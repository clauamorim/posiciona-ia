import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Copy, Check } from "lucide-react";
import PostCanvas from "@/components/post-editor/PostCanvas";
import CarouselEditor from "@/components/post-editor/CarouselEditor";
import PostToolbar from "@/components/post-editor/PostToolbar";
import MobileEditorBar from "@/components/post-editor/MobileEditorBar";
import type { OverlayImage } from "@/components/post-editor/PostToolbar";
import type { TextBox } from "@/components/post-editor/PostCanvas";
import { parseReportContent } from "@/lib/reportParser";
import { cleanMarkdown, extractAfterBold, cleanText, stripFrameworkLabels } from "@/lib/textCleanup";
import { compressImage } from "@/lib/imageUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildAutoLayout, fetchBackgroundImage, type PostStyle, type PhotographerInfo } from "@/lib/postAutoLayout";
import { getAIStyleById, type AIStyleId } from "@/lib/aiImageStyles";
import { prepareSinglePostCardCopy, prepareCarouselCardCopy } from "@/lib/editorialCardCopy";

import { Sparkles, X, Image as ImageIcon, Loader2, Download } from "lucide-react";
import { useEditorHistory } from "@/hooks/useEditorHistory";
import { normalizeWeekToV6 } from "@/lib/editorialShape";
import { normalizeTemplateStateForCanvas, rewriteDecorativeOverlaySvg } from "@/lib/template-normalize";

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#1a1a2e" : "#ffffff";
}

function loadGoogleFont(fontName: string) {
  const id = `gfont-${fontName.replace(/\s+/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@300;400;500;600;700;800;900&display=swap`;
  document.head.appendChild(link);
}

const DRAFT_KEY = "posiciona-editor-draft";

function findBackgroundIndex(palette: any[]): number {
  if (!Array.isArray(palette) || palette.length === 0) return 0;
  const idx = palette.findIndex((c) => {
    const usage = typeof c?.usage === "string" ? c.usage.toLowerCase() : "";
    return usage.includes("fundo") || usage.includes("background");
  });
  return idx >= 0 ? idx : 0;
}

interface EditorDraft {
  weekIndex: number;
  dayIndex: number;
  editedTexts: string[];
  editedTitle: string;
  overlayImages: OverlayImage[];
  uploadedImages: string[];
  bgIndex: number;
  layout: string;
  currentSlide: number;
  fontSize: number;
  fontWeight: string;
  fontStyle: string;
  useGradient: boolean;
  gradientColor2Index: number;
  customGradientColor2: string | null;
  gradientDirection: string;
  textAlign: string;
  titleTextAlign?: string;
  customTextColor: string | null;
  customBgColor: string | null;
  titleFontSize: number;
  titleColor: string | null;
  titleFontFamily: string | null;
  ctaText: string;
  ctaBgColor: string | null;
  ctaTextColor: string | null;
  ctaFontSize: number;
  ctaPosition: { x: number; y: number } | null;
  canvasFormat: string;
  showSlideNumber: boolean;
  slideNumberPosition: { x: number; y: number } | null;
  slideNumberBgColor: string | null;
  slideNumberTextColor: string | null;
  slideNumberSize: number;
  displayFont: string;
  bodyFont: string;
  slideTextBoxes?: Record<number, TextBox[]>;
}

function loadDraft(weekIdx: number, dayIdx: number, style: string | undefined, format: string): EditorDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft: EditorDraft & { __style?: string; __format?: string } = JSON.parse(raw);
    if (draft.weekIndex !== weekIdx || draft.dayIndex !== dayIdx) return null;
    // Só reaproveitar quando estilo e formato batem (evita Unsplash herdar layout minimal)
    const draftStyle = draft.__style || "minimal";
    const draftFormat = draft.__format || "square";
    const targetStyle = style || "minimal";
    if (draftStyle !== targetStyle || draftFormat !== format) return null;
    return restoreDraftImages(draft);
  } catch { return null; }
}

function saveDraft(draft: EditorDraft, style: string | undefined, format: string) {
  try {
    const imageStore: Record<string, string> = {};
    const overlaysLite = draft.overlayImages.map(img => {
      if (img.src.length > 50000) {
        const key = `img_${img.id}`;
        imageStore[key] = img.src;
        return { ...img, src: `__ref__:${key}` };
      }
      return img;
    });
    const uploadedLite: string[] = [];
    draft.uploadedImages.forEach((src, i) => {
      if (src.length > 50000) {
        const key = `upl_${i}`;
        imageStore[key] = src;
        uploadedLite.push(`__ref__:${key}`);
      } else if (src) {
        uploadedLite.push(src);
      }
    });

    const lightweight = {
      ...draft,
      overlayImages: overlaysLite,
      uploadedImages: uploadedLite,
      __style: style || "minimal",
      __format: format,
    };
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(lightweight));
    Object.entries(imageStore).forEach(([k, v]) => {
      try { sessionStorage.setItem(`${DRAFT_KEY}_${k}`, v); } catch {}
    });
  } catch {}
}

function restoreDraftImages(draft: EditorDraft): EditorDraft {
  // Restore large images from separate sessionStorage keys
  const overlays = draft.overlayImages.map(img => {
    if (img.src.startsWith("__ref__:")) {
      const key = img.src.replace("__ref__:", "");
      const real = sessionStorage.getItem(`${DRAFT_KEY}_${key}`);
      return real ? { ...img, src: real } : img;
    }
    return img;
  }).filter(img => !img.src.startsWith("__ref__:"));

  const uploaded = draft.uploadedImages.map(src => {
    if (src.startsWith("__ref__:")) {
      const key = src.replace("__ref__:", "");
      return sessionStorage.getItem(`${DRAFT_KEY}_${key}`) || "";
    }
    return src;
  }).filter(Boolean);

  return { ...draft, overlayImages: overlays, uploadedImages: uploaded };
}

