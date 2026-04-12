import React, { useRef, useEffect, useState, useCallback } from "react";
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
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  onTextChange?: (newText: string) => void;
  onTitleChange?: (newTitle: string) => void;
  canvasRef?: React.RefObject<HTMLDivElement> | ((el: HTMLDivElement | null) => void);
  overlayImages?: OverlayImage[];
  onImageMove?: (id: string, x: number, y: number) => void;
  onImageResize?: (id: string, width: number, height: number) => void;
  selectedImageId?: string | null;
  onSelectImage?: (id: string | null) => void;
  bgGradient?: string | null;
}

const RESIZE_HANDLE_SIZE = 14;

type Corner = "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r";

const CURSORS: Record<Corner, string> = {
  tl: "nwse-resize", tr: "nesw-resize", bl: "nesw-resize", br: "nwse-resize",
  t: "ns-resize", b: "ns-resize", l: "ew-resize", r: "ew-resize",
};

const PostCanvas: React.FC<PostCanvasProps> = ({
  text, title, slideNumber, totalSlides, cta, isLastSlide, isCoverSlide,
  bgColor, textColor, accentColor, displayFont, bodyFont, layout,
  fontSize, fontWeight, fontStyle, textAlign,
  onTextChange, onTitleChange, canvasRef,
  overlayImages = [], onImageMove, onImageResize,
  selectedImageId, onSelectImage, bgGradient,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number; corner: Corner } | null>(null);

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
    onSelectImage?.(img.id);
    setDragging({ id: img.id, startX: e.clientX, startY: e.clientY, origX: img.x, origY: img.y });
  };

  const handleResizeDown = (e: React.MouseEvent, img: OverlayImage, corner: Corner) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectImage?.(img.id);
    setResizing({ id: img.id, startX: e.clientX, startY: e.clientY, origX: img.x, origY: img.y, origW: img.width, origH: img.height, corner });
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
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [dragging, scale, onImageMove]);

  useEffect(() => {
    if (!resizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - resizing.startX) / scale;
      const dy = (e.clientY - resizing.startY) / scale;
      const { corner, origW, origH, origX, origY } = resizing;
      const img = overlayImages.find(i => i.id === resizing.id);
      if (!img) return;

      let newW = origW, newH = origH, newX = origX, newY = origY;

      if (corner === "br") { newW = Math.max(40, origW + dx); newH = Math.max(40, origH + dy); }
      else if (corner === "bl") { newW = Math.max(40, origW - dx); newH = Math.max(40, origH + dy); newX = origX + (origW - newW); }
      else if (corner === "tr") { newW = Math.max(40, origW + dx); newH = Math.max(40, origH - dy); newY = origY + (origH - newH); }
      else if (corner === "tl") { newW = Math.max(40, origW - dx); newH = Math.max(40, origH - dy); newX = origX + (origW - newW); newY = origY + (origH - newH); }
      else if (corner === "r") { newW = Math.max(40, origW + dx); }
      else if (corner === "l") { newW = Math.max(40, origW - dx); newX = origX + (origW - newW); }
      else if (corner === "b") { newH = Math.max(40, origH + dy); }
      else if (corner === "t") { newH = Math.max(40, origH - dy); newY = origY + (origH - newH); }

      // Shift = proportional for corners
      if (e.shiftKey && ["tl", "tr", "bl", "br"].includes(corner)) {
        const ratio = origW / origH;
        newH = newW / ratio;
      }

      onImageResize?.(resizing.id, newW, newH);
      if (newX !== img.x || newY !== img.y) onImageMove?.(resizing.id, newX, newY);
    };
    const handleMouseUp = () => setResizing(null);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [resizing, scale, onImageResize, onImageMove, overlayImages]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest("[data-overlay]") === null) {
      onSelectImage?.(null);
    }
  };

  const justifyClass = layout === "top" ? "justify-start pt-[120px]" : layout === "split" ? "justify-between" : "justify-center";
  const bodyFontSize = fontSize || 28;
  const bodyFontWeight = fontWeight || "normal";
  const bodyFontStyle2 = fontStyle || "normal";
  const bodyTextAlign = textAlign || "center";

  const renderResizeHandles = (img: OverlayImage) => {
    const hs = RESIZE_HANDLE_SIZE;
    const half = hs / 2;
    const handles: { corner: Corner; style: React.CSSProperties }[] = [
      { corner: "tl", style: { left: -half, top: -half } },
      { corner: "tr", style: { right: -half, top: -half } },
      { corner: "bl", style: { left: -half, bottom: -half } },
      { corner: "br", style: { right: -half, bottom: -half } },
      { corner: "t", style: { left: "50%", top: -half, transform: "translateX(-50%)" } },
      { corner: "b", style: { left: "50%", bottom: -half, transform: "translateX(-50%)" } },
      { corner: "l", style: { left: -half, top: "50%", transform: "translateY(-50%)" } },
      { corner: "r", style: { right: -half, top: "50%", transform: "translateY(-50%)" } },
    ];
    return handles.map(h => (
      <div key={h.corner} style={{
        position: "absolute", ...h.style,
        width: hs, height: hs,
        backgroundColor: "white", border: "2px solid rgba(0,0,0,0.5)",
        borderRadius: 3, cursor: CURSORS[h.corner],
      }} onMouseDown={(e) => handleResizeDown(e, img, h.corner)} />
    ));
  };

  return (
    <div ref={containerRef} className="flex items-center justify-center w-full">
      <div style={{ width: 1080 * scale, height: 1080 * scale, overflow: "hidden", position: "relative" }}>
        <div
          ref={(el) => {
            if (typeof canvasRef === "function") canvasRef(el);
            else if (canvasRef && "current" in canvasRef) (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          }}
          className={`absolute top-0 left-0 flex flex-col items-center ${justifyClass}`}
          style={{
            width: 1080, height: 1080,
            transform: `scale(${scale})`, transformOrigin: "top left",
            background: bgGradient || bgColor, color: textColor,
            fontFamily: `'${bodyFont}', sans-serif`,
          }}
          onClick={handleCanvasClick}
        >
          <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: accentColor }} />
          <div className="absolute bottom-0 left-0 w-full h-2" style={{ backgroundColor: accentColor }} />

          {slideNumber !== undefined && totalSlides !== undefined && (
            <div className="absolute top-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: accentColor, color: bgColor, fontFamily: `'${displayFont}', sans-serif` }}>
              {slideNumber}/{totalSlides}
            </div>
          )}

          {isCoverSlide && (
            <div className="flex flex-col items-center justify-center flex-1 px-[100px] text-center gap-8">
              <div className="w-20 h-1 rounded-full" style={{ backgroundColor: accentColor }} />
              <h1 contentEditable={!!onTitleChange} suppressContentEditableWarning
                onBlur={(e) => onTitleChange?.(e.currentTarget.textContent || "")}
                className="text-[64px] leading-tight font-bold outline-none focus:ring-2 focus:ring-white/30 rounded-lg px-4 py-2"
                style={{ fontFamily: `'${displayFont}', sans-serif`, textAlign: bodyTextAlign }}>{title}</h1>
              <p contentEditable={!!onTextChange} suppressContentEditableWarning
                onBlur={(e) => onTextChange?.(e.currentTarget.textContent || "")}
                className="leading-relaxed opacity-80 outline-none focus:ring-2 focus:ring-white/30 rounded-lg px-4 py-2 max-w-[800px]"
                style={{ fontSize: bodyFontSize, fontWeight: bodyFontWeight, fontStyle: bodyFontStyle2, textAlign: bodyTextAlign }}>{text}</p>
              <div className="w-20 h-1 rounded-full" style={{ backgroundColor: accentColor }} />
            </div>
          )}

          {isLastSlide && !isCoverSlide && (
            <div className="flex flex-col items-center justify-center flex-1 px-[100px] text-center gap-10">
              <p contentEditable={!!onTextChange} suppressContentEditableWarning
                onBlur={(e) => onTextChange?.(e.currentTarget.textContent || "")}
                className="leading-relaxed outline-none focus:ring-2 focus:ring-white/30 rounded-lg px-4 py-2"
                style={{ fontSize: bodyFontSize + 4, fontWeight: bodyFontWeight, fontStyle: bodyFontStyle2, textAlign: bodyTextAlign }}>{text}</p>
              {cta && (
                <div className="px-12 py-5 rounded-2xl text-[28px] font-bold"
                  style={{ backgroundColor: accentColor, color: bgColor, fontFamily: `'${displayFont}', sans-serif` }}>{cta}</div>
              )}
            </div>
          )}

          {!isCoverSlide && !isLastSlide && (
            <div className={`flex flex-col flex-1 px-[80px] w-full ${justifyClass} gap-6`}>
              {title && (
                <h2 contentEditable={!!onTitleChange} suppressContentEditableWarning
                  onBlur={(e) => onTitleChange?.(e.currentTarget.textContent || "")}
                  className="text-[44px] leading-tight font-bold outline-none focus:ring-2 focus:ring-white/30 rounded-lg px-4 py-2"
                  style={{ fontFamily: `'${displayFont}', sans-serif`, textAlign: bodyTextAlign }}>{title}</h2>
              )}
              <p contentEditable={!!onTextChange} suppressContentEditableWarning
                onBlur={(e) => onTextChange?.(e.currentTarget.textContent || "")}
                className="leading-relaxed outline-none focus:ring-2 focus:ring-white/30 rounded-lg px-4 py-2"
                style={{ fontSize: bodyFontSize, fontWeight: bodyFontWeight, fontStyle: bodyFontStyle2, textAlign: bodyTextAlign }}>{text}</p>
              {cta && layout === "split" && (
                <div className="text-[22px] font-semibold opacity-70 pb-[60px]" style={{ color: accentColor }}>{cta}</div>
              )}
            </div>
          )}

          {/* Overlay images */}
          {overlayImages.map((img) => {
            const isSelected = selectedImageId === img.id;
            return (
              <div key={img.id} data-overlay
                style={{
                  position: "absolute", left: img.x, top: img.y,
                  width: img.width, height: img.height,
                  cursor: "move", userSelect: "none",
                  outline: isSelected ? "2px dashed rgba(255,255,255,0.7)" : "none",
                  outlineOffset: 2,
                }}
                onMouseDown={(e) => handleMouseDown(e, img)}
                onClick={(e) => { e.stopPropagation(); onSelectImage?.(img.id); }}
              >
                <img src={img.src} alt={img.type}
                  style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", opacity: img.opacity ?? 1 }}
                  draggable={false} />
                {isSelected && renderResizeHandles(img)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PostCanvas;
