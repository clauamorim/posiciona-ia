/**
 * Templates fixos para o editor de posts.
 *
 * Cada template define posições iniciais para os elementos do canvas
 * (logo, retrato, faixa decorativa, número do slide, CTA) e o tipo
 * de slide a que se aplica.
 *
 * Formatos:
 *   - card  → 1080×1350 (4:5, padrão Instagram feed)
 *   - reels → 1080×1920 (9:16, capa de Reels)
 */

import type { OverlayImage } from "@/components/post-editor/PostToolbar";

export type TemplateKind = "cover" | "content" | "minimal" | "cta";
// "square" é mantido como alias para compatibilidade com states salvos antes
// da migração para 4:5 — internamente sempre usamos 1080×1350 quando não-reels.
export type CanvasFormat = "square" | "reels";

export interface TemplateLayout {
  kind: TemplateKind;
  format: CanvasFormat;
  decorativeBlock?: {
    x: number; y: number; width: number; height: number;
    paletteIndex: number;
    opacity?: number;
  } | null;
  logoSlot?: { x: number; y: number; width: number; height: number } | null;
  portraitSlot?: { x: number; y: number; width: number; height: number } | null;
  titleSlot?: { x: number; y: number; width: number; fontSize: number; align: "left" | "center" | "right" };
  bodySlot?: { x: number; y: number; width: number; fontSize: number; align: "left" | "center" | "right" };
  ctaSlot?: { x: number; y: number; fontSize: number };
  slideNumberSlot?: { x: number; y: number; size: number; show: boolean };
  backgroundOverlay?: boolean;
}

// Card 4:5 (Instagram feed)
const CARD_W = 1080;
const CARD_H = 1350;
// Reels 9:16
const REELS_W = 1080;
const REELS_H = 1920;

// Logo padrão: canto inferior direito, com margem segura
const CARD_LOGO = { x: CARD_W - 200, y: CARD_H - 200, width: 140, height: 140 };
const REELS_LOGO = { x: REELS_W - 220, y: REELS_H - 240, width: 160, height: 160 };

// =====================
// Templates 4:5 (CARD)
// =====================

