/**
 * postAutoLayout — orquestra a montagem inicial automática de um post.
 *
 * Combina template + estilo escolhido (minimal/unsplash/ai) + logo do usuário
 * e devolve overlays + ajustes de layout.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  pickTemplate, pickSingleTemplate,
  buildBackgroundImageOverlay, buildDecorativeBlockOverlay, buildLogoOverlay,
  buildMinimalDecorativeOverlays,
  type CanvasFormat, type TemplateLayout,
} from "./postTemplates";
import type { OverlayImage } from "@/components/post-editor/PostToolbar";

export type PostStyle = "minimal" | "unsplash" | "ai";

export interface PhotographerInfo {
  name: string;
  profileUrl: string;
  unsplashUrl: string;
}

export interface AutoLayoutInput {
  weekIndex: number;
  dayIndex: number;
  slideIndex?: number;
  totalSlides?: number;
  isCarousel: boolean;
  isCover?: boolean;
  isLast?: boolean;
  format: CanvasFormat;
  theme: string;
  caption?: string;
  hasCta?: boolean;
  paletteHex: string[];
  bgPaletteHex: string;
  userId: string;
  /** Estilo escolhido pelo usuário no modal. Default: "unsplash" se houver logo, senão "minimal". */
  style?: PostStyle;
  /** Nicho do negócio (PT) — usado para melhorar busca de imagens. */
  niche?: string;
  /** Contexto adicional do negócio (PT). */
  businessContext?: string;
}

export interface AutoLayoutResult {
  template: TemplateLayout;
  overlays: OverlayImage[];
  /** Posições iniciais dos blocos de texto (título e corpo) — usadas pelo PostCanvas. */
  slots?: {
    title?: { x: number; y: number; width: number; height: number };
    body?: { x: number; y: number; width: number; height: number };
  };
  suggestions: {
    titleFontSize?: number;
    titleTextAlign?: "left" | "center" | "right";
    bodyFontSize?: number;
    bodyTextAlign?: "left" | "center" | "right";
    showSlideNumber?: boolean;
    slideNumberSize?: number;
    backgroundImageUrl?: string;
    backgroundSource?: "unsplash" | "ai" | "cache" | "none";
    /** Sugestão de gradiente (modo minimalista). */
    useGradient?: boolean;
    gradientColor2Index?: number;
    gradientDirection?: string;
  };
  /** Metadados do fotógrafo (Unsplash) — usado para atribuição obrigatória. */
  photographer?: PhotographerInfo;
  /** Quando true, o estilo escolhido (unsplash/ai) falhou e usamos fallback de cor sólida. */
  styleFailed?: boolean;
  styleFailedReason?: string;
}

/**
 * Verifica se uma imagem (URL) tem transparência real OU detecta fundo
 * sólido (branco/quase-branco) que precisa ser removido. Retorna:
 *   - "transparent" → tem alpha real, está ok
 *   - "solid-bg"    → fundo sólido (branco/uniforme nas bordas), precisa remover
 *   - "unknown"     → falhou ao analisar, tratar como precisa-remover por segurança
 */
