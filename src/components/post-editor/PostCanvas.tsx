import React, { useRef, useEffect, useState } from "react";
import type { OverlayImage } from "./PostToolbar";

interface PostCanvasProps {
  text: string;
  title?: string;
  slideNumber?: number;
  totalSlides?: number;
  cta?: string;
  isLastSlide?: boolean;
  isCoverSlide?: boolean;
  bgColor: string;
  textColor: string;
  accentColor: string;
  displayFont: string;
  bodyFont: string;
  layout: "centered" | "top" | "split";
  onTextChange?: (newText: string) => void;
  onTitleChange?: (newTitle: string) => void;
  canvasRef?: React.RefObject<HTMLDivElement> | ((el: HTMLDivElement | null) => void);
  overlayImages?: OverlayImage[];
  onImageMove?: (id: string, x: number, y: number) => void;
  onImageResize?: (id: string, width: number, height: number) => void;
}

const PostCanvas: React.FC<PostCanvasProps> = ({
  text,
  title,
  slideNumber,
  totalSlides,
  cta,
  isLastSlide,
  isCoverSlide,
  bgColor,
  textColor,
  accentColor,
  displayFont,
  bodyFont,
  layout,
  onTextChange,
  onTitleChange,
  canvasRef,
  overlayImages = [],
  onImageMove,
  onImageResize,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const parent = containerRef.current.parentElement;
        if (parent) {
          const s = Math.min(parent.clientWidth / 1080, 0.55);
          setScale(s);
        }
      }
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  const handleMouseDown = (e: React.MouseEvent, img: OverlayImage) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging({ id: img.id, startX: e.clientX, startY: e.clientY, origX: img.x, origY: img.y });
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragging.startX) / scale;
      const dy = (e.clientY - dragging.startY) / scale;
      onImageMove?.(dragging.id, dragging.origX + dx, dragging.origY + dy);
    };
    const handleMouseUp = () => setDragging(null);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, scale, onImageMove]);

  const justifyClass = layout === "top" ? "justify-start pt-[120px]" : layout === "split" ? "justify-between" : "justify-center";

  return (
    <div ref={containerRef} className="flex items-center justify-center w-full">
      <div
        style={{
          width: 1080 * scale,
          height: 1080 * scale,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          ref={(el) => {
            if (typeof canvasRef === "function") canvasRef(el);
            else if (canvasRef && "current" in canvasRef) (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          }}
          className={`absolute top-0 left-0 flex flex-col items-center ${justifyClass}`}
          style={{
            width: 1080,
            height: 1080,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            backgroundColor: bgColor,
            color: textColor,
            fontFamily: `'${bodyFont}', sans-serif`,
          }}
        >
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: accentColor }} />
          <div className="absolute bottom-0 left-0 w-full h-2" style={{ backgroundColor: accentColor }} />

          {/* Slide number indicator */}
          {slideNumber !== undefined && totalSlides !== undefined && (
            <div
              className="absolute top-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: accentColor, color: bgColor, fontFamily: `'${displayFont}', sans-serif` }}
            >
              {slideNumber}/{totalSlides}
            </div>
          )}

          {/* Cover slide layout */}
          {isCoverSlide && (
            <div className="flex flex-col items-center justify-center flex-1 px-[100px] text-center gap-8">
              <div className="w-20 h-1 rounded-full" style={{ backgroundColor: accentColor }} />
              <h1
                contentEditable={!!onTitleChange}
                suppressContentEditableWarning
                onBlur={(e) => onTitleChange?.(e.currentTarget.textContent || "")}
                className="text-[64px] leading-tight font-bold outline-none focus:ring-2 focus:ring-white/30 rounded-lg px-4 py-2"
                style={{ fontFamily: `'${displayFont}', sans-serif` }}
              >
                {title}
              </h1>
              <p
                contentEditable={!!onTextChange}
                suppressContentEditableWarning
                onBlur={(e) => onTextChange?.(e.currentTarget.textContent || "")}
                className="text-[28px] leading-relaxed opacity-80 outline-none focus:ring-2 focus:ring-white/30 rounded-lg px-4 py-2 max-w-[800px]"
              >
                {text}
              </p>
              <div className="w-20 h-1 rounded-full" style={{ backgroundColor: accentColor }} />
            </div>
          )}

          {/* CTA / last slide layout */}
          {isLastSlide && !isCoverSlide && (
            <div className="flex flex-col items-center justify-center flex-1 px-[100px] text-center gap-10">
              <p
                contentEditable={!!onTextChange}
                suppressContentEditableWarning
                onBlur={(e) => onTextChange?.(e.currentTarget.textContent || "")}
                className="text-[32px] leading-relaxed outline-none focus:ring-2 focus:ring-white/30 rounded-lg px-4 py-2"
              >
                {text}
              </p>
              {cta && (
                <div
                  className="px-12 py-5 rounded-2xl text-[28px] font-bold"
                  style={{ backgroundColor: accentColor, color: bgColor, fontFamily: `'${displayFont}', sans-serif` }}
                >
                  {cta}
                </div>
              )}
            </div>
          )}

          {/* Regular content slide */}
          {!isCoverSlide && !isLastSlide && (
            <div className={`flex flex-col flex-1 px-[80px] w-full ${justifyClass} gap-6`}>
              {title && (
                <h2
                  contentEditable={!!onTitleChange}
                  suppressContentEditableWarning
                  onBlur={(e) => onTitleChange?.(e.currentTarget.textContent || "")}
                  className="text-[44px] leading-tight font-bold outline-none focus:ring-2 focus:ring-white/30 rounded-lg px-4 py-2"
                  style={{ fontFamily: `'${displayFont}', sans-serif` }}
                >
                  {title}
                </h2>
              )}
              <p
                contentEditable={!!onTextChange}
                suppressContentEditableWarning
                onBlur={(e) => onTextChange?.(e.currentTarget.textContent || "")}
                className="text-[28px] leading-relaxed outline-none focus:ring-2 focus:ring-white/30 rounded-lg px-4 py-2"
              >
                {text}
              </p>
              {cta && layout === "split" && (
                <div className="text-[22px] font-semibold opacity-70 pb-[60px]" style={{ color: accentColor }}>
                  {cta}
                </div>
              )}
            </div>
          )}

          {/* Overlay images */}
          {overlayImages.map((img) => (
            <img
              key={img.id}
              src={img.src}
              alt={img.type}
              onMouseDown={(e) => handleMouseDown(e, img)}
              style={{
                position: "absolute",
                left: img.x,
                top: img.y,
                width: img.width,
                height: img.height,
                objectFit: "contain",
                cursor: "move",
                border: dragging?.id === img.id ? "2px dashed rgba(255,255,255,0.5)" : "none",
                userSelect: "none",
              }}
              draggable={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PostCanvas;
