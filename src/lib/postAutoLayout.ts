/**
 * postAutoLayout — orquestra a montagem inicial automática de um post.
 *
 * Combina template + imagem de fundo (Unsplash) + logo do usuário
 * + retrato (opcional) e devolve o conjunto de overlays + ajustes de layout.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  pickTemplate, pickSingleTemplate,
  buildBackgroundImageOverlay, buildDecorativeBlockOverlay, buildLogoOverlay,
  type CanvasFormat, type TemplateLayout,
} from "./postTemplates";
import type { OverlayImage } from "@/components/post-editor/PostToolbar";

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
  paletteHex: string[]; // cores da paleta da marca, em ordem
  bgPaletteHex: string; // cor de fundo principal
  userId: string;
}

export interface AutoLayoutResult {
  template: TemplateLayout;
  overlays: OverlayImage[];
  /** Ajustes recomendados ao state do editor. */
  suggestions: {
    titleFontSize?: number;
    titleTextAlign?: "left" | "center" | "right";
    bodyFontSize?: number;
    bodyTextAlign?: "left" | "center" | "right";
    showSlideNumber?: boolean;
    slideNumberSize?: number;
    backgroundImageUrl?: string;
    backgroundSource?: "unsplash" | "ai" | "cache" | "none";
  };
}

/** Busca a primeira logo do usuário marcada com is_logo=true. */
async function fetchUserLogo(userId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("user_gallery_assets")
      .select("file_path")
      .eq("user_id", userId)
      .eq("is_logo", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!data?.file_path) return null;
    const { data: signed } = await supabase.storage
      .from("user-uploads")
      .createSignedUrl(data.file_path, 60 * 60);
    return signed?.signedUrl || null;
  } catch (err) {
    console.warn("fetchUserLogo failed", err);
    return null;
  }
}

/** Busca uma imagem de fundo via edge function (Unsplash, sem custo). */
export async function fetchBackgroundImage(opts: {
  theme: string;
  caption?: string;
  format: "square" | "portrait";
  allowAI?: boolean;
}): Promise<{ url: string; source: "unsplash" | "ai" | "cache" } | null> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-post-image", {
      body: opts,
    });
    if (error || !data?.url) return null;
    return { url: data.url, source: data.source };
  } catch (err) {
    console.warn("fetchBackgroundImage failed", err);
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
  let bgInfo: { url: string; source: "unsplash" | "ai" | "cache" } | null = null;

  // 1) Imagem de fundo (apenas para template "cover")
  if (template.kind === "cover") {
    bgInfo = await fetchBackgroundImage({
      theme: input.theme,
      caption: input.caption,
      format: input.format === "reels" ? "portrait" : "square",
      allowAI: false,
    });
    if (bgInfo) {
      overlays.push(buildBackgroundImageOverlay(bgInfo.url, input.format, true));
    }
  }

  // 2) Bloco decorativo (cor da paleta)
  const blockColor = template.decorativeBlock
    ? input.paletteHex[template.decorativeBlock.paletteIndex] || input.paletteHex[0] || "#7c3aed"
    : null;
  if (blockColor && template.decorativeBlock) {
    const block = buildDecorativeBlockOverlay(template, blockColor);
    if (block) overlays.push(block);
  }

  // 3) Logo do usuário (se houver)
  const logoUrl = await fetchUserLogo(input.userId);
  if (logoUrl) {
    const logo = buildLogoOverlay(template, logoUrl);
    if (logo) overlays.push(logo);
  }

  return {
    template,
    overlays,
    suggestions: {
      titleFontSize: template.titleSlot?.fontSize,
      titleTextAlign: template.titleSlot?.align,
      bodyFontSize: template.bodySlot?.fontSize,
      bodyTextAlign: template.bodySlot?.align,
      showSlideNumber: template.slideNumberSlot?.show,
      slideNumberSize: template.slideNumberSlot?.size,
      backgroundImageUrl: bgInfo?.url,
      backgroundSource: bgInfo?.source ?? "none",
    },
  };
}
