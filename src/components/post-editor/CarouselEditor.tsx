import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Download, Package } from "lucide-react";
import PostCanvas from "./PostCanvas";
import type { OverlayImage } from "./PostToolbar";

interface CarouselEditorProps {
  slides: string[];
  theme: string;
  cta: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
  displayFont: string;
  bodyFont: string;
  layout: "centered" | "top" | "split";
  currentSlide: number;
  onSlideChange: (index: number) => void;
  onSlideTextChange: (index: number, text: string) => void;
  onDownloadSlide: (index: number) => void;
  onDownloadAll: () => void;
  slideRefs: React.MutableRefObject<(HTMLDivElement | null)[]>;
  overlayImages?: OverlayImage[];
  onUpdateOverlay?: (id: string, updates: Partial<OverlayImage>) => void;
  onImageMove?: (id: string, x: number, y: number) => void;
  onImageResize?: (id: string, width: number, height: number) => void;
  selectedImageId?: string | null;
  onSelectImage?: (id: string | null) => void;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  bgGradient?: string | null;
  titleFontSize?: number;
  titleColor?: string | null;
  titleFontFamily?: string | null;
  ctaText?: string;
  ctaBgColor?: string | null;
  ctaTextColor?: string | null;
  ctaFontSize?: number;
  ctaPosition?: { x: number; y: number } | null;
  onCtaMove?: (x: number, y: number) => void;
  canvasWidth?: number;
  canvasHeight?: number;
  showSlideNumber?: boolean;
  slideNumberPosition?: { x: number; y: number } | null;
  onSlideNumberMove?: (x: number, y: number) => void;
  slideNumberBgColor?: string | null;
  slideNumberTextColor?: string | null;
  slideNumberSize?: number;
}

const CarouselEditor: React.FC<CarouselEditorProps> = ({
  slides, theme, cta, bgColor, textColor, accentColor, displayFont, bodyFont, layout,
  currentSlide, onSlideChange, onSlideTextChange, onDownloadSlide, onDownloadAll, slideRefs,
  overlayImages = [], onUpdateOverlay, onImageMove, onImageResize, selectedImageId, onSelectImage,
  fontSize, fontWeight, fontStyle, textAlign, bgGradient,
  titleFontSize, titleColor, titleFontFamily,
  ctaText, ctaBgColor, ctaTextColor, ctaFontSize, ctaPosition, onCtaMove,
  canvasWidth, canvasHeight,
  showSlideNumber, slideNumberPosition, onSlideNumberMove,
  slideNumberBgColor, slideNumberTextColor, slideNumberSize,
}) => {
  const total = slides.length;
  const isCover = currentSlide === 0;
  const isLast = currentSlide === total - 1;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <PostCanvas
        text={slides[currentSlide]}
        title={isCover ? theme : undefined}
        slideNumber={currentSlide + 1}
        totalSlides={total}
        cta={isLast ? cta : undefined}
        isCoverSlide={isCover}
        isLastSlide={isLast}
        bgColor={bgColor} textColor={textColor} accentColor={accentColor}
        displayFont={displayFont} bodyFont={bodyFont} layout={layout}
        onTextChange={(t) => onSlideTextChange(currentSlide, t)}
        canvasRef={(el: HTMLDivElement | null) => { slideRefs.current[currentSlide] = el; }}
        overlayImages={overlayImages} onUpdateOverlay={onUpdateOverlay} onImageMove={onImageMove} onImageResize={onImageResize}
        selectedImageId={selectedImageId} onSelectImage={onSelectImage}
        fontSize={fontSize} fontWeight={fontWeight} fontStyle={fontStyle}
        textAlign={textAlign} bgGradient={bgGradient}
        titleFontSize={titleFontSize} titleColor={titleColor} titleFontFamily={titleFontFamily}
        ctaText={ctaText} ctaBgColor={ctaBgColor} ctaTextColor={ctaTextColor}
        ctaFontSize={ctaFontSize} ctaPosition={ctaPosition} onCtaMove={onCtaMove}
        canvasWidth={canvasWidth} canvasHeight={canvasHeight}
        showSlideNumber={showSlideNumber}
        slideNumberPosition={slideNumberPosition}
        onSlideNumberMove={onSlideNumberMove}
        slideNumberBgColor={slideNumberBgColor}
        slideNumberTextColor={slideNumberTextColor}
        slideNumberSize={slideNumberSize}
      />

      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" disabled={currentSlide === 0} onClick={() => onSlideChange(currentSlide - 1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-muted-foreground">{currentSlide + 1} / {total}</span>
        <Button variant="outline" size="icon" disabled={currentSlide === total - 1} onClick={() => onSlideChange(currentSlide + 1)}>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap justify-center">
        {slides.map((_, i) => (
          <button key={i} onClick={() => onSlideChange(i)}
            className={`w-8 h-8 rounded-md text-xs font-bold transition-all ${i === currentSlide ? "ring-2 ring-primary scale-110" : "opacity-60 hover:opacity-100"}`}
            style={{ backgroundColor: bgColor, color: textColor, border: `2px solid ${accentColor}` }}>
            {i + 1}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="gap-2" onClick={() => onDownloadSlide(currentSlide)}>
          <Download className="h-3 w-3" /> Baixar slide {currentSlide + 1}
        </Button>
        <Button size="sm" className="gap-2" onClick={onDownloadAll}>
          <Package className="h-3 w-3" /> Baixar todos (ZIP)
        </Button>
      </div>
    </div>
  );
};

export default CarouselEditor;
