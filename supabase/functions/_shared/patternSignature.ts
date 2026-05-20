// Extração de "moldes narrativos abstratos" (signatures) de posts de feed
// já gerados, usando Claude Haiku como classificador barato. Essas signatures
// são persistidas em `_dedup_metrics._pattern_signatures` de cada semana e
// usadas como RESTRIÇÃO NEGATIVA na geração da próxima semana — o sistema
// aprende padrões saturados da própria voz do usuário, sem hardcode.

import { callClaude } from "./claudeClient.ts";
import { extractJsonFromLLM } from "./jsonExtract.ts";

export interface PostSignature {
  day: number;
  /** Descrição free-form do molde estrutural (1 frase, sem tema). */
  signature: string;
  /** Tags categóricas em snake_case para comparação determinística. */
  tags: string[];
}

const SIGNATURE_SYSTEM_PROMPT = `Você é um analista editorial. Sua tarefa é extrair o MOLDE ESTRUTURAL/NARRATIVO de cada post — NÃO o tema.

Para cada post, retorne:
1. signature: descrição em 1 frase do MOLDE NARRATIVO (não do tema). Foque em:
   - Tipo de gancho de abertura (ano histórico nomeado, número, pergunta, comparação, anedota pessoal, dado, etc.)
   - Estrutura narrativa interna (case → analogia, framework numerado, mito → refutação, definição → contraste, etc.)
   - Tipo de fechamento (CTA específico, pergunta aberta, reflexão, etc.)

2. tags: 2-4 tags categóricas curtas em snake_case que classificam o molde (ex: "framework_numerico_4_elementos", "caso_empresa_historica_com_analogia", "mito_refutacao", "pergunta_abertura", "anedota_primeira_pessoa", "comparacao_concorrente")

REGRAS:
- IGNORE o tema/assunto do post. Foque APENAS no molde estrutural.
- Use tags genéricas o suficiente pra capturar repetições futuras (ex: "framework_numerico_N" agnostic ao número).
- Se um post mistura múltiplos moldes, escolha o DOMINANTE.

Retorne APENAS JSON válido no formato:
{ "signatures": [{ "day": 1, "signature": "...", "tags": [...] }, ...] }`;

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
        tags: s.tags.map((t: any) => String(t).toLowerCase().slice(0, 50)).slice(0, 6),
      }));
  } catch (e: any) {
    console.warn("[pattern-signature] extraction falhou:", e?.message || e);
    return [];
  }
}

/**
 * Analisa histórico de signatures e identifica tags que aparecem
 * em N ou mais semanas distintas (= padrão saturado).
 */
export function findProhibitedTags(
  historicalSignaturesByWeek: Array<{ weekIndex: number; signatures: PostSignature[] }>,
  minOccurrences: number = 3,
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
    if (weeks.size >= minOccurrences) {
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
