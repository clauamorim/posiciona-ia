import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, RotateCcw, AlignCenter, AlignLeft, Columns, Upload, ImagePlus, Shapes } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
}

const LAYOUTS = [
  { value: "centered" as const, icon: AlignCenter, label: "Centralizado" },
  { value: "top" as const, icon: AlignLeft, label: "Topo" },
  { value: "split" as const, icon: Columns, label: "Dividido" },
];

const GRAPHIC_ELEMENTS = [
  { icon: Star, name: "Estrela" },
  { icon: Heart, name: "Coração" },
  { icon: CheckCircle, name: "Check" },
  { icon: Quote, name: "Aspas" },
  { icon: ArrowRight, name: "Seta direita" },
  { icon: ArrowUp, name: "Seta cima" },
  { icon: Zap, name: "Raio" },
  { icon: Award, name: "Prêmio" },
  { icon: Circle, name: "Círculo" },
  { icon: Square, name: "Quadrado" },
  { icon: Triangle, name: "Triângulo" },
  { icon: Hexagon, name: "Hexágono" },
  { icon: Diamond, name: "Diamante" },
  { icon: Flame, name: "Chama" },
  { icon: Target, name: "Alvo" },
  { icon: Crown, name: "Coroa" },
  { icon: ThumbsUp, name: "Curtir" },
  { icon: Bookmark, name: "Salvar" },
  { icon: Send, name: "Enviar" },
  { icon: AtSign, name: "Arroba" },
  { icon: Hash, name: "Hashtag" },
  { icon: MapPin, name: "Local" },
  { icon: Clock, name: "Relógio" },
  { icon: Eye, name: "Olho" },
];

function iconToDataUrl(IconComponent: React.FC<any>, color: string): string {
  const svgMarkup = renderToStaticMarkup(
    <IconComponent size={120} color={color} strokeWidth={2} />
  );
  return `data:image/svg+xml;base64,${btoa(svgMarkup)}`;
}

const PostToolbar: React.FC<PostToolbarProps> = ({
  palette,
  selectedBgIndex,
  onBgChange,
  layout,
  onLayoutChange,
  onDownload,
  onReset,
  onAddImage,
}) => {
  const [elementsOpen, setElementsOpen] = useState(false);
  const accentColor = palette[(selectedBgIndex + 1) % Math.max(palette.length, 1)]?.hex || "#7c3aed";

  const handleFileUpload = (type: "logo" | "photo") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img: OverlayImage = {
          id: crypto.randomUUID(),
          src: reader.result as string,
          x: type === "logo" ? 40 : 200,
          y: type === "logo" ? 40 : 200,
          width: type === "logo" ? 150 : 400,
          height: type === "logo" ? 150 : 400,
          type,
        };
        onAddImage?.(img);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleAddElement = (element: typeof GRAPHIC_ELEMENTS[0]) => {
    const src = iconToDataUrl(element.icon, accentColor);
    const img: OverlayImage = {
      id: crypto.randomUUID(),
      src,
      x: 460,
      y: 460,
      width: 160,
      height: 160,
      type: "element",
    };
    onAddImage?.(img);
  };

  return (
    <div className="flex flex-col gap-6 p-4 rounded-xl bg-card border">
      {/* Colors */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Cor de fundo</h4>
        <div className="flex gap-2 flex-wrap">
          {palette.map((color, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onBgChange(i)}
                  className={`w-10 h-10 rounded-lg transition-all border-2 ${
                    i === selectedBgIndex ? "ring-2 ring-primary ring-offset-2 scale-110" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.hex, borderColor: i === selectedBgIndex ? color.hex : "transparent" }}
                />
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
                <Button
                  variant={layout === value ? "default" : "outline"}
                  size="icon"
                  onClick={() => onLayoutChange(value)}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Images */}
      {onAddImage && (
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Imagens</h4>
          <div className="flex flex-col gap-2">
            <Button variant="outline" size="sm" className="gap-2 w-full" onClick={() => handleFileUpload("logo")}>
              <Upload className="h-4 w-4" /> Upload Logo
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
                    <button
                      onClick={() => handleAddElement(el)}
                      className="w-full aspect-square flex items-center justify-center rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                    >
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
