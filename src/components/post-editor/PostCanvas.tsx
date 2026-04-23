import React, { useRef, useEffect, useState } from "react";
import type { OverlayImage } from "./PostToolbar";
import { useIsMobile } from "@/hooks/use-mobile";

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
  titleTextAlign?: "left" | "center" | "right" | "justify";
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
  onSelectedTextChange?: (id: string | null) => void;
  renderOrder?: string[];
  onRenderOrderChange?: (order: string[]) => void;
  /** Mostra réguas horizontais e verticais nas bordas. */
  showRulers?: boolean;
  /** Mostra badge de coordenadas X,Y e tamanho W×H no item selecionado. */
  showCoordinates?: boolean;
  /** Estilo escolhido na criação do post (minimal força centralização horizontal). */
  postStyle?: "minimal" | "unsplash" | "ai" | string;
  /** Posições iniciais de título/corpo definidas pelo template (sobrescrevem os cálculos genéricos). */
  initialTextBoxes?: {
    title?: { x: number; y: number; width: number; height: number };
    body?: { x: number; y: number; width: number; height: number };
  };
  /** Chave que dispara reset de posições do canvas (style/format/slide). */
  resetKey?: string;
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
  fontSize, fontWeight, fontStyle, textAlign, titleTextAlign,
  onTextChange, onTitleChange, canvasRef,
  overlayImages = [], onUpdateOverlay, onImageMove, onImageResize,
  selectedImageId, onSelectImage, bgGradient,
  titleFontSize, titleColor, titleFontFamily,
  ctaText, ctaBgColor, ctaTextColor, ctaFontSize, ctaPosition, onCtaMove,
  canvasWidth = 1080, canvasHeight = 1080,
  showSlideNumber = true, slideNumberPosition, onSlideNumberMove,
  slideNumberBgColor, slideNumberTextColor, slideNumberSize,
  onSelectedTextChange, renderOrder: externalRenderOrder, onRenderOrderChange,
  showRulers = false, showCoordinates = true, postStyle,
  initialTextBoxes, resetKey,
}) => {
  const isMobile = useIsMobile();
  const handleVisualSize = isMobile ? 22 : RESIZE_HANDLE_SIZE;
  const handleHitSize = isMobile ? 36 : 20;
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const [dragging, setDragging] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number; isText?: boolean; isCta?: boolean } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number; corner: Corner; isText?: boolean } | null>(null);
  const [selectedTextIdLocal, setSelectedTextIdLocal] = useState<string | null>(null);
  const selectedTextId = selectedTextIdLocal;
  const setSelectedTextId = (id: string | null) => {
    setSelectedTextIdLocal(id);
    onSelectedTextChange?.(id);
  };
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [activeGuides, setActiveGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });

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
    const isMinimal = postStyle === "minimal";
    const centerX = (w: number) => Math.round((canvasWidth - w) / 2);
    // Se há slots vindos do template, usá-los direto
    if (initialTextBoxes?.title && hasTitle) {
      const w = initialTextBoxes.title.width;
      boxes.push({
        id: "text-title", type: "title",
        x: isMinimal ? centerX(w) : initialTextBoxes.title.x,
        y: initialTextBoxes.title.y,
        width: w,
        height: initialTextBoxes.title.height,
      });
    } else if (hasTitle) {
      const w = isCover ? 880 : 920;
      boxes.push({
        id: "text-title", type: "title",
        x: isMinimal ? centerX(w) : (isCover ? 100 : 80),
        y: isCover ? 300 : (lyt === "top" ? 120 : 250),
        width: w,
        height: isCover ? 140 : 100,
      });
    }
    if (initialTextBoxes?.body) {
      const w = initialTextBoxes.body.width;
      boxes.push({
        id: "text-body", type: "body",
        x: isMinimal ? centerX(w) : initialTextBoxes.body.x,
        y: initialTextBoxes.body.y,
        width: w,
        height: initialTextBoxes.body.height,
      });
    } else {
      const w = isCover ? 800 : 920;
      boxes.push({
        id: "text-body", type: "body",
        x: isMinimal ? centerX(w) : (isCover ? 140 : 80),
        y: hasTitle ? (isCover ? 480 : (lyt === "top" ? 250 : 400)) : (lyt === "top" ? 120 : 300),
        width: w,
        height: isCover ? 160 : 250,
      });
    }
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
    // Always force-reset positions/sizes when layout changes
    setTextBoxes(newPositions);
  }, [layout, title, isCoverSlide]);

  useEffect(() => {
    textBoxesInitialized.current = false;
  }, [isCoverSlide, isLastSlide]);

  // Reset quando muda formato/estilo: força recálculo a partir dos novos slots do template
  const lastResetKey = useRef<string | undefined>(resetKey);
  useEffect(() => {
    if (resetKey === undefined) return;
    if (lastResetKey.current === resetKey) return;
    lastResetKey.current = resetKey;
    const boxes = computeTextBoxPositions(layout, !!title, !!isCoverSlide);
    if (boxes.length > 0) {
      setTextBoxes(boxes);
      textBoxesInitialized.current = true;
    }
  }, [resetKey, layout, title, isCoverSlide]);

  // Quando initialTextBoxes muda (novo layout do template), aplica imediatamente
  const lastInitialKey = useRef<string>("");
  useEffect(() => {
    const key = JSON.stringify(initialTextBoxes || {});
    if (key === lastInitialKey.current) return;
    if (key === "{}") return; // sem slots ainda
    lastInitialKey.current = key;
    const boxes = computeTextBoxPositions(layout, !!title, !!isCoverSlide);
    if (boxes.length > 0) {
      setTextBoxes(boxes);
      textBoxesInitialized.current = true;
    }
  }, [initialTextBoxes, layout, title, isCoverSlide]);

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

  const capturePointer = (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
  };

  const handlePointerDown = (e: React.PointerEvent, img: OverlayImage) => {
    e.preventDefault(); e.stopPropagation();
    capturePointer(e);
    onSelectImage?.(img.id);
    setSelectedTextId(null);
    setDragging({ id: img.id, startX: e.clientX, startY: e.clientY, origX: img.x, origY: img.y });
  };

  const handleTextPointerDown = (e: React.PointerEvent, tb: TextBox) => {
    if (editingTextId === tb.id) return;
    e.preventDefault(); e.stopPropagation();
    capturePointer(e);
    setSelectedTextId(tb.id);
    onSelectImage?.(null);
    setDragging({ id: tb.id, startX: e.clientX, startY: e.clientY, origX: tb.x, origY: tb.y, isText: true });
  };

  const handleCtaPointerDown = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation();
    capturePointer(e);
    setSelectedTextId("cta");
    onSelectImage?.(null);
    const pos = ctaPosition || { x: 0, y: 0 };
    setDragging({ id: "cta-button", startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, isCta: true });
  };

  const handleResizeDown = (e: React.PointerEvent, img: OverlayImage, corner: Corner) => {
    e.preventDefault(); e.stopPropagation();
    capturePointer(e);
    onSelectImage?.(img.id);
    setResizing({ id: img.id, startX: e.clientX, startY: e.clientY, origX: img.x, origY: img.y, origW: img.width, origH: img.height, corner });
  };

  const handleTextResizeDown = (e: React.PointerEvent, tb: TextBox, corner: Corner) => {
    e.preventDefault(); e.stopPropagation();
    capturePointer(e);
    setSelectedTextId(tb.id);
    setResizing({ id: tb.id, startX: e.clientX, startY: e.clientY, origX: tb.x, origY: tb.y, origW: tb.width, origH: tb.height, corner, isText: true });
  };

  useEffect(() => {
    if (!dragging) return;
    const handlePointerMove = (e: PointerEvent) => {
      if (e.cancelable) e.preventDefault();
      const dx = (e.clientX - dragging.startX) / scale;
      const dy = (e.clientY - dragging.startY) / scale;
      const proposedX = dragging.origX + dx;
      const proposedY = dragging.origY + dy;
      if (dragging.isCta) {
        onCtaMove?.(proposedX, proposedY);
      } else if (dragging.isText) {
        setTextBoxes(prev => prev.map(t => t.id === dragging.id ? { ...t, x: proposedX, y: proposedY } : t));
      } else {
        updateOverlay(dragging.id, { x: proposedX, y: proposedY });
      }
    };
    const handlePointerUp = () => { setDragging(null); };
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [dragging, scale, overlayImages, textBoxes, canvasWidth, canvasHeight]);

  useEffect(() => {
    if (!resizing) return;
    const handlePointerMove = (e: PointerEvent) => {
      if (e.cancelable) e.preventDefault();
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
    const handlePointerUp = () => setResizing(null);
    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [resizing, scale, overlayImages]);

  // Arrow-key nudging for selected element (1px / Shift+10px)
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (!selectedImageId && !selectedTextId) return;
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      if (selectedImageId) {
        const img = overlayImages.find(i => i.id === selectedImageId);
        if (img) updateOverlay(selectedImageId, { x: img.x + dx, y: img.y + dy });
      } else if (selectedTextId === "cta") {
        const pos = ctaPosition || { x: 540, y: 780 };
        onCtaMove?.(pos.x + dx, pos.y + dy);
      } else if (selectedTextId === "slideNumber") {
        const pos = slideNumberPosition || { x: canvasWidth - 60, y: 50 };
        onSlideNumberMove?.(pos.x + dx, pos.y + dy);
      } else if (selectedTextId) {
        setTextBoxes(prev => prev.map(tb => tb.id === selectedTextId ? { ...tb, x: tb.x + dx, y: tb.y + dy } : tb));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedImageId, selectedTextId, overlayImages, ctaPosition, slideNumberPosition, canvasWidth]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest("[data-overlay]") === null) {
      onSelectImage?.(null);
      setSelectedTextId(null);
      setEditingTextId(null);
    }
  };

  // Selected item bounding box (for coordinates badge)
  const selectedBounds = (() => {
    if (selectedImageId) {
      const img = overlayImages.find(i => i.id === selectedImageId);
      if (img) return { x: img.x, y: img.y, w: img.width, h: img.height };
    }
    if (selectedTextId && selectedTextId.startsWith("text-")) {
      const tb = textBoxes.find(t => t.id === selectedTextId);
      if (tb) return { x: tb.x, y: tb.y, w: tb.width, h: tb.height };
    }
    return null;
  })();

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
    const visual = handleVisualSize;
    const hit = handleHitSize;
    const halfHit = hit / 2;
    const handles: { corner: Corner; wrapStyle: React.CSSProperties }[] = [
      { corner: "tl", wrapStyle: { left: -halfHit, top: -halfHit } },
      { corner: "tr", wrapStyle: { right: -halfHit, top: -halfHit } },
      { corner: "bl", wrapStyle: { left: -halfHit, bottom: -halfHit } },
      { corner: "br", wrapStyle: { right: -halfHit, bottom: -halfHit } },
      { corner: "t", wrapStyle: { left: "50%", top: -halfHit, transform: "translateX(-50%)" } },
      { corner: "b", wrapStyle: { left: "50%", bottom: -halfHit, transform: "translateX(-50%)" } },
      { corner: "l", wrapStyle: { left: -halfHit, top: "50%", transform: "translateY(-50%)" } },
      { corner: "r", wrapStyle: { right: -halfHit, top: "50%", transform: "translateY(-50%)" } },
    ];
    return handles.map(h => (
      <div
        key={h.corner}
        style={{
          position: "absolute", ...h.wrapStyle,
          width: hit, height: hit,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: CURSORS[h.corner], zIndex: 10000,
          touchAction: "none",
          backgroundColor: "transparent",
        }}
        onPointerDown={(e) => {
          if (isText) {
            const tb = textBoxes.find(t => t.id === item.id);
            if (tb) handleTextResizeDown(e, tb, h.corner);
          } else {
            handleResizeDown(e, item as OverlayImage, h.corner);
          }
        }}
      >
        <div style={{
          width: visual, height: visual,
          backgroundColor: "white", border: "2px solid rgba(0,0,0,0.5)",
          borderRadius: 3, pointerEvents: "none",
        }} />
      </div>
    ));
  };

  // Unified render order: all items (text boxes + overlays) share one z-index stack
  // externalRenderOrder controls the order; if not provided, default: textBoxes first, then overlays
  const allIds = [...textBoxes.map(tb => tb.id), ...overlayImages.map(img => img.id)];
  const effectiveRenderOrder = (() => {
    if (externalRenderOrder && externalRenderOrder.length > 0) {
      // Keep only IDs that still exist, append any new ones at the end
      const existing = externalRenderOrder.filter(id => allIds.includes(id));
      const newIds = allIds.filter(id => !existing.includes(id));
      return [...existing, ...newIds];
    }
    return allIds;
  })();

  // Sync render order to parent when it changes
  const lastSyncedOrder = useRef<string>("");
  useEffect(() => {
    const key = effectiveRenderOrder.join(",");
    if (key !== lastSyncedOrder.current && onRenderOrderChange) {
      lastSyncedOrder.current = key;
      onRenderOrderChange(effectiveRenderOrder);
    }
  }, [effectiveRenderOrder.join(",")]);

  const getZIndex = (id: string) => {
    const idx = effectiveRenderOrder.indexOf(id);
    return 10 + (idx >= 0 ? idx : 0);
  };

  // Detecta se há foto de fundo cobrindo todo o canvas (para aplicar text-shadow legível)
  const hasPhotoBackground = overlayImages.some(
    img => img.type === "photo" && img.x <= 5 && img.y <= 5 && img.width >= canvasWidth - 10 && img.height >= canvasHeight - 10
  );

  const renderTextBox = (tb: TextBox) => {
    const isSelected = selectedTextId === tb.id;
    const isEditing = editingTextId === tb.id;
    const isTitle = tb.type === "title";
    const content = isTitle ? title : text;

    // Caixa de texto sem fundo sólido — a legibilidade vem do degradê global do canvas
    return (
      <div key={tb.id} data-overlay
        style={{
          position: "absolute", left: tb.x, top: tb.y, width: tb.width, minHeight: tb.height,
          cursor: isEditing ? "text" : "move", userSelect: isEditing ? "text" : "none",
          outline: isSelected ? "2px dashed rgba(255,255,255,0.7)" : "none", outlineOffset: 2,
          zIndex: getZIndex(tb.id), padding: "8px 16px", boxSizing: "border-box", overflow: "hidden",
          touchAction: isEditing ? "auto" : "none",
        }}
        onPointerDown={(e) => handleTextPointerDown(e, tb)}
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
            textAlign: isTitle ? (titleTextAlign || "center") : bodyTextAlign,
            lineHeight: isTitle ? 1.15 : 1.6,
            color: hasPhotoBackground ? "#ffffff" : (isTitle ? resolvedTitleColor : textColor),
            outline: "none", width: "100%", minHeight: "1em",
            opacity: isTitle ? 1 : 0.95,
            textShadow: hasPhotoBackground
              ? (isTitle ? "0 2px 12px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.45)" : "0 1px 4px rgba(0,0,0,0.45)")
              : undefined,
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

  const renderOverlayItem = (img: OverlayImage) => {
    const itemZ = getZIndex(img.id);
    if (img.type === "textbox") {
      const isSelected = selectedImageId === img.id;
      return (
        <div key={img.id} data-overlay
          style={{
            position: "absolute", left: img.x, top: img.y, width: img.width, minHeight: img.height,
            cursor: "move", userSelect: "none",
            outline: isSelected ? "2px dashed rgba(255,255,255,0.7)" : "none", outlineOffset: 2,
            zIndex: itemZ,
            backgroundColor: img.bgColor || "transparent",
            opacity: img.opacity ?? 1,
            borderRadius: 8, padding: "12px 16px", boxSizing: "border-box",
            touchAction: "none",
          }}
          onPointerDown={(e) => handlePointerDown(e, img)}
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
    }

    // photo / element / logo
    const isSelected = selectedImageId === img.id;
    return (
      <div key={img.id} data-overlay
        style={{
          position: "absolute", left: img.x, top: img.y,
          width: img.width, height: img.height,
          cursor: "move", userSelect: "none",
          outline: isSelected ? "2px dashed rgba(255,255,255,0.7)" : "none",
          outlineOffset: 2, zIndex: itemZ,
          touchAction: "none",
        }}
        onPointerDown={(e) => handlePointerDown(e, img)}
        onClick={(e) => { e.stopPropagation(); onSelectImage?.(img.id); setSelectedTextId(null); }}
      >
        <img src={img.src} alt={img.type}
          crossOrigin="anonymous"
          style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none", opacity: img.opacity ?? 1 }}
          draggable={false} />
        {isSelected && renderResizeHandles(img, false)}
      </div>
    );
  };

  const topZ = 10 + effectiveRenderOrder.length;

  const RULER_PX = 18;
  const rulerTickEvery = 100; // canvas px

  return (
    <div ref={containerRef} className="flex items-center justify-center w-full">
      <div
        style={{
          width: canvasWidth * scale + (showRulers ? RULER_PX : 0),
          height: canvasHeight * scale + (showRulers ? RULER_PX : 0),
          overflow: "hidden",
          position: "relative",
          paddingTop: showRulers ? RULER_PX : 0,
          paddingLeft: showRulers ? RULER_PX : 0,
          boxSizing: "content-box",
        }}
      >
        {/* Rulers */}
        {showRulers && (
          <>
            {/* Top horizontal ruler */}
            <div style={{
              position: "absolute", top: 0, left: RULER_PX,
              width: canvasWidth * scale, height: RULER_PX,
              background: "hsl(var(--muted))", borderBottom: "1px solid hsl(var(--border))",
              fontSize: 9, color: "hsl(var(--muted-foreground))",
              fontFamily: "monospace", overflow: "hidden",
            }}>
              {Array.from({ length: Math.ceil(canvasWidth / rulerTickEvery) + 1 }).map((_, i) => {
                const x = i * rulerTickEvery * scale;
                return (
                  <div key={i} style={{ position: "absolute", left: x, top: 0, height: RULER_PX, borderLeft: "1px solid hsl(var(--border))", paddingLeft: 2 }}>
                    {i * rulerTickEvery}
                  </div>
                );
              })}
            </div>
            {/* Left vertical ruler */}
            <div style={{
              position: "absolute", top: RULER_PX, left: 0,
              width: RULER_PX, height: canvasHeight * scale,
              background: "hsl(var(--muted))", borderRight: "1px solid hsl(var(--border))",
              fontSize: 9, color: "hsl(var(--muted-foreground))",
              fontFamily: "monospace", overflow: "hidden",
            }}>
              {Array.from({ length: Math.ceil(canvasHeight / rulerTickEvery) + 1 }).map((_, i) => {
                const y = i * rulerTickEvery * scale;
                return (
                  <div key={i} style={{ position: "absolute", top: y, left: 0, width: RULER_PX, borderTop: "1px solid hsl(var(--border))", paddingLeft: 2, lineHeight: "10px" }}>
                    {i * rulerTickEvery}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div
          style={{
            position: "relative",
            width: canvasWidth * scale,
            height: canvasHeight * scale,
            overflow: "hidden",
          }}
        >
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
          {/* Degradê de legibilidade quando há foto de fundo (cobre ~55% inferiores) */}
          {hasPhotoBackground && (() => {
            const bgIndexInOrder = effectiveRenderOrder.findIndex(id => {
              const img = overlayImages.find(o => o.id === id);
              return !!img && img.type === "photo" && img.x <= 5 && img.y <= 5
                && img.width >= canvasWidth - 10 && img.height >= canvasHeight - 10;
            });
            const overlayZ = 10 + (bgIndexInOrder >= 0 ? bgIndexInOrder + 1 : 1);
            return (
              <div
                aria-hidden
                style={{
                  position: "absolute", left: 0, right: 0, bottom: 0,
                  height: "55%",
                  pointerEvents: "none",
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.65) 40%, rgba(0,0,0,0) 100%)",
                  zIndex: overlayZ,
                }}
              />
            );
          })()}
          {showSlideNumber && slideNumber !== undefined && totalSlides !== undefined && (() => {
            const snPos = slideNumberPosition || { x: canvasWidth - 60, y: 50 };
            const snBg = slideNumberBgColor || accentColor;
            const snText = slideNumberTextColor || bgColor;
            const snSize = slideNumberSize || 14;
            const badgeW = snSize * 4;
            const badgeH = snSize * 4;
            return (
              <div data-overlay
                style={{
                  position: "absolute", left: snPos.x - badgeW / 2, top: snPos.y - badgeH / 2,
                  width: badgeW, height: badgeH, borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: snBg, color: snText,
                  fontFamily: `'${displayFont}', sans-serif`,
                  fontSize: snSize, fontWeight: "bold",
                  cursor: "move", userSelect: "none", zIndex: topZ + 2,
                  touchAction: "none",
                }}
                onPointerDown={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch {}
                  onSelectImage?.(null);
                  setSelectedTextId("slideNumber");
                  const startX = e.clientX, startY = e.clientY;
                  const origX = snPos.x, origY = snPos.y;
                  const handleMove = (ev: PointerEvent) => {
                    if (ev.cancelable) ev.preventDefault();
                    const dx = (ev.clientX - startX) / scale;
                    const dy = (ev.clientY - startY) / scale;
                    onSlideNumberMove?.(origX + dx, origY + dy);
                  };
                  const handleUp = () => {
                    window.removeEventListener("pointermove", handleMove);
                    window.removeEventListener("pointerup", handleUp);
                    window.removeEventListener("pointercancel", handleUp);
                  };
                  window.addEventListener("pointermove", handleMove, { passive: false });
                  window.addEventListener("pointerup", handleUp);
                  window.addEventListener("pointercancel", handleUp);
                }}
                onClick={(e) => { e.stopPropagation(); setSelectedTextId("slideNumber"); onSelectImage?.(null); }}
              >
                {slideNumber}/{totalSlides}
              </div>
            );
          })()}

          {isLastSlide && !isCoverSlide && resolvedCtaText && (
            <div data-overlay
              style={{
                position: "absolute", left: ctaPos.x, top: ctaPos.y,
                transform: "translate(-50%, -50%)",
                cursor: "move", userSelect: "none", zIndex: topZ + 1,
                touchAction: "none",
              }}
              onPointerDown={handleCtaPointerDown}
              onClick={(e) => { e.stopPropagation(); setSelectedTextId("cta"); onSelectImage?.(null); }}
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
                cursor: "move", userSelect: "none", zIndex: topZ + 1,
                touchAction: "none",
              }}
              onPointerDown={handleCtaPointerDown}
              onClick={(e) => { e.stopPropagation(); setSelectedTextId("cta"); onSelectImage?.(null); }}
            >
              <div className="font-semibold whitespace-nowrap"
                style={{ color: resolvedCtaBg, fontSize: Math.max(18, resolvedCtaFontSize - 6), opacity: 0.8 }}>
                {resolvedCtaText}
              </div>
            </div>
          )}

          {/* Render all items in unified order */}
          {effectiveRenderOrder.map(id => {
            const tb = textBoxes.find(t => t.id === id);
            if (tb) return renderTextBox(tb);
            const img = overlayImages.find(i => i.id === id);
            if (img) return renderOverlayItem(img);
            return null;
          })}
        </div>


        {/* Coordinates badge for selected element */}
        {showCoordinates && selectedBounds && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              left: Math.min(selectedBounds.x * scale, canvasWidth * scale - 130),
              top: Math.max(0, (selectedBounds.y - 28 / scale) * scale),
              padding: "2px 6px",
              background: "hsl(var(--primary))",
              color: "hsl(var(--primary-foreground))",
              fontSize: 10, fontFamily: "monospace",
              borderRadius: 4, pointerEvents: "none", zIndex: 100000,
              whiteSpace: "nowrap",
            }}
          >
            {Math.round(selectedBounds.x)}, {Math.round(selectedBounds.y)} · {Math.round(selectedBounds.w)}×{Math.round(selectedBounds.h)}
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default PostCanvas;
