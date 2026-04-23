import React from "react";
import { Square, Maximize, RotateCcw, Grid3x3, Ruler, Crosshair, Magnet, ImageDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import ColorPicker, { PaletteColor } from "./ColorPicker";

const GRADIENT_DIRECTIONS = [
  { value: "to right", label: "→ Horizontal" },
  { value: "to bottom", label: "↓ Vertical" },
  { value: "to bottom right", label: "↘ Diagonal" },
  { value: "to bottom left", label: "↙ Diagonal inv." },
];

interface DocumentPanelProps {
  palette: PaletteColor[];
  selectedBgIndex: number;
  bgHex: string;
  onBgChange: (i: number) => void;
  onCustomBgColorChange: (color: string) => void;
  canvasFormat?: "square" | "reels";
  onCanvasFormatChange?: (f: "square" | "reels") => void;
  useGradient?: boolean;
  onUseGradientChange?: (v: boolean) => void;
  gradientColor2Index?: number;
  onGradientColor2Change?: (i: number) => void;
  customGradientColor2?: string | null;
  onCustomGradientColor2Change?: (c: string) => void;
  gradientDirection?: string;
  onGradientDirectionChange?: (d: string) => void;
  isCarousel?: boolean;
  showSlideNumber?: boolean;
  onShowSlideNumberChange?: (v: boolean) => void;
  slideNumberSize?: number;
  onSlideNumberSizeChange?: (s: number) => void;
  slideNumberBgColor?: string | null;
  onSlideNumberBgColorChange?: (c: string) => void;
  slideNumberTextColor?: string | null;
  onSlideNumberTextColorChange?: (c: string) => void;
  onReset: () => void;
}

const DocumentPanel: React.FC<DocumentPanelProps> = ({
  palette, selectedBgIndex, bgHex, onBgChange, onCustomBgColorChange,
  canvasFormat, onCanvasFormatChange,
  useGradient, onUseGradientChange,
  gradientColor2Index, onGradientColor2Change,
  customGradientColor2, onCustomGradientColor2Change,
  gradientDirection, onGradientDirectionChange,
  isCarousel, showSlideNumber, onShowSlideNumberChange,
  slideNumberSize, onSlideNumberSizeChange,
  slideNumberBgColor, onSlideNumberBgColorChange,
  slideNumberTextColor, onSlideNumberTextColorChange,
  onReset,
}) => {
  return (
    <div className="space-y-4">
      {/* Format */}
      {onCanvasFormatChange && (
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Formato</h4>
          <div className="flex gap-1.5">
            <Button variant={canvasFormat === "square" ? "default" : "outline"} size="sm" onClick={() => onCanvasFormatChange("square")} className="gap-1.5 text-xs flex-1 h-8">
              <Square className="h-3.5 w-3.5" /> 1:1
            </Button>
            <Button variant={canvasFormat === "reels" ? "default" : "outline"} size="sm" onClick={() => onCanvasFormatChange("reels")} className="gap-1.5 text-xs flex-1 h-8">
              <Maximize className="h-3.5 w-3.5" /> 9:16
            </Button>
          </div>
        </div>
      )}

      {/* Background */}
      <div>
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Fundo</h4>
        <ColorPicker
          palette={palette}
          value={bgHex}
          onChange={(c) => {
            const idx = palette.findIndex((p) => p.hex === c);
            if (idx >= 0) onBgChange(idx);
            else onCustomBgColorChange(c);
          }}
          size="md"
        />
        {palette.length >= 2 && onUseGradientChange && (
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={useGradient || false} onChange={(e) => onUseGradientChange(e.target.checked)} className="rounded" />
              Gradiente
            </label>
            {useGradient && (
              <div className="space-y-2 pl-1">
                <span className="text-[11px] text-muted-foreground">2ª cor:</span>
                <ColorPicker
                  palette={palette}
                  value={customGradientColor2 || palette[gradientColor2Index ?? 1]?.hex}
                  onChange={(c) => {
                    const idx = palette.findIndex((p) => p.hex === c);
                    if (idx >= 0) {
                      onCustomGradientColor2Change?.("");
                      onGradientColor2Change?.(idx);
                    } else {
                      onCustomGradientColor2Change?.(c);
                    }
                  }}
                />
                <Select value={gradientDirection || "to right"} onValueChange={(v) => onGradientDirectionChange?.(v)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRADIENT_DIRECTIONS.map((d) => (
                      <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slide numbering (carousel only) */}
      {isCarousel && onShowSlideNumberChange && (
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Numeração</h4>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={showSlideNumber ?? true} onChange={(e) => onShowSlideNumberChange(e.target.checked)} className="rounded" />
            Exibir
          </label>
          {showSlideNumber && (
            <div className="space-y-2 mt-2">
              <div>
                <label className="text-[11px] text-muted-foreground">Tamanho: {slideNumberSize || 14}px</label>
                <Slider value={[slideNumberSize || 14]} onValueChange={([v]) => onSlideNumberSizeChange?.(v)} min={8} max={28} step={1} className="mt-1" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Fundo</label>
                <ColorPicker palette={palette} value={slideNumberBgColor || undefined} onChange={(c) => onSlideNumberBgColorChange?.(c)} />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Texto</label>
                <ColorPicker palette={palette} value={slideNumberTextColor || undefined} onChange={(c) => onSlideNumberTextColorChange?.(c)} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reset */}
      <Button variant="outline" size="sm" onClick={onReset} className="gap-2 w-full h-8 text-xs">
        <RotateCcw className="h-3.5 w-3.5" /> Resetar
      </Button>
    </div>
  );
};

export default DocumentPanel;
