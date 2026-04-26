/**
 * Helpers para preparar o texto que vai dentro do card visual do post.
 *
 * Princípio: card é arte (texto curto, escaneável). Legenda é desenvolvimento
 * completo, fora da imagem. Quando a IA devolve `card_copy` repetindo a
 * `caption` (eco de legenda), reduzimos para uma versão visual.
 *
 * Este helper roda no FRONTEND, na inicialização do editor — não altera
 * o conteúdo persistido no banco. Somente o que é exibido/editado na arte.
 *
 * Limites práticos:
 *  - Post único: 12-26 palavras / ~180 chars (máx. 2 frases curtas)
 *  - Carrossel: 8-22 palavras por slide / ~140 chars (máx. 2 frases)
 */

import { cleanText } from "./textCleanup";

const SINGLE_MAX_CHARS = 200;
const SINGLE_MAX_SENTENCES = 2;
const SLIDE_MAX_CHARS = 160;
const SLIDE_MAX_SENTENCES = 2;

/** Tokeniza em sentenças simples respeitando . ! ? e quebras de linha. */
function splitSentences(text: string): string[] {
  if (!text) return [];
  // Quebra por . ! ? mantendo o sinal de pontuação no item anterior.
  const raw = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÚÇ"'(¿¡])/u);
  return raw.map((s) => s.trim()).filter(Boolean);
}

function wordCount(s: string): number {
  return (s.match(/\S+/g) || []).length;
}

/**
 * Normaliza similaridade leve para comparação (lower, sem acento, sem
 * pontuação/espaços extras). Retorna apenas as primeiras N palavras.
 */
function normalizeForCompare(s: string, takeWords = 12): string {
  const lower = (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = lower.split(" ").filter(Boolean);
  return words.slice(0, takeWords).join(" ");
}

/** Detecta se duas strings têm início significativamente igual. */
function startsAlmostTheSame(a: string, b: string, takeWords = 10): boolean {
  if (!a || !b) return false;
  const na = normalizeForCompare(a, takeWords);
  const nb = normalizeForCompare(b, takeWords);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Mesmo prefixo grande (>= 8 palavras)
  const aw = na.split(" ");
  const bw = nb.split(" ");
  let same = 0;
  for (let i = 0; i < Math.min(aw.length, bw.length); i++) {
    if (aw[i] === bw[i]) same++;
    else break;
  }
  return same >= 8;
}

/**
 * Reduz uma string longa pegando as N primeiras sentenças até caber no
 * limite de caracteres. Garante que termine em pontuação razoável.
 */
function takeShort(text: string, maxChars: number, maxSentences: number): string {
  const cleaned = (text || "").trim();
  if (!cleaned) return "";
  if (cleaned.length <= maxChars && wordCount(cleaned) <= 30) return cleaned;

  const sentences = splitSentences(cleaned);
  if (sentences.length === 0) return cleaned.slice(0, maxChars).trim();

  let out = "";
  let used = 0;
  for (const s of sentences) {
    if (used >= maxSentences) break;
    const candidate = out ? `${out} ${s}` : s;
    if (candidate.length > maxChars && out) break;
    out = candidate;
    used++;
    if (out.length >= maxChars) break;
  }

  if (!out) {
    // Pega 1ª sentença mesmo que longa, mas trunca em palavra inteira
    out = sentences[0];
  }
  if (out.length > maxChars) {
    const slice = out.slice(0, maxChars);
    const lastSpace = slice.lastIndexOf(" ");
    out = (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim();
    if (!/[.!?…]$/.test(out)) out = out.replace(/[,;:\-—–]+$/, "") + "…";
  }
  return out.trim();
}

/**
 * Prepara a copy do card para POST ÚNICO.
 *
 * Regras:
 * 1) Se houver `cardCopy[0]` curto e diferente da legenda → usa ele direto.
 * 2) Se `cardCopy[0]` for praticamente igual à legenda OU muito longo → reduz.
 * 3) Se não houver `cardCopy[0]`, deriva uma versão curta da legenda (ou tema).
 */
export function prepareSinglePostCardCopy(opts: {
  cardCopy?: string[];
  caption?: string;
  theme?: string;
}): string[] {
  const caption = cleanText(opts.caption || "");
  const theme = cleanText(opts.theme || "");
  const first = cleanText(opts.cardCopy?.[0] || "");

  // 1) Card curto e distinto da legenda — preserva
  if (first && first.length <= SINGLE_MAX_CHARS && !startsAlmostTheSame(first, caption)) {
    return [first];
  }

  // 2) Card é eco da legenda OU grande demais → reduz a partir do primeiro slide
  if (first) {
    const short = takeShort(first, SINGLE_MAX_CHARS, SINGLE_MAX_SENTENCES);
    if (short && !startsAlmostTheSame(short, caption)) return [short];
  }

  // 3) Sem card_copy aproveitável: deriva da legenda; se vazia, usa tema
  if (caption) {
    const derived = takeShort(caption, SINGLE_MAX_CHARS, SINGLE_MAX_SENTENCES);
    if (derived) return [derived];
  }
  if (theme) return [theme];
  return [""];
}

/**
 * Prepara a copy do card para CARROSSEL.
 *
 * Regras:
 * - Mantém o número de slides original.
 * - Compacta cada slide ao limite (≤ ~160 chars / 2 frases).
 * - Se a legenda inteira foi colada num único slide, reduz mesmo assim.
 * - Para slides praticamente idênticos à legenda, mantém apenas a 1ª frase.
 */
export function prepareCarouselCardCopy(opts: {
  cardCopy?: string[];
  caption?: string;
}): string[] {
  const caption = cleanText(opts.caption || "");
  const slides = (opts.cardCopy || []).map((s) => cleanText(s || ""));
  if (slides.length === 0) return [];

  return slides.map((raw) => {
    if (!raw) return "";
    const short = takeShort(raw, SLIDE_MAX_CHARS, SLIDE_MAX_SENTENCES);
    if (caption && startsAlmostTheSame(short, caption)) {
      // Só primeira frase para evitar eco direto da legenda
      const first = splitSentences(short)[0] || short;
      return takeShort(first, SLIDE_MAX_CHARS, 1);
    }
    return short;
  }).filter((s) => s.length > 0);
}

/**
 * Decide tamanho de fonte inicial mais adequado em função do tamanho
 * do texto. Usado quando o card ainda for longo após a normalização.
 */
export function suggestBodyFontSize(text: string, baseSize: number, isReels = false): number {
  const len = (text || "").length;
  const min = isReels ? 32 : 28;
  const max = baseSize;
  if (len <= 80) return max;
  if (len <= 140) return Math.max(min, max - 4);
  if (len <= 200) return Math.max(min, max - 8);
  return min;
}