async function analyzeLogoBackground(url: string): Promise<"transparent" | "solid-bg" | "unknown"> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const sampleSize = 200;
          const ratio = Math.min(1, sampleSize / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * ratio));
          const h = Math.max(1, Math.round(img.height * ratio));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve("unknown");
          ctx.drawImage(img, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h).data;

          // 1) Conta pixels com alpha real (< 250)
          let transparentPixels = 0;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 250) transparentPixels++;
          }
          const totalPixels = data.length / 4;
          const transparentRatio = transparentPixels / totalPixels;

          // 2) Inspeciona apenas os pixels da BORDA do canvas para detectar
          //    fundo sólido (branco, preto ou outra cor uniforme).
          //    Usar bordas evita falsos positivos quando o ícone preenche o centro.
          const borderThickness = Math.max(2, Math.floor(Math.min(w, h) * 0.06));
          let borderSamples = 0;
          let whiteish = 0;       // perto do branco
          let opaqueBorder = 0;   // alpha = 255
          let greenish = 0;       // chroma key residual
          let rSum = 0, gSum = 0, bSum = 0;
          const isBorder = (x: number, y: number) =>
            x < borderThickness || x >= w - borderThickness ||
            y < borderThickness || y >= h - borderThickness;
          for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
              if (!isBorder(x, y)) continue;
              const i = (y * w + x) * 4;
              const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
              borderSamples++;
              if (a >= 250) opaqueBorder++;
              rSum += r; gSum += g; bSum += b;
              if (r > 240 && g > 240 && b > 240 && a >= 250) whiteish++;
              // Detecta chroma key verde residual
              if (a >= 250 && g > 140 && r < 180 && b < 180 && g > r + 25 && g > b + 25) {
                greenish++;
              }
            }
          }

          // Se >2% dos pixels têm alpha parcial, considera transparente real.
          if (transparentRatio > 0.02) {
            // Mas ainda podem haver áreas verdes residuais — verifica
            if (borderSamples > 0 && greenish / borderSamples > 0.15) {
              return resolve("solid-bg");
            }
            return resolve("transparent");
          }

          // Se a borda é majoritariamente opaca E majoritariamente branca, tem fundo branco.
          if (borderSamples > 0) {
            const opaqueRatio = opaqueBorder / borderSamples;
            const whiteRatio = whiteish / borderSamples;
            const greenRatio = greenish / borderSamples;
            if (opaqueRatio > 0.85 && whiteRatio > 0.6) return resolve("solid-bg");
            if (greenRatio > 0.15) return resolve("solid-bg");

            // Detecta também fundo de cor uniforme (variância baixa nas bordas)
            const rAvg = rSum / borderSamples;
            const gAvg = gSum / borderSamples;
            const bAvg = bSum / borderSamples;
            let variance = 0;
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                if (!isBorder(x, y)) continue;
                const i = (y * w + x) * 4;
                variance += Math.abs(data[i] - rAvg) + Math.abs(data[i + 1] - gAvg) + Math.abs(data[i + 2] - bAvg);
              }
            }
            const avgVariance = variance / (borderSamples * 3);
            if (opaqueRatio > 0.85 && avgVariance < 12) return resolve("solid-bg");
          }

          // Sem alpha e sem fundo claramente sólido: deixa como está.
          return resolve("transparent");
        } catch { resolve("unknown"); }
      };
      img.onerror = () => resolve("unknown");
      img.src = url;
    } catch { resolve("unknown"); }
  });
}

/** Aplica chroma-key (verde #00FF00) sobre uma data-URL e devolve PNG transparente. */
async function chromaKeyGreenToTransparent(dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const d = imageData.data;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            // Verde puro / quase puro → transparente
            if (g > 150 && r < 120 && b < 120 && g > r + 30 && g > b + 30) {
              d[i + 3] = 0;
            } else if (g > 80 && r < 160 && b < 160 && g > r && g > b) {
              const greenness = (g - Math.max(r, b)) / g;
              if (greenness > 0.15) {
                d[i + 3] = Math.round(255 * (1 - greenness));
                d[i] = Math.min(255, Math.round(r * 1.3));
                d[i + 2] = Math.min(255, Math.round(b * 1.3));
              }
            }
          }
          // Despill: remove halo verde dos pixels restantes
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            const r = d[i], g = d[i + 1], b = d[i + 2];
            const avg = (r + b) / 2;
            if (g > avg + 10) d[i + 1] = Math.round(avg);
          }
          ctx.putImageData(imageData, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    } catch { resolve(null); }
  });
}

const LOGO_CACHE_PREFIX = "posiciona-logo-cache-";

/** Invalida o cache de sessão da logo (chamar após upload de nova logo). */
export function clearLogoCache(userId: string) {
  try { sessionStorage.removeItem(`${LOGO_CACHE_PREFIX}${userId}`); } catch {}
}

/**
 * Recebe uma data-URL (PNG vindo de remove-background com chroma key verde)
 * e devolve uma data-URL PNG com transparência real validada.
 * Retorna `null` se a conversão não produziu transparência adequada
 * (ex.: a logo continua com grandes áreas verdes/sólidas nas bordas).
 */
