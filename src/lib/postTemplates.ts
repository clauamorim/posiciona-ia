/**
 * Templates fixos para o editor de posts.
 *
 * Cada template define posições iniciais para os elementos do canvas
 * (logo, retrato, faixa decorativa, número do slide, CTA) e o tipo
 * de slide a que se aplica.
 *
 * A escolha do template é determinística por (weekIndex + dayIndex + slideIndex).
 */

import type { OverlayImage } from "@/components/post-editor/PostToolbar";

export type TemplateKind = "cover" | "content" | "minimal" | "cta";
export type CanvasFormat = "square" | "reels";

export interface TemplateLayout {
  kind: TemplateKind;
  format: CanvasFormat;
  /** Bloco decorativo de cor (faixa lateral / inferior). null = sem bloco. */
  decorativeBlock?: {
    x: number; y: number; width: number; height: number;
    paletteIndex: number; // qual cor usar (índice da paleta)
    opacity?: number;
  } | null;
  /** Posição da logo na composição. */
  logoSlot?: { x: number; y: number; width: number; height: number } | null;
  /** Posição opcional de retrato. */
  portraitSlot?: { x: number; y: number; width: number; height: number } | null;
  /** Configuração do título (override da posição padrão). */
  titleSlot?: { x: number; y: number; width: number; fontSize: number; align: "left" | "center" | "right" };
  /** Configuração do corpo de texto. */
  bodySlot?: { x: number; y: number; width: number; fontSize: number; align: "left" | "center" | "right" };
  /** Posição do CTA (somente em templates `cta`). */
  ctaSlot?: { x: number; y: number; fontSize: number };
  /** Posição do número do slide. */
  slideNumberSlot?: { x: number; y: number; size: number; show: boolean };
  /** Imagem de fundo translúcida sobreposta? Se true, escurece a imagem. */
  backgroundOverlay?: boolean;
}

const SQUARE_W = 1080;
const SQUARE_H = 1080;
const REELS_W = 1080;
const REELS_H = 1920;

// =====================
// Templates QUADRADO
// =====================

const SQUARE_TEMPLATES: Record<TemplateKind, TemplateLayout> = {
  cover: {
    kind: "cover",
    format: "square",
    backgroundOverlay: true,
    // paletteIndex 2 (geralmente cor escura/contraste) ao invés de 0 (primária) para destacar do gradiente
    decorativeBlock: { x: 0, y: 760, width: SQUARE_W, height: 320, paletteIndex: 2, opacity: 0.85 },
    logoSlot: { x: 60, y: 60, width: 160, height: 160 },
    portraitSlot: null,
    titleSlot: { x: 80, y: 800, width: 920, fontSize: 64, align: "left" },
    bodySlot: { x: 80, y: 940, width: 920, fontSize: 26, align: "left" },
    slideNumberSlot: { x: SQUARE_W - 80, y: 80, size: 14, show: false },
  },
  content: {
    kind: "content",
    format: "square",
    decorativeBlock: { x: 0, y: 0, width: 24, height: SQUARE_H, paletteIndex: 1, opacity: 1 },
    logoSlot: { x: SQUARE_W - 200, y: 60, width: 140, height: 140 },
    portraitSlot: null,
    titleSlot: { x: 100, y: 200, width: 880, fontSize: 54, align: "left" },
    bodySlot: { x: 100, y: 520, width: 880, fontSize: 30, align: "left" },
    slideNumberSlot: { x: SQUARE_W - 90, y: 980, size: 16, show: true },
  },
  minimal: {
    kind: "minimal",
    format: "square",
    decorativeBlock: { x: 440, y: 680, width: 200, height: 6, paletteIndex: 1, opacity: 1 },
    logoSlot: { x: SQUARE_W / 2 - 70, y: 80, width: 140, height: 140 },
    portraitSlot: null,
    titleSlot: { x: 100, y: 280, width: 880, fontSize: 60, align: "center" },
    bodySlot: { x: 100, y: 720, width: 880, fontSize: 28, align: "center" },
    slideNumberSlot: { x: SQUARE_W / 2, y: 1010, size: 14, show: true },
  },
  cta: {
    kind: "cta",
    format: "square",
    decorativeBlock: { x: 0, y: 0, width: SQUARE_W, height: SQUARE_H, paletteIndex: 1, opacity: 1 },
    logoSlot: { x: SQUARE_W / 2 - 90, y: 100, width: 180, height: 180 },
    portraitSlot: null,
    titleSlot: { x: 80, y: 380, width: 920, fontSize: 64, align: "center" },
    bodySlot: { x: 80, y: 560, width: 920, fontSize: 28, align: "center" },
    ctaSlot: { x: SQUARE_W / 2, y: 820, fontSize: 32 },
    slideNumberSlot: { x: 0, y: 0, size: 14, show: false },
  },
};

// =====================
// Templates REELS (1080x1920)
// =====================

