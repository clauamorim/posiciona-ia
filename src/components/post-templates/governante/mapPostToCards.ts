// Mapeia o conteúdo atual do editor (card_copy + title + cta + meta opcional)
// para o array de 7 CardData esperado pelo SertaoCard.
//
// Estratégia determinística (sem IA): cada slot vem da meta quando disponível,
// senão cai no conteúdo default vindo do manifest (SERTAO_CONTENT_DEFAULTS).

import type { CardData, ClauseSlots, CloseSlots, CoverSlots } from "./types";
import { SERTAO_CONTENT_DEFAULTS as D } from "./tokens";

export interface MapPostInput {
  card_copy?: string[];
  title?: string;
  cta?: string;
  meta?: {
    eyebrow?: string;
    kicker?: string;
    countWord?: string;
    topic?: string[];
    titles?: string[];
  };
}

export function mapPostToCards(input: MapPostInput): CardData[] {
  const copy = input.card_copy ?? [];
  const meta = input.meta;

  // ── Cover (índice 0) ──────────────────────────────────────────────
  const coverDefault = D[0] as { kind: "cover" } & CoverSlots;
  const cover: CardData = {
    kind: "cover",
    eyebrow: meta?.eyebrow ?? coverDefault.eyebrow,
    kicker: meta?.kicker ?? coverDefault.kicker,
    countWord: meta?.countWord ?? coverDefault.countWord,
    titleLead: input.title ?? coverDefault.titleLead,
    titleTail: coverDefault.titleTail,
    footer: coverDefault.footer,
  };

  // ── Cláusulas (índices 1..5) ──────────────────────────────────────
  const clauses: CardData[] = [];
  for (let i = 0; i < 5; i++) {
    const def = D[i + 1] as { kind: "clause" } & ClauseSlots;
    clauses.push({
      kind: "clause",
      num: def.num,
      roman: def.roman,
      topic: meta?.topic?.[i] ?? def.topic,
      title: meta?.titles?.[i] ?? def.title,
      body: copy[i + 1] ?? def.body,
    });
  }

  // ── Fechamento (índice 6) ─────────────────────────────────────────
  const closeDefault = D[6] as { kind: "close" } & CloseSlots;
  const close: CardData = {
    kind: "close",
    eyebrow: closeDefault.eyebrow,
    title: copy[6] ?? closeDefault.title,
    body: closeDefault.body,
    cta: input.cta ?? closeDefault.cta,
  };

  return [cover, ...clauses, close];
}