export async function chromaKeyAndValidate(dataUrl: string): Promise<string | null> {
  const transparent = await chromaKeyGreenToTransparent(dataUrl);
  if (!transparent) return null;
  const status = await analyzeLogoBackground(transparent);
  if (status !== "transparent") return null;
  return transparent;
}

/** Busca a logo mais recente do usuário marcada com is_logo=true. Garante transparência real. */
async function fetchUserLogo(userId: string): Promise<string | null> {
  // Cache por sessão para evitar reprocessar a cada slide
  try {
    const cached = sessionStorage.getItem(`${LOGO_CACHE_PREFIX}${userId}`);
    if (cached) return cached;
  } catch {}

  try {
    const { data } = await supabase
      .from("user_gallery_assets")
      .select("id, file_path, bg_removed")
      .eq("user_id", userId)
      .eq("is_logo", true)
      .order("created_at", { ascending: false }) // logo mais recente
      .limit(1)
      .maybeSingle();
    if (!data?.file_path) return null;

    let filePath = data.file_path as string;

    // Sempre obter URL assinada primeiro
    const { data: signed } = await supabase.storage
      .from("user-uploads")
      .createSignedUrl(filePath, 60 * 60);
    let finalUrl = signed?.signedUrl || null;
    if (!finalUrl) return null;

    // Analisa a logo: pode estar transparente, com fundo branco/sólido,
    // ou indeterminada. Em caso de fundo sólido OU indeterminado, reprocessa.
    const status = await analyzeLogoBackground(finalUrl);
    const needsRemoval = status !== "transparent";

    if (needsRemoval) {
      // Reprocessa via remove-background. A edge function devolve um PNG com
      // fundo VERDE (#00FF00) e o flag chromaKey=true; precisamos converter
      // o verde em alpha aqui no cliente, senão a logo continua com fundo.
      try {
        const resp = await fetch(finalUrl);
        const blob = await resp.blob();
        const dataUrl: string = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = () => rej(r.error);
          r.readAsDataURL(blob);
        });
        const { data: rb, error: rbErr } = await supabase.functions.invoke("remove-background", {
          body: { imageUrl: dataUrl },
        });
        if (!rbErr && rb?.image && typeof rb.image === "string" && rb.image.startsWith("data:image/")) {
          // Sempre passa pelo chroma-key — independente da flag, garante alpha real.
          const transparent = await chromaKeyGreenToTransparent(rb.image);
          const finalImage = transparent || rb.image;
          // Confirma que de fato gerou alpha; só persiste se ficou transparente.
          const newStatus = await analyzeLogoBackground(finalImage);
          if (newStatus === "transparent") {
            const newBlob = await (await fetch(finalImage)).blob();
            const newPath = filePath.replace(/\.[^.]+$/, "") + ".png";
            const { error: upErr } = await supabase.storage
              .from("user-uploads")
              .upload(newPath, newBlob, { contentType: "image/png", upsert: true });
            if (!upErr) {
              await supabase
                .from("user_gallery_assets")
                .update({ file_path: newPath, bg_removed: true })
                .eq("id", (data as any).id);
              const { data: signed2 } = await supabase.storage
                .from("user-uploads")
                .createSignedUrl(newPath, 60 * 60);
              if (signed2?.signedUrl) finalUrl = signed2.signedUrl;
            }
          } else {
            console.warn("Logo still has background after chroma-key, keeping original");
          }
        } else {
          console.warn("remove-background returned no image, using original logo");
        }
      } catch (rbErr) {
        console.warn("On-demand bg removal failed for logo, using original", rbErr);
      }
    }

    try { sessionStorage.setItem(`${LOGO_CACHE_PREFIX}${userId}`, finalUrl); } catch {}
    return finalUrl;
  } catch (err) {
    console.warn("fetchUserLogo failed", err);
    return null;
  }
}

/**
 * Formato semântico para busca/IA.
 *  - "card"  → 4:5  (1080×1350)  [aceita "square" como alias legado]
 *  - "reels" → 9:16 (1080×1920)  [aceita "portrait" como alias legado]
 */
export type ImageFormat = "card" | "reels" | "square" | "portrait";

