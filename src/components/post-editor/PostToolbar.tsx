import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, RotateCcw, AlignCenter, AlignLeft, Columns, Upload, ImagePlus, Shapes, Bold, Italic, Type } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import {
  Star, Heart, CheckCircle, Quote, ArrowRight, ArrowUp, Zap, Award,
  Circle, Square, Triangle, Hexagon, Diamond, Flame, Target, Crown,
  ThumbsUp, Bookmark, Send, AtSign, Hash, MapPin, Clock, Eye,
} from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";

interface PaletteColor {
  hex: string;
  name: string;
}

export interface OverlayImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "logo" | "photo" | "element";
}

interface PostToolbarProps {
  palette: PaletteColor[];
  selectedBgIndex: number;
  onBgChange: (index: number) => void;
  layout: "centered" | "top" | "split";
  onLayoutChange: (layout: "centered" | "top" | "split") => void;
  onDownload: () => void;
  onReset: () => void;
  onAddImage?: (image: OverlayImage) => void;
  recommendedFonts?: { display?: string; body?: string };
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  fontWeight: string;
  onFontWeightChange: (w: string) => void;
  fontStyle: string;
  onFontStyleChange: (s: string) => void;
  bodyFont: string;
  onBodyFontChange: (f: string) => void;
  displayFont: string;
  onDisplayFontChange: (f: string) => void;
}

const LAYOUTS = [
  { value: "centered" as const, icon: AlignCenter, label: "Centralizado" },
  { value: "top" as const, icon: AlignLeft, label: "Topo" },
  { value: "split" as const, icon: Columns, label: "Dividido" },
];

const GRAPHIC_ELEMENTS = [
  { icon: Star, name: "Estrela" }, { icon: Heart, name: "Coração" },
  { icon: CheckCircle, name: "Check" }, { icon: Quote, name: "Aspas" },
  { icon: ArrowRight, name: "Seta direita" }, { icon: ArrowUp, name: "Seta cima" },
  { icon: Zap, name: "Raio" }, { icon: Award, name: "Prêmio" },
  { icon: Circle, name: "Círculo" }, { icon: Square, name: "Quadrado" },
  { icon: Triangle, name: "Triângulo" }, { icon: Hexagon, name: "Hexágono" },
  { icon: Diamond, name: "Diamante" }, { icon: Flame, name: "Chama" },
  { icon: Target, name: "Alvo" }, { icon: Crown, name: "Coroa" },
  { icon: ThumbsUp, name: "Curtir" }, { icon: Bookmark, name: "Salvar" },
  { icon: Send, name: "Enviar" }, { icon: AtSign, name: "Arroba" },
  { icon: Hash, name: "Hashtag" }, { icon: MapPin, name: "Local" },
  { icon: Clock, name: "Relógio" }, { icon: Eye, name: "Olho" },
];

const GOOGLE_FONTS = [
  "Inter", "Montserrat", "Playfair Display", "Roboto", "Poppins",
  "Raleway", "Oswald", "Lato", "Merriweather", "Nunito",
  "Open Sans", "Source Sans 3", "Space Grotesk", "DM Sans",
  "Cormorant Garamond", "Libre Baskerville", "Bebas Neue",
  "Archivo", "Work Sans", "Josefin Sans",
];

const LOGO_STORAGE_KEY = "posiciona_user_logo";

