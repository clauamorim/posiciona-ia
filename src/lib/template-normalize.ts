// Normaliza o `state` salvo de um template/design legado (1080×1080 quadrado)
// para o canvas atual (1080×1350 ou 1080×1920).
//
// Ao invés de "esticar" cegamente os SVGs decorativos antigos (o que criava
// linhas verticais/horizontais perdidas e molduras coladas nas laterais),
// esta camada faz duas coisas:
//
//   1) Define uma ÁREA SEGURA por formato (margem lateral generosa) e
//      reposiciona `tpl-frame-*`, `tpl-line-*`, `tpl-accent-*` dentro dela.
//   2) Para cada `tpl-frame-{archetype}` gera novamente o SVG com elementos
//      decorativos ancorados nos cantos/bordas da área segura, mantendo a
//      identidade visual de cada arquétipo (Governante, Explorador, Rebelde,
//      Cuidador, Sábio, Mago, Inocente, Amante, Herói, Criador, Cara-comum,
//      Bobo-da-corte) sem distorções.

const TEMPLATE_DECOR_RE = /^tpl-(mframe|frame|mline|line|mornament|ornament|block|accent)/;

function encodeBase64(str: string): string {
  if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(str)));
  return Buffer.from(str, "utf-8").toString("base64");
}

// =====================================================================
// Área segura por formato (em px sobre o canvas alvo).
// =====================================================================
function getSafeArea(toW: number, toH: number) {
  const isReels = toH >= 1700; // 1080×1920
  const isPortrait = toH > toW;
  // Lateral mais generosa para não colar a moldura na borda.
  const sideX = isReels ? 110 : isPortrait ? 100 : 60;
  const topY = isReels ? 160 : isPortrait ? 120 : 60;
  const bottomY = isReels ? 200 : isPortrait ? 160 : 60;
  return {
    x: sideX,
    y: topY,
    width: toW - sideX * 2,
    height: toH - topY - bottomY,
  };
}

// =====================================================================
// Geradores de SVG por arquétipo. Cada função recebe a largura/altura
// da MOLDURA (área segura) e devolve um SVG já dimensionado.
// Trabalham no espaço do próprio overlay (0..W, 0..H).
// =====================================================================
type FrameBuilder = (W: number, H: number) => string;

