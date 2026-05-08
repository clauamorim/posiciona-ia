import React from "react";
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, ArrowUp, ArrowDown, Paintbrush, MousePointerClick, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Toggle } from "@/components/ui/toggle";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import ColorPicker, { PaletteColor } from "./ColorPicker";
import type { OverlayImage } from "../PostToolbar";
import { inlineFormatBus } from "@/lib/inlineFormatBus";

/**
 * Botão de formatação inline (B/I/U) que usa o bus global.
 * - data-inline-format-control: o onBlur do contentEditable ignora este foco,
 *   mantendo a edição ativa enquanto clicamos.
 */
const InlineFormatButton: React.FC<{
  cmd: "bold" | "italic" | "underline";
  icon: React.ReactNode;
  label: string;
  fallback?: () => void;
}> = ({ cmd, icon, label, fallback }) => {
  const handle = (e: React.MouseEvent | React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = inlineFormatBus.applyFormat(cmd);
    if (!ok && fallback) fallback();
  };
  const stop = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); };
  return (
    <button
      type="button"
      data-inline-format-control
      aria-label={label}
      onMouseDown={handle}
      onClick={stop}
      className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground"
    >
      {icon}
    </button>
  );
};

const GOOGLE_FONTS = [
  "Inter", "Montserrat", "Playfair Display", "Roboto", "Poppins",
  "Raleway", "Oswald", "Lato", "Merriweather", "Nunito",
  "Open Sans", "Source Sans 3", "Space Grotesk", "DM Sans",
  "Cormorant Garamond", "Libre Baskerville", "Bebas Neue",
  "Archivo", "Work Sans", "Josefin Sans",
  "Quicksand", "Comfortaa", "Fredoka One", "Baloo 2",
  "Cinzel", "Fjalla One", "Permanent Marker", "Roboto Slab", "Bitter",
];

export type SelectedKind = "title" | "body" | "cta" | "slideNumber" | "image" | "icon" | "textbox" | null;

interface SelectionPanelProps {
  kind: SelectedKind;
  palette: PaletteColor[];
  recommendedFonts?: { display?: string; body?: string };

  // Title
  titleFontSize?: number;
  onTitleFontSizeChange?: (s: number) => void;
  titleColor?: string | null;
  onTitleColorChange?: (c: string) => void;
  titleFontFamily?: string | null;
  displayFont: string;
  onTitleFontFamilyChange?: (f: string) => void;
  titleTextAlign?: "left" | "center" | "right" | "justify";
  onTitleTextAlignChange?: (a: "left" | "center" | "right" | "justify") => void;

  // Body
  fontSize: number;
  onFontSizeChange: (s: number) => void;
  fontWeight: string;
  onFontWeightChange: (w: string) => void;
  fontStyle: string;
  onFontStyleChange: (s: string) => void;
  bodyFont: string;
  onBodyFontChange: (f: string) => void;
  textAlign?: "left" | "center" | "right" | "justify";
  onTextAlignChange?: (a: "left" | "center" | "right" | "justify") => void;
  textColor?: string;
  onTextColorChange?: (c: string) => void;

  // CTA
  ctaText?: string;
  onCtaTextChange?: (t: string) => void;
  ctaFontSize?: number;
  onCtaFontSizeChange?: (s: number) => void;
  ctaBgColor?: string | null;
  onCtaBgColorChange?: (c: string) => void;
  ctaTextColor?: string | null;
  onCtaTextColorChange?: (c: string) => void;

  // Slide number (carousel)
  slideNumberSize?: number;
  onSlideNumberSizeChange?: (s: number) => void;
  slideNumberBgColor?: string | null;
  onSlideNumberBgColorChange?: (c: string) => void;
  slideNumberTextColor?: string | null;
  onSlideNumberTextColorChange?: (c: string) => void;

