import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import PostCanvas from "@/components/post-editor/PostCanvas";
import CarouselEditor from "@/components/post-editor/CarouselEditor";
import PostToolbar from "@/components/post-editor/PostToolbar";

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
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@300;400;500;600;700&display=swap`;
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
  const singleCanvasRef = useRef<HTMLDivElement>(null);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("reports")
      .select("*")
      .eq("user_id", user.id)
      .order("version", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        setReport(data);
        setLoading(false);
      });
  }, [user]);

  const content = report?.content;
  const isStructured = typeof content === "object" && content !== null && content.archetypes;

  const editorialWeeks: any[][] = report?.editorial_weeks || [];
  const allWeeks = [
    ...(isStructured && content.editorial ? [content.editorial] : []),
    ...editorialWeeks,
  ];

  const day = allWeeks[weekIndex]?.[dayIndex];
  const palette = content?.visual_identity?.palette || [];
  const typography = content?.visual_identity?.typography || {};

  // Load fonts
  useEffect(() => {
    if (typography.display) loadGoogleFont(typography.display);
    if (typography.body) loadGoogleFont(typography.body);
  }, [typography]);

  // Initialize editable texts
  useEffect(() => {
    if (!day) return;
    const copies = day.card_copy || [day.caption || ""];
    setEditedTexts(copies);
    setEditedTitle(day.theme || "");
  }, [day]);

  const bgColor = palette[bgIndex]?.hex || "#1a1a2e";
  const textColor = getContrastColor(bgColor);
  const accentColor = palette[(bgIndex + 1) % Math.max(palette.length, 1)]?.hex || "#7c3aed";
  const displayFont = typography.display || "Space Grotesk";
  const bodyFont = typography.body || "Inter";

  const isCarousel = day?.format?.toLowerCase() === "carrossel";

  const handleDownloadSlide = useCallback(async (index: number) => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const el = isCarousel ? slideRefs.current[index] : singleCanvasRef.current;
      if (!el) return;

      // Temporarily remove scale for full-res capture
      const original = el.style.transform;
      el.style.transform = "scale(1)";
      el.style.transformOrigin = "top left";

      const canvas = await html2canvas(el, { scale: 2, width: 1080, height: 1080, useCORS: true });

      el.style.transform = original;
      el.style.transformOrigin = "center center";

      const link = document.createElement("a");
      link.download = `post-dia${day?.day || dayIndex + 1}${isCarousel ? `-slide${index + 1}` : ""}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      toast({ title: "Erro ao exportar imagem", variant: "destructive" });
    }
  }, [isCarousel, day, dayIndex]);

  const handleDownloadAll = useCallback(async () => {
    try {
      const html2canvas = (await import("html2canvas")).default;
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      for (let i = 0; i < editedTexts.length; i++) {
        // We need to render each slide — navigate to it, capture
        setCurrentSlide(i);
        await new Promise((r) => setTimeout(r, 200)); // wait for render

        const el = slideRefs.current[i];
        if (!el) continue;

        const original = el.style.transform;
        el.style.transform = "scale(1)";
        el.style.transformOrigin = "top left";

        const canvas = await html2canvas(el, { scale: 2, width: 1080, height: 1080, useCORS: true });

        el.style.transform = original;
        el.style.transformOrigin = "center center";

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
    } catch (err) {
      toast({ title: "Erro ao exportar ZIP", variant: "destructive" });
    }
  }, [editedTexts, day, dayIndex]);

  const handleReset = () => {
    if (!day) return;
    const copies = day.card_copy || [day.caption || ""];
    setEditedTexts(copies);
    setEditedTitle(day.theme || "");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!day) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-muted-foreground">Conteúdo não encontrado.</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => navigate("/report")}>
            <ArrowLeft className="h-4 w-4" /> Voltar ao relatório
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => navigate("/report")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold font-display">
              Dia {day.day || dayIndex + 1}: {day.theme}
            </h1>
            <p className="text-sm text-muted-foreground">
              Semana {weekIndex + 1} · {day.format}
              {isCarousel && ` · ${editedTexts.length} slides`}
            </p>
          </div>
        </div>

        {/* Editor area */}
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="flex items-center justify-center min-h-[400px] bg-muted/30 rounded-2xl p-4 overflow-hidden">
            {isCarousel ? (
              <CarouselEditor
                slides={editedTexts}
                theme={editedTitle}
                cta={day.cta || ""}
                bgColor={bgColor}
                textColor={textColor}
                accentColor={accentColor}
                displayFont={displayFont}
                bodyFont={bodyFont}
                layout={layout}
                currentSlide={currentSlide}
                onSlideChange={setCurrentSlide}
                onSlideTextChange={(i, t) => {
                  const copy = [...editedTexts];
                  copy[i] = t;
                  setEditedTexts(copy);
                }}
                onDownloadSlide={handleDownloadSlide}
                onDownloadAll={handleDownloadAll}
                slideRefs={slideRefs}
              />
            ) : (
              <div className="flex flex-col items-center gap-4">
                <PostCanvas
                  text={editedTexts[0] || ""}
                  title={editedTitle}
                  cta={day.cta}
                  bgColor={bgColor}
                  textColor={textColor}
                  accentColor={accentColor}
                  displayFont={displayFont}
                  bodyFont={bodyFont}
                  layout={layout}
                  onTextChange={(t) => setEditedTexts([t])}
                  onTitleChange={setEditedTitle}
                  canvasRef={singleCanvasRef}
                />
              </div>
            )}
          </div>

          {/* Toolbar */}
          <PostToolbar
            palette={palette.map((c: any) => ({ hex: c.hex, name: c.name }))}
            selectedBgIndex={bgIndex}
            onBgChange={setBgIndex}
            layout={layout}
            onLayoutChange={setLayout}
            onDownload={() => handleDownloadSlide(isCarousel ? currentSlide : 0)}
            onReset={handleReset}
          />
        </div>

        {/* Caption section */}
        <div className="bg-card rounded-xl border p-4">
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-2">Legenda do Instagram</h3>
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">{day.caption}</p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PostEditorPage;
