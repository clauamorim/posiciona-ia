import React from "react";
import { Button } from "@/components/ui/button";
import { Download, Save } from "lucide-react";
import DocumentPanel from "./inspector/DocumentPanel";
import SelectionPanel, { SelectedKind } from "./inspector/SelectionPanel";
import AddElementPanel from "./inspector/AddElementPanel";

export interface OverlayImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "logo" | "photo" | "element" | "textbox";
  opacity?: number;
  text?: string;
  textColor?: string;
  bgColor?: string;
  fontSize?: number;
  fontFamily?: string;
}

interface PaletteColor { hex: string; name: string }

interface PostToolbarProps {
  // Palette / background
  palette: PaletteColor[];
  selectedBgIndex: number;
  bgHex: string;
  onBgChange: (i: number) => void;
  onCustomBgColorChange: (c: string) => void;
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

  // Selection context
  selectedKind: SelectedKind;
  recommendedFonts?: { display?: string; body?: string };
  // title
  titleFontSize?: number;
  onTitleFontSizeChange?: (s: number) => void;
  titleColor?: string | null;
  onTitleColorChange?: (c: string) => void;
  titleFontFamily?: string | null;
  displayFont: string;
  onTitleFontFamilyChange?: (f: string) => void;
  titleTextAlign?: "left" | "center" | "right" | "justify";
  onTitleTextAlignChange?: (a: "left" | "center" | "right" | "justify") => void;
  // body
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
  // cta
  ctaText?: string;
  onCtaTextChange?: (t: string) => void;
  ctaFontSize?: number;
  onCtaFontSizeChange?: (s: number) => void;
  ctaBgColor?: string | null;
  onCtaBgColorChange?: (c: string) => void;
  ctaTextColor?: string | null;
  onCtaTextColorChange?: (c: string) => void;
  // overlay
  selectedOverlay?: OverlayImage | null;
  onImageOpacityChange?: (id: string, op: number) => void;
  onUpdateOverlaySrc?: (id: string, updates: Partial<OverlayImage>) => void;
  onRemoveBackground?: (id: string) => void;
  removingBackground?: boolean;
  onRecolorElement?: (color: string) => void;
  selectedLayerId?: string | null;
  onBringForward?: (id: string) => void;
  onSendBackward?: (id: string) => void;

  // Add element
  userPortraits?: string[];
  onAddImage: (img: OverlayImage) => void;

  // Actions
  onDownload: () => void;
  onSaveDesign?: () => void;
  saving?: boolean;
  onReset: () => void;
}