const wrap = (W: number, H: number, body: string) =>
  `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

const FRAME_BUILDERS: Record<string, FrameBuilder> = {
  governante: (W, H) => {
    const c = "#c8a84b";
    const tickLen = Math.min(80, W * 0.16);
    const top = Math.min(120, H * 0.1);
    const bot = H - top;
    return wrap(W, H, `
      <rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.75"/>
      <line x1="0" y1="${top}" x2="${tickLen}" y2="${top}" stroke="${c}" stroke-width="1.5" opacity="0.85"/>
      <line x1="${W - tickLen}" y1="${top}" x2="${W}" y2="${top}" stroke="${c}" stroke-width="1.5" opacity="0.85"/>
      <line x1="0" y1="${bot}" x2="${tickLen}" y2="${bot}" stroke="${c}" stroke-width="1.5" opacity="0.85"/>
      <line x1="${W - tickLen}" y1="${bot}" x2="${W}" y2="${bot}" stroke="${c}" stroke-width="1.5" opacity="0.85"/>
    `);
  },
  explorador: (W, H) => {
    const c = "#4db8ff";
    const len = Math.min(220, Math.min(W, H) * 0.22);
    return wrap(W, H, `
      <line x1="2" y1="2" x2="${len}" y2="2" stroke="${c}" stroke-width="2.5" opacity="0.85"/>
      <line x1="2" y1="2" x2="2" y2="${len}" stroke="${c}" stroke-width="2.5" opacity="0.85"/>
      <line x1="${W - len}" y1="${H - 2}" x2="${W - 2}" y2="${H - 2}" stroke="${c}" stroke-width="2.5" opacity="0.85"/>
      <line x1="${W - 2}" y1="${H - len}" x2="${W - 2}" y2="${H - 2}" stroke="${c}" stroke-width="2.5" opacity="0.85"/>
    `);
  },
  heroi: (W, H) => {
    const c = "#ff3b3b";
    const len = Math.min(320, Math.min(W, H) * 0.32);
    return wrap(W, H, `
      <line x1="0" y1="0" x2="${len}" y2="0" stroke="${c}" stroke-width="3.5"/>
      <line x1="0" y1="0" x2="0" y2="${len}" stroke="${c}" stroke-width="3.5"/>
      <line x1="${W - len}" y1="${H}" x2="${W}" y2="${H}" stroke="${c}" stroke-width="3.5"/>
      <line x1="${W}" y1="${H - len}" x2="${W}" y2="${H}" stroke="${c}" stroke-width="3.5"/>
    `);
  },
  cuidador: (W, H) => {
    const c = "#52b788";
    const r = Math.min(28, Math.min(W, H) * 0.04);
    const top = Math.min(90, H * 0.07);
    return wrap(W, H, `
      <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="${r}" ry="${r}" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.65"/>
      <circle cx="${W / 2}" cy="${top}" r="4" fill="${c}" opacity="0.7"/>
      <circle cx="${W / 2 - 16}" cy="${top}" r="3" fill="${c}" opacity="0.4"/>
      <circle cx="${W / 2 + 16}" cy="${top}" r="3" fill="${c}" opacity="0.4"/>
    `);
  },
  mago: (W, H) => {
    const c = "#b388ff";
    const dotY = H - Math.min(80, H * 0.07);
    return wrap(W, H, `
      <rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.45"/>
      <polygon points="${W / 2},20 ${W - 20},${H - 20} 20,${H - 20}" fill="none" stroke="${c}" stroke-width="1" opacity="0.2"/>
      <circle cx="${W / 2}" cy="${dotY}" r="6" fill="${c}" opacity="0.75"/>
    `);
  },
  sabio: (W, H) => {
    const c = "#c4a870";
    const sideY1 = Math.min(140, H * 0.12);
    const sideY2 = H - Math.min(140, H * 0.12);
    const lineY = H - Math.min(120, H * 0.1);
    const dotY = H - Math.min(80, H * 0.07);
    return wrap(W, H, `
      <rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="none" stroke="${c}" stroke-width="1.2" opacity="0.55"/>
      <line x1="2" y1="${sideY1}" x2="2" y2="${sideY2}" stroke="${c}" stroke-width="1.5" opacity="0.6"/>
      <line x1="2" y1="${lineY}" x2="160" y2="${lineY}" stroke="${c}" stroke-width="1.5" opacity="0.7"/>
      <rect x="${W / 2 - 80}" y="${dotY - 18}" width="160" height="2" fill="${c}" opacity="0.55"/>
      <circle cx="${W / 2}" cy="${dotY}" r="4" fill="none" stroke="${c}" stroke-width="1" opacity="0.6"/>
    `);
  },
  amante: (W, H) => {
    const c = "#c97b8a";
    const cx = W / 2, cy = H / 2;
    const rx = W / 2 - 10, ry = H / 2 - 10;
    const lineY = H - Math.min(100, H * 0.08);
    return wrap(W, H, `
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="${c}" stroke-width="1" opacity="0.3"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx * 0.82}" ry="${ry * 0.82}" fill="none" stroke="${c}" stroke-width="0.8" opacity="0.18"/>
      <line x1="${cx - 200}" y1="${lineY}" x2="${cx + 200}" y2="${lineY}" stroke="${c}" stroke-width="1.2" opacity="0.5"/>
      <circle cx="${cx}" cy="${lineY}" r="5" fill="${c}" opacity="0.7"/>
    `);
  },
  rebelde: (W, H) => {
    // Rebelde tem `tpl-accent-rebelde` (acento vertical) e `tpl-line-rebelde`
    // (linha horizontal) como overlays separados; a moldura é apenas um
    // marco fino no canto superior direito.
    const c = "#ff2d2d";
    const len = Math.min(260, Math.min(W, H) * 0.25);
    return wrap(W, H, `
      <line x1="${W - len}" y1="2" x2="${W - 2}" y2="2" stroke="${c}" stroke-width="3"/>
      <line x1="${W - 2}" y1="2" x2="${W - 2}" y2="${len}" stroke="${c}" stroke-width="3"/>
    `);
  },
  criador: (W, H) => {
    const c = "#e07b39";
    const len = Math.min(140, Math.min(W, H) * 0.14);
    const lineY = H - Math.min(110, H * 0.09);
    return wrap(W, H, `
      <line x1="0" y1="0" x2="${len}" y2="0" stroke="${c}" stroke-width="3"/>
      <line x1="0" y1="0" x2="0" y2="${len}" stroke="${c}" stroke-width="3"/>
      <rect x="0" y="${lineY}" width="160" height="2" fill="${c}" opacity="0.6"/>
    `);
  },
  caracomum: (W, H) => {
    const c = "#2d7dd2";
    const r = Math.min(10, Math.min(W, H) * 0.012);
    const lineY = H - Math.min(100, H * 0.08);
    return wrap(W, H, `
      <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="${r}" ry="${r}" fill="none" stroke="${c}" stroke-width="2" opacity="0.45"/>
      <line x1="${W / 2 - 240}" y1="${lineY}" x2="${W / 2 + 240}" y2="${lineY}" stroke="${c}" stroke-width="2" opacity="0.5"/>
    `);
  },
  inocente: (W, H) => {
    const c = "#f5c842";
    const cx = W / 2, cy = H / 2;
    const r = Math.min(W, H) / 2 - 10;
    const dotY = H - Math.min(90, H * 0.07);
    return wrap(W, H, `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-width="1.5" opacity="0.4"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.82}" fill="none" stroke="${c}" stroke-width="1" opacity="0.25"/>
      <circle cx="${cx}" cy="${dotY}" r="5" fill="${c}" opacity="0.8"/>
    `);
  },
  bobo: (W, H) => {
    const c1 = "#ffdd57";
    const c2 = "#ff6b9d";
    const c3 = "#66ffdd";
    const r = Math.min(40, Math.min(W, H) * 0.04);
    const lineY = H - Math.min(110, H * 0.09);
    return wrap(W, H, `
      <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="${r}" ry="${r}" fill="none" stroke="${c1}" stroke-width="2" opacity="0.5"/>
      <circle cx="${Math.min(150, W * 0.15)}" cy="${Math.min(150, H * 0.12)}" r="60" fill="none" stroke="${c2}" stroke-width="1" opacity="0.25"/>
      <circle cx="${W - Math.min(150, W * 0.15)}" cy="${H - Math.min(150, H * 0.12)}" r="80" fill="none" stroke="${c3}" stroke-width="1" opacity="0.25"/>
      <line x1="${Math.min(100, W * 0.1)}" y1="${lineY}" x2="${Math.min(300, W * 0.3)}" y2="${lineY}" stroke="${c1}" stroke-width="3" opacity="0.7"/>
    `);
  },
};

function archetypeKeyFromId(id: string): string | null {
  const m = id.match(/^tpl-(?:frame|line|accent)-([a-z0-9-]+)/i);
  if (!m) return null;
  return m[1].toLowerCase().replace(/-/g, "");
}

// =====================================================================
// Reposicionamento de elementos auxiliares (tpl-line-*, tpl-accent-*)
// dentro da área segura.
// =====================================================================
type AuxBuilder = (safe: { x: number; y: number; width: number; height: number }) =>
  { x: number; y: number; width: number; height: number; src: string };

const AUX_BUILDERS: Record<string, AuxBuilder> = {
  "tpl-line-governante": (safe) => {
    const W = 200, H = 4;
    const svg = wrap(W, H, `<line x1="0" y1="2" x2="${W}" y2="2" stroke="#c8a84b" stroke-width="2"/>`);
    return {
      x: safe.x + 40,
      y: safe.y + safe.height - 240,
      width: W,
      height: H,
      src: `data:image/svg+xml;base64,${encodeBase64(svg)}`,
    };
  },
  "tpl-line-rebelde": (safe) => {
    const W = safe.width, H = 4;
    const svg = wrap(W, H, `<rect width="${W}" height="${H}" fill="#ff2d2d" opacity="0.5"/>`);
    return {
      x: safe.x,
      y: safe.y + safe.height - 60,
      width: W,
      height: H,
      src: `data:image/svg+xml;base64,${encodeBase64(svg)}`,
    };
  },
  "tpl-accent-rebelde": (safe) => {
    const W = 8, H = safe.height;
    const svg = wrap(W, H, `<rect width="${W}" height="${H}" fill="#ff2d2d"/>`);
    return {
      x: safe.x,
      y: safe.y,
      width: W,
      height: H,
      src: `data:image/svg+xml;base64,${encodeBase64(svg)}`,
    };
  },
  "tpl-accent-explorador": (safe) => {
    const W = 6, H = Math.round(safe.height * 0.42);
    const svg = wrap(W, H, `<rect width="3" height="${H}" fill="#4db8ff" opacity="0.7"/>`);
    return {
      x: safe.x + 20,
      y: safe.y + Math.round(safe.height * 0.32),
      width: W,
      height: H,
      src: `data:image/svg+xml;base64,${encodeBase64(svg)}`,
    };
  },
};

// =====================================================================
// Normalização principal
// =====================================================================
export interface NormalizeOptions {
  fromW?: number;
  fromH?: number;
  rewriteSvgs?: boolean;
}

export function normalizeTemplateStateForCanvas(
  state: any,
  toW: number,
  toH: number,
  opts: NormalizeOptions = {}
): any {
  if (!state || typeof state !== "object") return state;
  const fromW = opts.fromW ?? (typeof state.canvasWidth === "number" ? state.canvasWidth : 1080);
  const fromH = opts.fromH ?? (typeof state.canvasHeight === "number" ? state.canvasHeight : 1080);
  if (!fromW || !fromH) return state;

  const safe = getSafeArea(toW, toH);
  const sx = toW / fromW;
  const sy = toH / fromH;

  const next: any = { ...state, canvasWidth: toW, canvasHeight: toH };

  if (Array.isArray(state.overlayImages)) {
    next.overlayImages = state.overlayImages.map((o: any) => {
      if (!o || typeof o !== "object") return o;

      // Background full-canvas: força nova dimensão de canvas.
      if (typeof o.id === "string" && o.id.startsWith("tpl-bg-")) {
        return { ...o, x: 0, y: 0, width: toW, height: toH };
      }

      const id: string = typeof o.id === "string" ? o.id : "";

      // Frame por arquétipo: regenera SVG ancorado na área segura.
      if (id.startsWith("tpl-frame-")) {
        const archKey = archetypeKeyFromId(id);
        const builder = archKey ? FRAME_BUILDERS[archKey] : null;
        if (builder) {
          const svg = builder(safe.width, safe.height);
          return {
            ...o,
            x: safe.x,
            y: safe.y,
            width: safe.width,
            height: safe.height,
            src: `data:image/svg+xml;base64,${encodeBase64(svg)}`,
          };
        }
      }

      // Auxiliares conhecidos (linha/acento por arquétipo).
      if (AUX_BUILDERS[id]) {
        const built = AUX_BUILDERS[id](safe);
        return { ...o, ...built };
      }

      // Genérico: escala não-uniforme simples.
      return {
        ...o,
        x: typeof o.x === "number" ? Math.round(o.x * sx) : o.x,
        y: typeof o.y === "number" ? Math.round(o.y * sy) : o.y,
        width: typeof o.width === "number" ? Math.round(o.width * sx) : o.width,
        height: typeof o.height === "number" ? Math.round(o.height * sy) : o.height,
      };
    });
  }

  if (state.slideTextBoxes && typeof state.slideTextBoxes === "object") {
    const scaled: Record<string, any[]> = {};
    for (const [k, arr] of Object.entries(state.slideTextBoxes)) {
      if (Array.isArray(arr)) {
        scaled[k] = (arr as any[]).map((b: any) => ({
          ...b,
          x: typeof b?.x === "number" ? Math.round(b.x * sx) : b?.x,
          y: typeof b?.y === "number" ? Math.round(b.y * sy) : b?.y,
          width: typeof b?.width === "number" ? Math.round(b.width * sx) : b?.width,
          height: typeof b?.height === "number" ? Math.round(b.height * sy) : b?.height,
        }));
      }
    }
    next.slideTextBoxes = scaled;
  }

  return next;
}

/** Reescreve apenas o `src` SVG de um overlay decorativo já posicionado. */
export function rewriteDecorativeOverlaySvg(overlay: any): any {
  if (!overlay || typeof overlay !== "object") return overlay;
  if (typeof overlay.id !== "string" || !TEMPLATE_DECOR_RE.test(overlay.id)) return overlay;
  const id = overlay.id;
  if (id.startsWith("tpl-frame-")) {
    const archKey = archetypeKeyFromId(id);
    const builder = archKey ? FRAME_BUILDERS[archKey] : null;
    if (builder) {
      const W = Math.round(Number(overlay.width) || 0);
      const H = Math.round(Number(overlay.height) || 0);
      if (!W || !H) return overlay;
      const svg = builder(W, H);
      return { ...overlay, src: `data:image/svg+xml;base64,${encodeBase64(svg)}` };
    }
  }
  return overlay;
}
