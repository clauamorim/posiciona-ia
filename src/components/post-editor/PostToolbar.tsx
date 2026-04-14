import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, RotateCcw, AlignCenter, AlignLeft, AlignRight, AlignJustify, Columns, Upload, ImagePlus, Shapes, Bold, Italic, Type, Minus, MoreHorizontal, Maximize, CircleDashed, Grip, PlusSquare, Paintbrush } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Star, Heart, CheckCircle, Quote, ArrowRight, ArrowUp, Zap, Award,
  Circle, Square, Triangle, Hexagon, Diamond, Flame, Target, Crown,
  ThumbsUp, Bookmark, Send, AtSign, Hash, MapPin, Clock, Eye,
  Lightbulb, Gift, Camera, Coffee, Smile, Bell, Flag, Shield, Layers,
  Feather, Music, Pen, Globe, Sparkles, Lock, Unlock, Settings,
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
  type: "logo" | "photo" | "element" | "textbox";
  opacity?: number;
  // Text box fields
  text?: string;
  textColor?: string;
  bgColor?: string;
  fontSize?: number;
  fontFamily?: string;
}

interface PostToolbarProps {
  palette: PaletteColor[];
  selectedBgIndex: number;
  onBgChange: (index: number) => void;
  onCustomBgColorChange?: (color: string) => void;
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
  textAlign?: "left" | "center" | "right" | "justify";
  onTextAlignChange?: (align: "left" | "center" | "right" | "justify") => void;
  textColor?: string;
  onTextColorChange?: (color: string) => void;
  selectedImageId?: string | null;
  overlayImages?: OverlayImage[];
  onImageOpacityChange?: (id: string, opacity: number) => void;
  onUpdateOverlaySrc?: (id: string, updates: Partial<OverlayImage>) => void;
  useGradient?: boolean;
  onUseGradientChange?: (v: boolean) => void;
  gradientColor2Index?: number;
  onGradientColor2Change?: (index: number) => void;
  gradientDirection?: string;
  onGradientDirectionChange?: (d: string) => void;
  titleFontSize?: number;
  onTitleFontSizeChange?: (size: number) => void;
  titleColor?: string;
  onTitleColorChange?: (color: string) => void;
  titleFontFamily?: string;
  onTitleFontFamilyChange?: (f: string) => void;
  ctaText?: string;
  onCtaTextChange?: (text: string) => void;
  ctaBgColor?: string;
  onCtaBgColorChange?: (color: string) => void;
  ctaTextColor?: string;
  onCtaTextColorChange?: (color: string) => void;
  ctaFontSize?: number;
  onCtaFontSizeChange?: (size: number) => void;
  userPortraits?: string[];
  // Canvas format
  canvasFormat?: "square" | "reels";
  onCanvasFormatChange?: (f: "square" | "reels") => void;
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
  { icon: Lightbulb, name: "Lâmpada" }, { icon: Gift, name: "Presente" },
  { icon: Camera, name: "Câmera" }, { icon: Coffee, name: "Café" },
  { icon: Smile, name: "Sorriso" }, { icon: Bell, name: "Sino" },
  { icon: Flag, name: "Bandeira" }, { icon: Shield, name: "Escudo" },
  { icon: Layers, name: "Camadas" }, { icon: Feather, name: "Pena" },
  { icon: Music, name: "Música" }, { icon: Pen, name: "Caneta" },
  { icon: Globe, name: "Globo" }, { icon: Sparkles, name: "Brilho" },
  { icon: Lock, name: "Cadeado" }, { icon: Unlock, name: "Desbloq." },
  { icon: Settings, name: "Config." },
];

