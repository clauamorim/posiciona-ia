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
  /**
   * Formato do post no editorial: "carrossel" gera 7 cards (cover + 5 + close).
   * "post" (qualquer valor que não seja carrossel) gera 1 card único do tipo
   * close, que tem slots de título + corpo + CTA — adequado pra peça única.
   */
  format?: string;
  /** Legenda completa do post, usada como fallback do body em post único. */
  caption?: string;
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

// ROMAN é o único default ESTRUTURAL (derivado do índice 1..5, não tem
// equivalente no conteúdo do post). Os outros campos (countWord, footer,
// closeEyebrow, kicker, eyebrow, topic, title da cláusula) ficam vazios
// quando o post não traz o dado — o componente renderiza slot vazio
// editável em vez de texto-exemplo do template. Sem isso, frases como
// "Cinco", "arraste para começar" e "FECHAMENTO" vazavam como se
// fossem conteúdo real, criando a sensação de mistura entre
// linha editorial e demonstração do template.
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

  // ── Post único (não-carrossel) ────────────────────────────────────
  // Gera APENAS 1 card do tipo "close" (que tem slots de título + corpo
  // + CTA + sobretítulo). Cover seria errado porque cover não tem slot
  // de body — perderíamos o texto principal da peça.
  const isCarrossel = (input.format || "").toLowerCase() === "carrossel";
  if (!isCarrossel) {
    const singleClose: CardData = {
      kind: "close",
      eyebrow: meta?.closeEyebrow ?? "",
      title: input.title ?? "",
      body: (copy[0] || input.caption || meta?.closeBody || "").trim(),
      cta: input.cta ?? "",
    };
    return [singleClose];
  }

  // ── Cover (índice 0) ──────────────────────────────────────────────
  const cover: CardData = {
    kind: "cover",
    eyebrow: meta?.eyebrow ?? "",
    kicker: meta?.kicker ?? "",
    countWord: meta?.countWord ?? "",
    titleLead: input.title ?? "",
    titleTail: meta?.titleTail ?? "",
    footer: meta?.footer ?? "",
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
    eyebrow: meta?.closeEyebrow ?? "",
    title: copy[6] ?? "",
    body: meta?.closeBody ?? "",
    cta: input.cta ?? "",
  };

  return [cover, ...clauses, close];
}