/** Busca uma imagem de fundo via edge function. Retorna metadata do fotógrafo. */
export async function fetchBackgroundImage(opts: {
  theme: string;
  caption?: string;
  body?: string;
  format: ImageFormat;
  allowAI?: boolean;
  query?: string;
  niche?: string;
  businessContext?: string;
}): Promise<{ url: string; source: "unsplash" | "ai" | "cache"; photographer?: PhotographerInfo } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-post-image", {
      body: { ...opts, mode: "single" },
    });
    if (error || !data?.url) return null;
    const photographer = data.photographer
      ? { name: data.photographer.name, profileUrl: data.photographer.profileUrl, unsplashUrl: data.unsplashUrl || "" }
      : undefined;
    return { url: data.url, source: data.source, photographer };
  } catch (err) {
    console.warn("fetchBackgroundImage failed", err);
    return null;
  }
}

/** Busca galeria de imagens (Unsplash) — até 12. */
export async function fetchImageGallery(opts: {
  query: string;
  format: ImageFormat;
  page?: number;
  niche?: string;
  businessContext?: string;
  caption?: string;
  body?: string;
}): Promise<Array<{ url: string; photographer: PhotographerInfo }>> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-post-image", {
      body: { ...opts, theme: opts.query, mode: "gallery" },
    });
    if (error || !Array.isArray(data?.results)) return [];
    return data.results.map((r: any) => ({
      url: r.url,
      photographer: {
        name: r.photographer?.name || "Unknown",
        profileUrl: r.photographer?.profileUrl || "",
        unsplashUrl: r.unsplashUrl || "",
      },
    }));
  } catch (err) {
    console.warn("fetchImageGallery failed", err);
    return [];
  }
}

/**
 * Gera imagem por IA. Retorna a URL e a fonte real ("ai").
 * NUNCA retorna foto do Unsplash — a edge function isola por modo.
 */
export async function generateAIImage(opts: {
  query: string;
  format: ImageFormat;
  niche?: string;
  businessContext?: string;
  caption?: string;
  body?: string;
}): Promise<{ url: string; source: "ai" | "cache" } | null> {
  try {
    const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const { data, error } = await supabase.functions.invoke("fetch-post-image", {
      body: {
        theme: opts.query, query: opts.query, format: opts.format,
        caption: opts.caption, body: opts.body,
        allowAI: true, mode: "single",
        niche: opts.niche, businessContext: opts.businessContext,
        nonce,
      },
    });
    if (error || !data?.url) return null;
    const src = data.source === "ai" ? "ai" : null;
    if (!src) {
      console.warn("generateAIImage: response source is not 'ai':", data.source);
      return null;
    }
    return { url: data.url, source: "ai" };
  } catch (err) {
    console.warn("generateAIImage failed", err);
    return null;
  }
}

