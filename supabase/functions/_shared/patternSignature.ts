// Extração de "moldes narrativos abstratos" (signatures) de posts de feed
// já gerados, usando Claude Haiku como classificador barato. Essas signatures
// são persistidas em `_dedup_metrics._pattern_signatures` de cada semana e
// usadas como RESTRIÇÃO NEGATIVA na geração da próxima semana — o sistema
// aprende padrões saturados da própria voz do usuário, sem hardcode.

import { callClaude } from "./claudeClient.ts";
import { extractJsonFromLLM } from "./jsonExtract.ts";

// Taxonomia canônica — Haiku deve escolher tags APENAS desta lista.
// Tags fora dessa lista são descartadas no pós-processamento.
export const CANONICAL_TAGS = {
  openers: [
    "gancho_ano_evento_historico",
    "gancho_pergunta_recorrente",
    "gancho_dado_pesquisa",
    "gancho_anedota_primeira_pessoa",
    "gancho_observacao_clinica",
    "gancho_conselho_circulante",
    "gancho_paradoxo_imediato",
    "gancho_definicao_contraste",
    "gancho_situacao_hipotetica",
    "gancho_critica_pratica_comum",
  ],
  structures: [
    "estrutura_framework_numerico",
    "estrutura_case_empresa_analogia",
    "estrutura_mito_refutacao",
    "estrutura_caso_pessoal_licao",
    "estrutura_diagnostico_perguntas",
    "estrutura_comparacao_alternativas",
    "estrutura_lista_horizontal",
    "estrutura_definicao_contraste",
    "estrutura_observacao_extrapolada",
  ],
  closers: [
    "fechamento_cta_acionavel",
    "fechamento_pergunta_aberta",
    "fechamento_reflexao_implicita",
    "fechamento_redefinicao_conceito",
    "fechamento_salvar_post",
  ],
} as const;

export const ALL_CANONICAL_TAGS = new Set<string>([
  ...CANONICAL_TAGS.openers,
  ...CANONICAL_TAGS.structures,
  ...CANONICAL_TAGS.closers,
]);

export interface PostSignature {
  day: number;
  signature: string;
  tags: string[];
}

const SIGNATURE_SYSTEM_PROMPT = `Você é um analista editorial. Sua tarefa é extrair o MOLDE ESTRUTURAL/NARRATIVO de cada post — NÃO o tema.

Para cada post, retorne:
1. signature: 1 frase descrevendo o MOLDE (não o tema)
2. tags: EXATAMENTE 3 tags — uma de cada categoria abaixo, escolhidas LITERALMENTE da lista canônica:

## TAGS DE GANCHO (escolher EXATAMENTE 1):
${CANONICAL_TAGS.openers.join("\n")}

## TAGS DE ESTRUTURA (escolher EXATAMENTE 1):
${CANONICAL_TAGS.structures.join("\n")}

## TAGS DE FECHAMENTO (escolher EXATAMENTE 1):
${CANONICAL_TAGS.closers.join("\n")}

REGRAS ABSOLUTAS:
- USE APENAS tags da lista acima. NÃO invente, NÃO crie variantes, NÃO inclua números específicos.
- Sempre exatamente 3 tags por post: 1 gancho + 1 estrutura + 1 fechamento.
- Se o post não bater perfeitamente com nenhuma opção, escolha a MAIS PRÓXIMA da lista.
- IGNORE o tema/assunto. Foque apenas no molde estrutural.

Exemplos de mapeamento:
- "Os 4 cortes que aplico..." → estrutura = estrutura_framework_numerico (NÃO "framework_4_cortes")
- "Os 7 sinais que leio..." → estrutura = estrutura_framework_numerico (mesmo tag, número não importa)
- "Em 2018, a Bayer comprou Monsanto..." → gancho = gancho_ano_evento_historico, estrutura = estrutura_case_empresa_analogia

Retorne JSON: { "signatures": [{ "day": N, "signature": "...", "tags": ["tag1", "tag2", "tag3"] }, ...] }`;

export async function extractSignaturesForWeek(
  posts: Array<{ day: number; theme?: string; caption?: string; card_copy?: string[]; script?: string }>,
): Promise<PostSignature[]> {
  if (!posts || posts.length === 0) return [];

  const userText = `# POSTS DA SEMANA PARA ANALISAR

${posts.map((p) => `
## DIA ${p.day}
TEMA: ${p.theme || ""}
LEGENDA: ${(p.caption || "").slice(0, 600)}
CARDS: ${Array.isArray(p.card_copy) ? p.card_copy.slice(0, 5).map((c) => `• ${c}`).join("\n") : ""}
${p.script ? `ROTEIRO: ${p.script.slice(0, 400)}` : ""}
`).join("\n---\n")}

Extraia o molde estrutural de cada um. Retorne JSON.`;

  try {
    const raw = await callClaude({
      systemPrompt: SIGNATURE_SYSTEM_PROMPT,
      userText,
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1200,
      timeoutMs: 30000,
      disableRetries: true,
    });
    const parsed = extractJsonFromLLM(raw) as any;
    const sigs = parsed?.signatures;
    if (!Array.isArray(sigs)) return [];
    return sigs
      .filter((s: any) => typeof s?.day === "number" && typeof s?.signature === "string" && Array.isArray(s?.tags))
      .map((s: any) => ({
        day: Number(s.day),
        signature: String(s.signature).slice(0, 300),
        // Manter APENAS tags canônicas — descarta variantes inventadas pelo Haiku
        tags: s.tags
          .map((t: any) => String(t).toLowerCase().slice(0, 50))
          .filter((t: string) => ALL_CANONICAL_TAGS.has(t))
          .slice(0, 4),
      }))
      .filter((s: PostSignature) => s.tags.length > 0);
  } catch (e: any) {
    console.warn("[pattern-signature] extraction falhou:", e?.message || e);
    return [];
  }
}

