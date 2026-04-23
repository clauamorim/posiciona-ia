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

/** Busca a logo mais recente do usuário marcada com is_logo=true. Reprocessa fundo se ainda não foi tratado. */
async function fetchUserLogo(userId: string): Promise<string | null> {
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
    const alreadyProcessed = !!(data as any).bg_removed;

    // Reprocessamento sob demanda: se a logo nunca passou por remove-background,
    // processa agora — independente da extensão do arquivo (PNG branco também precisa).
    if (!alreadyProcessed) {
      try {
        const { data: srcSigned } = await supabase.storage
          .from("user-uploads")
          .createSignedUrl(filePath, 60 * 5);
        if (srcSigned?.signedUrl) {
          const resp = await fetch(srcSigned.signedUrl);
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
            const newBlob = await (await fetch(rb.image)).blob();
            const newPath = filePath.replace(/\.[^.]+$/, "") + ".png";
            const { error: upErr } = await supabase.storage
              .from("user-uploads")
              .upload(newPath, newBlob, { contentType: "image/png", upsert: true });
            if (!upErr) {
              await supabase
                .from("user_gallery_assets")
                .update({ file_path: newPath, bg_removed: true })
                .eq("id", (data as any).id);
              filePath = newPath;
            }
          } else {
            console.warn("remove-background returned no image, using original logo");
          }
        }
      } catch (rbErr) {
        console.warn("On-demand bg removal failed for logo, using original", rbErr);
      }
    }

    const { data: signed } = await supabase.storage
      .from("user-uploads")
      .createSignedUrl(filePath, 60 * 60);
    return signed?.signedUrl || null;
  } catch (err) {
    console.warn("fetchUserLogo failed", err);
    return null;
  }
}

/** Busca uma imagem de fundo via edge function. Retorna metadata do fotógrafo. */
export async function fetchBackgroundImage(opts: {
  theme: string;
  caption?: string;
  format: "square" | "portrait";
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
  format: "square" | "portrait";
  page?: number;
  niche?: string;
  businessContext?: string;
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

/** Gera imagem por IA. */
export async function generateAIImage(opts: {
  query: string;
  format: "square" | "portrait";
  niche?: string;
}): Promise<{ url: string } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-post-image", {
      body: { theme: opts.query, query: opts.query, format: opts.format, allowAI: true, mode: "single", niche: opts.niche },
    });
    if (error || !data?.url) return null;
    return { url: data.url };
  } catch (err) {
    console.warn("generateAIImage failed", err);
    return null;
  }
}

/** Monta a composição inicial completa para um slide. */
export async function buildAutoLayout(input: AutoLayoutInput): Promise<AutoLayoutResult> {
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
      });

  const overlays: OverlayImage[] = [];
  let bgInfo: { url: string; source: "unsplash" | "ai" | "cache"; photographer?: PhotographerInfo } | null = null;

  // Resolve estilo: respeitar escolha explícita, ou padrão "unsplash"
  const style: PostStyle = input.style ?? "unsplash";
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
    });
    if (ai) {
      bgInfo = { url: ai.url, source: "ai" };
      overlays.push(buildBackgroundImageOverlay(ai.url, input.format, true));
    } else {
      styleFailed = true;
      styleFailedReason = "A geração por IA falhou. Tente novamente em instantes.";
    }
  }
  // style === "minimal" → sem imagem; usamos overlays decorativos próprios + gradient

  // 2) Bloco / overlays decorativos
  if (style === "minimal") {
    // Para minimal, usar conjunto rico (moldura + linha + ornamento)
    const primary = input.paletteHex[0] || "#7c3aed";
    const accent = input.paletteHex[1] || input.paletteHex[0] || "#7c3aed";
    overlays.push(...buildMinimalDecorativeOverlays(template, primary, accent));
  } else {
    // Para outros estilos, usar bloco padrão do template
    const blockColor = template.decorativeBlock
      ? input.paletteHex[template.decorativeBlock.paletteIndex] || input.paletteHex[0] || "#7c3aed"
      : null;
    if (blockColor && template.decorativeBlock) {
      const block = buildDecorativeBlockOverlay(template, blockColor);
      if (block) overlays.push(block);
    }
  }

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

  return {
    template,
    overlays,
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
