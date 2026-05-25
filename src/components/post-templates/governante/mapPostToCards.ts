// Mapeia o conteúdo atual do editor (card_copy + title + cta + meta opcional)
// para o array de CardData esperado pelo SertaoCard.
//
// Estratégia: a IA hoje só devolve `title`, `card_copy[]`, `caption`, `cta` —
// não há `meta` editorial (eyebrow, kicker, countWord, topic[], titles[]).
// Para que o carrossel não fique com 80% dos slots vazios, sintetizamos
// defaults sensatos a partir do que existe (theme/title/copy). Quando o
// post passar a vir com `meta` real (fluxo futuro), os campos sobrescrevem
// os sintetizados.

import type { CardData } from "./types";

export interface MapPostInput {
  card_copy?: string[];
  title?: string;
  cta?: string;
  format?: string;
  caption?: string;
  /** Nome do negócio do usuário, usado para enriquecer eyebrow da capa. */
  brandName?: string;
  /** Rótulo de seção (ex. "CLÁUSULA"); usado para derivar `kicker` no plural. */
  sectionLabel?: string;
  meta?: {
    eyebrow?: string;
    kicker?: string;
    /**
     * Palavra-destaque que aparece gigante no centro da capa.
     * - Quando o post É numérico (ex: "5 dicas"), recebe o número por extenso
     *   ("Cinco"). Hoje preenchido por mapPostToCards via numberToPortuguese.
     * - Quando o post NÃO é numérico (ex: "Como leio um contrato…"), idealmente
     *   recebe uma palavra-resumo gerada pela IA junto com o copy (ex:
     *   "Contrato"). Enquanto o backend não devolver esse campo, caímos numa
     *   heurística client-side (extractThemeWord) que pega o primeiro
     *   substantivo significativo do título.
     */
    countWord?: string;
    titleTail?: string;
    footer?: string;
    closeEyebrow?: string;
    closeBody?: string;
    topic?: string[];
    titles?: string[];
  };
}

const ROMAN: Record<number, string> = {
  1: "I", 2: "II", 3: "III", 4: "IV", 5: "V",
  6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X",
};

const NUM_PT: Record<number, string> = {
  1: "Uma", 2: "Duas", 3: "Três", 4: "Quatro", 5: "Cinco",
  6: "Seis", 7: "Sete", 8: "Oito", 9: "Nove", 10: "Dez",
  11: "Onze", 12: "Doze", 13: "Treze", 14: "Quatorze", 15: "Quinze",
  16: "Dezesseis", 17: "Dezessete", 18: "Dezoito", 19: "Dezenove", 20: "Vinte",
};

function numberToPortuguese(n: number): string {
  return NUM_PT[n] ?? String(n);
}

// Stopwords PT-BR usadas pra pular palavras de função quando extraímos uma
// palavra-destaque do título. Mantém a lista enxuta — só palavras MUITO
// comuns. Substantivos genéricos (coisa, jeito, modo) ficam de fora porque
// às vezes carregam o conteúdo principal do título.
const PT_STOPWORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "uns", "umas",
  "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas",
  "por", "para", "pra", "com", "sem", "sobre", "ao", "aos", "à", "às",
  "que", "se", "ou", "e", "mas", "como", "quando", "onde", "porque",
  "é", "são", "foi", "ser", "tem", "ter", "vai", "ir", "está", "estar",
  "antes", "depois", "ainda", "já", "mais", "menos", "muito", "pouco",
  "meu", "minha", "seu", "sua", "meus", "minhas", "seus", "suas",
  "esse", "essa", "este", "esta", "isto", "isso", "aquilo", "aquele", "aquela",
  "nem", "também", "só", "apenas", "quase", "talvez", "agora", "hoje", "ontem",
  "5", "7", "10", "três", "cinco", "sete", "dez",
]);

/**
 * Extrai uma palavra-destaque do título quando o backend não devolve
 * `meta.countWord` explícito. Heurística simples: percorre as palavras do
 * título, pula stopwords/números, e retorna a primeira palavra com >=4
 * caracteres, capitalizada. Se nada bater, devolve string vazia (que vira
 * placeholder vazio — usuário edita à mão).
 */
function extractThemeWord(title?: string): string {
  if (!title) return "";
  const words = title
    .toLowerCase()
    .replace(/[^a-záàâãéêíóôõúç\s-]/gi, " ") // mantém letras + hífen
    .split(/\s+/)
    .filter(Boolean);
  for (const w of words) {
    if (PT_STOPWORDS.has(w)) continue;
    if (w.length < 4) continue;
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  return "";
}

/**
 * Detecta se o título carrega contagem numérica (ex: "5 cláusulas",
 * "as 7 dicas"). Se sim, devolve o número; caso contrário, null. Permite
 * decidir se usamos `numberToPortuguese(n)` ou `extractThemeWord(title)`.
 */
function detectTitleCount(title?: string): number | null {
  if (!title) return null;
  const m = title.match(/\b(\d{1,2})\b/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 2 && n <= 20) return n;
  }
  // Tenta também números por extenso comuns no início do título.
  const lower = title.toLowerCase();
  const wordToNum: Record<string, number> = {
    dois: 2, três: 3, quatro: 4, cinco: 5, seis: 6, sete: 7,
    oito: 8, nove: 9, dez: 10, onze: 11, doze: 12,
  };
  for (const [w, n] of Object.entries(wordToNum)) {
    if (new RegExp(`\\b${w}\\b`, "i").test(lower)) return n;
  }
  return null;
}