export interface ProhibitionThresholds {
  openers: number;     // default 3
  structures: number;  // default 3
  closers: number;     // default 4 (categoria com menos opções, threshold mais permissivo)
}

export const DEFAULT_PROHIBITION_THRESHOLDS: ProhibitionThresholds = {
  openers: 3,
  structures: 3,
  closers: 4,
};

/**
 * Identifica tags saturadas, aplicando threshold específico por categoria.
 * Categoria é inferida pelo prefixo da tag (gancho_*, estrutura_*, fechamento_*).
 */
export function findProhibitedTags(
  historicalSignaturesByWeek: Array<{ weekIndex: number; signatures: PostSignature[] }>,
  thresholds: ProhibitionThresholds = DEFAULT_PROHIBITION_THRESHOLDS,
): Array<{ tag: string; occurrences: number; weeks: number[] }> {
  const tagWeeks = new Map<string, Set<number>>();

  for (const week of historicalSignaturesByWeek) {
    for (const sig of week.signatures) {
      for (const tag of sig.tags) {
        if (!tagWeeks.has(tag)) tagWeeks.set(tag, new Set());
        tagWeeks.get(tag)!.add(week.weekIndex);
      }
    }
  }

  const result: Array<{ tag: string; occurrences: number; weeks: number[] }> = [];
  for (const [tag, weeks] of tagWeeks) {
    let threshold: number;
    if (tag.startsWith("gancho_")) threshold = thresholds.openers;
    else if (tag.startsWith("estrutura_")) threshold = thresholds.structures;
    else if (tag.startsWith("fechamento_")) threshold = thresholds.closers;
    else threshold = 3;

    if (weeks.size >= threshold) {
      result.push({ tag, occurrences: weeks.size, weeks: Array.from(weeks).sort((a, b) => a - b) });
    }
  }
  return result.sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Renderiza bloco de instrução pra injetar no prompt do feed da próxima geração.
 */
export function renderProhibitedMoldsBlock(
  historicalSignaturesByWeek: Array<{ weekIndex: number; signatures: PostSignature[] }>,
  prohibitedTags: Array<{ tag: string; occurrences: number; weeks: number[] }>,
): string {
  if (prohibitedTags.length === 0) return "";

  const examplesByTag = new Map<string, string[]>();
  for (const week of historicalSignaturesByWeek) {
    for (const sig of week.signatures) {
      for (const tag of sig.tags) {
        if (prohibitedTags.some((pt) => pt.tag === tag)) {
          if (!examplesByTag.has(tag)) examplesByTag.set(tag, []);
          if (examplesByTag.get(tag)!.length < 3) {
            examplesByTag.get(tag)!.push(`S${week.weekIndex} DIA ${sig.day}: "${sig.signature}"`);
          }
        }
      }
    }
  }

  const prohibitionLines = prohibitedTags.slice(0, 10).map((pt) => {
    const exs = examplesByTag.get(pt.tag) || [];
    return `- ${pt.tag} (${pt.occurrences} ocorrências em S${pt.weeks.slice(-3).join(", S")}):
  Exemplos: ${exs.slice(0, 2).join(" | ")}`;
  }).join("\n");

  return `

# MOLDES ESTRUTURAIS PROIBIDOS — REGRA INEGOCIÁVEL

Os moldes narrativos abaixo foram usados 3+ vezes nas últimas 8 semanas e estão SATURADOS. NENHUM dos 4 posts desta semana pode reproduzir nenhum deles. NÃO basta trocar o tema — a ESTRUTURA NARRATIVA precisa mudar.

${prohibitionLines}

REGRA: se algum post desta semana acionar qualquer desses moldes, será regerado. Use estruturas diferentes:
- Em vez de "framework numérico", use observação clínica direta ou definição por contraste
- Em vez de "case histórico de empresa", use anedota presente, comparação contemporânea entre concorrentes, ou pergunta sobre dado real do nicho
- Em vez de "mito → refutação", use experimento mental ou checklist específico
- Varie tipo de gancho, varie estrutura interna, varie tipo de fechamento

Diversifique o MOLDE, não só o assunto.`;
}
