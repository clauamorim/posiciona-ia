// Mapeia o conteúdo atual do editor (card_copy + title + cta + meta opcional)
// para o array de 7 CardData esperado pelo SertaoCard.
//
// IMPORTANTE: defaults TEMÁTICOS (textos sobre Direito do Agro, "Sete cláusulas
// de arrendamento rural", "PRAZO", "REAJUSTE"…) foram REMOVIDOS para evitar
// que conteúdo de demonstração vaze nos posts reais. Slots não preenchidos
// pelo post agora retornam string vazia; o SertaoCard renderiza placeholder
// editável. Quando a IA passar a devolver slots nativos (eyebrow, kicker,
// topic, titles), basta plugar em `meta` e o mapper já preenche.

import type { CardData } from "./types";

export interface MapPostInput {
  card_copy?: string[];
  title?: string;
  cta?: string;
  meta?: {
    eyebrow?: string;
    kicker?: string;
    countWord?: string;
    titleTail?: string;
    footer?: string;
    closeEyebrow?: string;
    closeBody?: string;
    topic?: string[];
    titles?: string[];
  };
}

// Defaults ESTRUTURAIS (neutros, não-temáticos) — usados apenas como
// rótulos de navegação/ritmo, não como conteúdo.
const NUMBER_WORD: Record<number, string> = {
  1: "Uma",
  2: "Duas",
  3: "Três",
  4: "Quatro",
  5: "Cinco",
  6: "Seis",
  7: "Sete",
};
const ROMAN: Record<number, string> = {
  1: "I",
  2: "II",
  3: "III",
  4: "IV",
  5: "V",
};

export function mapPostToCards(input: MapPostInput): CardData[] {
  const copy = input.card_copy ?? [];
  const meta = input.meta;
  const clauseCount = 5;

  // ── Cover (índice 0) ──────────────────────────────────────────────
  const cover: CardData = {
    kind: "cover",
    eyebrow: meta?.eyebrow ?? "",
    kicker: meta?.kicker ?? "",
    countWord: meta?.countWord ?? (NUMBER_WORD[clauseCount] || ""),
    titleLead: input.title ?? "",
    titleTail: meta?.titleTail ?? "",
    footer: meta?.footer ?? "arraste para começar",
  };

  // ── Cláusulas (índices 1..5) ──────────────────────────────────────
  const clauses: CardData[] = [];
  for (let i = 0; i < clauseCount; i++) {
    const n = i + 1;
    clauses.push({
      kind: "clause",
      num: String(n).padStart(2, "0"),
      roman: ROMAN[n],
      topic: meta?.topic?.[i] ?? "",
      title: meta?.titles?.[i] ?? "",
      body: copy[i + 1] ?? "",
    });
  }

  // ── Fechamento (índice 6) ─────────────────────────────────────────
  const close: CardData = {
    kind: "close",
    eyebrow: meta?.closeEyebrow ?? "FECHAMENTO",
    title: copy[6] ?? "",
    body: meta?.closeBody ?? "",
    cta: input.cta ?? "",
  };

  return [cover, ...clauses, close];
}
