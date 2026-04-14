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
import type { OverlayImage } from "@/components/post-editor/PostToolbar";
import { parseReportContent } from "@/lib/reportParser";

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

const PostEditorPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const weekIndex = parseInt(searchParams.get("week") || "0", 10);
  const dayIndex = parseInt(searchParams.get("day") || "0", 10);

  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bgIndex, setBgIndex] = useState(0);
  const [layout, setLayout] = useState<"centered" | "top" | "split">("centered");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [editedTexts, setEditedTexts] = useState<string[]>([]);
  const [editedTitle, setEditedTitle] = useState("");
  const [overlayImages, setOverlayImages] = useState<OverlayImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(28);
  const [fontWeight, setFontWeight] = useState("normal");
  const [fontStyle, setFontStyle] = useState("normal");
  const [useGradient, setUseGradient] = useState(false);
  const [gradientColor2Index, setGradientColor2Index] = useState(1);
  const [gradientDirection, setGradientDirection] = useState("to right");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right" | "justify">("center");
  const [customTextColor, setCustomTextColor] = useState<string | null>(null);
  const [customBgColor, setCustomBgColor] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [removingBackground, setRemovingBackground] = useState(false);
  const [titleFontSize, setTitleFontSize] = useState(44);
  const [titleColor, setTitleColor] = useState<string | null>(null);
  const [titleFontFamily, setTitleFontFamily] = useState<string | null>(null);
  const [ctaText, setCtaText] = useState("");
  const [ctaBgColor, setCtaBgColor] = useState<string | null>(null);
  const [ctaTextColor, setCtaTextColor] = useState<string | null>(null);
  const [ctaFontSize, setCtaFontSize] = useState(28);
  const [ctaPosition, setCtaPosition] = useState<{ x: number; y: number } | null>(null);
  const [userPortraits, setUserPortraits] = useState<string[]>([]);
  const [canvasFormat, setCanvasFormat] = useState<"square" | "reels">("square");
  const singleCanvasRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  const cW = canvasFormat === "reels" ? 1080 : 1080;
  const cH = canvasFormat === "reels" ? 1920 : 1080;

  useEffect(() => {
    if (!user) return;
    supabase.from("reports").select("*").eq("user_id", user.id).order("version", { ascending: false }).limit(1).single()
      .then(({ data }) => { setReport(data); setLoading(false); });
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

  const [displayFont, setDisplayFont] = useState(typography.display || "Space Grotesk");
  const [bodyFont, setBodyFont] = useState(typography.body || "Inter");

  useEffect(() => {
    if (typography.display) { setDisplayFont(typography.display); loadGoogleFont(typography.display); }
    if (typography.body) { setBodyFont(typography.body); loadGoogleFont(typography.body); }
  }, [typography.display, typography.body]);

  useEffect(() => {
    if (!day) return;
    const copies = day.card_copy || [day.caption || ""];
    setEditedTexts(copies);
    setEditedTitle(day.theme || "");
    setCtaText(day.cta || "");
  }, [day]);

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

  const bgGradient = useGradient && palette.length >= 2
    ? `linear-gradient(${gradientDirection}, ${bgColor}, ${palette[gradientColor2Index]?.hex || accentColor})`
    : null;

  const isCarousel = day?.format?.toLowerCase() === "carrossel";

  const handleAddImage = (image: OverlayImage) => setOverlayImages((prev) => [...prev, image]);

  // Unified overlay update
  const handleUpdateOverlay = (id: string, updates: Partial<OverlayImage>) => {
    setOverlayImages((prev) => prev.map((img) => (img.id === id ? { ...img, ...updates } : img)));
  };

  // Legacy compat
  const handleImageMove = (id: string, x: number, y: number) => handleUpdateOverlay(id, { x, y });
  const handleImageResize = (id: string, width: number, height: number) => handleUpdateOverlay(id, { width, height });
  const handleImageOpacityChange = (id: string, opacity: number) => handleUpdateOverlay(id, { opacity });

  const handleRemoveBackground = useCallback(async (id: string) => {
    const overlay = overlayImages.find((img) => img.id === id);
    if (!overlay) return;
    setRemovingBackground(true);
    try {
      const { data, error } = await supabase.functions.invoke("remove-background", {
        body: { imageUrl: overlay.src },
      });
      if (error) throw error;
      if (data?.image) {
        handleUpdateOverlay(id, { src: data.image });
        toast({ title: "Fundo removido com sucesso!" });
      } else {
        throw new Error(data?.error || "Erro ao processar imagem");
      }
    } catch (err: any) {
      toast({ title: err.message || "Erro ao remover fundo", variant: "destructive" });
    } finally {
      setRemovingBackground(false);
    }
  }, [overlayImages, handleUpdateOverlay]);

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

  const handleReset = () => {
    if (!day) return;
    setEditedTexts(day.card_copy || [day.caption || ""]);
    setEditedTitle(day.theme || "");
    setOverlayImages([]);
    setSelectedImageId(null);
    setFontSize(28);
    setFontWeight("normal");
    setFontStyle("normal");
    setUseGradient(false);
    setTextAlign("center");
    setCustomTextColor(null);
    setCustomBgColor(null);
    setTitleFontSize(44);
    setTitleColor(null);
    setTitleFontFamily(null);
    setCtaText(day.cta || "");
    setCtaBgColor(null);
    setCtaTextColor(null);
    setCtaFontSize(28);
    setCtaPosition(null);
    setCanvasFormat("square");
    if (typography.display) setDisplayFont(typography.display);
    if (typography.body) setBodyFont(typography.body);
  };

  const handleCopyCaption = async () => {
    if (!day?.caption) return;
    try {
      await navigator.clipboard.writeText(day.caption);
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
      <div className="space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate("/editorial")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold font-display">Dia {day.day || dayIndex + 1}: {day.theme}</h1>
            <p className="text-sm text-muted-foreground">
              Semana {weekIndex + 1} · {day.format}
              {isCarousel && ` · ${editedTexts.length} slides`}
              {canvasFormat === "reels" && " · Capa de Reels"}
              {selectedImageId && " · Pressione Delete para remover elemento selecionado"}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="flex items-center justify-center min-h-[400px] bg-muted/30 rounded-2xl p-4 overflow-hidden">
            {isCarousel ? (
              <CarouselEditor
                slides={editedTexts} theme={editedTitle} cta={ctaText || day.cta || ""}
                bgColor={bgColor} textColor={textColor} accentColor={accentColor}
                displayFont={displayFont} bodyFont={bodyFont} layout={layout}
                currentSlide={currentSlide} onSlideChange={setCurrentSlide}
                onSlideTextChange={(i, t) => { const copy = [...editedTexts]; copy[i] = t; setEditedTexts(copy); }}
                onDownloadSlide={handleDownloadSlide} onDownloadAll={handleDownloadAll}
                slideRefs={slideRefs}
                overlayImages={overlayImages} onUpdateOverlay={handleUpdateOverlay}
                onImageMove={handleImageMove} onImageResize={handleImageResize}
                selectedImageId={selectedImageId} onSelectImage={setSelectedImageId}
                fontSize={fontSize} fontWeight={fontWeight} fontStyle={fontStyle}
                textAlign={textAlign} bgGradient={bgGradient}
                titleFontSize={titleFontSize} titleColor={titleColor} titleFontFamily={titleFontFamily}
                ctaText={ctaText} ctaBgColor={ctaBgColor} ctaTextColor={ctaTextColor}
                ctaFontSize={ctaFontSize} ctaPosition={ctaPosition} onCtaMove={handleCtaMove}
                canvasWidth={cW} canvasHeight={cH}
              />
            ) : (
              <PostCanvas
                text={editedTexts[0] || ""} title={editedTitle} cta={day.cta}
                bgColor={bgColor} textColor={textColor} accentColor={accentColor}
                displayFont={displayFont} bodyFont={bodyFont} layout={layout}
                fontSize={fontSize} fontWeight={fontWeight} fontStyle={fontStyle}
                textAlign={textAlign}
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
              />
            )}
          </div>

          <PostToolbar
            palette={palette.map((c: any) => ({ hex: c.hex, name: c.name }))}
            selectedBgIndex={bgIndex} onBgChange={(i) => { setCustomBgColor(null); setBgIndex(i); }}
            onCustomBgColorChange={setCustomBgColor}
            layout={layout} onLayoutChange={setLayout}
            onDownload={() => handleDownloadSlide(isCarousel ? currentSlide : 0)}
            onReset={handleReset} onAddImage={handleAddImage}
            recommendedFonts={{ display: typography.display, body: typography.body }}
            fontSize={fontSize} onFontSizeChange={setFontSize}
            fontWeight={fontWeight} onFontWeightChange={setFontWeight}
            fontStyle={fontStyle} onFontStyleChange={setFontStyle}
            bodyFont={bodyFont} onBodyFontChange={(f) => { loadGoogleFont(f); setBodyFont(f); }}
            displayFont={displayFont} onDisplayFontChange={(f) => { loadGoogleFont(f); setDisplayFont(f); }}
            textAlign={textAlign} onTextAlignChange={setTextAlign}
            textColor={textColor} onTextColorChange={setCustomTextColor}
            selectedImageId={selectedImageId}
            overlayImages={overlayImages}
            onImageOpacityChange={handleImageOpacityChange}
            onUpdateOverlaySrc={handleUpdateOverlay}
            useGradient={useGradient} onUseGradientChange={setUseGradient}
            gradientColor2Index={gradientColor2Index} onGradientColor2Change={setGradientColor2Index}
            gradientDirection={gradientDirection} onGradientDirectionChange={setGradientDirection}
            titleFontSize={titleFontSize} onTitleFontSizeChange={setTitleFontSize}
            titleColor={titleColor} onTitleColorChange={setTitleColor}
            titleFontFamily={titleFontFamily} onTitleFontFamilyChange={setTitleFontFamily}
            ctaText={ctaText} onCtaTextChange={setCtaText}
            ctaBgColor={ctaBgColor} onCtaBgColorChange={setCtaBgColor}
            ctaTextColor={ctaTextColor} onCtaTextColorChange={setCtaTextColor}
            ctaFontSize={ctaFontSize} onCtaFontSizeChange={setCtaFontSize}
            userPortraits={userPortraits}
            canvasFormat={canvasFormat} onCanvasFormatChange={setCanvasFormat}
            onRemoveBackground={handleRemoveBackground} removingBackground={removingBackground}
          />
        </div>

        <div className="bg-card rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Legenda do Instagram</h3>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleCopyCaption}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </div>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">{day.caption}</p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PostEditorPage;