function iconToDataUrl(IconComponent: React.FC<any>, color: string): string {
  const svgMarkup = renderToStaticMarkup(
    <IconComponent size={120} color={color} strokeWidth={2} />
  );
  return `data:image/svg+xml;base64,${btoa(svgMarkup)}`;
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

const PostToolbar: React.FC<PostToolbarProps> = ({
  palette, selectedBgIndex, onBgChange, layout, onLayoutChange,
  onDownload, onReset, onAddImage,
  recommendedFonts, fontSize, onFontSizeChange, fontWeight, onFontWeightChange,
  fontStyle, onFontStyleChange, bodyFont, onBodyFontChange, displayFont, onDisplayFontChange,
}) => {
  const [elementsOpen, setElementsOpen] = useState(false);
  const [savedLogo, setSavedLogo] = useState<string | null>(null);
  const accentColor = palette[(selectedBgIndex + 1) % Math.max(palette.length, 1)]?.hex || "#7c3aed";

  useEffect(() => {
    const logo = localStorage.getItem(LOGO_STORAGE_KEY);
    if (logo) setSavedLogo(logo);
  }, []);

  const getFontOptions = (type: "display" | "body") => {
    const recommended = type === "display" ? recommendedFonts?.display : recommendedFonts?.body;
    const fonts = [...GOOGLE_FONTS];
    if (recommended && !fonts.includes(recommended)) fonts.unshift(recommended);
    return fonts.map((f) => ({
      value: f,
      label: f === recommended ? `${f} (Recomendada)` : f,
      isRecommended: f === recommended,
    })).sort((a, b) => (a.isRecommended ? -1 : b.isRecommended ? 1 : 0));
  };

  const handleFileUpload = (type: "logo" | "photo") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const src = reader.result as string;
        if (type === "logo") {
          localStorage.setItem(LOGO_STORAGE_KEY, src);
          setSavedLogo(src);
        }
        const img: OverlayImage = {
          id: crypto.randomUUID(), src,
          x: type === "logo" ? 40 : 200, y: type === "logo" ? 40 : 200,
          width: type === "logo" ? 150 : 400, height: type === "logo" ? 150 : 400,
          type,
        };
        onAddImage?.(img);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleAddSavedLogo = () => {
    if (!savedLogo) return;
    const img: OverlayImage = {
      id: crypto.randomUUID(), src: savedLogo,
      x: 40, y: 40, width: 150, height: 150, type: "logo",
    };
    onAddImage?.(img);
  };

  const handleAddElement = (element: typeof GRAPHIC_ELEMENTS[0]) => {
    const src = iconToDataUrl(element.icon, accentColor);
    const img: OverlayImage = {
      id: crypto.randomUUID(), src,
      x: 460, y: 460, width: 160, height: 160, type: "element",
    };
    onAddImage?.(img);
  };

  const handleFontChange = (font: string, type: "display" | "body") => {
    loadGoogleFont(font);
    if (type === "display") onDisplayFontChange(font);
    else onBodyFontChange(font);
  };

  return (
    <div className="flex flex-col gap-6 p-4 rounded-xl bg-card border overflow-y-auto max-h-[80vh]">
      {/* Colors */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Cor de fundo</h4>
        <div className="flex gap-2 flex-wrap">
          {palette.map((color, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <button onClick={() => onBgChange(i)}
                  className={`w-10 h-10 rounded-lg transition-all border-2 ${i === selectedBgIndex ? "ring-2 ring-primary ring-offset-2 scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: color.hex, borderColor: i === selectedBgIndex ? color.hex : "transparent" }} />
              </TooltipTrigger>
              <TooltipContent>{color.name}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Layout */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Layout</h4>
        <div className="flex gap-2">
          {LAYOUTS.map(({ value, icon: Icon, label }) => (
            <Tooltip key={value}>
              <TooltipTrigger asChild>
                <Button variant={layout === value ? "default" : "outline"} size="icon" onClick={() => onLayoutChange(value)}>
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Typography */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Tipografia</h4>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Fonte título</label>
            <Select value={displayFont} onValueChange={(v) => handleFontChange(v, "display")}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {getFontOptions("display").map((f) => (
                  <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fonte corpo</label>
            <Select value={bodyFont} onValueChange={(v) => handleFontChange(v, "body")}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {getFontOptions("body").map((f) => (
                  <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tamanho corpo: {fontSize}px</label>
            <Slider value={[fontSize]} onValueChange={([v]) => onFontSizeChange(v)} min={16} max={48} step={1} className="mt-1" />
          </div>
          <div className="flex gap-2">
            <Toggle pressed={fontWeight === "bold"} onPressedChange={(p) => onFontWeightChange(p ? "bold" : "normal")} size="sm" aria-label="Negrito">
              <Bold className="h-4 w-4" />
            </Toggle>
            <Toggle pressed={fontStyle === "italic"} onPressedChange={(p) => onFontStyleChange(p ? "italic" : "normal")} size="sm" aria-label="Itálico">
              <Italic className="h-4 w-4" />
            </Toggle>
          </div>
        </div>
      </div>

      {/* Images */}
      {onAddImage && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Imagens</h4>
          <div className="flex flex-col gap-2">
            {savedLogo && (
              <div className="flex gap-2 items-center">
                <button onClick={handleAddSavedLogo}
                  className="w-12 h-12 rounded-lg border bg-muted/50 hover:bg-muted transition-colors overflow-hidden flex-shrink-0">
                  <img src={savedLogo} alt="Logo salva" className="w-full h-full object-contain" />
                </button>
                <span className="text-xs text-muted-foreground">Sua logo</span>
              </div>
            )}
            <Button variant="outline" size="sm" className="gap-2 w-full" onClick={() => handleFileUpload("logo")}>
              <Upload className="h-4 w-4" /> {savedLogo ? "Trocar Logo" : "Upload Logo"}
            </Button>
            <Button variant="outline" size="sm" className="gap-2 w-full" onClick={() => handleFileUpload("photo")}>
              <ImagePlus className="h-4 w-4" /> Upload Foto
            </Button>
          </div>
        </div>
      )}

      {/* Graphic Elements */}
      {onAddImage && (
        <Collapsible open={elementsOpen} onOpenChange={setElementsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 w-full">
              <Shapes className="h-4 w-4" /> Elementos gráficos
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {GRAPHIC_ELEMENTS.map((el) => (
                <Tooltip key={el.name}>
                  <TooltipTrigger asChild>
                    <button onClick={() => handleAddElement(el)}
                      className="w-full aspect-square flex items-center justify-center rounded-lg border bg-muted/50 hover:bg-muted transition-colors">
                      <el.icon className="h-5 w-5 text-foreground/70" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{el.name}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <Button onClick={onDownload} className="gap-2 w-full">
          <Download className="h-4 w-4" /> Baixar PNG
        </Button>
        <Button variant="outline" onClick={onReset} className="gap-2 w-full">
          <RotateCcw className="h-4 w-4" /> Resetar textos
        </Button>
      </div>
    </div>
  );
};

export default PostToolbar;
