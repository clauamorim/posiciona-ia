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
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  onTextChange?: (newText: string) => void;
  onTitleChange?: (newTitle: string) => void;
  canvasRef?: React.RefObject<HTMLDivElement> | ((el: HTMLDivElement | null) => void);
  overlayImages?: OverlayImage[];
  onUpdateOverlay?: (id: string, updates: Partial<OverlayImage>) => void;
  selectedImageId?: string | null;
  onSelectImage?: (id: string | null) => void;
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
  // Legacy compat
  onImageMove?: (id: string, x: number, y: number) => void;
  onImageResize?: (id: string, width: number, height: number) => void;
}

const RESIZE_HANDLE_SIZE = 14;

type Corner = "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r";

const CURSORS: Record<Corner, string> = {
  tl: "nwse-resize", tr: "nesw-resize", bl: "nesw-resize", br: "nwse-resize",
  t: "ns-resize", b: "ns-resize", l: "ew-resize", r: "ew-resize",
};

interface TextBox {
  id: string;
  type: "title" | "body";
  x: number;
  y: number;
  width: number;
  height: number;
}

const PostCanvas: React.FC<PostCanvasProps> = ({
  text, title, slideNumber, totalSlides, cta, isLastSlide, isCoverSlide,
  bgColor, textColor, accentColor, displayFont, bodyFont, layout,
  fontSize, fontWeight, fontStyle, textAlign,
  onTextChange, onTitleChange, canvasRef,
  overlayImages = [], onUpdateOverlay, onImageMove, onImageResize,
  selectedImageId, onSelectImage, bgGradient,
  titleFontSize, titleColor, titleFontFamily,
  ctaText, ctaBgColor, ctaTextColor, ctaFontSize, ctaPosition, onCtaMove,
  canvasWidth = 1080, canvasHeight = 1080,
  showSlideNumber = true, slideNumberPosition, onSlideNumberMove,
  slideNumberBgColor, slideNumberTextColor, slideNumberSize,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number; isText?: boolean; isCta?: boolean } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number; corner: Corner; isText?: boolean } | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const textBoxesInitialized = useRef(false);
  const lastLayout = useRef(layout);

  const updateOverlay = (id: string, updates: Partial<OverlayImage>) => {
    if (onUpdateOverlay) {
      onUpdateOverlay(id, updates);
    } else {
      if (updates.x !== undefined || updates.y !== undefined) {
        const img = overlayImages.find(i => i.id === id);
        onImageMove?.(id, updates.x ?? img?.x ?? 0, updates.y ?? img?.y ?? 0);
      }
      if (updates.width !== undefined || updates.height !== undefined) {
        const img = overlayImages.find(i => i.id === id);
        onImageResize?.(id, updates.width ?? img?.width ?? 100, updates.height ?? img?.height ?? 100);
      }
    }
  };

  const computeTextBoxPositions = (lyt: string, hasTitle: boolean, isCover: boolean) => {
    const boxes: TextBox[] = [];
    if (hasTitle) {
      boxes.push({
        id: "text-title", type: "title",
        x: isCover ? 100 : 80,
        y: isCover ? 300 : (lyt === "top" ? 120 : 250),
        width: isCover ? 880 : 920,
        height: isCover ? 140 : 100,
      });
    }
    boxes.push({
      id: "text-body", type: "body",
      x: isCover ? 140 : 80,
      y: hasTitle ? (isCover ? 480 : (lyt === "top" ? 250 : 400)) : (lyt === "top" ? 120 : 300),
      width: isCover ? 800 : 920,
      height: isCover ? 160 : 250,
    });
    return boxes;
  };

  useEffect(() => {
    if (textBoxesInitialized.current) return;
    const boxes = computeTextBoxPositions(layout, !!title, !!isCoverSlide);
    if (boxes.length > 0) {
      setTextBoxes(boxes);
      textBoxesInitialized.current = true;
    }
  }, [title, text, isCoverSlide, layout]);

  useEffect(() => {
    if (!textBoxesInitialized.current) return;
    if (lastLayout.current === layout) return;
    lastLayout.current = layout;
    const newPositions = computeTextBoxPositions(layout, !!title, !!isCoverSlide);
    setTextBoxes(prev => prev.map(tb => {
      const match = newPositions.find(n => n.id === tb.id);
      if (match) return { ...tb, x: match.x, y: match.y, width: match.width, height: match.height };
      return tb;
    }));
  }, [layout, title, isCoverSlide]);

  useEffect(() => {
    textBoxesInitialized.current = false;
  }, [isCoverSlide, isLastSlide]);

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const parent = containerRef.current.parentElement;
        if (parent) {
          const sW = parent.clientWidth / canvasWidth;
          const sH = parent.clientHeight ? parent.clientHeight / canvasHeight : 1;
          const s = Math.min(sW, sH, 0.55);
          setScale(s);
        }
      }
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [canvasWidth, canvasHeight]);

  const handleMouseDown = (e: React.MouseEvent, img: OverlayImage) => {
    e.preventDefault(); e.stopPropagation();
    onSelectImage?.(img.id);
    setSelectedTextId(null);
    setDragging({ id: img.id, startX: e.clientX, startY: e.clientY, origX: img.x, origY: img.y });
  };

  const handleTextMouseDown = (e: React.MouseEvent, tb: TextBox) => {
    if (editingTextId === tb.id) return;
    e.preventDefault(); e.stopPropagation();
    setSelectedTextId(tb.id);
    onSelectImage?.(null);
    setDragging({ id: tb.id, startX: e.clientX, startY: e.clientY, origX: tb.x, origY: tb.y, isText: true });
  };

  const handleCtaMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setSelectedTextId(null);
    onSelectImage?.(null);
    const pos = ctaPosition || { x: 0, y: 0 };
    setDragging({ id: "cta-button", startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, isCta: true });
  };

  const handleResizeDown = (e: React.MouseEvent, img: OverlayImage, corner: Corner) => {
    e.preventDefault(); e.stopPropagation();
    onSelectImage?.(img.id);
    setResizing({ id: img.id, startX: e.clientX, startY: e.clientY, origX: img.x, origY: img.y, origW: img.width, origH: img.height, corner });
  };

  const handleTextResizeDown = (e: React.MouseEvent, tb: TextBox, corner: Corner) => {
    e.preventDefault(); e.stopPropagation();
    setSelectedTextId(tb.id);
    setResizing({ id: tb.id, startX: e.clientX, startY: e.clientY, origX: tb.x, origY: tb.y, origW: tb.width, origH: tb.height, corner, isText: true });
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragging.startX) / scale;
      const dy = (e.clientY - dragging.startY) / scale;
      if (dragging.isCta) {
        onCtaMove?.(dragging.origX + dx, dragging.origY + dy);
      } else if (dragging.isText) {
        setTextBoxes(prev => prev.map(tb => tb.id === dragging.id ? { ...tb, x: dragging.origX + dx, y: dragging.origY + dy } : tb));
      } else {
        updateOverlay(dragging.id, { x: dragging.origX + dx, y: dragging.origY + dy });
      }
    };
    const handleMouseUp = () => setDragging(null);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [dragging, scale]);

  useEffect(() => {
    if (!resizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = (e.clientX - resizing.startX) / scale;
      const dy = (e.clientY - resizing.startY) / scale;
      const { corner, origW, origH, origX, origY } = resizing;
      let newW = origW, newH = origH, newX = origX, newY = origY;
      const MIN = 8;
      if (corner === "br") { newW = Math.max(MIN, origW + dx); newH = Math.max(MIN, origH + dy); }
      else if (corner === "bl") { newW = Math.max(MIN, origW - dx); newH = Math.max(MIN, origH + dy); newX = origX + (origW - newW); }
      else if (corner === "tr") { newW = Math.max(MIN, origW + dx); newH = Math.max(MIN, origH - dy); newY = origY + (origH - newH); }
      else if (corner === "tl") { newW = Math.max(MIN, origW - dx); newH = Math.max(MIN, origH - dy); newX = origX + (origW - newW); newY = origY + (origH - newH); }
      else if (corner === "r") { newW = Math.max(MIN, origW + dx); }
      else if (corner === "l") { newW = Math.max(MIN, origW - dx); newX = origX + (origW - newW); }
      else if (corner === "b") { newH = Math.max(MIN, origH + dy); }
      else if (corner === "t") { newH = Math.max(MIN, origH - dy); newY = origY + (origH - newH); }
      if (e.shiftKey && ["tl", "tr", "bl", "br"].includes(corner)) {
        const ratio = origW / origH;
        newH = newW / ratio;
        if (corner === "tl" || corner === "tr") newY = origY + origH - newH;
      }
      if (resizing.isText) {
        setTextBoxes(prev => prev.map(tb => tb.id === resizing.id ? { ...tb, x: newX, y: newY, width: newW, height: newH } : tb));
      } else {
        updateOverlay(resizing.id, { x: newX, y: newY, width: newW, height: newH });
      }
    };
    const handleMouseUp = () => setResizing(null);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => { window.removeEventListener("mousemove", handleMouseMove); window.removeEventListener("mouseup", handleMouseUp); };
  }, [resizing, scale, overlayImages]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest("[data-overlay]") === null) {
      onSelectImage?.(null);
      setSelectedTextId(null);
      setEditingTextId(null);
    }
  };

  const bodyFontSize = fontSize || 28;
  const bodyFontWeight = fontWeight || "normal";
  const bodyFontStyle2 = fontStyle || "normal";
  const bodyTextAlign = textAlign || "center";

  const resolvedTitleFontSize = titleFontSize || (isCoverSlide ? 64 : 44);
  const resolvedTitleColor = titleColor || textColor;
  const resolvedTitleFont = titleFontFamily || displayFont;

  const resolvedCtaText = ctaText || cta || "";
  const resolvedCtaBg = ctaBgColor || accentColor;
  const resolvedCtaText2 = ctaTextColor || bgColor;
  const resolvedCtaFontSize = ctaFontSize || 27;

  const renderResizeHandles = (item: { id: string; x: number; y: number; width: number; height: number }, isText: boolean) => {
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
        borderRadius: 3, cursor: CURSORS[h.corner], zIndex: 10,
      }} onMouseDown={(e) => {
        if (isText) {
          const tb = textBoxes.find(t => t.id === item.id);
          if (tb) handleTextResizeDown(e, tb, h.corner);
        } else {
          handleResizeDown(e, item as OverlayImage, h.corner);
        }
      }} />
    ));
  };

  const renderTextBox = (tb: TextBox) => {
    const isSelected = selectedTextId === tb.id;
    const isEditing = editingTextId === tb.id;
    const isTitle = tb.type === "title";
    const content = isTitle ? title : text;

    return (
      <div key={tb.id} data-overlay
        style={{
          position: "absolute", left: tb.x, top: tb.y, width: tb.width, minHeight: tb.height,
          cursor: isEditing ? "text" : "move", userSelect: isEditing ? "text" : "none",
          outline: isSelected ? "2px dashed rgba(255,255,255,0.7)" : "none", outlineOffset: 2,
          zIndex: isSelected ? 5 : 2, padding: "8px 16px", boxSizing: "border-box", overflow: "hidden",
        }}
        onMouseDown={(e) => handleTextMouseDown(e, tb)}
        onClick={(e) => { e.stopPropagation(); setSelectedTextId(tb.id); onSelectImage?.(null); }}
        onDoubleClick={(e) => { e.stopPropagation(); setEditingTextId(tb.id); }}
      >
        <div contentEditable={isEditing} suppressContentEditableWarning
          onBlur={(e) => {
            const newText = e.currentTarget.textContent || "";
            if (isTitle) onTitleChange?.(newText);
            else onTextChange?.(newText);
            setEditingTextId(null);
          }}
          style={{
            fontFamily: isTitle ? `'${resolvedTitleFont}', sans-serif` : `'${bodyFont}', sans-serif`,
            fontSize: isTitle ? resolvedTitleFontSize : bodyFontSize,
            fontWeight: isTitle ? "bold" : bodyFontWeight,
            fontStyle: isTitle ? "normal" : bodyFontStyle2,
            textAlign: bodyTextAlign,
            lineHeight: isTitle ? 1.15 : 1.6,
            color: isTitle ? resolvedTitleColor : textColor,
            outline: "none", width: "100%", minHeight: "1em",
            opacity: isTitle ? 1 : 0.9,
          }}
        >
          {content}
        </div>
        {isSelected && renderResizeHandles(tb, true)}
      </div>
    );
  };

  const showCta = resolvedCtaText && (isLastSlide || isCoverSlide || (layout === "split" && cta));
  const defaultCtaPos = isCoverSlide
    ? { x: 540, y: 540 }
    : isLastSlide
    ? { x: 540, y: 780 }
    : { x: 80, y: 960 };
  const ctaPos = ctaPosition || defaultCtaPos;

  const renderOverlayTextBox = (img: OverlayImage) => {
    const isSelected = selectedImageId === img.id;
    return (
      <div key={img.id} data-overlay
        style={{
          position: "absolute", left: img.x, top: img.y, width: img.width, minHeight: img.height,
          cursor: "move", userSelect: "none",
          outline: isSelected ? "2px dashed rgba(255,255,255,0.7)" : "none", outlineOffset: 2,
          zIndex: isSelected ? 6 : 4,
          backgroundColor: img.bgColor || "transparent",
          opacity: img.opacity ?? 1,
          borderRadius: 8, padding: "12px 16px", boxSizing: "border-box",
        }}
        onMouseDown={(e) => handleMouseDown(e, img)}
        onClick={(e) => { e.stopPropagation(); onSelectImage?.(img.id); setSelectedTextId(null); }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          const target = e.currentTarget.querySelector("[contenteditable]") as HTMLElement;
          if (target) { target.contentEditable = "true"; target.focus(); }
        }}
      >
        <div
          contentEditable={false}
          suppressContentEditableWarning
          onBlur={(e) => {
            const el = e.currentTarget;
            el.contentEditable = "false";
            updateOverlay(img.id, { text: el.textContent || "" });
          }}
          style={{
            fontFamily: img.fontFamily ? `'${img.fontFamily}', sans-serif` : `'${bodyFont}', sans-serif`,
            fontSize: img.fontSize || 24,
            color: img.textColor || textColor,
            outline: "none", width: "100%", minHeight: "1em",
            lineHeight: 1.5,
          }}
        >
          {img.text || "Texto"}
        </div>
        {isSelected && renderResizeHandles(img, false)}
      </div>
    );
  };

  return (
    <div ref={containerRef} className="flex items-center justify-center w-full">
      <div style={{ width: canvasWidth * scale, height: canvasHeight * scale, overflow: "hidden", position: "relative" }}>
        <div
          ref={(el) => {
            if (typeof canvasRef === "function") canvasRef(el);
            else if (canvasRef && "current" in canvasRef) (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          }}
          className="absolute top-0 left-0"
          style={{
            width: canvasWidth, height: canvasHeight,
            transform: `scale(${scale})`, transformOrigin: "top left",
            background: bgGradient || bgColor, color: textColor,
            fontFamily: `'${bodyFont}', sans-serif`,
            position: "relative",
          }}
          onClick={handleCanvasClick}
        >
          {/* Removed hardcoded decorative bars — use Barras e molduras from toolbar instead */}

          {slideNumber !== undefined && totalSlides !== undefined && (
            <div className="absolute top-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: accentColor, color: bgColor, fontFamily: `'${displayFont}', sans-serif`, zIndex: 3 }}>
              {slideNumber}/{totalSlides}
            </div>
          )}

          {isLastSlide && !isCoverSlide && resolvedCtaText && (
            <div data-overlay
              style={{
                position: "absolute", left: ctaPos.x, top: ctaPos.y,
                transform: "translate(-50%, -50%)",
                cursor: "move", userSelect: "none", zIndex: 7,
              }}
              onMouseDown={handleCtaMouseDown}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-12 py-5 rounded-2xl font-bold whitespace-nowrap"
                style={{ backgroundColor: resolvedCtaBg, color: resolvedCtaText2, fontFamily: `'${displayFont}', sans-serif`, fontSize: resolvedCtaFontSize }}>
                {resolvedCtaText}
              </div>
            </div>
          )}

          {!isCoverSlide && !isLastSlide && resolvedCtaText && layout === "split" && (
            <div data-overlay
              style={{
                position: "absolute", left: ctaPos.x, top: ctaPos.y,
                cursor: "move", userSelect: "none", zIndex: 7,
              }}
              onMouseDown={handleCtaMouseDown}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="font-semibold whitespace-nowrap"
                style={{ color: resolvedCtaBg, fontSize: Math.max(18, resolvedCtaFontSize - 6), opacity: 0.8 }}>
                {resolvedCtaText}
              </div>
            </div>
          )}

          {textBoxes.map(renderTextBox)}

          {overlayImages.map((img, arrayIndex) => {
            if (img.type === "textbox") return renderOverlayTextBox(img);
            const isSelected = selectedImageId === img.id;
            return (
              <div key={img.id} data-overlay
                style={{
                  position: "absolute", left: img.x, top: img.y,
                  width: img.width, height: img.height,
                  cursor: "move", userSelect: "none",
                  outline: isSelected ? "2px dashed rgba(255,255,255,0.7)" : "none",
                  outlineOffset: 2, zIndex: isSelected ? 6 : 3 + arrayIndex,
                }}
                onMouseDown={(e) => handleMouseDown(e, img)}
                onClick={(e) => { e.stopPropagation(); onSelectImage?.(img.id); setSelectedTextId(null); }}
              >
                <img src={img.src} alt={img.type}
                  crossOrigin="anonymous"
                  style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", opacity: img.opacity ?? 1 }}
                  draggable={false} />
                {isSelected && renderResizeHandles(img, false)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PostCanvas;