const SVG_ELEMENTS: { name: string; svg: string }[] = [
  { name: "Barra horizontal fina", svg: `<svg width="400" height="8" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="8" rx="4" fill="currentColor"/></svg>` },
  { name: "Barra horizontal grossa", svg: `<svg width="400" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="400" height="24" rx="4" fill="currentColor"/></svg>` },
  { name: "Barra vertical", svg: `<svg width="8" height="400" xmlns="http://www.w3.org/2000/svg"><rect width="8" height="400" rx="4" fill="currentColor"/></svg>` },
  { name: "Moldura retangular", svg: `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="384" height="384" rx="12" fill="none" stroke="currentColor" stroke-width="8"/></svg>` },
  { name: "Moldura circular", svg: `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><circle cx="200" cy="200" r="190" fill="none" stroke="currentColor" stroke-width="8"/></svg>` },
  { name: "Cantos decorativos", svg: `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><path d="M8 80 L8 8 L80 8" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M320 8 L392 8 L392 80" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M392 320 L392 392 L320 392" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M80 392 L8 392 L8 320" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/></svg>` },
  { name: "Linha ondulada", svg: `<svg width="400" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M0 20 Q50 0 100 20 Q150 40 200 20 Q250 0 300 20 Q350 40 400 20" fill="none" stroke="currentColor" stroke-width="4"/></svg>` },
  { name: "Linha pontilhada", svg: `<svg width="400" height="8" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="4" x2="400" y2="4" stroke="currentColor" stroke-width="4" stroke-dasharray="12 8" stroke-linecap="round"/></svg>` },
  { name: "Divider decorativo", svg: `<svg width="400" height="24" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="12" x2="170" y2="12" stroke="currentColor" stroke-width="2"/><circle cx="200" cy="12" r="6" fill="currentColor"/><line x1="230" y1="12" x2="400" y2="12" stroke="currentColor" stroke-width="2"/></svg>` },
  { name: "Aspas grandes", svg: `<svg width="120" height="100" xmlns="http://www.w3.org/2000/svg"><text x="0" y="80" font-size="100" font-family="Georgia" fill="currentColor">"</text></svg>` },
  { name: "Seta larga", svg: `<svg width="200" height="60" xmlns="http://www.w3.org/2000/svg"><polygon points="0,15 150,15 150,0 200,30 150,60 150,45 0,45" fill="currentColor"/></svg>` },
  { name: "Moldura dupla", svg: `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="384" height="384" rx="12" fill="none" stroke="currentColor" stroke-width="4"/><rect x="20" y="20" width="360" height="360" rx="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>` },
  { name: "Moldura arredondada", svg: `<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="384" height="384" rx="40" fill="none" stroke="currentColor" stroke-width="6"/></svg>` },
  { name: "Separador losango", svg: `<svg width="400" height="24" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="12" x2="160" y2="12" stroke="currentColor" stroke-width="2"/><polygon points="200,0 212,12 200,24 188,12" fill="currentColor"/><line x1="240" y1="12" x2="400" y2="12" stroke="currentColor" stroke-width="2"/></svg>` },
  { name: "Barra diagonal", svg: `<svg width="400" height="60" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="60" x2="400" y2="0" stroke="currentColor" stroke-width="4"/></svg>` },
];

const GOOGLE_FONTS = [
  "Inter", "Montserrat", "Playfair Display", "Roboto", "Poppins",
  "Raleway", "Oswald", "Lato", "Merriweather", "Nunito",
  "Open Sans", "Source Sans 3", "Space Grotesk", "DM Sans",
  "Cormorant Garamond", "Libre Baskerville", "Bebas Neue",
  "Archivo", "Work Sans", "Josefin Sans",
  "Quicksand", "Comfortaa", "Fredoka One", "Baloo 2",
  "Cinzel", "Fjalla One", "Permanent Marker", "Roboto Slab", "Bitter",
];

const GRADIENT_DIRECTIONS = [
  { value: "to right", label: "→ Horizontal" },
  { value: "to bottom", label: "↓ Vertical" },
  { value: "to bottom right", label: "↘ Diagonal" },
  { value: "to bottom left", label: "↙ Diagonal inv." },
];

const LOGO_STORAGE_KEY = "posiciona_user_logo";

function iconToDataUrl(IconComponent: React.FC<any>, color: string): string {
  const svgMarkup = renderToStaticMarkup(
    <IconComponent size={120} color={color} strokeWidth={2} />
  );
  return `data:image/svg+xml;base64,${btoa(svgMarkup)}`;
}

function svgToDataUrl(svg: string, color: string): string {
  const colored = svg.replace(/currentColor/g, color);
  return `data:image/svg+xml;base64,${btoa(colored)}`;
}

