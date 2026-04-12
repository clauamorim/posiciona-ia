import React, { useCallback } from "react";
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
  onImageMove?: (id: string, x: number, y: number) => void;
  onImageResize?: (id: string, width: number, height: number) => void;
  selectedImageId?: string | null;
  onSelectImage?: (id: string | null) => void;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  bgGradient?: string | null;
}

const CarouselEditor: React.FC<CarouselEditorProps> = ({
  slides,
  theme,
  cta,
  bgColor,
  textColor,
  accentColor,
  displayFont,
  bodyFont,
  layout,
  currentSlide,
  onSlideChange,
  onSlideTextChange,
  onDownloadSlide,
  onDownloadAll,
  slideRefs,
  overlayImages = [],
  onImageMove,
  onImageResize,
  selectedImageId,
  onSelectImage,
  fontSize,
  fontWeight,
  fontStyle,
  bgGradient,
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
        bgColor={bgColor}
        textColor={textColor}
        accentColor={accentColor}
        displayFont={displayFont}
        bodyFont={bodyFont}
        layout={layout}
        onTextChange={(t) => onSlideTextChange(currentSlide, t)}
        canvasRef={(el: HTMLDivElement | null) => { slideRefs.current[currentSlide] = el; }}
        overlayImages={overlayImages}
        onImageMove={onImageMove}
        onImageResize={onImageResize}
        selectedImageId={selectedImageId}
        onSelectImage={onSelectImage}
        fontSize={fontSize}
        fontWeight={fontWeight}
        fontStyle={fontStyle}
        bgGradient={bgGradient}
      />

      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          disabled={currentSlide === 0}
          onClick={() => onSlideChange(currentSlide - 1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium text-muted-foreground">
          {currentSlide + 1} / {total}
        </span>
        <Button
          variant="outline"
          size="icon"
          disabled={currentSlide === total - 1}
          onClick={() => onSlideChange(currentSlide + 1)}
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Slide thumbnails */}
      <div className="flex gap-2 flex-wrap justify-center">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => onSlideChange(i)}
            className={`w-8 h-8 rounded-md text-xs font-bold transition-all ${
              i === currentSlide
                ? "ring-2 ring-primary scale-110"
                : "opacity-60 hover:opacity-100"
            }`}
            style={{ backgroundColor: bgColor, color: textColor, border: `2px solid ${accentColor}` }}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Download buttons */}
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