/** Monta a composição inicial completa para um slide. */
export async function buildAutoLayout(input: AutoLayoutInput): Promise<AutoLayoutResult> {
  const style: PostStyle = input.style ?? "unsplash";
  const template = input.isCarousel
    ? pickTemplate({
        weekIndex: input.weekIndex,
        dayIndex: input.dayIndex,
        slideIndex: input.slideIndex ?? 0,
        totalSlides: input.totalSlides ?? 1,
        format: input.format,
        isCover: input.isCover,
        isLast: input.isLast,
        hasCta: input.hasCta,
      })
    : pickSingleTemplate({
        weekIndex: input.weekIndex,
        dayIndex: input.dayIndex,
        format: input.format,
        hasCta: input.hasCta,
        style,
      });

  const overlays: OverlayImage[] = [];
  let bgInfo: { url: string; source: "unsplash" | "ai" | "cache"; photographer?: PhotographerInfo } | null = null;

  let styleFailed = false;
  let styleFailedReason: string | undefined;

  // 1) Imagem de fundo segundo o estilo
  if (style === "unsplash") {
    bgInfo = await fetchBackgroundImage({
      theme: input.theme,
      caption: input.caption,
      format: input.format === "reels" ? "portrait" : "square",
      allowAI: false,
      niche: input.niche,
      businessContext: input.businessContext,
    });
    if (bgInfo) {
      overlays.push(buildBackgroundImageOverlay(bgInfo.url, input.format, true));
    } else {
      styleFailed = true;
      styleFailedReason = "Banco de imagens indisponível no momento.";
    }
  } else if (style === "ai") {
    const ai = await generateAIImage({
      query: input.theme || input.caption || "abstract",
      format: input.format === "reels" ? "portrait" : "square",
      niche: input.niche,
      businessContext: input.businessContext,
    });
    if (ai) {
      bgInfo = { url: ai.url, source: ai.source };
      overlays.push(buildBackgroundImageOverlay(ai.url, input.format, true));
    } else {
      styleFailed = true;
      styleFailedReason = "A geração por IA falhou. Tente novamente em instantes.";
    }
  }
  // style === "minimal" → sem imagem; usamos overlays decorativos próprios + gradient

  // Calcula bodyBottomY estimado (para posicionar decoração abaixo do texto)
  const estBodyHeight = template.bodySlot
    ? Math.max(160, Math.round(template.bodySlot.fontSize * 1.6 * 4))
    : 160;
  const bodyBottomY = template.bodySlot
    ? template.bodySlot.y + estBodyHeight
    : undefined;

  // 2) Decorações (moldura + linha + losango) — agora em TODOS os estilos
  const primary = input.paletteHex[0] || "#7c3aed";
  const accent = input.paletteHex[1] || input.paletteHex[0] || "#7c3aed";
  const onPhoto = style === "unsplash" || style === "ai";
  overlays.push(
    ...buildMinimalDecorativeOverlays(template, primary, accent, { onPhoto, bodyBottomY }),
  );

  // 3) Logo do usuário (se houver)
  const logoUrl = await fetchUserLogo(input.userId);
  if (logoUrl) {
    const logo = buildLogoOverlay(template, logoUrl);
    if (logo) overlays.push(logo);
  }

  // 4) Ajuste dinâmico de fonte/posição quando título é muito longo (evita sobreposição)
  const titleLen = (input.theme || "").trim().length;
  let dynTitleFontSize = template.titleSlot?.fontSize;
  if (dynTitleFontSize && titleLen > 50) {
    const reductionFactor = titleLen > 80 ? 0.7 : 0.8;
    dynTitleFontSize = Math.round(dynTitleFontSize * reductionFactor);
  }

  // Se o estilo foi unsplash/ai mas falhou, ativa gradiente de cor sólida da paleta
  // (em vez de cair sem aviso no fundo padrão, que se confundia com minimal)
  const useGradientFallback = (style === "unsplash" || style === "ai") && styleFailed && input.paletteHex.length >= 2;

  // Slots iniciais (posição/largura/altura) para os blocos de texto do canvas
  // Altura é estimada com base em fontSize * 1.6 (line-height) * 3 linhas
  const titleSlot = template.titleSlot
    ? {
        x: template.titleSlot.x,
        y: template.titleSlot.y,
        width: template.titleSlot.width,
        height: Math.max(120, Math.round((dynTitleFontSize || template.titleSlot.fontSize) * 1.6 * 2)),
      }
    : undefined;
  const bodySlot = template.bodySlot
    ? {
        x: template.bodySlot.x,
        y: template.bodySlot.y,
        width: template.bodySlot.width,
        height: Math.max(160, Math.round(template.bodySlot.fontSize * 1.6 * 4)),
      }
    : undefined;

  return {
    template,
    overlays,
    slots: { title: titleSlot, body: bodySlot },
    suggestions: {
      titleFontSize: dynTitleFontSize,
      titleTextAlign: template.titleSlot?.align,
      bodyFontSize: template.bodySlot?.fontSize,
      bodyTextAlign: template.bodySlot?.align,
      showSlideNumber: template.slideNumberSlot?.show,
      slideNumberSize: template.slideNumberSlot?.size,
      backgroundImageUrl: bgInfo?.url,
      backgroundSource: bgInfo?.source ?? "none",
      // Gradient para minimalista OU para fallback de erro de estilo
      useGradient: (style === "minimal" && input.paletteHex.length >= 2) || useGradientFallback,
      gradientColor2Index: 1,
      gradientDirection: "to bottom right",
    },
    photographer: bgInfo?.photographer,
    styleFailed,
    styleFailedReason,
  };
}