const PostEditorPage = () => {
  const { user, balances, refreshSubscription, isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const weekIndex = parseInt(searchParams.get("week") || "0", 10);
  const dayIndex = parseInt(searchParams.get("day") || "0", 10);
  const initialStyle = (searchParams.get("style") as PostStyle | null) || undefined;
  const initialAiVisualStyle = (searchParams.get("aiVisualStyle") as AIStyleId | null) || undefined;
  const initialFormatParam = searchParams.get("format");

  const targetFormat: "square" | "reels" = initialFormatParam === "reels" ? "reels" : "square";
  const hasDesignParam = !!searchParams.get("design");
  const draft = hasDesignParam ? null : loadDraft(weekIndex, dayIndex, initialStyle, targetFormat);

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userNiche, setUserNiche] = useState<string>("");
  const [businessContext, setBusinessContext] = useState<string>("");
  const [imageContextLoaded, setImageContextLoaded] = useState(false);
  const [bgIndex, setBgIndex] = useState(draft?.bgIndex ?? 0);
  const [layout, setLayout] = useState<"centered" | "top" | "split">((draft?.layout as any) ?? "centered");
  const [currentSlide, setCurrentSlide] = useState(draft?.currentSlide ?? 0);
  const [editedTexts, setEditedTexts] = useState<string[]>(draft?.editedTexts ?? []);
  const [editedTitle, setEditedTitle] = useState(draft?.editedTitle ?? "");
  const [overlayImages, setOverlayImages] = useState<OverlayImage[]>(draft?.overlayImages ?? []);
  const [uploadedImages, setUploadedImages] = useState<string[]>(draft?.uploadedImages ?? []);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(draft?.fontSize ?? 28);
  const [fontWeight, setFontWeight] = useState(draft?.fontWeight ?? "normal");
  const [fontStyle, setFontStyle] = useState(draft?.fontStyle ?? "normal");
  const [useGradient, setUseGradient] = useState(draft?.useGradient ?? false);
  const [gradientColor2Index, setGradientColor2Index] = useState(draft?.gradientColor2Index ?? 1);
  const [customGradientColor2, setCustomGradientColor2] = useState<string | null>(draft?.customGradientColor2 ?? null);
  const [gradientDirection, setGradientDirection] = useState(draft?.gradientDirection ?? "to right");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right" | "justify">((draft?.textAlign as any) ?? "center");
  const [titleTextAlign, setTitleTextAlign] = useState<"left" | "center" | "right" | "justify">(((draft as any)?.titleTextAlign as any) ?? "center");
  const [customTextColor, setCustomTextColor] = useState<string | null>(draft?.customTextColor ?? null);
  const [customBgColor, setCustomBgColor] = useState<string | null>(draft?.customBgColor ?? null);
  const [copied, setCopied] = useState(false);
  const [removingBackground, setRemovingBackground] = useState(false);
  const [titleFontSize, setTitleFontSize] = useState(draft?.titleFontSize ?? 44);
  const [titleColor, setTitleColor] = useState<string | null>(draft?.titleColor ?? null);
  const [titleFontFamily, setTitleFontFamily] = useState<string | null>(draft?.titleFontFamily ?? null);
  const [ctaText, setCtaText] = useState(draft?.ctaText ?? "");
  const [ctaBgColor, setCtaBgColor] = useState<string | null>(draft?.ctaBgColor ?? null);
  const [ctaTextColor, setCtaTextColor] = useState<string | null>(draft?.ctaTextColor ?? null);
  const [ctaFontSize, setCtaFontSize] = useState(draft?.ctaFontSize ?? 28);
  const [ctaPosition, setCtaPosition] = useState<{ x: number; y: number } | null>(draft?.ctaPosition ?? null);
  const [userPortraits, setUserPortraits] = useState<string[]>([]);
  const [canvasFormat, setCanvasFormat] = useState<"square" | "reels">((draft?.canvasFormat as any) ?? (initialFormatParam === "reels" ? "reels" : "square"));
  const [showSlideNumber, setShowSlideNumber] = useState(draft?.showSlideNumber ?? true);
  const [slideNumberPosition, setSlideNumberPosition] = useState<{ x: number; y: number } | null>(draft?.slideNumberPosition ?? null);
  const [slideNumberBgColor, setSlideNumberBgColor] = useState<string | null>(draft?.slideNumberBgColor ?? null);
  const [slideNumberTextColor, setSlideNumberTextColor] = useState<string | null>(draft?.slideNumberTextColor ?? null);
  const [slideNumberSize, setSlideNumberSize] = useState(draft?.slideNumberSize ?? 14);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [renderOrder, setRenderOrder] = useState<string[]>([]);
  const [showRulers, setShowRulers] = useState(false);
  const [slideTextBoxes, setSlideTextBoxes] = useState<Record<number, TextBox[]>>(draft?.slideTextBoxes ?? {});
  // Imagem de fundo independente por slide do carrossel + variação visual sutil
  // (opacidade e object-position alternados) — gera ritmo entre os cards.
  const [slideBackgrounds, setSlideBackgrounds] = useState<Record<number, { url: string; opacity: number; objectPosition: string }>>({});
  const handleSlideTextBoxesChange = useCallback((slideIndex: number, boxes: TextBox[]) => {
    setSlideTextBoxes((prev) => {
      const existing = prev[slideIndex];
      if (existing && existing.length === boxes.length && existing.every((b, i) => {
        const n = boxes[i];
        return b.id === n.id && b.x === n.x && b.y === n.y && b.width === n.width && b.height === n.height;
      })) return prev;
      return { ...prev, [slideIndex]: boxes };
    });
  }, []);
  const [autoLayoutBanner, setAutoLayoutBanner] = useState(false);
  const [swappingBackground, setSwappingBackground] = useState(false);
  const [activePhotographer, setActivePhotographer] = useState<PhotographerInfo | null>(null);
  const [initialTextBoxes, setInitialTextBoxes] = useState<{ title?: { x: number; y: number; width: number; height: number }; body?: { x: number; y: number; width: number; height: number } } | undefined>(undefined);
  const [initializingLayout, setInitializingLayout] = useState<string | null>(
    !!draft || hasDesignParam ? null : (initialStyle === "ai" ? "Gerando imagem com IA…" : initialStyle === "pexels" ? "Buscando foto editorial…" : "Preparando layout…")
  );
  const singleCanvasRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textsInitializedRef = useRef(!!draft);
  const bgInitializedRef = useRef(!!draft);
  const autoLayoutRanRef = useRef(!!draft || hasDesignParam);
  // Quando o usuário abre um post novo, aplicamos o template global do
  // arquétipo dele como base visual (cores, fontes, decorativos, layout).
  // O auto-layout que roda depois apenas substitui o background image.
  const archetypeTemplateRanRef = useRef(!!draft || hasDesignParam);
  const archetypeTemplateAppliedRef = useRef(false);
  // Card 4:5 (1080×1350) ou Reels 9:16 (1080×1920)
  const cW = canvasFormat === "reels" ? 1080 : 1080;
  const cH = canvasFormat === "reels" ? 1920 : 1350;

  useEffect(() => {
    if (!user) return;
    supabase.from("reports").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).single()
      .then(({ data }) => { setReport(data); setLoading(false); });
    setImageContextLoaded(false);
    (async () => {
      const [profileRes, businessRes] = await Promise.all([
        supabase.from("profiles").select("niche").eq("user_id", user.id).maybeSingle(),
        supabase.from("business_questionnaires").select("services,target_audience,company_name")
          .eq("user_id", user.id).order("version", { ascending: false }).limit(1).maybeSingle(),
      ]);
      const business = businessRes.data;
      const ctx = business
        ? [business.company_name, business.services, business.target_audience].filter(Boolean).join(" ")
        : "";
      const derivedNiche = business
        ? [business.services, business.company_name].filter(Boolean).join(" ").trim()
        : "";
      const resolvedNiche = (profileRes.data?.niche || derivedNiche || "").trim();
      setBusinessContext(ctx);
      setUserNiche(resolvedNiche);
      setImageContextLoaded(true);
      console.log("[PostEditor] image context loaded", {
        profileNiche: profileRes.data?.niche || null,
        derivedNiche,
        resolvedNiche,
        hasResolvedNiche: Boolean(resolvedNiche),
      });
    })().catch((err) => {
      console.warn("[PostEditor] image context failed", err);
      setImageContextLoaded(true);
    });
    supabase.functions
      .invoke("portrait-history", { method: "GET" })
      .then(({ data }) => {
        const items: any[] = (data as any)?.portraits ?? [];
        const urls = items
          .map((p) => (p && typeof p.url === "string" ? p.url : ""))
          .filter(Boolean);
        setUserPortraits(urls);
      })
      .catch((err) => {
        console.warn("[PostEditor] portrait-history failed", err);
      });
  }, [user]);

  const { contentObject, hasEditorial } = parseReportContent(report?.content);
  const content = contentObject ?? {};
  const structuredEditorial = Array.isArray(content.editorial) ? content.editorial : [];
  const editorialWeeks: any[][] = Array.isArray(report?.editorial_weeks) ? report.editorial_weeks : [];
  const allWeeksRaw = [
    ...(hasEditorial && structuredEditorial.length > 0 ? [structuredEditorial] : []),
    ...editorialWeeks,
  ];
  const allWeeks = allWeeksRaw.map((w) => normalizeWeekToV6(w));

  const dayV6 = allWeeks[weekIndex]?.days?.[dayIndex];
  // Compat: o restante do editor ainda lê day.theme / day.caption / day.card_copy / day.cta / day.format
  // como no shape v5. Expomos um objeto v5-like a partir do feed v6 para evitar
  // refatorar centenas de linhas dependentes desses campos.
  const day: any = dayV6
    ? {
        ...(dayV6.feed ?? {}),
        day: dayV6.day,
        theme: dayV6.feed?.theme || dayV6.story?.theme || "",
        caption: dayV6.feed?.caption || "",
        card_copy: dayV6.feed?.card_copy || [],
        cta: dayV6.feed?.cta || "",
        format: dayV6.feed?.format || "post",
        script: dayV6.feed?.script || "",
        generator_version: dayV6.feed?.generator_version || dayV6.generator_version,
      }
    : null;
  const palette = Array.isArray(content.visual_identity?.palette) ? content.visual_identity.palette : [];
  const typography = typeof content.visual_identity?.typography === "object" && content.visual_identity?.typography !== null
    ? content.visual_identity.typography
    : {};
  // Arquétipo primário (rank 1) — usado para hierarquia tipográfica do canvas.
  const primaryArchetype: string | null =
    content?.archetypes?.primary?.name ||
    content?.archetypes?.["1"]?.name ||
    content?.archetypes?.[1]?.name ||
    null;

  const [displayFont, setDisplayFont] = useState(draft?.displayFont || typography.display || "Space Grotesk");
  const [bodyFont, setBodyFont] = useState(draft?.bodyFont || typography.body || "Inter");

  // ===== Undo / history =====
  const historyState = {
    editedTexts,
    editedTitle,
    overlayImages,
    bgIndex,
    layout,
    currentSlide,
    fontSize,
    fontWeight,
    fontStyle,
    useGradient,
    gradientColor2Index,
    customGradientColor2,
    gradientDirection,
    textAlign,
    titleTextAlign,
    customTextColor,
    customBgColor,
    titleFontSize,
    titleColor,
    titleFontFamily,
    ctaText,
    ctaBgColor,
    ctaTextColor,
    ctaFontSize,
    ctaPosition,
    canvasFormat,
    showSlideNumber,
    slideNumberPosition,
    slideNumberBgColor,
    slideNumberTextColor,
    slideNumberSize,
    renderOrder,
    displayFont,
    bodyFont,
    slideTextBoxes,
  };

  const applyUndoSnapshot = useCallback((snap: typeof historyState) => {
    setEditedTexts(snap.editedTexts);
    setEditedTitle(snap.editedTitle);
    setOverlayImages(snap.overlayImages);
    setBgIndex(snap.bgIndex);
    setLayout(snap.layout);
    setCurrentSlide(snap.currentSlide);
    setFontSize(snap.fontSize);
    setFontWeight(snap.fontWeight);
    setFontStyle(snap.fontStyle);
    setUseGradient(snap.useGradient);
    setGradientColor2Index(snap.gradientColor2Index);
    setCustomGradientColor2(snap.customGradientColor2);
    setGradientDirection(snap.gradientDirection);
    setTextAlign(snap.textAlign);
    setTitleTextAlign(snap.titleTextAlign);
    setCustomTextColor(snap.customTextColor);
    setCustomBgColor(snap.customBgColor);
    setTitleFontSize(snap.titleFontSize);
    setTitleColor(snap.titleColor);
    setTitleFontFamily(snap.titleFontFamily);
    setCtaText(snap.ctaText);
    setCtaBgColor(snap.ctaBgColor);
    setCtaTextColor(snap.ctaTextColor);
    setCtaFontSize(snap.ctaFontSize);
    setCtaPosition(snap.ctaPosition);
    setCanvasFormat(snap.canvasFormat);
    setShowSlideNumber(snap.showSlideNumber);
    setSlideNumberPosition(snap.slideNumberPosition);
    setSlideNumberBgColor(snap.slideNumberBgColor);
    setSlideNumberTextColor(snap.slideNumberTextColor);
    setSlideNumberSize(snap.slideNumberSize);
    setRenderOrder(snap.renderOrder);
    setDisplayFont(snap.displayFont);
    setBodyFont(snap.bodyFont);
    if (snap.slideTextBoxes) setSlideTextBoxes(snap.slideTextBoxes);
  }, []);

  const { undo, canUndo } = useEditorHistory(historyState as any, applyUndoSnapshot as any);

  // Keyboard shortcut: Ctrl/Cmd + Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isUndoCombo = (e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z") && !e.shiftKey;
      if (!isUndoCombo) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || target.isContentEditable) return;
      }
      e.preventDefault();
      undo();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo]);

  useEffect(() => {
    if (draft) return; // Don't overwrite draft fonts
    if (typography.display) { setDisplayFont(typography.display); loadGoogleFont(typography.display); }
    if (typography.body) { setBodyFont(typography.body); loadGoogleFont(typography.body); }
  }, [typography.display, typography.body]);

  // Initialize bgIndex from palette usage ("fundo"/"background") once on first load
  useEffect(() => {
    if (bgInitializedRef.current) return;
    if (!Array.isArray(palette) || palette.length === 0) return;
    if (customBgColor) { bgInitializedRef.current = true; return; }
    const idx = findBackgroundIndex(palette);
    setBgIndex(idx);
    bgInitializedRef.current = true;
  }, [palette, customBgColor]);

  // Initialize texts only once per day, prevent alt+tab reset
  useEffect(() => {
    if (!day) return;
    if (textsInitializedRef.current) return;
    const isCarouselDay = day?.format?.toLowerCase() === "carrossel";
    const rawCopy = (day.card_copy || []).map((t: string) => extractAfterBold(t));
    const copies = isCarouselDay
      ? prepareCarouselCardCopy({ cardCopy: rawCopy, caption: day.caption })
      : prepareSinglePostCardCopy({ cardCopy: rawCopy, caption: day.caption, theme: day.theme });
    setEditedTexts(copies.length > 0 ? copies : [""]);
    setEditedTitle(cleanText(day.theme || ""));
    setCtaText(cleanText(day.cta || ""));
    textsInitializedRef.current = true;
  }, [day]);

  // Aplica o template global do arquétipo do usuário como base visual.
  // Preserva: cores, fontes, pesos, tamanhos, layout, decorativos.
  // NÃO toca em: textos (vêm da IA) e imagens de fundo (vêm do auto-layout).
  // Se nenhum template global existir para o arquétipo, segue o fluxo padrão.
  useEffect(() => {
    if (archetypeTemplateRanRef.current) return;
    if (!user || !primaryArchetype) return;
    archetypeTemplateRanRef.current = true;
    // Otimista: marca como aplicado para que o auto-layout (que dispara em
    // paralelo) já preserve as decisões do template. Reverte se falhar.
    archetypeTemplateAppliedRef.current = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_designs")
          .select("state")
          .eq("is_template", true)
          .eq("is_global", true)
          .eq("archetype", primaryArchetype)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error || !data?.state) {
          archetypeTemplateAppliedRef.current = false;
          return;
        }
        const s: any = data.state;
        // Salvaguarda: archetype do template não sobrescreve o do usuário
        if ("archetype" in s) delete s.archetype;

        // Visual base: cores, gradiente, fontes, layout, alinhamentos, números de slide
        if (s.layout) setLayout(s.layout);
        if (typeof s.bgIndex === "number") setBgIndex(s.bgIndex);
        if (s.customBgColor !== undefined) setCustomBgColor(s.customBgColor);
        if (typeof s.useGradient === "boolean") setUseGradient(s.useGradient);
        if (typeof s.gradientColor2Index === "number") setGradientColor2Index(s.gradientColor2Index);
        if (s.customGradientColor2 !== undefined) setCustomGradientColor2(s.customGradientColor2);
        if (s.gradientDirection) setGradientDirection(s.gradientDirection);
        if (s.displayFont) { loadGoogleFont(s.displayFont); setDisplayFont(s.displayFont); }
        if (s.bodyFont) { loadGoogleFont(s.bodyFont); setBodyFont(s.bodyFont); }
        if (s.titleFontFamily !== undefined) {
          if (s.titleFontFamily) loadGoogleFont(s.titleFontFamily);
          setTitleFontFamily(s.titleFontFamily);
        }
        if (typeof s.fontSize === "number") setFontSize(s.fontSize);
        if (s.fontWeight) setFontWeight(s.fontWeight);
        if (s.fontStyle) setFontStyle(s.fontStyle);
        if (s.textAlign) setTextAlign(s.textAlign);
        if (s.titleTextAlign) setTitleTextAlign(s.titleTextAlign);
        if (s.customTextColor !== undefined) setCustomTextColor(s.customTextColor);
        if (typeof s.titleFontSize === "number") setTitleFontSize(s.titleFontSize);
        if (s.titleColor !== undefined) setTitleColor(s.titleColor);
        if (s.ctaBgColor !== undefined) setCtaBgColor(s.ctaBgColor);
        if (s.ctaTextColor !== undefined) setCtaTextColor(s.ctaTextColor);
        if (typeof s.ctaFontSize === "number") setCtaFontSize(s.ctaFontSize);
        if (s.ctaPosition !== undefined) setCtaPosition(s.ctaPosition);
        if (typeof s.showSlideNumber === "boolean") setShowSlideNumber(s.showSlideNumber);
        if (s.slideNumberPosition !== undefined) setSlideNumberPosition(s.slideNumberPosition);
        if (s.slideNumberBgColor !== undefined) setSlideNumberBgColor(s.slideNumberBgColor);
        if (s.slideNumberTextColor !== undefined) setSlideNumberTextColor(s.slideNumberTextColor);
        if (typeof s.slideNumberSize === "number") setSlideNumberSize(s.slideNumberSize);
        // Marca bg como inicializado para evitar que o efeito de palette sobrescreva
        bgInitializedRef.current = true;

        // Normaliza o state legado (1080×1080 quadrado) para o canvas atual,
        // reescalando posições E reescrevendo a string dos SVGs decorativos
        // (viewBox + preserveAspectRatio="none") para que molduras/linhas
        // preencham corretamente o novo formato em todos os 12 templates.
        const normalized = normalizeTemplateStateForCanvas(s, cW, cH);

        if (normalized.slideTextBoxes && typeof normalized.slideTextBoxes === "object") {
          const scaled: Record<number, TextBox[]> = {};
          for (const [k, arr] of Object.entries(normalized.slideTextBoxes)) {
            if (Array.isArray(arr)) scaled[Number(k)] = arr as TextBox[];
          }
          setSlideTextBoxes(scaled);
        }

        const tplOverlays: OverlayImage[] = Array.isArray(normalized.overlayImages)
          ? normalized.overlayImages.filter((o: any) => o && o.type !== "photo")
          : [];
        if (tplOverlays.length > 0) {
          setOverlayImages(prev => {
            // Substitui completamente: mantém só fotos (bg do usuário) e
            // descarta qualquer outro decorativo prévio para evitar
            // sobreposição com a moldura do template.
            const photos = prev.filter(o => o.type === "photo");
            return [...tplOverlays, ...photos];
          });
        }
      } catch (err) {
        console.warn("[archetype-template] failed", err);
        archetypeTemplateAppliedRef.current = false;
      }
    })();
  }, [user, primaryArchetype, cW, cH]);

  // Auto-layout: monta layout inicial (template + bg Unsplash + logo) na primeira abertura
  useEffect(() => {
    if (!user || !day || autoLayoutRanRef.current) return;
    if (!imageContextLoaded) return;
    if (!Array.isArray(palette) || palette.length === 0) return;
    autoLayoutRanRef.current = true;
    const isCarouselDay = day?.format?.toLowerCase() === "carrossel";
    const totalSlides = isCarouselDay ? Math.max(1, (day.card_copy?.length || 1)) : 1;
    const themeStr = (day.theme || day.caption || "").toString();
    const initialBody = (day.card_copy?.[0] || day.caption || "").toString();
    (async () => {
      try {
        const result = await buildAutoLayout({
          weekIndex, dayIndex,
          slideIndex: 0,
          totalSlides,
          isCarousel: isCarouselDay,
          isCover: isCarouselDay,
          isLast: false,
          format: canvasFormat,
          theme: themeStr,
          caption: day.caption,
          body: initialBody,
          hasCta: !!day.cta,
          paletteHex: palette.map((c: any) => c.hex),
          bgPaletteHex: palette[bgIndex]?.hex || "#1a1a2e",
          userId: user.id,
          style: initialStyle,
          niche: userNiche,
          businessContext,
          aiStyleDirective: initialStyle === "ai" ? getAIStyleById(initialAiVisualStyle)?.directive : undefined,
        });
        // Quando o template do arquétipo já foi aplicado, preservamos seus
        // overlays decorativos e configurações visuais — só atualizamos o
        // background image e os slots de texto sugeridos pelo auto-layout.
        const tplApplied = archetypeTemplateAppliedRef.current;
        if (result.overlays.length > 0) {
          setOverlayImages(prev => {
            if (tplApplied) {
              // Template do arquétipo é a única fonte de decorativos.
              // Do auto-layout só aproveitamos o background image (tpl-bg-*).
              const keptTplDecor = prev.filter(o => o.id.startsWith("tpl-") && !o.id.startsWith("tpl-bg-"));
              const newBgs = result.overlays.filter(o => o.id.startsWith("tpl-bg-"));
              const otherPrev = prev.filter(o => !o.id.startsWith("tpl-"));
              return [...newBgs, ...otherPrev, ...keptTplDecor];
            }
            // Sem template do arquétipo: comportamento original.
            const cleaned = prev.filter(o => !o.id.startsWith("tpl-"));
            const next = [...result.overlays, ...cleaned];
            const bgs = next.filter(o => o.id.startsWith("tpl-bg-"));
            const others = next.filter(o => !o.id.startsWith("tpl-bg-"));
            return [...bgs, ...others];
          });
          setAutoLayoutBanner(true);
        }
        if (result.slots) setInitialTextBoxes(result.slots);
        const s = result.suggestions;
        if (!tplApplied) {
          if (s.titleFontSize) setTitleFontSize(s.titleFontSize);
          if (s.titleTextAlign) setTitleTextAlign(s.titleTextAlign);
          if (s.bodyFontSize) setFontSize(s.bodyFontSize);
          if (s.bodyTextAlign) setTextAlign(s.bodyTextAlign);
          if (typeof s.showSlideNumber === "boolean") setShowSlideNumber(s.showSlideNumber);
          if (s.slideNumberSize) setSlideNumberSize(s.slideNumberSize);
          // Aplicar sugestões de gradiente (estilo minimalista OU fallback de erro)
          if (s.useGradient) {
            setUseGradient(true);
            if (typeof s.gradientColor2Index === "number") setGradientColor2Index(s.gradientColor2Index);
            if (s.gradientDirection) setGradientDirection(s.gradientDirection);
          }
        }
        if (result.photographer) setActivePhotographer(result.photographer);
        // Salva imagem inicial do template (IA/Pexels) automaticamente na galeria pessoal
        const initialBgUrl = result.suggestions?.backgroundImageUrl;
        const initialSrc = result.suggestions?.backgroundSource;
        if (initialBgUrl && (initialSrc === "pexels" || initialSrc === "ai")) {
          console.log("Saving initial template bg to gallery:", initialSrc, initialBgUrl);
          saveSinglePhotoToGallery(initialBgUrl, initialSrc, result.photographer || null).catch(() => {});
        }
        // Toast claro quando o estilo escolhido falhou (evita confusão com minimal)
        if (result.styleFailed && initialStyle && initialStyle !== "minimal") {
          const styleName = initialStyle === "ai" ? "Geração por IA" : "Banco de imagens";
          toast({
            title: `${styleName} indisponível`,
            description: result.styleFailedReason
              ? `${result.styleFailedReason} Aplicamos um fundo gradiente — você pode trocar a imagem no editor.`
              : "Aplicamos um fundo gradiente — você pode trocar a imagem no editor.",
            variant: "destructive",
          });
        }
      } catch (err) {
        console.warn("Auto-layout failed", err);
      } finally {
        setInitializingLayout(null);
      }
    })();
  }, [user, day, palette, weekIndex, dayIndex, canvasFormat, bgIndex, initialStyle, userNiche, businessContext, imageContextLoaded]);

  // Carrossel + estilo Pexels: busca uma imagem independente para cada slide,
  // com variação sutil de opacidade e object-position para criar ritmo visual.
  // Apenas Pexels (gratuito); estilo "ai" mantém uma imagem só para não estourar custo.
  const slideBgRanRef = useRef(false);
  useEffect(() => {
    if (!day || slideBgRanRef.current) return;
    if (!imageContextLoaded) return;
    const isCarouselDay = day.format?.toLowerCase() === "carrossel";
    if (!isCarouselDay || initialStyle !== "pexels") return;
    const totalSlides = Math.max(1, day.card_copy?.length || 1);
    if (totalSlides <= 1) return;
    slideBgRanRef.current = true;

    const opacityCycle = [0.45, 0.55, 0.65];
    const positionCycle = ["center center", "center top", "center bottom"];
    const themeStr = (day.theme || day.caption || "").toString();
    const baseSeed = Date.now();

    (async () => {
      const updates: Record<number, { url: string; opacity: number; objectPosition: string }> = {};
      const usedUrls = new Set<string>();
      for (let i = 0; i < totalSlides; i++) {
        let url: string | undefined;
        // Tenta até 3 vezes com nonces diferentes para evitar colidir com
        // URLs já usadas em slides anteriores deste mesmo carrossel.
        for (let attempt = 0; attempt < 3 && !url; attempt++) {
          try {
            const slideBody = (day.card_copy?.[i] || day.caption || "").toString();
            const nonce = `${baseSeed}-${i}-${attempt}-${Math.random().toString(36).slice(2, 10)}`;
            const fetchPostImageBody = {
                theme: themeStr,
                caption: day.caption,
                body: slideBody,
                cardCopy: slideBody,
                format: canvasFormat === "reels" ? "reels" : "card",
                niche: userNiche,
                businessContext,
                mode: "single",
                nonce,
              };
            console.log("[fetch-post-image] carousel slide body", {
              slideIndex: i,
              attempt,
              niche: fetchPostImageBody.niche,
              hasNiche: Boolean(fetchPostImageBody.niche),
              body: fetchPostImageBody,
            });
            const res = await supabase.functions.invoke("fetch-post-image", {
              body: fetchPostImageBody,
            });
            const candidate = res?.data?.url;
            if (candidate && !usedUrls.has(candidate)) {
              url = candidate;
            } else if (candidate && attempt === 2) {
              // último recurso: aceita mesmo duplicado
              url = candidate;
            }
          } catch (err) {
            console.warn("[slide-bg] fetch failed for slide", i, "attempt", attempt, err);
          }
        }
        if (url) {
          usedUrls.add(url);
          updates[i] = {
            url,
            opacity: opacityCycle[i % opacityCycle.length],
            objectPosition: positionCycle[i % positionCycle.length],
          };
        }
      }
      if (Object.keys(updates).length > 0) {
        setSlideBackgrounds((prev) => ({ ...prev, ...updates }));
      }
    })();
  }, [day, canvasFormat, initialStyle, userNiche, businessContext, imageContextLoaded]);

  // Trocar imagem de fundo (busca nova do Unsplash)
  const handleSwapBackground = useCallback(async () => {
    if (swappingBackground || !day) return;
    setSwappingBackground(true);
    try {
      const themeStr = (day.theme || day.caption || "").toString();
      const bodyStr = (editedTexts[currentSlide] || day.card_copy?.[currentSlide] || day.caption || "").toString();
      const result = await fetchBackgroundImage({
        theme: themeStr,
        caption: day.caption,
        body: bodyStr,
        format: canvasFormat === "reels" ? "reels" : "card",
        allowAI: false,
        niche: userNiche,
        businessContext,
      });
      if (!result) {
        toast({ title: "Nenhuma imagem encontrada", description: "Tente outro tema ou suba sua própria foto.", variant: "destructive" });
        return;
      }
      setOverlayImages(prev => {
        const idx = prev.findIndex(o => o.id.startsWith("tpl-bg-"));
        if (idx >= 0) {
          // Atualiza o src e move o overlay de fundo para o início (atrás de tudo)
          const next = [...prev];
          const updated = { ...next[idx], src: result.url };
          next.splice(idx, 1);
          return [updated, ...next];
        }
        const w = canvasFormat === "reels" ? 1080 : 1080;
        const h = canvasFormat === "reels" ? 1920 : 1350;
        return [
          { id: `tpl-bg-${crypto.randomUUID()}`, src: result.url, x: 0, y: 0, width: w, height: h, type: "photo", opacity: 0.85 },
          ...prev,
        ];
      });
      if (result.photographer) setActivePhotographer(result.photographer);
      // Salva automaticamente na galeria pessoal (Pexels)
      saveSinglePhotoToGallery(result.url, "pexels", result.photographer || null).catch(() => {});
      toast({ title: "Imagem atualizada", description: "Fonte: Pexels (gratuita)." });
    } catch (err: any) {
      toast({ title: "Erro ao buscar imagem", description: err?.message, variant: "destructive" });
    } finally {
      setSwappingBackground(false);
    }
  }, [day, canvasFormat, swappingBackground, userNiche, businessContext]);

  // Debita 1 crédito de regeneração após geração IA bem-sucedida
  const debitRegenerationCredit = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    try {
      const current = balances?.regeneration_credits ?? 0;
      if (current <= 0) {
        toast({
          title: "Sem créditos de regeneração",
          description: "Você precisa comprar mais créditos para gerar imagens por IA.",
          variant: "destructive",
        });
        return false;
      }
      const newBalance = current - 1;
      const { error: updErr } = await supabase
        .from("user_balances")
        .update({ regeneration_credits: newBalance })
        .eq("user_id", user.id);
      if (updErr) {
        console.warn("Failed to debit regeneration credit", updErr);
        return false;
      }
      await supabase.from("credit_logs").insert({
        user_id: user.id,
        credit_type: "regeneration",
        amount: -1,
        description: "Geração de imagem IA no editor",
      });
      await refreshSubscription();
      return true;
    } catch (err) {
      console.warn("debitRegenerationCredit error", err);
      return false;
    }
  }, [user, balances?.regeneration_credits, refreshSubscription]);

  // Save draft on changes (debounced via effect dependencies)
  useEffect(() => {
    if (!textsInitializedRef.current) return;
    const timer = setTimeout(() => {
      saveDraft({
        weekIndex, dayIndex, editedTexts, editedTitle, overlayImages, uploadedImages,
        bgIndex, layout, currentSlide, fontSize, fontWeight, fontStyle,
        useGradient, gradientColor2Index, customGradientColor2, gradientDirection,
        textAlign, customTextColor, customBgColor, titleTextAlign,
        titleFontSize, titleColor, titleFontFamily,
        ctaText, ctaBgColor, ctaTextColor, ctaFontSize, ctaPosition,
        canvasFormat, showSlideNumber, slideNumberPosition,
        slideNumberBgColor, slideNumberTextColor, slideNumberSize,
        displayFont, bodyFont,
      }, initialStyle, canvasFormat);
    }, 300);
    return () => clearTimeout(timer);
  }, [editedTexts, editedTitle, overlayImages, uploadedImages, bgIndex, layout, currentSlide,
      fontSize, fontWeight, fontStyle, useGradient, gradientColor2Index, customGradientColor2,
      gradientDirection, textAlign, customTextColor, customBgColor, titleTextAlign,
      titleFontSize, titleColor, titleFontFamily,
      ctaText, ctaBgColor, ctaTextColor, ctaFontSize, ctaPosition,
      canvasFormat, showSlideNumber, slideNumberPosition,
      slideNumberBgColor, slideNumberTextColor, slideNumberSize,
      displayFont, bodyFont, weekIndex, dayIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedImageId) {
        const target = e.target as HTMLElement;
        if (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
        e.preventDefault();
        setOverlayImages((prev) => prev.filter((img) => img.id !== selectedImageId));
        setSelectedImageId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImageId]);

  const bgColor = customBgColor || palette[bgIndex]?.hex || "#1a1a2e";
  const textColor = customTextColor || getContrastColor(bgColor);
  const accentColor = palette[(bgIndex + 1) % Math.max(palette.length, 1)]?.hex || "#7c3aed";

  const gradientColor2 = customGradientColor2 || palette[gradientColor2Index]?.hex || accentColor;
  const bgGradient = useGradient && palette.length >= 2
    ? `linear-gradient(${gradientDirection}, ${bgColor}, ${gradientColor2})`
    : null;

  const isCarousel = day?.format?.toLowerCase() === "carrossel";

  // Quando há background por slide, substitui o overlay de fundo (tpl-bg-*)
  // pela imagem específica daquele slide + opacidade/object-position alternados.
  const carouselOverlays = (() => {
    if (!isCarousel) return overlayImages;
    const slideBg = slideBackgrounds[currentSlide];
    if (!slideBg) return overlayImages;
    return overlayImages.map((o) =>
      o.id.startsWith("tpl-bg-")
        ? { ...o, src: slideBg.url, opacity: slideBg.opacity, objectPosition: slideBg.objectPosition }
        : o
    );
  })();

  const handleAddImage = (image: OverlayImage) => {
    setOverlayImages((prev) => [...prev, image]);
    // Track uploaded photos in gallery
    if ((image.type === "photo" || image.type === "logo") && image.src) {
      setUploadedImages(prev => prev.includes(image.src) ? prev : [...prev, image.src]);
    }
  };

  const handleUpdateOverlay = (id: string, updates: Partial<OverlayImage>) => {
    setOverlayImages((prev) => prev.map((img) => (img.id === id ? { ...img, ...updates } : img)));
  };

  const handleImageMove = (id: string, x: number, y: number) => handleUpdateOverlay(id, { x, y });
  const handleImageResize = (id: string, width: number, height: number) => handleUpdateOverlay(id, { width, height });
  const handleImageOpacityChange = (id: string, opacity: number) => handleUpdateOverlay(id, { opacity });

  // Layer ordering — works on unified render order (text boxes + overlays)
  const handleBringForward = (id: string) => {
    setRenderOrder(prev => {
      const idx = prev.indexOf(id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const handleSendBackward = (id: string) => {
    setRenderOrder(prev => {
      const idx = prev.indexOf(id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx], next[idx - 1]] = [next[idx - 1], next[idx]];
      return next;
    });
  };

  const chromaKeyToTransparent = useCallback((dataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas context failed")); return; }
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imageData.data;
        const tolerance = 120;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          if (g > 150 && r < tolerance && b < tolerance && g > r + 30 && g > b + 30) {
            d[i + 3] = 0;
          }
          else if (g > 80 && r < 160 && b < 160 && g > r && g > b) {
            const greenness = (g - Math.max(r, b)) / g;
            if (greenness > 0.15) {
              d[i + 3] = Math.round(255 * (1 - greenness));
              d[i] = Math.min(255, Math.round(r * 1.3));
              d[i + 2] = Math.min(255, Math.round(b * 1.3));
            }
          }
        }
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] === 0) continue;
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const avg = (r + b) / 2;
          if (g > avg + 10) {
            d[i + 1] = Math.round(avg);
          }
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => reject(new Error("Failed to load image for chroma key"));
      img.src = dataUrl;
    });
  }, []);

  const handleRemoveBackground = useCallback(async (id: string) => {
    if (removingBackground) return;
    const overlay = overlayImages.find((img) => img.id === id);
    if (!overlay) return;
    const originalSrc = overlay.src;
    setRemovingBackground(true);

    const tryRemove = async (imageUrl: string) => {
      const { data, error } = await supabase.functions.invoke("remove-background", {
        body: { imageUrl },
      });
      if (error) throw error;
      if (data?.image && data.image.startsWith("data:image/")) {
        const transparentImage = data.chromaKey
          ? await chromaKeyToTransparent(data.image)
          : data.image;
        return transparentImage;
      }
      throw new Error(data?.error || "A IA não retornou uma imagem válida");
    };

    try {
      // Compress image before sending to reduce payload
      let imageToSend = overlay.src;
      if (overlay.src.startsWith("data:")) {
        try { imageToSend = await compressImage(overlay.src, 1024, 0.8); } catch {}
      }

      let result: string;
      try {
        result = await tryRemove(imageToSend);
      } catch (firstErr: any) {
        // Retry once
        try {
          result = await tryRemove(imageToSend);
        } catch (retryErr: any) {
          throw retryErr;
        }
      }

      handleUpdateOverlay(id, { src: result });
      toast({ title: "Fundo removido com sucesso!" });
    } catch (err: any) {
      handleUpdateOverlay(id, { src: originalSrc });
      const msg = err.message || "Erro ao remover fundo";
      toast({ title: msg, description: "Tente com uma imagem menor ou diferente.", variant: "destructive" });
    } finally {
      setRemovingBackground(false);
    }
  }, [overlayImages, removingBackground, chromaKeyToTransparent]);

  const handleDownloadSlide = useCallback(async (index: number) => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const el = isCarousel ? slideRefs.current[index] : singleCanvasRef.current;
      if (!el) return;
      const origTransform = el.style.transform;
      const origTransformOrigin = el.style.transformOrigin;
      el.style.transform = "scale(1)";
      el.style.transformOrigin = "top left";
      const canvas = await html2canvas(el, { scale: 2, width: cW, height: cH, useCORS: true });
      el.style.transform = origTransform;
      el.style.transformOrigin = origTransformOrigin;
      const link = document.createElement("a");
      link.download = `post-dia${day?.day || dayIndex + 1}${isCarousel ? `-slide${index + 1}` : ""}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch { toast({ title: "Erro ao exportar imagem", variant: "destructive" }); }
  }, [isCarousel, day, dayIndex, cW, cH]);

  const handleDownloadAll = useCallback(async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (let i = 0; i < editedTexts.length; i++) {
        setCurrentSlide(i);
        await new Promise((r) => setTimeout(r, 200));
        const el = slideRefs.current[i];
        if (!el) continue;
        const origTransform = el.style.transform;
        const origTransformOrigin = el.style.transformOrigin;
        el.style.transform = "scale(1)";
        el.style.transformOrigin = "top left";
        const canvas = await html2canvas(el, { scale: 2, width: cW, height: cH, useCORS: true });
        el.style.transform = origTransform;
        el.style.transformOrigin = origTransformOrigin;
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), "image/png"));
        zip.file(`slide-${i + 1}.png`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.download = `carrossel-dia${day?.day || dayIndex + 1}.zip`;
      link.href = URL.createObjectURL(zipBlob);
      link.click();
      URL.revokeObjectURL(link.href);
      toast({ title: "Carrossel exportado com sucesso!" });
    } catch { toast({ title: "Erro ao exportar ZIP", variant: "destructive" }); }
  }, [editedTexts, day, dayIndex, cW, cH]);

  const handleCtaMove = (x: number, y: number) => setCtaPosition({ x, y });

  const handleRecolorElement = (color: string) => {
    if (!selectedImageId) return;
    const overlay = overlayImages.find(o => o.id === selectedImageId);
    if (!overlay || overlay.type !== "element") return;
    try {
      const base64 = overlay.src.split("base64,")[1];
      if (!base64) return;
      const decoded = atob(base64);
      // Replace fill / stroke / color attrs (skip "none")
      let recolored = decoded.replace(/(fill|stroke|color)="(?!none)[^"]*"/g, (_m, attr) => `${attr}="${color}"`);
      // Ensure root <svg> carries a color attribute (drives currentColor on children)
      const svgOpen = recolored.match(/<svg[^>]*>/);
      if (svgOpen && !/\bcolor=/.test(svgOpen[0])) {
        recolored = recolored.replace(/<svg([^>]*)>/, `<svg$1 color="${color}">`);
      }
      // If no fill on root <svg>, inject it as well
      if (svgOpen && !/\bfill=/.test(svgOpen[0])) {
        recolored = recolored.replace(/<svg([^>]*)>/, `<svg$1 fill="${color}">`);
      }
      const encoded = btoa(recolored);
      handleUpdateOverlay(overlay.id, { src: `data:image/svg+xml;base64,${encoded}` });
    } catch (e) {
      console.error("Recolor failed", e);
    }
  };

  const designIdParam = searchParams.get("design");
  const fromTemplateParam = searchParams.get("fromTemplate") === "1";
  const fromGalleryParam = searchParams.get("fromGallery");
  const [currentDesignId, setCurrentDesignId] = useState<string | null>(fromTemplateParam ? null : designIdParam);
  const [savingDesign, setSavingDesign] = useState(false);
  const designLoadedRef = useRef(false);
  const galleryLoadedRef = useRef(false);

  // Pre-carrega imagem da galeria pessoal como background overlay
  useEffect(() => {
    if (!user || !fromGalleryParam || galleryLoadedRef.current) return;
    galleryLoadedRef.current = true;
    (async () => {
      const { data } = await supabase
        .from("user_gallery_assets")
        .select("file_path, name")
        .eq("id", fromGalleryParam)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) return;
      // Bucket privado — sempre URL assinada.
      const { data: signed } = await supabase.storage.from("user-uploads").createSignedUrl(data.file_path, 60 * 60);
      const signedUrl = signed?.signedUrl;
      if (!signedUrl) return;
      const w = canvasFormat === "reels" ? 1080 : 1080;
      const h = canvasFormat === "reels" ? 1920 : 1350;
      setOverlayImages(prev => [
        { id: `tpl-bg-${crypto.randomUUID()}`, src: signedUrl, x: 0, y: 0, width: w, height: h, type: "photo", opacity: 1 },
        ...prev.filter(o => !o.id.startsWith("tpl-bg-")),
      ]);
      toast({ title: "Imagem carregada da galeria", description: data.name });
    })();
  }, [user, fromGalleryParam, canvasFormat]);


  // Load existing design from ?design=ID
  useEffect(() => {
    if (!user || !designIdParam || designLoadedRef.current) return;
    designLoadedRef.current = true;
    supabase.from("user_designs").select("*").eq("id", designIdParam).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!data || !data.state) return;
        const s: any = data.state;
        // IMPORTANTE: o campo `archetype` do template (coluna ou state) NUNCA
        // sobrescreve o primaryArchetype do usuário atual. A tipografia/canvas
        // sempre usa o arquétipo derivado do relatório do próprio usuário.
        if ("archetype" in s) delete s.archetype;
        if (s.editedTexts) setEditedTexts(s.editedTexts);
        if (s.editedTitle) setEditedTitle(s.editedTitle);
        if (s.overlayImages) setOverlayImages(s.overlayImages);
        if (s.uploadedImages) setUploadedImages(s.uploadedImages);
        if (typeof s.bgIndex === "number") setBgIndex(s.bgIndex);
        if (s.layout) setLayout(s.layout);
        if (typeof s.currentSlide === "number") setCurrentSlide(s.currentSlide);
        if (typeof s.fontSize === "number") setFontSize(s.fontSize);
        if (s.fontWeight) setFontWeight(s.fontWeight);
        if (s.fontStyle) setFontStyle(s.fontStyle);
        if (typeof s.useGradient === "boolean") setUseGradient(s.useGradient);
        if (typeof s.gradientColor2Index === "number") setGradientColor2Index(s.gradientColor2Index);
        if (s.customGradientColor2 !== undefined) setCustomGradientColor2(s.customGradientColor2);
        if (s.gradientDirection) setGradientDirection(s.gradientDirection);
        if (s.textAlign) setTextAlign(s.textAlign);
        if (s.titleTextAlign) setTitleTextAlign(s.titleTextAlign);
        if (s.customTextColor !== undefined) setCustomTextColor(s.customTextColor);
        if (s.customBgColor !== undefined) setCustomBgColor(s.customBgColor);
        if (typeof s.titleFontSize === "number") setTitleFontSize(s.titleFontSize);
        if (s.titleColor !== undefined) setTitleColor(s.titleColor);
        if (s.titleFontFamily !== undefined) setTitleFontFamily(s.titleFontFamily);
        if (s.ctaText !== undefined) setCtaText(s.ctaText);
        if (s.ctaBgColor !== undefined) setCtaBgColor(s.ctaBgColor);
        if (s.ctaTextColor !== undefined) setCtaTextColor(s.ctaTextColor);
        if (typeof s.ctaFontSize === "number") setCtaFontSize(s.ctaFontSize);
        if (s.ctaPosition !== undefined) setCtaPosition(s.ctaPosition);
        if (s.canvasFormat) setCanvasFormat(s.canvasFormat);
        if (typeof s.showSlideNumber === "boolean") setShowSlideNumber(s.showSlideNumber);
        if (s.slideNumberPosition !== undefined) setSlideNumberPosition(s.slideNumberPosition);
        if (s.slideNumberBgColor !== undefined) setSlideNumberBgColor(s.slideNumberBgColor);
        if (s.slideNumberTextColor !== undefined) setSlideNumberTextColor(s.slideNumberTextColor);
        if (typeof s.slideNumberSize === "number") setSlideNumberSize(s.slideNumberSize);
        if (s.displayFont) { loadGoogleFont(s.displayFont); setDisplayFont(s.displayFont); }
        if (s.bodyFont) { loadGoogleFont(s.bodyFont); setBodyFont(s.bodyFont); }
        if (s.slideTextBoxes && typeof s.slideTextBoxes === "object") setSlideTextBoxes(s.slideTextBoxes);
        textsInitializedRef.current = true;
        bgInitializedRef.current = true;
      });
  }, [user, designIdParam]);

  // Cache em memória para evitar reinserir a mesma URL na mesma sessão
  const savedPhotoUrlsRef = useRef<Set<string>>(new Set());

  const saveSinglePhotoToGallery = useCallback(async (
    url: string,
    sourceHint?: "pexels" | "ai",
    photographer?: PhotographerInfo | null
  ): Promise<boolean> => {
    if (!user || !url) return false;
    const isHttpUrl = url.startsWith("http://") || url.startsWith("https://");
    const isDataUrl = url.startsWith("data:image/");
    if (!isHttpUrl && !isDataUrl) return false;
    const isFromOwnStorage =
      url.includes("/storage/v1/object/public/user-uploads/") ||
      url.includes("/storage/v1/object/sign/user-uploads/");
    if (isFromOwnStorage) return false;
    if (savedPhotoUrlsRef.current.has(url)) return false;
    savedPhotoUrlsRef.current.add(url);
    try {
      const resp = await fetch(url);
      if (!resp.ok) return false;
      const blob = await resp.blob();
      const normalizedType = blob.type || (isDataUrl ? "image/jpeg" : "image/jpg");
      const ext = (normalizedType.split("/")[1] || "jpg").split(";")[0];
      const id = crypto.randomUUID();
      const path = `${user.id}/saved-${id}.${ext}`;
      const isPexels = sourceHint === "pexels" || /images\.pexels\.com/.test(url);
      const source = sourceHint || (isPexels ? "pexels" : "ai");
      const { error: upErr } = await supabase.storage.from("user-uploads").upload(path, blob, { contentType: normalizedType, upsert: false });
      if (upErr) return false;
      const { error: insErr } = await supabase.from("user_gallery_assets").insert({
        user_id: user.id,
        name: isPexels ? "Foto Pexels salva" : (source === "ai" ? "Imagem gerada por IA" : "Imagem do post"),
        file_path: path,
        is_logo: false,
        bg_removed: false,
        source,
        attribution: (photographer || (isPexels ? activePhotographer : null)) as any,
      });
      if (insErr) return false;
      window.dispatchEvent(new CustomEvent("posiciona:gallery-updated"));
      return true;
    } catch (err) {
      console.warn("saveSinglePhotoToGallery failed", err);
      return false;
    }
  }, [user, activePhotographer]);

  const persistPostPhotosToGallery = useCallback(async (): Promise<number> => {
    if (!user) return 0;
    let added = 0;
    try {
      const photoOverlays = overlayImages.filter(o => o.type === "photo" && o.src && (o.src.startsWith("http://") || o.src.startsWith("https://")));
      if (photoOverlays.length === 0) return 0;
      // Pula URLs que já são da galeria do próprio usuário (storage user-uploads)
      const isFromOwnStorage = (url: string) =>
        url.includes("/storage/v1/object/public/user-uploads/") || url.includes("/storage/v1/object/sign/user-uploads/");
      const candidates = photoOverlays.filter(o => !isFromOwnStorage(o.src) && !savedPhotoUrlsRef.current.has(o.src));
      if (candidates.length === 0) return 0;
      for (const ov of candidates) {
        savedPhotoUrlsRef.current.add(ov.src);
        try {
          const resp = await fetch(ov.src);
          if (!resp.ok) continue;
          const blob = await resp.blob();
          const ext = (blob.type.split("/")[1] || "jpg").split(";")[0];
          const id = crypto.randomUUID();
          const path = `${user.id}/saved-${id}.${ext}`;
          const isPexels = /images\.pexels\.com/.test(ov.src);
          const { error: upErr } = await supabase.storage.from("user-uploads").upload(path, blob, { contentType: blob.type, upsert: false });
          if (upErr) continue;
          const { error: insErr } = await supabase.from("user_gallery_assets").insert({
            user_id: user.id,
            name: isPexels ? "Foto Pexels salva" : "Imagem do post",
            file_path: path,
            is_logo: false,
            bg_removed: false,
            source: isPexels ? "pexels" : "ai",
            attribution: activePhotographer && isPexels ? activePhotographer as any : null,
          });
          if (!insErr) added += 1;
        } catch {}
      }
    } catch (err) {
      console.warn("persistPostPhotosToGallery failed", err);
    }
    if (added > 0) window.dispatchEvent(new CustomEvent("posiciona:gallery-updated"));
    return added;
  }, [user, overlayImages, activePhotographer]);

  const doSaveDesign = useCallback(async (asTemplate: boolean) => {
    if (!user || savingDesign) return;
    setSavingDesign(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const el = isCarousel ? slideRefs.current[currentSlide] : singleCanvasRef.current;
      let thumbnail: string | null = null;
      if (el) {
        const origTransform = el.style.transform;
        const origOrigin = el.style.transformOrigin;
        el.style.transform = "scale(1)";
        el.style.transformOrigin = "top left";
        try {
          const c = await html2canvas(el, { scale: 0.3, width: cW, height: cH, useCORS: true });
          thumbnail = c.toDataURL("image/jpeg", 0.7);
        } catch {}
        el.style.transform = origTransform;
        el.style.transformOrigin = origOrigin;
      }

      const state: any = {
        editedTexts, editedTitle, overlayImages, uploadedImages,
        bgIndex, layout, currentSlide, fontSize, fontWeight, fontStyle,
        useGradient, gradientColor2Index, customGradientColor2, gradientDirection,
        textAlign, customTextColor, customBgColor, titleTextAlign,
        titleFontSize, titleColor, titleFontFamily,
        ctaText, ctaBgColor, ctaTextColor, ctaFontSize, ctaPosition,
        canvasFormat, showSlideNumber, slideNumberPosition,
        slideNumberBgColor, slideNumberTextColor, slideNumberSize,
        displayFont, bodyFont,
        slideTextBoxes,
      };
      const baseTitle = `Dia ${day?.day || dayIndex + 1} — ${cleanMarkdown(editedTitle || day?.theme || "Sem título").slice(0, 60)}`;
      const title = asTemplate ? `Modelo · ${baseTitle}` : baseTitle;

      // Persistir fotos do post na galeria do usuário (Unsplash + IA)
      const addedToGallery = await persistPostPhotosToGallery();
      const galleryNote = addedToGallery > 0
        ? ` ${addedToGallery} foto${addedToGallery > 1 ? "s" : ""} adicionada${addedToGallery > 1 ? "s" : ""} à sua galeria.`
        : "";

      if (currentDesignId && !asTemplate) {
        const { error } = await supabase.from("user_designs")
          .update({ title, state, thumbnail, week_index: weekIndex, day_index: dayIndex, updated_at: new Date().toISOString() })
          .eq("id", currentDesignId).eq("user_id", user.id);
        if (error) throw error;
        toast({ title: "Design atualizado", description: galleryNote || undefined });
      } else {
        const adminTemplate = isAdmin && asTemplate && searchParams.get("adminTemplate") === "1";
        const archetypeParam = searchParams.get("archetype");
        const insertPayload: any = { user_id: user.id, title, state, thumbnail, week_index: weekIndex, day_index: dayIndex, is_template: asTemplate };
        if (adminTemplate) {
          insertPayload.is_global = true;
          if (archetypeParam) insertPayload.archetype = archetypeParam;
        }
        const { data, error } = await supabase.from("user_designs")
          .insert(insertPayload)
          .select("id").single();
        if (error) throw error;
        if (data && !asTemplate) setCurrentDesignId(data.id);
        toast({ title: asTemplate ? (adminTemplate ? "Template global salvo" : "Modelo salvo") : "Design salvo", description: galleryNote || undefined });
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    } finally {
      setSavingDesign(false);
    }
  }, [user, savingDesign, currentDesignId, isCarousel, currentSlide, cW, cH, day, dayIndex, weekIndex,
      editedTexts, editedTitle, overlayImages, uploadedImages, bgIndex, layout, fontSize, fontWeight, fontStyle,
      useGradient, gradientColor2Index, customGradientColor2, gradientDirection, textAlign, customTextColor, customBgColor,
      titleFontSize, titleColor, titleFontFamily, ctaText, ctaBgColor, ctaTextColor, ctaFontSize, ctaPosition,
      canvasFormat, showSlideNumber, slideNumberPosition, slideNumberBgColor, slideNumberTextColor, slideNumberSize,
      displayFont, bodyFont, titleTextAlign, persistPostPhotosToGallery, slideTextBoxes, isAdmin, searchParams]);

  const handleSaveDesign = useCallback(() => doSaveDesign(false), [doSaveDesign]);
  const handleSaveAsTemplate = useCallback(() => doSaveDesign(true), [doSaveDesign]);


  const handleReset = () => {
    if (!day) return;
    const isCarouselDay = day?.format?.toLowerCase() === "carrossel";
    const rawCopy = (day.card_copy || []).map((t: string) => extractAfterBold(t));
    const copies = isCarouselDay
      ? prepareCarouselCardCopy({ cardCopy: rawCopy, caption: day.caption })
      : prepareSinglePostCardCopy({ cardCopy: rawCopy, caption: day.caption, theme: day.theme });
    setEditedTexts(copies.length > 0 ? copies : [""]);
    setEditedTitle(cleanText(day.theme || ""));
    setOverlayImages([]);
    setSelectedImageId(null);
    setFontSize(28);
    setFontWeight("normal");
    setFontStyle("normal");
    setUseGradient(false);
    setTextAlign("center");
    setTitleTextAlign("center");
    setCustomTextColor(null);
    setCustomBgColor(null);
    setCustomGradientColor2(null);
    setTitleFontSize(44);
    setTitleColor(null);
    setTitleFontFamily(null);
    setCtaText(cleanText(day.cta || ""));
    setCtaBgColor(null);
    setCtaTextColor(null);
    setCtaFontSize(28);
    setCtaPosition(null);
    setCanvasFormat("square");
    setShowSlideNumber(true);
    setSlideNumberPosition(null);
    setSlideNumberBgColor(null);
    setSlideNumberTextColor(null);
    setSlideNumberSize(14);
    if (typography.display) setDisplayFont(typography.display);
    if (typography.body) setBodyFont(typography.body);
    setUploadedImages([]);
    setSlideTextBoxes({});
    // Clear all draft keys including image refs
    const keysToRemove = [DRAFT_KEY];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(`${DRAFT_KEY}_`)) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
  };

  const handleCopyCaption = async () => {
    if (!day?.caption) return;
    try {
      await navigator.clipboard.writeText(cleanText(day.caption));
      setCopied(true);
      toast({ title: "Legenda copiada!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Erro ao copiar", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-96 w-full" /></div>
      </DashboardLayout>
    );
  }

  if (!day) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-muted-foreground">Conteúdo não encontrado.</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate("/editorial")}>
            <ArrowLeft className="h-4 w-4" /> Voltar à linha editorial
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-24 md:pb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate("/editorial")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold font-display">Dia {day.day || dayIndex + 1}: {cleanText(day.theme)}</h1>
            <p className="text-sm text-muted-foreground">
              Semana {weekIndex + 1} · {day.format}
              {isCarousel && ` · ${editedTexts.length} slides`}
              {canvasFormat === "reels" && " · Capa de Reels"}
              {selectedImageId && " · Pressione Delete para remover elemento selecionado"}
            </p>
          </div>
        </div>

        {autoLayoutBanner && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-foreground/80">Montagem inicial gerada. Personalize como quiser.</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAutoLayoutBanner(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-[1fr_280px]">
          <div className="relative flex items-center justify-center min-h-[400px] bg-muted/30 rounded-2xl p-4 overflow-hidden md:sticky md:top-4 md:self-start">
            {initializingLayout && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm rounded-2xl">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium text-foreground/90 text-center px-4">{initializingLayout}</p>
                <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-primary rounded-full animate-[loading-bar_1.4s_ease-in-out_infinite]" />
                </div>
              </div>
            )}
            {isCarousel ? (
              <CarouselEditor
                slides={editedTexts} theme={editedTitle} cta={ctaText || day.cta || ""}
                bgColor={bgColor} textColor={textColor} accentColor={accentColor}
                displayFont={displayFont} bodyFont={bodyFont} layout={layout}
                currentSlide={currentSlide} onSlideChange={setCurrentSlide}
                onSlideTextChange={(i, t) => { const copy = [...editedTexts]; copy[i] = t; setEditedTexts(copy); }}
                onDownloadSlide={handleDownloadSlide} onDownloadAll={handleDownloadAll}
                slideRefs={slideRefs}
                initialTextBoxes={initialTextBoxes}
                resetKey={`${initialStyle || "minimal"}-${canvasFormat}-${currentSlide}`}
                overlayImages={carouselOverlays} onUpdateOverlay={handleUpdateOverlay}
                onImageMove={handleImageMove} onImageResize={handleImageResize}
                selectedImageId={selectedImageId} onSelectImage={setSelectedImageId}
                fontSize={fontSize} fontWeight={fontWeight} fontStyle={fontStyle}
                textAlign={textAlign} titleTextAlign={titleTextAlign} bgGradient={bgGradient}
                titleFontSize={titleFontSize} titleColor={titleColor} titleFontFamily={titleFontFamily}
                ctaText={ctaText} ctaBgColor={ctaBgColor} ctaTextColor={ctaTextColor}
                ctaFontSize={ctaFontSize} ctaPosition={ctaPosition} onCtaMove={handleCtaMove}
                canvasWidth={cW} canvasHeight={cH}
                showSlideNumber={showSlideNumber}
                slideNumberPosition={slideNumberPosition}
                onSlideNumberMove={(x, y) => setSlideNumberPosition({ x, y })}
                slideNumberBgColor={slideNumberBgColor}
                slideNumberTextColor={slideNumberTextColor}
                slideNumberSize={slideNumberSize}
                onSelectedTextChange={setSelectedTextId}
                renderOrder={renderOrder}
                onRenderOrderChange={setRenderOrder}
                showRulers={showRulers}
                postStyle={initialStyle || undefined}
                primaryArchetype={primaryArchetype}
                slideTextBoxes={slideTextBoxes}
                onSlideTextBoxesChange={handleSlideTextBoxesChange}
              />
            ) : (
              <PostCanvas
                text={editedTexts[0] || ""} title={editedTitle} cta={day.cta}
                bgColor={bgColor} textColor={textColor} accentColor={accentColor}
                displayFont={displayFont} bodyFont={bodyFont} layout={layout}
                fontSize={fontSize} fontWeight={fontWeight} fontStyle={fontStyle}
                textAlign={textAlign} titleTextAlign={titleTextAlign}
                onTextChange={(t) => setEditedTexts([t])} onTitleChange={setEditedTitle}
                canvasRef={singleCanvasRef}
                overlayImages={overlayImages} onUpdateOverlay={handleUpdateOverlay}
                onImageMove={handleImageMove} onImageResize={handleImageResize}
                selectedImageId={selectedImageId} onSelectImage={setSelectedImageId}
                bgGradient={bgGradient}
                titleFontSize={titleFontSize} titleColor={titleColor} titleFontFamily={titleFontFamily}
                ctaText={ctaText} ctaBgColor={ctaBgColor} ctaTextColor={ctaTextColor}
                ctaFontSize={ctaFontSize} ctaPosition={ctaPosition} onCtaMove={handleCtaMove}
                canvasWidth={cW} canvasHeight={cH}
                onSelectedTextChange={setSelectedTextId}
                renderOrder={renderOrder}
                onRenderOrderChange={setRenderOrder}
                showRulers={showRulers}
                postStyle={initialStyle || undefined}
                primaryArchetype={primaryArchetype}
                initialTextBoxes={initialTextBoxes}
                resetKey={`${initialStyle || "minimal"}-${canvasFormat}`}
                textBoxes={slideTextBoxes[0]}
                onTextBoxesChange={(boxes) => handleSlideTextBoxesChange(0, boxes)}
              />
            )}
            {!isCarousel && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                <Button
                  size="sm"
                  className="gap-2 shadow-lg"
                  onClick={() => handleDownloadSlide(0)}
                >
                  <Download className="h-3.5 w-3.5" /> Baixar PNG
                </Button>
              </div>
            )}
          </div>

          {(() => {
            const selectedOverlay = selectedImageId ? overlayImages.find((o) => o.id === selectedImageId) ?? null : null;
            let selectedKind: import("@/components/post-editor/inspector/SelectionPanel").SelectedKind = null;
            if (selectedOverlay) {
              if (selectedOverlay.type === "textbox") selectedKind = "textbox";
              else if (selectedOverlay.type === "element") selectedKind = "icon";
              else selectedKind = "image";
            } else if (selectedTextId === "text-title") selectedKind = "title";
            else if (selectedTextId === "text-body") selectedKind = "body";
            else if (selectedTextId === "cta") selectedKind = "cta";
            else if (selectedTextId === "slideNumber") selectedKind = "slideNumber";
            const sharedToolbarProps = {
              palette: palette.map((c: any) => ({ hex: c.hex, name: c.name })),
              selectedBgIndex: bgIndex,
              bgHex: bgColor,
              onBgChange: (i: number) => { setCustomBgColor(null); setBgIndex(i); },
              onCustomBgColorChange: setCustomBgColor,
              onDownload: () => handleDownloadSlide(isCarousel ? currentSlide : 0),
              onReset: handleReset,
              onAddImage: handleAddImage,
              recommendedFonts: { display: typography.display, body: typography.body },
              selectedKind,
              fontSize, onFontSizeChange: setFontSize,
              fontWeight, onFontWeightChange: setFontWeight,
              fontStyle, onFontStyleChange: setFontStyle,
              bodyFont, onBodyFontChange: (f: string) => { loadGoogleFont(f); setBodyFont(f); },
              displayFont,
              textAlign: textAlign as any, onTextAlignChange: setTextAlign as any,
              textColor, onTextColorChange: setCustomTextColor,
              onImageOpacityChange: handleImageOpacityChange,
              onUpdateOverlaySrc: handleUpdateOverlay,
              useGradient, onUseGradientChange: setUseGradient,
              gradientColor2Index,
              onGradientColor2Change: (i: number) => { setCustomGradientColor2(null); setGradientColor2Index(i); },
              customGradientColor2, onCustomGradientColor2Change: setCustomGradientColor2,
              gradientDirection, onGradientDirectionChange: setGradientDirection,
              titleFontSize, onTitleFontSizeChange: setTitleFontSize,
              titleColor, onTitleColorChange: setTitleColor,
              titleFontFamily, onTitleFontFamilyChange: setTitleFontFamily,
              titleTextAlign, onTitleTextAlignChange: setTitleTextAlign,
              ctaText, onCtaTextChange: setCtaText,
              ctaBgColor, onCtaBgColorChange: setCtaBgColor,
              ctaTextColor, onCtaTextColorChange: setCtaTextColor,
              ctaFontSize, onCtaFontSizeChange: setCtaFontSize,
              userPortraits,
              canvasFormat: canvasFormat as any, onCanvasFormatChange: setCanvasFormat as any,
              onRemoveBackground: (id: string) => handleRemoveBackground(id),
              removingBackground,
              selectedOverlay,
              selectedLayerId: selectedImageId,
              onBringForward: handleBringForward, onSendBackward: handleSendBackward,
              onDeleteOverlay: (id: string) => {
                setOverlayImages((prev) => prev.filter((img) => img.id !== id));
                setSelectedImageId(null);
              },
              showSlideNumber, onShowSlideNumberChange: setShowSlideNumber,
              slideNumberBgColor, onSlideNumberBgColorChange: setSlideNumberBgColor,
              slideNumberTextColor, onSlideNumberTextColorChange: setSlideNumberTextColor,
              slideNumberSize, onSlideNumberSizeChange: setSlideNumberSize,
              isCarousel,
              onRecolorElement: handleRecolorElement,
              showRulers, onShowRulersChange: setShowRulers,
              onSwapBackgroundImage: handleSwapBackground,
              swappingBackground,
              imageSearchQuery: (day?.theme || "").toString().slice(0, 80),
              onPexelsPick: (photographer: PhotographerInfo) => setActivePhotographer(photographer),
              onSwapBackgroundUrl: (url: string, source?: "ai" | "pexels" | "saved") => {
                setOverlayImages(prev => {
                  const idx = prev.findIndex(o => o.id.startsWith("tpl-bg-"));
                  if (idx >= 0) {
                    const next = [...prev];
                    const updated = { ...next[idx], src: url };
                    next.splice(idx, 1);
                    return [updated, ...next];
                  }
                  const w = canvasFormat === "reels" ? 1080 : 1080;
                  const h = canvasFormat === "reels" ? 1920 : 1350;
                  return [
                    { id: `tpl-bg-${crypto.randomUUID()}`, src: url, x: 0, y: 0, width: w, height: h, type: "photo", opacity: 0.85 },
                    ...prev,
                  ];
                });
                // Salva automaticamente na galeria pessoal — só quando NÃO veio da própria galeria.
                console.log("PostEditor: onSwapBackgroundUrl picked", { url, source });
                if (source !== "saved") {
                  const hint: "ai" | "pexels" | undefined =
                    source === "ai" ? "ai" : source === "pexels" ? "pexels" : undefined;
                  saveSinglePhotoToGallery(url, hint)
                    .then((saved) => {
                      if (saved && source === "ai") {
                        toast({ title: "Imagem IA salva", description: "A imagem gerada já entrou na sua galeria." });
                      }
                    })
                    .catch((e) => console.warn("save bg to gallery failed", e));
                }
              },
              onAIGenerated: debitRegenerationCredit,
              regenerationCredits: balances?.regeneration_credits ?? 0,
              niche: userNiche,
              businessContext,
              caption: (day?.caption || "").toString(),
              postBody: (editedTexts[currentSlide] || day?.card_copy?.[currentSlide] || day?.caption || "").toString(),
              onUndo: undo,
              canUndo,
            };

            return (
              <>
                <div className="hidden md:block">
                  <PostToolbar
                    {...sharedToolbarProps}
                    onSaveDesign={handleSaveDesign}
                    onSaveAsTemplate={handleSaveAsTemplate}
                    saving={savingDesign}
                  />
                </div>
                {isMobile && (
                  <MobileEditorBar
                    {...sharedToolbarProps}
                    onSaveDesign={handleSaveDesign}
                    saving={savingDesign}
                  />
                )}
              </>
            );
          })()}
        </div>

        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Legenda do Instagram</h3>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleCopyCaption}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </div>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">{cleanMarkdown(day.caption || "")}</p>
        </div>
      </div>

    </DashboardLayout>
  );
};

export default PostEditorPage;
