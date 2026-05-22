// Paleta, helpers e defaults do arquétipo Governante.
// Extraído de design-sources/governante/cards-data.jsx + manifest.json.

import type { CSSProperties } from "react";
import type { CardData, Format, SertaoTokens } from "./types";

// ── Paleta ──────────────────────────────────────────────────────────────
export const VERDE = "#1B3A2D";
export const OURO = "#C9A84C";
export const AREIA = "#F5F0E8";
export const GRAFITE = "#2C2C2C";
export const MOGNO = "#8B4513";
export const VERDE_INK = "#102016";
export const AREIA_TINT = "#EEE7D7";
export const OURO_INK = "#A98933";

export const PALETTE = {
  verde: VERDE,
  ouro: OURO,
  areia: AREIA,
  grafite: GRAFITE,
  mogno: MOGNO,
  verdeInk: VERDE_INK,
  areiaTint: AREIA_TINT,
  ouroInk: OURO_INK,
} as const;

// ── Formatos (preview no editor) ────────────────────────────────────────
export const FORMATS: Record<Format, { w: number; h: number; label: string }> = {
  "4:5": { w: 540, h: 675, label: "4:5  ·  1080×1350" },
  "9:16": { w: 540, h: 960, label: "9:16 ·  1080×1920" },
};

// ── Helpers tipográficos ────────────────────────────────────────────────
export function peTinyCaps(color: string, size = 11): CSSProperties {
  return {
    fontFamily: '"Lato", sans-serif',
    fontWeight: 600,
    fontSize: size,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color,
  };
}

export function peBodyFontFor(key?: SertaoTokens["bodyFont"]): string {
  if (key === "lato") return '"Lato", sans-serif';
  if (key === "playfair") return '"Playfair Display", serif';
  return '"Cormorant Garamond", serif';
}

export function peRenderNum(
  num: string,
  style?: SertaoTokens["numberingStyle"],
): string {
  if (!num) return "";
  if (style === "bracketed") return `[ ${num} ]`;
  if (style === "roman") {
    const map: Record<string, string> = {
      "01": "I",
      "02": "II",
      "03": "III",
      "04": "IV",
      "05": "V",
    };
    return map[num] || num;
  }
  return num;
}

// ── Conteúdo default (do manifest.content_defaults.cards) ───────────────
// Usado pelo mapPostToCards como fallback enquanto a IA não devolve slots nativos.
export const SERTAO_CONTENT_DEFAULTS: CardData[] = [
  {
    kind: "cover",
    eyebrow: "POSICIONA EDITORIAL · DIREITO DO AGRO",
    kicker: "Cláusulas",
    countWord: "Sete",
    titleLead: "cláusulas de arrendamento rural",
    titleTail: "que eu releio antes de qualquer cliente assinar",
    footer: "arraste para começar",
  },
  {
    kind: "clause",
    num: "01",
    roman: "I",
    topic: "PRAZO",
    title: "Prazo e renovação automática",
    body: "Quem esquece de notificar, renova mais um ciclo inteiro.",
    detail:
      "Marque na agenda o prazo de notificação prévia. A omissão prorroga o contrato pelas mesmas condições — e travar a renovação depois custa caro.",
  },
  {
    kind: "clause",
    num: "02",
    roman: "II",
    topic: "REAJUSTE",
    title: "Sacas, arrobas ou índice fixo?",
    body: "Misturar critérios destrói a previsibilidade do contrato.",
    detail:
      "Escolha um único parâmetro de reajuste e fixe a fórmula. Combinações híbridas viram disputa sempre que o mercado oscila.",
  },
  {
    kind: "clause",
    num: "03",
    roman: "III",
    topic: "BENFEITORIAS",
    title: "Quem faz, quem paga, quem leva.",
    body: "Sem isso escrito, briga garantida no final do ciclo.",
    detail:
      "Classifique as benfeitorias em necessárias, úteis e voluptuárias. Defina indenização e direito de retenção antes da primeira obra.",
  },
  {
    kind: "clause",
    num: "04",
    roman: "IV",
    topic: "MEIO AMBIENTE",
    title: "Responsabilidade ambiental durante o arrendamento.",
    body: "É do dono da terra ou de quem produz nela? Defina antes.",
    detail:
      "O passivo ambiental persegue a matrícula. Estipule responsabilidades por licenciamento, reserva legal e eventuais autuações enquanto a posse está com o arrendatário.",
  },
  {
    kind: "clause",
    num: "05",
    roman: "V",
    topic: "RESCISÃO",
    title: "Rescisão antecipada.",
    body: "Aqui mora a maior parte das disputas que vejo no fórum.",
    detail:
      "Especifique hipóteses, prazos de notificação, multas e o destino da safra em curso. Sem isso, o juiz decide por você.",
  },
  {
    kind: "close",
    eyebrow: "FECHAMENTO",
    title: "Releia seu contrato esta semana.",
    body: "Sem pressa. Onde você travar, está o nó.",
    cta: "Salve para a próxima revisão.",
  },
];
