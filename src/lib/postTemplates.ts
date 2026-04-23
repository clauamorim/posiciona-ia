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
    // No solid decorative block — readability comes from the gradient overlay
    // rendered by PostCanvas itself when there is a photo background.
    decorativeBlock: null,
    logoSlot: { x: 60, y: 60, width: 160, height: 160 },
    portraitSlot: null,
    // Slots subidos para deixar respiro no rodapé (antes y=800/940)
    titleSlot: { x: 80, y: 620, width: 920, fontSize: 60, align: "left" },
    bodySlot: { x: 80, y: 820, width: 920, fontSize: 26, align: "left" },
    slideNumberSlot: { x: SQUARE_W - 80, y: 80, size: 14, show: false },
  },
  content: {
    kind: "content",
    format: "square",
    decorativeBlock: { x: 0, y: 0, width: 24, height: SQUARE_H, paletteIndex: 1, opacity: 1 },
    logoSlot: { x: SQUARE_W - 200, y: 60, width: 140, height: 140 },
    portraitSlot: null,
    titleSlot: { x: 100, y: 240, width: 880, fontSize: 54, align: "left" },
    bodySlot: { x: 100, y: 540, width: 880, fontSize: 30, align: "left" },
    slideNumberSlot: { x: SQUARE_W - 90, y: 980, size: 16, show: true },
  },
  minimal: {
    kind: "minimal",
    format: "square",
    // Linha decorativa REAL — agora gerenciada por buildMinimalDecorativeOverlays
    decorativeBlock: null,
    logoSlot: { x: SQUARE_W / 2 - 80, y: 100, width: 160, height: 160 },
    portraitSlot: null,
    titleSlot: { x: 120, y: 340, width: 840, fontSize: 60, align: "center" },
    bodySlot: { x: 140, y: 660, width: 800, fontSize: 28, align: "center" },
    slideNumberSlot: { x: SQUARE_W / 2, y: 990, size: 14, show: true },
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
    // paletteIndex 2 para contraste claro com gradiente
    decorativeBlock: { x: 0, y: 1380, width: REELS_W, height: 540, paletteIndex: 2, opacity: 0.85 },
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
    decorativeBlock: null,
    logoSlot: { x: REELS_W / 2 - 90, y: 160, width: 180, height: 180 },
    portraitSlot: null,
    titleSlot: { x: 120, y: 540, width: 840, fontSize: 78, align: "center" },
    bodySlot: { x: 140, y: 1100, width: 800, fontSize: 34, align: "center" },
    slideNumberSlot: { x: REELS_W / 2, y: 1820, size: 16, show: true },
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
  /** Se for "minimal", força template minimal para garantir slots e moldura coerentes. */
  style?: "minimal" | "unsplash" | "ai";
}): TemplateLayout {
  const set = opts.format === "reels" ? REELS_TEMPLATES : SQUARE_TEMPLATES;
  // Quando o usuário escolheu minimal, sempre usar slots minimais
  if (opts.style === "minimal") return set.minimal;
  // Estilos com foto (unsplash/ai) usam o template "cover" — slots otimizados
  // para sobreposição de gradiente preto translúcido na base.
  if (opts.style === "unsplash" || opts.style === "ai") return set.cover;
  // Sem estilo definido: alterna por hash (comportamento legado)
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

/**
 * Constrói um conjunto de overlays decorativos para o estilo "minimal":
 * moldura interna + linha horizontal abaixo do título + ornamento (losango).
 * Retorna array (e não único bloco) — substitui buildDecorativeBlockOverlay no estilo minimal.
 */
export function buildMinimalDecorativeOverlays(
  template: TemplateLayout,
  primaryHex: string,
  accentHex?: string,
): OverlayImage[] {
  const isReels = template.format === "reels";
  const W = isReels ? REELS_W : SQUARE_W;
  const H = isReels ? REELS_H : SQUARE_H;
  const accent = accentHex || primaryHex;

  // 1) Moldura interna
  const FRAME_INSET = isReels ? 60 : 40;
  const frameW = W - FRAME_INSET * 2;
  const frameH = H - FRAME_INSET * 2;
  const frameSvg = `<svg width="${frameW}" height="${frameH}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="${frameW - 2}" height="${frameH - 2}" fill="none" stroke="${primaryHex}" stroke-width="2" opacity="0.55"/></svg>`;
  const frame: OverlayImage = {
    id: `tpl-mframe-${crypto.randomUUID()}`,
    src: `data:image/svg+xml;base64,${btoa(frameSvg)}`,
    x: FRAME_INSET, y: FRAME_INSET, width: frameW, height: frameH,
    type: "element", opacity: 1,
  };

  // 2) Linha horizontal decorativa entre título e corpo
  const lineW = isReels ? 220 : 160;
  const lineH = 4;
  const lineX = (W - lineW) / 2;
  // Square: título termina ~440 (340 + 60*1.6), corpo começa em 660 → linha em 540
  // Reels: título termina ~720 (540 + 78*1.6*1.5 linhas), corpo em 1100 → linha em 880
  const lineY = isReels ? 880 : 540;
  const lineSvg = `<svg width="${lineW}" height="${lineH}" xmlns="http://www.w3.org/2000/svg"><rect width="${lineW}" height="${lineH}" fill="${accent}"/></svg>`;
  const line: OverlayImage = {
    id: `tpl-mline-${crypto.randomUUID()}`,
    src: `data:image/svg+xml;base64,${btoa(lineSvg)}`,
    x: lineX, y: lineY, width: lineW, height: lineH,
    type: "element", opacity: 1,
  };

  // 3) Ornamento losango logo abaixo da linha
  const dSize = 24;
  const dX = (W - dSize) / 2;
  const dY = isReels ? 920 : 580;
  const dSvg = `<svg width="${dSize}" height="${dSize}" xmlns="http://www.w3.org/2000/svg"><polygon points="${dSize / 2},0 ${dSize},${dSize / 2} ${dSize / 2},${dSize} 0,${dSize / 2}" fill="${accent}" opacity="0.85"/></svg>`;
  const ornament: OverlayImage = {
    id: `tpl-mornament-${crypto.randomUUID()}`,
    src: `data:image/svg+xml;base64,${btoa(dSvg)}`,
    x: dX, y: dY, width: dSize, height: dSize,
    type: "element", opacity: 1,
  };

  return [frame, line, ornament];
}
