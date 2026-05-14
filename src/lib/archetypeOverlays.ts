// Decorativos por grupo de arquétipo gerados como OverlayImage[],
// de forma que o usuário possa mover, recolorir e deletar livremente
// (mesmo padrão dos elementos do AddElementPanel).

import type { OverlayImage } from "@/components/post-editor/PostToolbar";
import { getArchetypePalette } from "@/lib/archetypePalettes";
import type { TemplateLayout } from "@/lib/postTemplates";

const CARD_W = 1080;
const CARD_H = 1350;
const REELS_W = 1080;
const REELS_H = 1920;

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function buildArchetypeOverlays(
  primaryArchetype: string | null | undefined,
  template: TemplateLayout,
): OverlayImage[] {
  if (!primaryArchetype) return [];

  const palette = getArchetypePalette(primaryArchetype);
  const group = palette.group;
  const isReels = template.format === "reels";
  const W = isReels ? REELS_W : CARD_W;
  const H = isReels ? REELS_H : CARD_H;
  const overlays: OverlayImage[] = [];

  if (group === "elegance") {
    const cornerSize = 140;
    const inset = 60;
    const stroke = 2;
    const color = palette.accent;

    const tl = `<svg width="${cornerSize}" height="${cornerSize}" xmlns="http://www.w3.org/2000/svg"><path d="M ${cornerSize} ${stroke / 2} L ${stroke / 2} ${stroke / 2} L ${stroke / 2} ${cornerSize}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/></svg>`;
    overlays.push({
      id: `tpl-arch-bracket-tl-${crypto.randomUUID()}`,
      src: svgDataUrl(tl),
      x: inset, y: inset, width: cornerSize, height: cornerSize,
      type: "element", opacity: 1,
    });

    const br = `<svg width="${cornerSize}" height="${cornerSize}" xmlns="http://www.w3.org/2000/svg"><path d="M 0 ${cornerSize - stroke / 2} L ${cornerSize - stroke / 2} ${cornerSize - stroke / 2} L ${cornerSize - stroke / 2} 0" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/></svg>`;
    overlays.push({
      id: `tpl-arch-bracket-br-${crypto.randomUUID()}`,
      src: svgDataUrl(br),
      x: W - inset - cornerSize, y: H - inset - cornerSize, width: cornerSize, height: cornerSize,
      type: "element", opacity: 1,
    });

    const lineW = 240;
    const lineH = 1.5;
    const line = `<svg width="${lineW}" height="${lineH}" xmlns="http://www.w3.org/2000/svg"><rect width="${lineW}" height="${lineH}" fill="${color}"/></svg>`;
    overlays.push({
      id: `tpl-arch-line-${crypto.randomUUID()}`,
      src: svgDataUrl(line),
      x: (W - lineW) / 2, y: isReels ? 700 : 520,
      width: lineW, height: lineH,
      type: "element", opacity: 0.7,
    });
  }

  if (group === "energy") {
    const color = palette.accent;

    const stripeW = Math.round(W * 1.3);
    const stripeH = Math.round(H * 0.08);
    const stripe = `<svg width="${stripeW}" height="${stripeH}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible"><g transform="rotate(-4 ${stripeW / 2} ${stripeH / 2})"><rect width="${stripeW}" height="${stripeH}" fill="${color}"/></g></svg>`;
    overlays.push({
      id: `tpl-arch-stripe-${crypto.randomUUID()}`,
      src: svgDataUrl(stripe),
      x: -Math.round(W * 0.1), y: -Math.round(stripeH * 0.4),
      width: stripeW, height: stripeH,
      type: "element", opacity: 0.92,
    });

    const triSize = 72;
    const tri = `<svg width="${triSize}" height="${triSize}" xmlns="http://www.w3.org/2000/svg"><polygon points="${triSize},0 ${triSize},${triSize} 0,${triSize}" fill="${color}"/></svg>`;
    overlays.push({
      id: `tpl-arch-triangle-${crypto.randomUUID()}`,
      src: svgDataUrl(tri),
      x: W - triSize - 80, y: H - triSize - 200,
      width: triSize, height: triSize,
      type: "element", opacity: 0.9,
    });
  }

  if (group === "warmth") {
    const primary = palette.accent;
    const secondary = palette.secondary;

    const blobSize = Math.round(Math.min(W, H) * 0.55);
    const blob = `<svg width="${blobSize}" height="${blobSize}" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg"><path d="M 200 40 C 290 50, 360 130, 350 220 C 340 310, 260 370, 170 355 C 80 340, 30 250, 50 160 C 70 80, 130 30, 200 40 Z" fill="${primary}"/></svg>`;
    overlays.push({
      id: `tpl-arch-blob-${crypto.randomUUID()}`,
      src: svgDataUrl(blob),
      x: -Math.round(blobSize * 0.3), y: H - Math.round(blobSize * 0.7),
      width: blobSize, height: blobSize,
      type: "element", opacity: 0.28,
    });

    const curveW = 300;
    const curveH = 32;
    const curve = `<svg width="${curveW}" height="${curveH}" xmlns="http://www.w3.org/2000/svg"><path d="M 0 ${curveH / 2} Q ${curveW / 4} 0, ${curveW / 2} ${curveH / 2} T ${curveW} ${curveH / 2}" fill="none" stroke="${secondary}" stroke-width="3" stroke-linecap="round"/></svg>`;
    overlays.push({
      id: `tpl-arch-curve-${crypto.randomUUID()}`,
      src: svgDataUrl(curve),
      x: (W - curveW) / 2, y: isReels ? 750 : 560,
      width: curveW, height: curveH,
      type: "element", opacity: 0.85,
    });
  }

  if (group === "lightness") {
    const c1 = palette.accent;
    const c2 = palette.secondary;
    const c3 = palette.critical;

    const margin = 80;
    const big = 56;
    const med = 40;
    const small = 28;

    const circ = (size: number, color: string) =>
      `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${color}"/></svg>`;

    overlays.push({
      id: `tpl-arch-circ1-${crypto.randomUUID()}`,
      src: svgDataUrl(circ(big, c1)),
      x: W - margin - big, y: margin,
      width: big, height: big,
      type: "element", opacity: 0.9,
    });
    overlays.push({
      id: `tpl-arch-circ2-${crypto.randomUUID()}`,
      src: svgDataUrl(circ(med, c2)),
      x: W - margin - big - med, y: margin + big - 10,
      width: med, height: med,
      type: "element", opacity: 0.9,
    });
    overlays.push({
      id: `tpl-arch-circ3-${crypto.randomUUID()}`,
      src: svgDataUrl(circ(small, c3)),
      x: W - margin - big - med - small + 6, y: margin - 14,
      width: small, height: small,
      type: "element", opacity: 0.85,
    });

    const dot = 18;
    overlays.push({
      id: `tpl-arch-dot-${crypto.randomUUID()}`,
      src: svgDataUrl(circ(dot, c1)),
      x: 100, y: H - 220,
      width: dot, height: dot,
      type: "element", opacity: 0.5,
    });
  }

  return overlays;
}
