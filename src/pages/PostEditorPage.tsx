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
import { parseReportContent } from "@/lib/reportParser";
import { cleanMarkdown, extractAfterBold, cleanText, stripFrameworkLabels } from "@/lib/textCleanup";
import { compressImage } from "@/lib/imageUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import { buildAutoLayout, fetchBackgroundImage, type PostStyle, type PhotographerInfo } from "@/lib/postAutoLayout";
import UnsplashAttribution from "@/components/post-editor/UnsplashAttribution";
import { Sparkles, X, Image as ImageIcon, Loader2 } from "lucide-react";

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
  const { user, balances, refreshSubscription } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const weekIndex = parseInt(searchParams.get("week") || "0", 10);
  const dayIndex = parseInt(searchParams.get("day") || "0", 10);
  const initialStyle = (searchParams.get("style") as PostStyle | null) || undefined;
  const initialFormatParam = searchParams.get("format");

  const targetFormat: "square" | "reels" = initialFormatParam === "reels" ? "reels" : "square";
  const hasDesignParam = !!searchParams.get("design");
  const draft = hasDesignParam ? null : loadDraft(weekIndex, dayIndex, initialStyle, targetFormat);

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userNiche, setUserNiche] = useState<string>("");
  const [businessContext, setBusinessContext] = useState<string>("");
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
  const [autoLayoutBanner, setAutoLayoutBanner] = useState(false);
  const [swappingBackground, setSwappingBackground] = useState(false);
  const [activePhotographer, setActivePhotographer] = useState<PhotographerInfo | null>(null);
  const [initialTextBoxes, setInitialTextBoxes] = useState<{ title?: { x: number; y: number; width: number; height: number }; body?: { x: number; y: number; width: number; height: number } } | undefined>(undefined);
  const [initializingLayout, setInitializingLayout] = useState<string | null>(
    !!draft || hasDesignParam ? null : (initialStyle === "ai" ? "Gerando imagem com IA…" : initialStyle === "unsplash" ? "Buscando foto editorial…" : "Preparando layout…")
  );
  const singleCanvasRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textsInitializedRef = useRef(!!draft);
  const bgInitializedRef = useRef(!!draft);
  const autoLayoutRanRef = useRef(!!draft || hasDesignParam);

  // Card 4:5 (1080×1350) ou Reels 9:16 (1080×1920)
  const cW = canvasFormat === "reels" ? 1080 : 1080;
  const cH = canvasFormat === "reels" ? 1920 : 1350;

  useEffect(() => {
    if (!user) return;
    supabase.from("reports").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).single()
      .then(({ data }) => { setReport(data); setLoading(false); });
    supabase.from("profiles").select("niche").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.niche) setUserNiche(data.niche); });
    supabase.from("business_questionnaires").select("services,target_audience,company_name")
      .eq("user_id", user.id).order("version", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const ctx = [data.company_name, data.services, data.target_audience].filter(Boolean).join(" ");
          setBusinessContext(ctx);
        }
      });
    supabase.from("portrait_generations").select("portraits").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          const urls: string[] = [];
          data.forEach((row: any) => {
            const p = row.portraits;
            if (Array.isArray(p)) p.forEach((u: any) => { if (typeof u === "string") urls.push(u); });
          });
          setUserPortraits(urls);
        }
      });
  }, [user]);

  const { contentObject, hasEditorial } = parseReportContent(report?.content);
  const content = contentObject ?? {};
  const structuredEditorial = Array.isArray(content.editorial) ? content.editorial : [];
  const editorialWeeks: any[][] = Array.isArray(report?.editorial_weeks) ? report.editorial_weeks : [];
  const allWeeks = [
    ...(hasEditorial && structuredEditorial.length > 0 ? [structuredEditorial] : []),
    ...editorialWeeks,
  ];

  const day = allWeeks[weekIndex]?.[dayIndex];
  const palette = Array.isArray(content.visual_identity?.palette) ? content.visual_identity.palette : [];
  const typography = typeof content.visual_identity?.typography === "object" && content.visual_identity?.typography !== null
    ? content.visual_identity.typography
    : {};

  const [displayFont, setDisplayFont] = useState(draft?.displayFont || typography.display || "Space Grotesk");
  const [bodyFont, setBodyFont] = useState(draft?.bodyFont || typography.body || "Inter");

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
    const copies = (day.card_copy || [day.caption || ""]).map((t: string) => extractAfterBold(t));
    setEditedTexts(copies);
    setEditedTitle(cleanText(day.theme || ""));
    setCtaText(cleanText(day.cta || ""));
    textsInitializedRef.current = true;
  }, [day]);

  // Auto-layout: monta layout inicial (template + bg Unsplash + logo) na primeira abertura
  useEffect(() => {
    if (!user || !day || autoLayoutRanRef.current) return;
    if (!Array.isArray(palette) || palette.length === 0) return;
    autoLayoutRanRef.current = true;
    const isCarouselDay = day?.format?.toLowerCase() === "carrossel";
    const totalSlides = isCarouselDay ? Math.max(1, (day.card_copy?.length || 1)) : 1;
    const themeStr = (day.theme || day.caption || "").toString();
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
          hasCta: !!day.cta,
          paletteHex: palette.map((c: any) => c.hex),
          bgPaletteHex: palette[bgIndex]?.hex || "#1a1a2e",
          userId: user.id,
          style: initialStyle,
          niche: userNiche,
          businessContext,
        });
        if (result.overlays.length > 0) {
          setOverlayImages(prev => {
            // Limpa overlays automáticos anteriores (tpl-*) antes de aplicar os novos
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
        if (result.photographer) setActivePhotographer(result.photographer);
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
  }, [user, day, palette, weekIndex, dayIndex, canvasFormat, bgIndex, initialStyle, userNiche, businessContext]);

  // Trocar imagem de fundo (busca nova do Unsplash)
  const handleSwapBackground = useCallback(async () => {
    if (swappingBackground || !day) return;
    setSwappingBackground(true);
    try {
      const themeStr = (day.theme || day.caption || "").toString();
      const result = await fetchBackgroundImage({
        theme: themeStr,
        caption: day.caption,
        format: canvasFormat === "reels" ? "portrait" : "square",
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
      toast({ title: "Imagem atualizada", description: "Fonte: Unsplash (gratuita)." });
    } catch (err: any) {
      toast({ title: "Erro ao buscar imagem", description: err?.message, variant: "destructive" });
    } finally {
      setSwappingBackground(false);
    }
  }, [day, canvasFormat, swappingBackground, userNiche, businessContext]);

  // Debita 1 crédito de regeneração após geração IA bem-sucedida
  const debitRegenerationCredit = useCallback(async () => {
    if (!user) return;
    try {
      const current = balances?.regeneration_credits ?? 0;
      if (current <= 0) {
        toast({
          title: "Sem créditos de regeneração",
          description: "Você precisa comprar mais créditos para gerar imagens por IA.",
          variant: "destructive",
        });
        return;
      }
      const newBalance = current - 1;
      const { error: updErr } = await supabase
        .from("user_balances")
        .update({ regeneration_credits: newBalance })
        .eq("user_id", user.id);
      if (updErr) {
        console.warn("Failed to debit regeneration credit", updErr);
        return;
      }
      await supabase.from("credit_logs").insert({
        user_id: user.id,
        credit_type: "regeneration",
        amount: -1,
        description: "Geração de imagem IA no editor",
      });
      await refreshSubscription();
    } catch (err) {
      console.warn("debitRegenerationCredit error", err);
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
  const [currentDesignId, setCurrentDesignId] = useState<string | null>(designIdParam);
  const [savingDesign, setSavingDesign] = useState(false);
  const designLoadedRef = useRef(false);

  // Load existing design from ?design=ID
  useEffect(() => {
    if (!user || !designIdParam || designLoadedRef.current) return;
    designLoadedRef.current = true;
    supabase.from("user_designs").select("*").eq("id", designIdParam).eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (!data || !data.state) return;
        const s: any = data.state;
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
        textsInitializedRef.current = true;
        bgInitializedRef.current = true;
      });
  }, [user, designIdParam]);

  const handleSaveDesign = useCallback(async () => {
    if (!user || savingDesign) return;
    setSavingDesign(true);
    try {
      // Capture thumbnail
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
      };
      const title = `Dia ${day?.day || dayIndex + 1} — ${cleanMarkdown(editedTitle || day?.theme || "Sem título").slice(0, 60)}`;

      if (currentDesignId) {
        const { error } = await supabase.from("user_designs")
          .update({ title, state, thumbnail, week_index: weekIndex, day_index: dayIndex, updated_at: new Date().toISOString() })
          .eq("id", currentDesignId).eq("user_id", user.id);
        if (error) throw error;
        toast({ title: "Design atualizado" });
      } else {
        const { data, error } = await supabase.from("user_designs")
          .insert({ user_id: user.id, title, state, thumbnail, week_index: weekIndex, day_index: dayIndex })
          .select("id").single();
        if (error) throw error;
        if (data) setCurrentDesignId(data.id);
        toast({ title: "Design salvo" });
      }
    } catch (err: any) {
      console.error(err);
      toast({ title: "Erro ao salvar design", description: err?.message, variant: "destructive" });
    } finally {
      setSavingDesign(false);
    }
  }, [user, savingDesign, currentDesignId, isCarousel, currentSlide, cW, cH, day, dayIndex, weekIndex,
      editedTexts, editedTitle, overlayImages, uploadedImages, bgIndex, layout, fontSize, fontWeight, fontStyle,
      useGradient, gradientColor2Index, customGradientColor2, gradientDirection, textAlign, customTextColor, customBgColor,
      titleFontSize, titleColor, titleFontFamily, ctaText, ctaBgColor, ctaTextColor, ctaFontSize, ctaPosition,
      canvasFormat, showSlideNumber, slideNumberPosition, slideNumberBgColor, slideNumberTextColor, slideNumberSize,
      displayFont, bodyFont]);


  const handleReset = () => {
    if (!day) return;
    const copies = (day.card_copy || [day.caption || ""]).map((t: string) => extractAfterBold(t));
    setEditedTexts(copies);
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
                overlayImages={overlayImages} onUpdateOverlay={handleUpdateOverlay}
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
                showCoordinates={showCoordinates}
                postStyle={initialStyle || undefined}
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
                showCoordinates={showCoordinates}
                postStyle={initialStyle || undefined}
                initialTextBoxes={initialTextBoxes}
                resetKey={`${initialStyle || "minimal"}-${canvasFormat}`}
              />
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
              showCoordinates, onShowCoordinatesChange: setShowCoordinates,
              onSwapBackgroundImage: handleSwapBackground,
              swappingBackground,
              imageSearchQuery: (day?.theme || day?.caption || "").toString(),
              onUnsplashPick: (photographer: PhotographerInfo) => setActivePhotographer(photographer),
              onSwapBackgroundUrl: (url: string) => {
                setOverlayImages(prev => {
                  const idx = prev.findIndex(o => o.id.startsWith("tpl-bg-"));
                  if (idx >= 0) {
                    const next = [...prev];
                    const updated = { ...next[idx], src: url };
                    next.splice(idx, 1);
                    return [updated, ...next];
                  }
                  const w = canvasFormat === "reels" ? 1080 : 1080;
                  const h = canvasFormat === "reels" ? 1920 : 1080;
                  return [
                    { id: `tpl-bg-${crypto.randomUUID()}`, src: url, x: 0, y: 0, width: w, height: h, type: "photo", opacity: 0.85 },
                    ...prev,
                  ];
                });
              },
              onAIGenerated: debitRegenerationCredit,
              regenerationCredits: balances?.regeneration_credits ?? 0,
            };

            return (
              <>
                <div className="hidden md:block">
                  <PostToolbar
                    {...sharedToolbarProps}
                    onSaveDesign={handleSaveDesign}
                    saving={savingDesign}
                  />
                </div>
                {isMobile && <MobileEditorBar {...sharedToolbarProps} />}
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

      {activePhotographer && (
        <UnsplashAttribution
          photographer={activePhotographer}
          onDismiss={() => setActivePhotographer(null)}
          autoDismissMs={5000}
        />
      )}
    </DashboardLayout>
  );
};

export default PostEditorPage;