const PostToolbar: React.FC<PostToolbarProps> = (props) => {
  return (
    <div className="flex flex-col gap-4 p-3 rounded-xl bg-card border overflow-y-auto max-h-[80vh]">
      {/* Document */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80 mb-3">Documento</h3>
        <DocumentPanel
          palette={props.palette}
          selectedBgIndex={props.selectedBgIndex}
          bgHex={props.bgHex}
          onBgChange={props.onBgChange}
          onCustomBgColorChange={props.onCustomBgColorChange}
          canvasFormat={props.canvasFormat}
          onCanvasFormatChange={props.onCanvasFormatChange}
          useGradient={props.useGradient}
          onUseGradientChange={props.onUseGradientChange}
          gradientColor2Index={props.gradientColor2Index}
          onGradientColor2Change={props.onGradientColor2Change}
          customGradientColor2={props.customGradientColor2}
          onCustomGradientColor2Change={props.onCustomGradientColor2Change}
          gradientDirection={props.gradientDirection}
          onGradientDirectionChange={props.onGradientDirectionChange}
          isCarousel={props.isCarousel}
          showSlideNumber={props.showSlideNumber}
          onShowSlideNumberChange={props.onShowSlideNumberChange}
          slideNumberSize={props.slideNumberSize}
          onSlideNumberSizeChange={props.onSlideNumberSizeChange}
          slideNumberBgColor={props.slideNumberBgColor}
          onSlideNumberBgColorChange={props.onSlideNumberBgColorChange}
          slideNumberTextColor={props.slideNumberTextColor}
          onSlideNumberTextColorChange={props.onSlideNumberTextColorChange}
          onReset={props.onReset}
        />
      </section>

      <div className="border-t border-border" />

      {/* Selection */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80 mb-3">Elemento selecionado</h3>
        <SelectionPanel
          kind={props.selectedKind}
          palette={props.palette}
          recommendedFonts={props.recommendedFonts}
          titleFontSize={props.titleFontSize}
          onTitleFontSizeChange={props.onTitleFontSizeChange}
          titleColor={props.titleColor}
          onTitleColorChange={props.onTitleColorChange}
          titleFontFamily={props.titleFontFamily}
          displayFont={props.displayFont}
          onTitleFontFamilyChange={props.onTitleFontFamilyChange}
          titleTextAlign={props.titleTextAlign}
          onTitleTextAlignChange={props.onTitleTextAlignChange}
          fontSize={props.fontSize}
          onFontSizeChange={props.onFontSizeChange}
          fontWeight={props.fontWeight}
          onFontWeightChange={props.onFontWeightChange}
          fontStyle={props.fontStyle}
          onFontStyleChange={props.onFontStyleChange}
          bodyFont={props.bodyFont}
          onBodyFontChange={props.onBodyFontChange}
          textAlign={props.textAlign}
          onTextAlignChange={props.onTextAlignChange}
          textColor={props.textColor}
          onTextColorChange={props.onTextColorChange}
          ctaText={props.ctaText}
          onCtaTextChange={props.onCtaTextChange}
          ctaFontSize={props.ctaFontSize}
          onCtaFontSizeChange={props.onCtaFontSizeChange}
          ctaBgColor={props.ctaBgColor}
          onCtaBgColorChange={props.onCtaBgColorChange}
          ctaTextColor={props.ctaTextColor}
          onCtaTextColorChange={props.onCtaTextColorChange}
          slideNumberSize={props.slideNumberSize}
          onSlideNumberSizeChange={props.onSlideNumberSizeChange}
          slideNumberBgColor={props.slideNumberBgColor}
          onSlideNumberBgColorChange={props.onSlideNumberBgColorChange}
          slideNumberTextColor={props.slideNumberTextColor}
          onSlideNumberTextColorChange={props.onSlideNumberTextColorChange}
          selectedOverlay={props.selectedOverlay}
          onImageOpacityChange={props.onImageOpacityChange}
          onUpdateOverlaySrc={props.onUpdateOverlaySrc}
          onRemoveBackground={props.onRemoveBackground}
          removingBackground={props.removingBackground}
          onRecolorElement={props.onRecolorElement}
          selectedLayerId={props.selectedLayerId}
          onBringForward={props.onBringForward}
          onSendBackward={props.onSendBackward}
        />
      </section>

      <div className="border-t border-border" />

      {/* Add element */}
      <section>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80 mb-3">Adicionar</h3>
        <AddElementPanel
          palette={props.palette}
          defaultElementColor={props.palette[1]?.hex}
          bodyFont={props.bodyFont}
          textColor={props.textColor}
          userPortraits={props.userPortraits}
          onAddImage={props.onAddImage}
        />
      </section>

      <div className="border-t border-border" />

      {/* Actions */}
      <div className="flex flex-col gap-1.5">
        {props.onSaveDesign && (
          <Button variant="outline" size="sm" className="gap-2 w-full h-8 text-xs" onClick={props.onSaveDesign} disabled={props.saving}>
            <Save className="h-3.5 w-3.5" /> {props.saving ? "Salvando…" : "Salvar design"}
          </Button>
        )}
        <Button onClick={props.onDownload} className="gap-2 w-full h-9 text-xs">
          <Download className="h-3.5 w-3.5" /> Baixar PNG
        </Button>
      </div>
    </div>
  );
};

export default PostToolbar;
