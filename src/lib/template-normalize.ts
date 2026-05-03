// Normaliza o `state` salvo de um template/design legado (1080×1080 quadrado)
// para o canvas atual (1080×1350 ou 1080×1920), corrigindo simultaneamente:
// - posições e dimensões (overlayImages, slideTextBoxes)
// - SVGs decorativos data:image/svg+xml (adiciona viewBox + preserveAspectRatio="none"
//   e atualiza width/height da raiz para casar com a nova caixa)
//
// Isso garante que molduras e linhas dos 12 templates de arquétipo se ajustem
// corretamente a qualquer formato.

const TEMPLATE_DECOR_RE = /^tpl-(mframe|frame|mline|line|mornament|ornament|block|accent)/;

function decodeBase64(str: string): string | null {
  try {
    if (typeof atob === "function") return atob(str);
  } catch {}
  return null;
}

function encodeBase64(str: string): string | null {
  try {
    if (typeof btoa === "function") return btoa(str);
  } catch {}
  return null;
}

function rewriteSvg(svg: string, newW: number, newH: number): string {
  // Garante viewBox e preserveAspectRatio="none" + width/height novos.
  // Captura intrinsic existente (atributos width/height ou viewBox).
  let viewBoxW = 0;
  let viewBoxH = 0;

  const vbMatch = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      viewBoxW = parts[2];
      viewBoxH = parts[3];
    }
  }
  if (!viewBoxW || !viewBoxH) {
    const wM = svg.match(/<svg[^>]*\swidth\s*=\s*["']([\d.]+)/i);
    const hM = svg.match(/<svg[^>]*\sheight\s*=\s*["']([\d.]+)/i);
    viewBoxW = wM ? parseFloat(wM[1]) : 1080;
    viewBoxH = hM ? parseFloat(hM[1]) : 1080;
  }

  // Reescreve a tag <svg ...> raiz
  return svg.replace(/<svg\b([^>]*)>/i, (_full, attrs: string) => {
    let cleaned = attrs
      .replace(/\swidth\s*=\s*["'][^"']*["']/i, "")
      .replace(/\sheight\s*=\s*["'][^"']*["']/i, "")
      .replace(/\sviewBox\s*=\s*["'][^"']*["']/i, "")
      .replace(/\spreserveAspectRatio\s*=\s*["'][^"']*["']/i, "");
    return `<svg${cleaned} width="${newW}" height="${newH}" viewBox="0 0 ${viewBoxW} ${viewBoxH}" preserveAspectRatio="none">`;
  });
}

function rewriteSvgSrc(src: string, newW: number, newH: number): string {
  if (typeof src !== "string") return src;
  // data:image/svg+xml;base64,...
  const base64Match = src.match(/^data:image\/svg\+xml;base64,(.+)$/i);
  if (base64Match) {
    const decoded = decodeBase64(base64Match[1]);
    if (!decoded) return src;
    const rewritten = rewriteSvg(decoded, Math.round(newW), Math.round(newH));
    const enc = encodeBase64(rewritten);
    if (!enc) return src;
    return `data:image/svg+xml;base64,${enc}`;
  }
  // data:image/svg+xml;utf8,... ou ;,...
  const utf8Match = src.match(/^data:image\/svg\+xml(?:;[^,]*)?,(.+)$/i);
  if (utf8Match) {
    const decoded = decodeURIComponent(utf8Match[1]);
    const rewritten = rewriteSvg(decoded, Math.round(newW), Math.round(newH));
    return `data:image/svg+xml;utf8,${encodeURIComponent(rewritten)}`;
  }
  return src;
}

export interface NormalizeOptions {
  /** Largura base do template original. Default: state.canvasWidth ?? 1080 */
  fromW?: number;
  /** Altura base do template original. Default: state.canvasHeight ?? 1080 */
  fromH?: number;
  /** Se true, regrava a moldura/decoração para preencher a nova caixa. Default true. */
  rewriteSvgs?: boolean;
}

/**
 * Normaliza o `state` para um canvas alvo (toW × toH).
 * - Escala não-uniformemente (sx, sy independentes)
 * - Reescreve SVGs decorativos para corresponder à nova caixa
 * - Atualiza canvasWidth/Height no state retornado
 */
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
  if (Math.abs(fromW - toW) < 1 && Math.abs(fromH - toH) < 1) {
    return { ...state, canvasWidth: toW, canvasHeight: toH };
  }
  const sx = toW / fromW;
  const sy = toH / fromH;
  const rewriteSvgs = opts.rewriteSvgs !== false;

  const scaleBox = <T extends { x?: number; y?: number; width?: number; height?: number }>(b: T): T => ({
    ...b,
    x: typeof b.x === "number" ? Math.round(b.x * sx) : b.x,
    y: typeof b.y === "number" ? Math.round(b.y * sy) : b.y,
    width: typeof b.width === "number" ? Math.round(b.width * sx) : b.width,
    height: typeof b.height === "number" ? Math.round(b.height * sy) : b.height,
  });

  const next: any = { ...state, canvasWidth: toW, canvasHeight: toH };

  if (Array.isArray(state.overlayImages)) {
    next.overlayImages = state.overlayImages.map((o: any) => {
      if (!o || typeof o !== "object") return o;
      const scaled = scaleBox(o);
      // Background full-canvas: força nova dimensão de canvas.
      if (typeof o.id === "string" && o.id.startsWith("tpl-bg-")) {
        return { ...scaled, x: 0, y: 0, width: toW, height: toH };
      }
      // SVG decorativo: reescreve a string para casar com a nova caixa.
      if (
        rewriteSvgs &&
        typeof o.id === "string" &&
        TEMPLATE_DECOR_RE.test(o.id) &&
        typeof o.src === "string" &&
        o.src.startsWith("data:image/svg+xml")
      ) {
        return { ...scaled, src: rewriteSvgSrc(o.src, scaled.width || 0, scaled.height || 0) };
      }
      return scaled;
    });
  }

  if (state.slideTextBoxes && typeof state.slideTextBoxes === "object") {
    const scaled: Record<string, any[]> = {};
    for (const [k, arr] of Object.entries(state.slideTextBoxes)) {
      if (Array.isArray(arr)) scaled[k] = (arr as any[]).map(b => scaleBox(b));
    }
    next.slideTextBoxes = scaled;
  }

  return next;
}

/** Reescreve apenas o `src` SVG de um overlay decorativo já posicionado. */
export function rewriteDecorativeOverlaySvg(overlay: any): any {
  if (!overlay || typeof overlay !== "object") return overlay;
  if (typeof overlay.id !== "string" || !TEMPLATE_DECOR_RE.test(overlay.id)) return overlay;
  if (typeof overlay.src !== "string" || !overlay.src.startsWith("data:image/svg+xml")) return overlay;
  const w = Math.round(Number(overlay.width) || 0);
  const h = Math.round(Number(overlay.height) || 0);
  if (!w || !h) return overlay;
  return { ...overlay, src: rewriteSvgSrc(overlay.src, w, h) };
}