/** Pluraliza rótulos simples (CLÁUSULA → Cláusulas, PASSO → Passos). */
function pluralizeKicker(label: string): string {
  const cleaned = (label || "").trim();
  if (!cleaned) return "Cláusulas";
  // Title-case a primeira letra, restante minúsculo (CLÁUSULA → Cláusula).
  const titled = cleaned[0].toUpperCase() + cleaned.slice(1).toLowerCase();
  // Regras simples PT-BR.
  if (/ão$/i.test(titled)) return titled.replace(/ão$/i, "ões"); // SITUAÇÃO → Situações
  if (/m$/i.test(titled)) return titled.replace(/m$/i, "ns");    // ITEM → Itens
  if (/[rzs]$/i.test(titled)) return titled + "es";              // MULHER → Mulheres
  if (/al$/i.test(titled)) return titled.replace(/al$/i, "ais"); // CAPITAL → Capitais
  return titled + "s";
}

/**
 * Tenta dividir o texto de um slide em (topic, title, body).
 * Reconhece três padrões da IA:
 *   1. "TÓPICO: Título da cláusula. Corpo..."  → topic, title, body
 *   2. "Título curto.\nCorpo desenvolvido"      → "", title, body
 *   3. "Frase única."                            → "", "", body
 */
function splitSlide(raw: string): { topic: string; title: string; body: string } {
  const text = (raw || "").trim();
  if (!text) return { topic: "", title: "", body: "" };

  let working = text;
  let topic = "";

  // Padrão "TÓPICO: ..." (até ~24 chars, all caps + opcional acento, antes de ":")
  const topicMatch = working.match(/^([A-ZÀ-Ú0-9 ]{2,28}):\s+(.+)$/s);
  if (topicMatch) {
    topic = topicMatch[1].trim();
    working = topicMatch[2].trim();
  }

  // Split por quebra de linha primeiro (cobre "Título\nCorpo").
  const lineParts = working.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (lineParts.length >= 2) {
    return { topic, title: lineParts[0], body: lineParts.slice(1).join(" ") };
  }

  // Senão tenta separar por 1ª frase terminada em .!?: (e curta o suficiente
  // para parecer título — até 80 chars).
  const sentMatch = working.match(/^(.{1,80}?[.!?:])\s+(.+)$/s);
  if (sentMatch) {
    return { topic, title: sentMatch[1].replace(/[.:]$/, "").trim(), body: sentMatch[2].trim() };
  }

  // Texto curto único: vira só body para não inventar um título igual ao corpo.
  return { topic, title: "", body: working };
}

export function mapPostToCards(input: MapPostInput): CardData[] {
  const copy = input.card_copy ?? [];
  const meta = input.meta;
  const isCarrossel = (input.format || "").toLowerCase() === "carrossel";

  // ── Post único ────────────────────────────────────────────────────
  if (!isCarrossel) {
    return [{
      kind: "close",
      eyebrow: meta?.closeEyebrow ?? "",
      title: input.title ?? "",
      body: (copy[0] || input.caption || meta?.closeBody || "").trim(),
      cta: input.cta ?? "",
    }];
  }

  // ── Carrossel ─────────────────────────────────────────────────────
  // No carrossel, copy[0] é abertura (capa), copy[1..N-2] são cláusulas e
  // copy[N-1] é fechamento. Quando vierem menos slides, ajustamos.
  const total = copy.length;
  const clauseCopies = total >= 3 ? copy.slice(1, total - 1) : [];
  const closeCopy = total >= 2 ? copy[total - 1] : "";
  const clauseCount = clauseCopies.length || 5;

  const brand = (input.brandName || "Posiciona Editorial").trim();
  const sectionLabel = (input.sectionLabel || "CLÁUSULA").trim();

  // ── Cover ────────────────────────────────────────────────────────
  // Resolve `countWord` em três níveis de fallback:
  //   1. meta.countWord vindo do backend (ideal — palavra ou número gerado pela IA)
  //   2. Se o título tem contagem detectável ("5 cláusulas"), usa o número por extenso
  //   3. Senão, extrai uma palavra-destaque do título via heurística PT-BR
  // Quando todos falham, volta pra contagem de cláusulas (comportamento legado).
  const detectedCount = detectTitleCount(input.title);
  const resolvedCountWord =
    meta?.countWord
    || (detectedCount != null ? numberToPortuguese(detectedCount) : "")
    || extractThemeWord(input.title)
    || numberToPortuguese(clauseCount);
  const cover: CardData = {
    kind: "cover",
    eyebrow: meta?.eyebrow || brand.toUpperCase(),
    kicker: meta?.kicker || pluralizeKicker(sectionLabel),
    countWord: resolvedCountWord,
    titleLead: input.title ?? "",
    titleTail: meta?.titleTail ?? "",
    body: copy[0] ?? "",
    footer: meta?.footer || "arraste para começar",
  };

  // ── Clauses ──────────────────────────────────────────────────────
  const clauses: CardData[] = [];
  for (let i = 0; i < clauseCount; i++) {
    const n = i + 1;
    const split = splitSlide(clauseCopies[i] ?? "");
    clauses.push({
      kind: "clause",
      num: String(n).padStart(2, "0"),
      roman: ROMAN[n],
      topic: meta?.topic?.[i] || split.topic,
      title: meta?.titles?.[i] || split.title,
      body: split.body,
    });
  }

  // ── Close ────────────────────────────────────────────────────────
  const close: CardData = {
    kind: "close",
    eyebrow: meta?.closeEyebrow || "FECHAMENTO",
    title: closeCopy || "",
    body: meta?.closeBody ?? "",
    cta: input.cta ?? "",
  };

  return [cover, ...clauses, close];
}