  // Selected overlay (image / icon / textbox)
  selectedOverlay?: OverlayImage | null;
  onImageOpacityChange?: (id: string, op: number) => void;
  onUpdateOverlaySrc?: (id: string, updates: Partial<OverlayImage>) => void;
  onRemoveBackground?: (id: string) => void;
  removingBackground?: boolean;
  onRecolorElement?: (color: string) => void;

  // Layer ordering
  selectedLayerId?: string | null;
  onBringForward?: (id: string) => void;
  onSendBackward?: (id: string) => void;

  // Delete (overlays only: image / icon / textbox)
  onDeleteOverlay?: (id: string) => void;
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

const FontSelect: React.FC<{
  value: string;
  recommended?: string;
  onChange: (f: string) => void;
}> = ({ value, recommended, onChange }) => {
  const fonts = [...GOOGLE_FONTS];
  if (recommended && !fonts.includes(recommended)) fonts.unshift(recommended);
  const sorted = fonts
    .map((f) => ({ value: f, label: f === recommended ? `${f} (recomendada)` : f, isRec: f === recommended }))
    .sort((a, b) => (a.isRec ? -1 : b.isRec ? 1 : 0));
  return (
    <Select value={value} onValueChange={(v) => { loadGoogleFont(v); onChange(v); }}>
      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
      <SelectContent>
        {sorted.map((f) => (
          <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const LayerControls: React.FC<{
  id: string;
  onBringForward?: (id: string) => void;
  onSendBackward?: (id: string) => void;
  onDelete?: (id: string) => void;
}> = ({ id, onBringForward, onSendBackward, onDelete }) => {
  if (!onBringForward && !onSendBackward && !onDelete) return null;
  return (
    <div className="flex gap-1.5">
      {onBringForward && (
        <Button variant="outline" size="sm" className="flex-1 gap-1 text-[11px] h-7" onClick={() => onBringForward(id)}>
          <ArrowUp className="h-3 w-3" /> Frente
        </Button>
      )}
      {onSendBackward && (
        <Button variant="outline" size="sm" className="flex-1 gap-1 text-[11px] h-7" onClick={() => onSendBackward(id)}>
          <ArrowDown className="h-3 w-3" /> Trás
        </Button>
      )}
      {onDelete && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 hover:border-destructive/40"
              onClick={() => onDelete(id)}
              aria-label="Excluir elemento"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Excluir elemento</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};

const SelectionPanel: React.FC<SelectionPanelProps> = (props) => {
  const { kind, palette, recommendedFonts, selectedOverlay, selectedLayerId } = props;

  if (!kind) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-6 text-muted-foreground/70">
        <MousePointerClick className="h-5 w-5 mb-2 opacity-60" />
        <p className="text-[11px] leading-relaxed">Selecione um elemento na arte para editar.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {kind === "title" && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Título</p>
          {props.onTitleFontFamilyChange && (
            <div>
              <label className="text-[11px] text-muted-foreground">Fonte</label>
              <FontSelect
                value={props.titleFontFamily || props.displayFont}
                recommended={recommendedFonts?.display}
                onChange={(f) => props.onTitleFontFamilyChange!(f)}
              />
            </div>
          )}
          <div>
            <label className="text-[11px] text-muted-foreground">Tamanho: {props.titleFontSize || 44}px</label>
            <Slider value={[props.titleFontSize || 44]} onValueChange={([v]) => props.onTitleFontSizeChange?.(v)} min={20} max={80} step={1} className="mt-1" />
          </div>
          {props.onTitleColorChange && (
            <div>
              <label className="text-[11px] text-muted-foreground">Cor</label>
              <ColorPicker palette={palette} value={props.titleColor || undefined} onChange={(c) => props.onTitleColorChange!(c)} />
            </div>
          )}
          {props.onTitleTextAlignChange && (
            <div>
              <label className="text-[11px] text-muted-foreground">Alinhamento</label>
              <div className="flex gap-1.5 mt-1">
                {([
                  { value: "left" as const, icon: AlignLeft },
                  { value: "center" as const, icon: AlignCenter },
                  { value: "right" as const, icon: AlignRight },
                  { value: "justify" as const, icon: AlignJustify },
                ]).map(({ value, icon: Icon }) => (
                  <Button key={value} variant={(props.titleTextAlign || "center") === value ? "default" : "outline"} size="icon" className="h-7 w-7" onClick={() => props.onTitleTextAlignChange!(value)}>
                    <Icon className="h-3.5 w-3.5" />
                  </Button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-[11px] text-muted-foreground">Formatação (selecione o texto)</label>
            <div className="flex gap-1.5 mt-1">
              <InlineFormatButton cmd="bold" icon={<Bold className="h-3.5 w-3.5" />} label="Negrito" />
              <InlineFormatButton cmd="italic" icon={<Italic className="h-3.5 w-3.5" />} label="Itálico" />
              <InlineFormatButton cmd="underline" icon={<Underline className="h-3.5 w-3.5" />} label="Sublinhado" />
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              Dê duplo clique no título e selecione o trecho que deseja formatar.
            </p>
          </div>
          {selectedLayerId && <LayerControls id={selectedLayerId} onBringForward={props.onBringForward} onSendBackward={props.onSendBackward} />}
        </>
      )}

      {kind === "body" && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Corpo do texto</p>
          <div>
            <label className="text-[11px] text-muted-foreground">Fonte</label>
            <FontSelect value={props.bodyFont} recommended={recommendedFonts?.body} onChange={props.onBodyFontChange} />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Tamanho: {props.fontSize}px</label>
            <Slider value={[props.fontSize]} onValueChange={([v]) => props.onFontSizeChange(v)} min={16} max={48} step={1} className="mt-1" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Formatação</label>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              <InlineFormatButton
                cmd="bold"
                icon={<Bold className="h-3.5 w-3.5" />}
                label="Negrito"
                fallback={() => props.onFontWeightChange(props.fontWeight === "bold" ? "normal" : "bold")}
              />
              <InlineFormatButton
                cmd="italic"
                icon={<Italic className="h-3.5 w-3.5" />}
                label="Itálico"
                fallback={() => props.onFontStyleChange(props.fontStyle === "italic" ? "normal" : "italic")}
              />
              <InlineFormatButton
                cmd="underline"
                icon={<Underline className="h-3.5 w-3.5" />}
                label="Sublinhado"
              />
              {props.onTextAlignChange && ([
                { value: "left" as const, icon: AlignLeft },
                { value: "center" as const, icon: AlignCenter },
                { value: "right" as const, icon: AlignRight },
                { value: "justify" as const, icon: AlignJustify },
              ]).map(({ value, icon: Icon }) => (
                <Button key={value} variant={props.textAlign === value ? "default" : "outline"} size="icon" className="h-7 w-7" onClick={() => props.onTextAlignChange!(value)}>
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1">
              Selecione um trecho dentro do texto para formatar só ele. Sem seleção, o B/I afetam o bloco inteiro.
            </p>
          </div>
          {props.onTextColorChange && (
            <div>
              <label className="text-[11px] text-muted-foreground">Cor</label>
              <ColorPicker palette={palette} value={props.textColor} onChange={(c) => props.onTextColorChange!(c)} />
            </div>
          )}
          {selectedLayerId && <LayerControls id={selectedLayerId} onBringForward={props.onBringForward} onSendBackward={props.onSendBackward} />}
        </>
      )}

      {kind === "cta" && props.onCtaTextChange && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Botão CTA</p>
          <div>
            <label className="text-[11px] text-muted-foreground">Texto</label>
            <Textarea
              value={props.ctaText || ""}
              onChange={(e) => props.onCtaTextChange!(e.target.value)}
              rows={2}
              className="text-xs mt-1 min-h-[48px] resize-none"
              placeholder={"CTA\n(Enter para quebrar linha)"}
            />
            <p className="text-[10px] text-muted-foreground/70 mt-1">Use Enter para quebrar em duas linhas.</p>
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Tamanho: {props.ctaFontSize || 28}px</label>
            <Slider value={[props.ctaFontSize || 28]} onValueChange={([v]) => props.onCtaFontSizeChange?.(v)} min={16} max={48} step={1} className="mt-1" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Fundo</label>
            <ColorPicker palette={palette} value={props.ctaBgColor || undefined} onChange={(c) => props.onCtaBgColorChange?.(c)} />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Cor do texto</label>
            <ColorPicker palette={palette} value={props.ctaTextColor || undefined} onChange={(c) => props.onCtaTextColorChange?.(c)} />
          </div>
          {selectedLayerId && <LayerControls id={selectedLayerId} onBringForward={props.onBringForward} onSendBackward={props.onSendBackward} />}
        </>
      )}

      {kind === "slideNumber" && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Numeração</p>
          <div>
            <label className="text-[11px] text-muted-foreground">Tamanho: {props.slideNumberSize || 14}px</label>
            <Slider value={[props.slideNumberSize || 14]} onValueChange={([v]) => props.onSlideNumberSizeChange?.(v)} min={8} max={28} step={1} className="mt-1" />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Fundo</label>
            <ColorPicker palette={palette} value={props.slideNumberBgColor || undefined} onChange={(c) => props.onSlideNumberBgColorChange?.(c)} />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Texto</label>
            <ColorPicker palette={palette} value={props.slideNumberTextColor || undefined} onChange={(c) => props.onSlideNumberTextColorChange?.(c)} />
          </div>
        </>
      )}

      {(kind === "image" || kind === "icon" || kind === "textbox") && selectedOverlay && (
        <>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            {kind === "image" ? "Imagem" : kind === "icon" ? "Ícone / forma" : "Caixa de texto"}
          </p>
          {props.onImageOpacityChange && (
            <div>
              <label className="text-[11px] text-muted-foreground">Opacidade: {Math.round((selectedOverlay.opacity ?? 1) * 100)}%</label>
              <Slider value={[(selectedOverlay.opacity ?? 1) * 100]} onValueChange={([v]) => props.onImageOpacityChange!(selectedOverlay.id, v / 100)} min={5} max={100} step={1} className="mt-1" />
            </div>
          )}
          {kind === "image" && props.onRemoveBackground && (
            <Button variant="outline" size="sm" className="w-full gap-2 h-8 text-xs" disabled={props.removingBackground}
              onClick={() => props.onRemoveBackground!(selectedOverlay.id)}>
              {props.removingBackground ? (
                <><span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full" /> Removendo…</>
              ) : (
                <><Paintbrush className="h-3.5 w-3.5" /> Remover fundo</>
              )}
            </Button>
          )}
          {kind === "textbox" && props.onUpdateOverlaySrc && (
            <>
              <div>
                <label className="text-[11px] text-muted-foreground">Cor do texto</label>
                <ColorPicker palette={palette} value={selectedOverlay.textColor || undefined} onChange={(c) => props.onUpdateOverlaySrc!(selectedOverlay.id, { textColor: c })} />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Fundo</label>
                <ColorPicker palette={palette} value={selectedOverlay.bgColor || undefined} onChange={(c) => props.onUpdateOverlaySrc!(selectedOverlay.id, { bgColor: c })} allowTransparent />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Tamanho: {selectedOverlay.fontSize || 24}px</label>
                <Slider value={[selectedOverlay.fontSize || 24]} onValueChange={([v]) => props.onUpdateOverlaySrc!(selectedOverlay.id, { fontSize: v })} min={12} max={72} step={1} className="mt-1" />
              </div>
            </>
          )}
          <LayerControls
            id={selectedOverlay.id}
            onBringForward={props.onBringForward}
            onSendBackward={props.onSendBackward}
            onDelete={props.onDeleteOverlay}
          />

        </>
      )}
    </div>
  );
};

export default SelectionPanel;