const CARD_TEMPLATES: Record<TemplateKind, TemplateLayout> = {
  cover: {
    kind: "cover",
    format: "square",
    backgroundOverlay: true,
    decorativeBlock: null,
    logoSlot: CARD_LOGO,
    portraitSlot: null,
    // Título e corpo subidos para liberar a área da logo (canto inf. direito)
    // e respeitar margem inferior segura (~280px).
    titleSlot: { x: 80, y: 760, width: 920, fontSize: 64, align: "left" },
    bodySlot: { x: 80, y: 970, width: 880, fontSize: 38, align: "left" },
    slideNumberSlot: { x: CARD_W - 80, y: 80, size: 14, show: false },
  },
  content: {
    kind: "content",
    format: "square",
    decorativeBlock: { x: 0, y: 0, width: 24, height: CARD_H, paletteIndex: 1, opacity: 1 },
    logoSlot: CARD_LOGO,
    portraitSlot: null,
    titleSlot: { x: 100, y: 280, width: 880, fontSize: 56, align: "left" },
    bodySlot: { x: 100, y: 600, width: 880, fontSize: 40, align: "left" },
    slideNumberSlot: { x: CARD_W - 100, y: 1240, size: 16, show: true },
  },
  minimal: {
    kind: "minimal",
    format: "square",
    decorativeBlock: null,
    logoSlot: CARD_LOGO,
    portraitSlot: null,
    // Minimal: título e corpo CENTRALIZADOS (PostCanvas já força isso quando postStyle === "minimal").
    titleSlot: { x: 120, y: 420, width: 840, fontSize: 62, align: "center" },
    bodySlot: { x: 140, y: 780, width: 800, fontSize: 40, align: "center" },
    slideNumberSlot: { x: CARD_W / 2, y: 1250, size: 14, show: true },
  },
  cta: {
    kind: "cta",
    format: "square",
    decorativeBlock: { x: 0, y: 0, width: CARD_W, height: CARD_H, paletteIndex: 1, opacity: 1 },
    logoSlot: CARD_LOGO,
    portraitSlot: null,
    titleSlot: { x: 80, y: 480, width: 920, fontSize: 66, align: "center" },
    bodySlot: { x: 80, y: 700, width: 920, fontSize: 38, align: "center" },
    ctaSlot: { x: CARD_W / 2, y: 1020, fontSize: 32 },
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
    decorativeBlock: null,
    logoSlot: REELS_LOGO,
    portraitSlot: null,
    titleSlot: { x: 80, y: 1180, width: 920, fontSize: 76, align: "left" },
    bodySlot: { x: 80, y: 1480, width: 920, fontSize: 46, align: "left" },
    slideNumberSlot: { x: 0, y: 0, size: 14, show: false },
  },
  content: {
    kind: "content",
    format: "reels",
    decorativeBlock: { x: 0, y: 0, width: 32, height: REELS_H, paletteIndex: 1, opacity: 1 },
    logoSlot: REELS_LOGO,
    portraitSlot: null,
    titleSlot: { x: 100, y: 380, width: 880, fontSize: 72, align: "left" },
    bodySlot: { x: 100, y: 660, width: 880, fontSize: 50, align: "left" },
    slideNumberSlot: { x: REELS_W - 100, y: 1820, size: 18, show: true },
  },
  minimal: {
    kind: "minimal",
    format: "reels",
    decorativeBlock: null,
    logoSlot: REELS_LOGO,
    portraitSlot: null,
    titleSlot: { x: 120, y: 540, width: 840, fontSize: 78, align: "center" },
    bodySlot: { x: 140, y: 1100, width: 800, fontSize: 48, align: "center" },
    slideNumberSlot: { x: REELS_W / 2, y: 1820, size: 16, show: true },
  },
  cta: {
    kind: "cta",
    format: "reels",
    decorativeBlock: { x: 0, y: 0, width: REELS_W, height: REELS_H, paletteIndex: 1, opacity: 1 },
    logoSlot: REELS_LOGO,
    portraitSlot: null,
    titleSlot: { x: 80, y: 720, width: 920, fontSize: 80, align: "center" },
    bodySlot: { x: 80, y: 1000, width: 920, fontSize: 48, align: "center" },
    ctaSlot: { x: REELS_W / 2, y: 1380, fontSize: 38 },
    slideNumberSlot: { x: 0, y: 0, size: 14, show: false },
  },
};

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
  const set = opts.format === "reels" ? REELS_TEMPLATES : CARD_TEMPLATES;
  if (opts.isCover || opts.slideIndex === 0) return set.cover;
  if (opts.isLast && opts.hasCta) return set.cta;
  const hash = opts.weekIndex * 31 + opts.dayIndex * 7 + opts.slideIndex;
  return hash % 2 === 0 ? set.content : set.minimal;
}

export function pickSingleTemplate(opts: {
  weekIndex: number;
  dayIndex: number;
  format: CanvasFormat;
  hasCta?: boolean;
  style?: "minimal" | "unsplash" | "ai";
}): TemplateLayout {
  const set = opts.format === "reels" ? REELS_TEMPLATES : CARD_TEMPLATES;
  if (opts.style === "minimal") return set.minimal;
  if (opts.style === "unsplash" || opts.style === "ai") return set.cover;
  const hash = opts.weekIndex * 31 + opts.dayIndex * 7;
  return hash % 2 === 0 ? set.minimal : set.content;
}