/** Re-color an existing SVG data URL */
function recolorSvgDataUrl(dataUrl: string, newColor: string): string | null {
  try {
    if (!dataUrl.startsWith("data:image/svg+xml;base64,")) return null;
    const b64 = dataUrl.replace("data:image/svg+xml;base64,", "");
    let svg = atob(b64);
    // Replace color attributes: stroke="..." fill="..." color="..."
    svg = svg.replace(/(?:stroke|fill|color)="(#[0-9a-fA-F]{3,8}|rgb[^"]*|[a-zA-Z]+)"/g, (match, _val) => {
      // Don't replace "none"
      if (match.includes('"none"')) return match;
      const attr = match.split("=")[0];
      return `${attr}="${newColor}"`;
    });
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  } catch {
    return null;
  }
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
  palette, selectedBgIndex, onBgChange, onCustomBgColorChange, layout, onLayoutChange,
  onDownload, onReset, onAddImage,
  recommendedFonts, fontSize, onFontSizeChange, fontWeight, onFontWeightChange,
  fontStyle, onFontStyleChange, bodyFont, onBodyFontChange, displayFont, onDisplayFontChange,
  textAlign, onTextAlignChange, textColor, onTextColorChange,
  selectedImageId, overlayImages, onImageOpacityChange, onUpdateOverlaySrc,
  useGradient, onUseGradientChange, gradientColor2Index, onGradientColor2Change, gradientDirection, onGradientDirectionChange,
  titleFontSize, onTitleFontSizeChange, titleColor, onTitleColorChange, titleFontFamily, onTitleFontFamilyChange,
  ctaText, onCtaTextChange, ctaBgColor, onCtaBgColorChange, ctaTextColor, onCtaTextColorChange, ctaFontSize, onCtaFontSizeChange,
  userPortraits,
  canvasFormat, onCanvasFormatChange,
}) => {
  const [elementsOpen, setElementsOpen] = useState(false);
  const [svgElementsOpen, setSvgElementsOpen] = useState(false);
  const [portraitsOpen, setPortraitsOpen] = useState(false);
  const [savedLogo, setSavedLogo] = useState<string | null>(null);
  const accentColor = palette[(selectedBgIndex + 1) % Math.max(palette.length, 1)]?.hex || "#7c3aed";

  const selectedOverlay = overlayImages?.find(img => img.id === selectedImageId);
  const isSelectedElement = selectedOverlay?.type === "element";
  const isSelectedTextBox = selectedOverlay?.type === "textbox";

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
          type, opacity: 1,
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
      x: 40, y: 40, width: 150, height: 150, type: "logo", opacity: 1,
    };
    onAddImage?.(img);
  };

  const [elementColor, setElementColor] = useState(accentColor);

  const handleAddElement = (element: typeof GRAPHIC_ELEMENTS[0]) => {
    const src = iconToDataUrl(element.icon, elementColor);
    const img: OverlayImage = {
      id: crypto.randomUUID(), src,
      x: 460, y: 460, width: 160, height: 160, type: "element", opacity: 1,
    };
    onAddImage?.(img);
  };

  const handleAddSvgElement = (el: typeof SVG_ELEMENTS[0]) => {
    const src = svgToDataUrl(el.svg, elementColor);
    const wMatch = el.svg.match(/width="(\d+)"/);
    const hMatch = el.svg.match(/height="(\d+)"/);
    const svgW = wMatch ? parseInt(wMatch[1]) : 400;
    const svgH = hMatch ? parseInt(hMatch[1]) : 400;
    const s = 0.8;
    const img: OverlayImage = {
      id: crypto.randomUUID(), src,
      x: 340, y: 460, width: svgW * s, height: svgH * s, type: "element", opacity: 1,
    };
    onAddImage?.(img);
  };

  const handleRecolorSelected = (color: string) => {
    if (!selectedOverlay || selectedOverlay.type !== "element" || !onUpdateOverlaySrc) return;
    const newSrc = recolorSvgDataUrl(selectedOverlay.src, color);
    if (newSrc) onUpdateOverlaySrc(selectedOverlay.id, { src: newSrc });
  };

  const handleAddPortrait = (url: string) => {
    const img: OverlayImage = {
      id: crypto.randomUUID(), src: url,
      x: 200, y: 200, width: 400, height: 400, type: "photo", opacity: 1,
    };
    onAddImage?.(img);
  };

  const handleAddTextBox = () => {
    const img: OverlayImage = {
      id: crypto.randomUUID(), src: "",
      x: 200, y: 400, width: 600, height: 80, type: "textbox", opacity: 1,
      text: "Novo texto", textColor: textColor || "#ffffff", bgColor: "transparent",
      fontSize: 24, fontFamily: bodyFont,
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
      {/* Canvas Format */}
      {onCanvasFormatChange && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Formato</h4>
          <div className="flex gap-2">
            <Button variant={canvasFormat === "square" ? "default" : "outline"} size="sm" onClick={() => onCanvasFormatChange("square")} className="gap-1.5 text-xs flex-1">
              <Square className="h-3.5 w-3.5" /> Post 1:1
            </Button>
            <Button variant={canvasFormat === "reels" ? "default" : "outline"} size="sm" onClick={() => onCanvasFormatChange("reels")} className="gap-1.5 text-xs flex-1">
              <Maximize className="h-3.5 w-3.5" /> Reels 9:16
            </Button>
          </div>
        </div>
      )}

      {/* Colors */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Cor de fundo</h4>
        <div className="flex gap-2 flex-wrap items-center">
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
          <Tooltip>
            <TooltipTrigger asChild>
              <label className="w-10 h-10 rounded-lg border-2 border-dashed border-muted-foreground/40 cursor-pointer flex items-center justify-center hover:bg-muted transition-colors overflow-hidden relative">
                <input type="color" value={palette[selectedBgIndex]?.hex || "#1a1a2e"} onChange={e => {
                  if (onCustomBgColorChange) onCustomBgColorChange(e.target.value);
                }} className="opacity-0 absolute inset-0 w-full h-full cursor-pointer" />
                <span className="text-muted-foreground text-lg font-bold">+</span>
              </label>
            </TooltipTrigger>
            <TooltipContent>Cor personalizada</TooltipContent>
          </Tooltip>
        </div>
        {palette.length >= 2 && (
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={useGradient || false} onChange={e => onUseGradientChange?.(e.target.checked)} className="rounded" />
              Gradiente
            </label>
            {useGradient && (
              <div className="space-y-2">
                <div>
                  <span className="text-xs text-muted-foreground">2ª cor:</span>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {palette.map((color, i) => (
                      <button key={i} onClick={() => onGradientColor2Change?.(i)}
                        className={`w-7 h-7 rounded-md border-2 transition-all ${i === gradientColor2Index ? "ring-2 ring-primary ring-offset-1 scale-110" : "hover:scale-105"}`}
                        style={{ backgroundColor: color.hex, borderColor: i === gradientColor2Index ? color.hex : "transparent" }} />
                    ))}
                  </div>
                </div>
                <Select value={gradientDirection || "to right"} onValueChange={v => onGradientDirectionChange?.(v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRADIENT_DIRECTIONS.map(d => (
                      <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
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

      {/* Title controls */}
      {onTitleFontSizeChange && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Título</h4>
          <div className="space-y-3">
            {onTitleFontFamilyChange && (
              <div>
                <label className="text-xs text-muted-foreground">Fonte título</label>
                <Select value={titleFontFamily || displayFont} onValueChange={(v) => { loadGoogleFont(v); onTitleFontFamilyChange(v); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getFontOptions("display").map((f) => (
                      <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-xs text-muted-foreground">Tamanho: {titleFontSize || 44}px</label>
              <Slider value={[titleFontSize || 44]} onValueChange={([v]) => onTitleFontSizeChange(v)} min={20} max={80} step={1} className="mt-1" />
            </div>
            {onTitleColorChange && (
              <div>
                <label className="text-xs text-muted-foreground">Cor do título</label>
                <div className="flex gap-1 flex-wrap mt-1 items-center">
                  {palette.map((color, i) => (
                    <button key={i} onClick={() => onTitleColorChange(color.hex)}
                      className={`w-6 h-6 rounded-md border transition-all ${titleColor === color.hex ? "ring-2 ring-primary ring-offset-1 scale-110" : "hover:scale-105"}`}
                      style={{ backgroundColor: color.hex, borderColor: titleColor === color.hex ? color.hex : "transparent" }} />
                  ))}
                  <label className="w-6 h-6 rounded-md border border-dashed border-muted-foreground/40 cursor-pointer flex items-center justify-center hover:bg-muted transition-colors overflow-hidden">
                    <input type="color" value={titleColor || "#ffffff"} onChange={e => onTitleColorChange(e.target.value)} className="opacity-0 absolute w-6 h-6 cursor-pointer" />
                    <Type className="h-3 w-3 text-muted-foreground" />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Body Typography */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Corpo do texto</h4>
        <div className="space-y-3">
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
          {onTextAlignChange && (
            <div>
              <label className="text-xs text-muted-foreground">Alinhamento</label>
              <div className="flex gap-1 mt-1">
                {([
                  { value: "left" as const, icon: AlignLeft, label: "Esquerda" },
                  { value: "center" as const, icon: AlignCenter, label: "Centro" },
                  { value: "right" as const, icon: AlignRight, label: "Direita" },
                  { value: "justify" as const, icon: AlignJustify, label: "Justificado" },
                ]).map(({ value, icon: Icon, label }) => (
                  <Tooltip key={value}>
                    <TooltipTrigger asChild>
                      <Button variant={textAlign === value ? "default" : "outline"} size="icon" className="h-7 w-7" onClick={() => onTextAlignChange(value)}>
                        <Icon className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}
          {onTextColorChange && (
            <div>
              <label className="text-xs text-muted-foreground">Cor do texto</label>
              <div className="flex gap-1 flex-wrap mt-1 items-center">
                {palette.map((color, i) => (
                  <Tooltip key={i}>
                    <TooltipTrigger asChild>
                      <button onClick={() => onTextColorChange(color.hex)}
                        className={`w-6 h-6 rounded-md border transition-all ${textColor === color.hex ? "ring-2 ring-primary ring-offset-1 scale-110" : "hover:scale-105"}`}
                        style={{ backgroundColor: color.hex, borderColor: textColor === color.hex ? color.hex : "transparent" }} />
                    </TooltipTrigger>
                    <TooltipContent>{color.name}</TooltipContent>
                  </Tooltip>
                ))}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <label className="w-6 h-6 rounded-md border border-dashed border-muted-foreground/40 cursor-pointer flex items-center justify-center hover:bg-muted transition-colors overflow-hidden">
                      <input type="color" value={textColor || "#ffffff"} onChange={e => onTextColorChange(e.target.value)} className="opacity-0 absolute w-6 h-6 cursor-pointer" />
                      <Type className="h-3 w-3 text-muted-foreground" />
                    </label>
                  </TooltipTrigger>
                  <TooltipContent>Cor personalizada</TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CTA Controls */}
      {onCtaTextChange && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Botão CTA</h4>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Texto do botão</label>
              <Input value={ctaText || ""} onChange={e => onCtaTextChange(e.target.value)} className="h-8 text-xs mt-1" placeholder="CTA" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Tamanho: {ctaFontSize || 28}px</label>
              <Slider value={[ctaFontSize || 28]} onValueChange={([v]) => onCtaFontSizeChange?.(v)} min={16} max={48} step={1} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Cor do fundo</label>
              <div className="flex gap-1 flex-wrap mt-1 items-center">
                {palette.map((color, i) => (
                  <button key={i} onClick={() => onCtaBgColorChange?.(color.hex)}
                    className={`w-6 h-6 rounded-md border transition-all ${ctaBgColor === color.hex ? "ring-2 ring-primary ring-offset-1 scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: color.hex, borderColor: ctaBgColor === color.hex ? color.hex : "transparent" }} />
                ))}
                <label className="w-6 h-6 rounded-md border border-dashed border-muted-foreground/40 cursor-pointer flex items-center justify-center hover:bg-muted transition-colors overflow-hidden">
                  <input type="color" value={ctaBgColor || accentColor} onChange={e => onCtaBgColorChange?.(e.target.value)} className="opacity-0 absolute w-6 h-6 cursor-pointer" />
                  <span className="text-muted-foreground text-xs">+</span>
                </label>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Cor do texto</label>
              <div className="flex gap-1 flex-wrap mt-1 items-center">
                {palette.map((color, i) => (
                  <button key={i} onClick={() => onCtaTextColorChange?.(color.hex)}
                    className={`w-6 h-6 rounded-md border transition-all ${ctaTextColor === color.hex ? "ring-2 ring-primary ring-offset-1 scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: color.hex, borderColor: ctaTextColor === color.hex ? color.hex : "transparent" }} />
                ))}
                <label className="w-6 h-6 rounded-md border border-dashed border-muted-foreground/40 cursor-pointer flex items-center justify-center hover:bg-muted transition-colors overflow-hidden">
                  <input type="color" value={ctaTextColor || "#ffffff"} onChange={e => onCtaTextColorChange?.(e.target.value)} className="opacity-0 absolute w-6 h-6 cursor-pointer" />
                  <Type className="h-3 w-3 text-muted-foreground" />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected element controls */}
      {selectedOverlay && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Elemento selecionado</h4>
          <div className="space-y-3">
            {/* Opacity */}
            {onImageOpacityChange && (
              <div>
                <label className="text-xs text-muted-foreground">Opacidade: {Math.round((selectedOverlay.opacity ?? 1) * 100)}%</label>
                <Slider
                  value={[(selectedOverlay.opacity ?? 1) * 100]}
                  onValueChange={([v]) => onImageOpacityChange(selectedOverlay.id, v / 100)}
                  min={5} max={100} step={1} className="mt-1"
                />
              </div>
            )}
            {/* Recolor for SVG elements */}
            {isSelectedElement && onUpdateOverlaySrc && (
              <div>
                <label className="text-xs text-muted-foreground">Alterar cor do elemento</label>
                <div className="flex gap-1 flex-wrap mt-1 items-center">
                  {palette.map((color, i) => (
                    <button key={i} onClick={() => handleRecolorSelected(color.hex)}
                      className="w-5 h-5 rounded border transition-all hover:scale-110"
                      style={{ backgroundColor: color.hex }} />
                  ))}
                  <label className="w-5 h-5 rounded border border-dashed border-muted-foreground/40 cursor-pointer flex items-center justify-center overflow-hidden">
                    <input type="color" onChange={e => handleRecolorSelected(e.target.value)} className="opacity-0 absolute w-5 h-5 cursor-pointer" />
                    <span className="text-muted-foreground text-[8px]">+</span>
                  </label>
                </div>
              </div>
            )}
            {/* Text box controls */}
            {isSelectedTextBox && onUpdateOverlaySrc && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground">Cor do texto</label>
                  <div className="flex gap-1 flex-wrap mt-1 items-center">
                    {palette.map((color, i) => (
                      <button key={i} onClick={() => onUpdateOverlaySrc(selectedOverlay.id, { textColor: color.hex })}
                        className="w-5 h-5 rounded border transition-all hover:scale-110"
                        style={{ backgroundColor: color.hex }} />
                    ))}
                    <label className="w-5 h-5 rounded border border-dashed border-muted-foreground/40 cursor-pointer flex items-center justify-center overflow-hidden">
                      <input type="color" value={selectedOverlay.textColor || "#ffffff"} onChange={e => onUpdateOverlaySrc(selectedOverlay.id, { textColor: e.target.value })} className="opacity-0 absolute w-5 h-5 cursor-pointer" />
                      <span className="text-muted-foreground text-[8px]">+</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Fundo da caixa</label>
                  <div className="flex gap-1 flex-wrap mt-1 items-center">
                    <button onClick={() => onUpdateOverlaySrc(selectedOverlay.id, { bgColor: "transparent" })}
                      className="w-5 h-5 rounded border border-dashed text-[8px] flex items-center justify-center">∅</button>
                    {palette.map((color, i) => (
                      <button key={i} onClick={() => onUpdateOverlaySrc(selectedOverlay.id, { bgColor: color.hex })}
                        className="w-5 h-5 rounded border transition-all hover:scale-110"
                        style={{ backgroundColor: color.hex }} />
                    ))}
                    <label className="w-5 h-5 rounded border border-dashed border-muted-foreground/40 cursor-pointer flex items-center justify-center overflow-hidden">
                      <input type="color" value={selectedOverlay.bgColor || "#000000"} onChange={e => onUpdateOverlaySrc(selectedOverlay.id, { bgColor: e.target.value })} className="opacity-0 absolute w-5 h-5 cursor-pointer" />
                      <span className="text-muted-foreground text-[8px]">+</span>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tamanho: {selectedOverlay.fontSize || 24}px</label>
                  <Slider
                    value={[selectedOverlay.fontSize || 24]}
                    onValueChange={([v]) => onUpdateOverlaySrc(selectedOverlay.id, { fontSize: v })}
                    min={12} max={72} step={1} className="mt-1"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
            <Button variant="outline" size="sm" className="gap-2 w-full" onClick={handleAddTextBox}>
              <PlusSquare className="h-4 w-4" /> Nova caixa de texto
            </Button>
          </div>
        </div>
      )}

      {/* Portraits panel */}
      {onAddImage && userPortraits && userPortraits.length > 0 && (
        <Collapsible open={portraitsOpen} onOpenChange={setPortraitsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 w-full">
              <Camera className="h-4 w-4" /> Meus Retratos ({userPortraits.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {userPortraits.map((url, i) => (
                <button key={i} onClick={() => handleAddPortrait(url)}
                  className="aspect-square rounded-lg border bg-muted/50 hover:bg-muted transition-colors overflow-hidden">
                  <img src={url} alt={`Retrato ${i + 1}`} className="w-full h-full object-cover" crossOrigin="anonymous" />
                </button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Graphic Elements (icons) */}
      {onAddImage && (
        <Collapsible open={elementsOpen} onOpenChange={setElementsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 w-full">
              <Shapes className="h-4 w-4" /> Ícones ({GRAPHIC_ELEMENTS.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 mb-2">
              <label className="text-xs text-muted-foreground">Cor dos novos elementos:</label>
              <div className="flex gap-1 flex-wrap mt-1 items-center">
                {palette.map((color, i) => (
                  <button key={i} onClick={() => setElementColor(color.hex)}
                    className={`w-5 h-5 rounded border transition-all ${elementColor === color.hex ? "ring-2 ring-primary ring-offset-1 scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: color.hex }} />
                ))}
                <label className="w-5 h-5 rounded border border-dashed border-muted-foreground/40 cursor-pointer flex items-center justify-center overflow-hidden">
                  <input type="color" value={elementColor} onChange={e => setElementColor(e.target.value)} className="opacity-0 absolute w-5 h-5 cursor-pointer" />
                  <span className="text-muted-foreground text-[8px]">+</span>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {GRAPHIC_ELEMENTS.map((el) => (
                <Tooltip key={el.name}>
                  <TooltipTrigger asChild>
                    <button onClick={() => handleAddElement(el)}
                      className="w-full aspect-square flex items-center justify-center rounded-lg border bg-muted/50 hover:bg-muted transition-colors">
                      <el.icon className="h-4 w-4 text-foreground/70" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{el.name}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* SVG Decorative Elements */}
      {onAddImage && (
        <Collapsible open={svgElementsOpen} onOpenChange={setSvgElementsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 w-full">
              <Minus className="h-4 w-4" /> Barras e molduras ({SVG_ELEMENTS.length})
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 mb-2">
              <label className="text-xs text-muted-foreground">Cor dos novos elementos:</label>
              <div className="flex gap-1 flex-wrap mt-1 items-center">
                {palette.map((color, i) => (
                  <button key={i} onClick={() => setElementColor(color.hex)}
                    className={`w-5 h-5 rounded border transition-all ${elementColor === color.hex ? "ring-2 ring-primary ring-offset-1 scale-110" : "hover:scale-105"}`}
                    style={{ backgroundColor: color.hex }} />
                ))}
                <label className="w-5 h-5 rounded border border-dashed border-muted-foreground/40 cursor-pointer flex items-center justify-center overflow-hidden">
                  <input type="color" value={elementColor} onChange={e => setElementColor(e.target.value)} className="opacity-0 absolute w-5 h-5 cursor-pointer" />
                  <span className="text-muted-foreground text-[8px]">+</span>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {SVG_ELEMENTS.map((el) => (
                <Tooltip key={el.name}>
                  <TooltipTrigger asChild>
                    <button onClick={() => handleAddSvgElement(el)}
                      className="w-full py-2 px-2 flex items-center justify-center rounded-lg border bg-muted/50 hover:bg-muted transition-colors text-xs text-muted-foreground">
                      {el.name}
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