const REELS_TEMPLATES: Record<TemplateKind, TemplateLayout> = {
  cover: {
    kind: "cover",
    format: "reels",
    backgroundOverlay: true,
    decorativeBlock: { x: 0, y: 1380, width: REELS_W, height: 540, paletteIndex: 0, opacity: 0.9 },
    logoSlot: { x: 60, y: 80, width: 180, height: 180 },
    portraitSlot: null,
    titleSlot: { x: 80, y: 1440, width: 920, fontSize: 80, align: "left" },
    bodySlot: { x: 80, y: 1660, width: 920, fontSize: 32, align: "left" },
    slideNumberSlot: { x: 0, y: 0, size: 14, show: false },
  },
  content: {
    kind: "content",
    format: "reels",
    decorativeBlock: { x: 0, y: 0, width: 32, height: REELS_H, paletteIndex: 1, opacity: 1 },
    logoSlot: { x: REELS_W - 220, y: 80, width: 160, height: 160 },
    portraitSlot: null,
    titleSlot: { x: 100, y: 380, width: 880, fontSize: 72, align: "left" },
    bodySlot: { x: 100, y: 660, width: 880, fontSize: 38, align: "left" },
    slideNumberSlot: { x: REELS_W - 100, y: 1820, size: 18, show: true },
  },
  minimal: {
    kind: "minimal",
    format: "reels",
    decorativeBlock: { x: 420, y: 1120, width: 240, height: 8, paletteIndex: 1, opacity: 1 },
    logoSlot: { x: REELS_W / 2 - 80, y: 120, width: 160, height: 160 },
    portraitSlot: null,
    titleSlot: { x: 100, y: 480, width: 880, fontSize: 78, align: "center" },
    bodySlot: { x: 100, y: 1180, width: 880, fontSize: 34, align: "center" },
    slideNumberSlot: { x: REELS_W / 2, y: 1840, size: 16, show: true },
  },
  cta: {
    kind: "cta",
    format: "reels",
    decorativeBlock: { x: 0, y: 0, width: REELS_W, height: REELS_H, paletteIndex: 1, opacity: 1 },
    logoSlot: { x: REELS_W / 2 - 100, y: 200, width: 200, height: 200 },
    portraitSlot: null,
    titleSlot: { x: 80, y: 720, width: 920, fontSize: 80, align: "center" },
    bodySlot: { x: 80, y: 1000, width: 920, fontSize: 34, align: "center" },
    ctaSlot: { x: REELS_W / 2, y: 1380, fontSize: 38 },
    slideNumberSlot: { x: 0, y: 0, size: 14, show: false },
  },
};

/**
 * Escolhe um template determinístico para um slide.
 * - Slide 0 (capa) sempre = "cover"
 * - Slide é último = "cta"
 * - Caso contrário, alterna entre "content" e "minimal" baseado em hash determinístico.
 */
export function pickTemplate(opts: {
  weekIndex: number;
  dayIndex: number;
  slideIndex: number;
  totalSlides: number;
  format: CanvasFormat;
  isCover?: boolean;
  isLast?: boolean;
  hasCta?: boolean;
}): TemplateLayout {
  const set = opts.format === "reels" ? REELS_TEMPLATES : SQUARE_TEMPLATES;
  if (opts.isCover || opts.slideIndex === 0) return set.cover;
  if (opts.isLast && opts.hasCta) return set.cta;
  // Hash determinístico
  const hash = opts.weekIndex * 31 + opts.dayIndex * 7 + opts.slideIndex;
  return hash % 2 === 0 ? set.content : set.minimal;
}

/** Retorna o template para um slide isolado (não-carrossel). */
export function pickSingleTemplate(opts: {
  weekIndex: number;
  dayIndex: number;
  format: CanvasFormat;
  hasCta?: boolean;
}): TemplateLayout {
  const set = opts.format === "reels" ? REELS_TEMPLATES : SQUARE_TEMPLATES;
  // Single posts: alternar entre minimal e content baseado em hash
  const hash = opts.weekIndex * 31 + opts.dayIndex * 7;
  return hash % 2 === 0 ? set.minimal : set.content;
}

/** Cria um overlay de bloco decorativo a partir do template. */
export function buildDecorativeBlockOverlay(
  template: TemplateLayout,
  paletteHex: string,
): OverlayImage | null {
  if (!template.decorativeBlock) return null;
  const block = template.decorativeBlock;
  // Garantir tamanho mínimo visível (evita "barrinha" de 6px que some)
  const MIN_DIM = 80;
  const w = block.width < MIN_DIM && block.width < block.height ? Math.max(MIN_DIM, block.width) : block.width;
  const h = block.height < MIN_DIM && block.height < block.width ? Math.max(MIN_DIM, block.height) : block.height;
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="${paletteHex}"/></svg>`;
  const src = `data:image/svg+xml;base64,${btoa(svg)}`;
  return {
    id: `tpl-block-${crypto.randomUUID()}`,
    src,
    x: block.x,
    y: block.y,
    width: w,
    height: h,
    type: "element",
    opacity: block.opacity ?? 1,
  };
}

/** Cria um overlay de logo a partir do template. */
export function buildLogoOverlay(
  template: TemplateLayout,
  logoUrl: string,
): OverlayImage | null {
  if (!template.logoSlot || !logoUrl) return null;
  const slot = template.logoSlot;
  return {
    id: `tpl-logo-${crypto.randomUUID()}`,
    src: logoUrl,
    x: slot.x,
    y: slot.y,
    width: slot.width,
    height: slot.height,
    type: "logo",
    opacity: 1,
  };
}

/** Cria um overlay de imagem de fundo (cobre todo o canvas). */
export function buildBackgroundImageOverlay(
  imageUrl: string,
  format: CanvasFormat,
  withDarkOverlay = false,
): OverlayImage {
  const w = format === "reels" ? REELS_W : SQUARE_W;
  const h = format === "reels" ? REELS_H : SQUARE_H;
  return {
    id: `tpl-bg-${crypto.randomUUID()}`,
    src: imageUrl,
    x: 0,
    y: 0,
    width: w,
    height: h,
    type: "photo",
    opacity: withDarkOverlay ? 0.75 : 1,
  };
}