export function buildDecorativeBlockOverlay(
  template: TemplateLayout,
  paletteHex: string,
): OverlayImage | null {
  if (!template.decorativeBlock) return null;
  const block = template.decorativeBlock;
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

export function buildBackgroundImageOverlay(
  imageUrl: string,
  format: CanvasFormat,
  withDarkOverlay = false,
): OverlayImage {
  const w = format === "reels" ? REELS_W : CARD_W;
  const h = format === "reels" ? REELS_H : CARD_H;
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
 * moldura interna + linha horizontal abaixo do bloco de texto + ornamento (losango).
 *
 * FRAME_INSET aumentado para evitar que o texto encoste na moldura.
 */
export function buildMinimalDecorativeOverlays(
  template: TemplateLayout,
  primaryHex: string,
  accentHex?: string,
  opts?: { onPhoto?: boolean; bodyBottomY?: number },
): OverlayImage[] {
  const isReels = template.format === "reels";
  const W = isReels ? REELS_W : CARD_W;
  const H = isReels ? REELS_H : CARD_H;
  const onPhoto = !!opts?.onPhoto;
  const accent = onPhoto ? "#ffffff" : (accentHex || primaryHex);
  const stroke = onPhoto ? "#ffffff" : primaryHex;
  const strokeOpacity = onPhoto ? 0.7 : 0.55;
  const accentOpacity = onPhoto ? 0.85 : 1;

  // Moldura interna com inset maior para garantir respiro do texto
  const FRAME_INSET = isReels ? 80 : 60;
  const frameW = W - FRAME_INSET * 2;
  const frameH = H - FRAME_INSET * 2;
  const frameSvg = `<svg width="${frameW}" height="${frameH}" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="${frameW - 2}" height="${frameH - 2}" fill="none" stroke="${stroke}" stroke-width="2" opacity="${strokeOpacity}"/></svg>`;
  const frame: OverlayImage = {
    id: `tpl-mframe-${crypto.randomUUID()}`,
    src: `data:image/svg+xml;base64,${btoa(frameSvg)}`,
    x: FRAME_INSET, y: FRAME_INSET, width: frameW, height: frameH,
    type: "element", opacity: 1,
  };

  // Linha horizontal decorativa SEMPRE abaixo do bloco de texto.
  const lineW = isReels ? 220 : 160;
  const lineH = 4;
  const lineX = (W - lineW) / 2;
  const fallbackLineY = isReels ? 1700 : 1180;
  const candidateY = opts?.bodyBottomY != null ? opts.bodyBottomY + 40 : fallbackLineY;
  // A linha precisa caber dentro da moldura E acima da logo (canto inf. direito)
  const logoTop = isReels ? REELS_LOGO.y : CARD_LOGO.y;
  const maxLineY = Math.min(H - FRAME_INSET - 80, logoTop - 60);
  const lineY = Math.min(candidateY, maxLineY);
  const lineSvg = `<svg width="${lineW}" height="${lineH}" xmlns="http://www.w3.org/2000/svg"><rect width="${lineW}" height="${lineH}" fill="${accent}" opacity="${accentOpacity}"/></svg>`;
  const line: OverlayImage = {
    id: `tpl-mline-${crypto.randomUUID()}`,
    src: `data:image/svg+xml;base64,${btoa(lineSvg)}`,
    x: lineX, y: lineY, width: lineW, height: lineH,
    type: "element", opacity: 1,
  };

  const dSize = 24;
  const dX = (W - dSize) / 2;
  const dY = lineY + 18;
  const dSvg = `<svg width="${dSize}" height="${dSize}" xmlns="http://www.w3.org/2000/svg"><polygon points="${dSize / 2},0 ${dSize},${dSize / 2} ${dSize / 2},${dSize} 0,${dSize / 2}" fill="${accent}" opacity="${accentOpacity}"/></svg>`;
  const ornament: OverlayImage = {
    id: `tpl-mornament-${crypto.randomUUID()}`,
    src: `data:image/svg+xml;base64,${btoa(dSvg)}`,
    x: dX, y: dY, width: dSize, height: dSize,
    type: "element", opacity: 1,
  };

  return [frame, line, ornament];
}
