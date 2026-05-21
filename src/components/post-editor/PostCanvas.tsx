import React, { useRef, useEffect, useState } from "react";
import type { OverlayImage } from "./PostToolbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { getArchetypeTypography, clampBodyWeight } from "@/lib/archetypeTypography";
import { sanitizeRichText } from "@/lib/richText";
import { inlineFormatBus } from "@/lib/inlineFormatBus";
import InlineFormatToolbar from "./InlineFormatToolbar";

// Retorna a luminância percebida da cor (fórmula YIQ): valor >=128 = clara.
// Usado para decidir se halo e text-shadow devem ser escuros (para texto claro)
// ou claros (para texto escuro), garantindo legibilidade sobre fotos de fundo.
function isLightColor(color: string | undefined | null): boolean {
  if (!color) return true; // assume claro por default → halo escuro (comportamento histórico)
  let r = 255, g = 255, b = 255;
  const trimmed = color.trim();
  if (trimmed.startsWith("#")) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  } else {
    const m = trimmed.match(/(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/);
    if (m) {
      r = parseFloat(m[1]);
      g = parseFloat(m[2]);
      b = parseFloat(m[3]);
    }
  }
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
}


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
  /** @deprecated Coordenadas foram removidas do canvas. Mantido para compat. */
  showCoordinates?: boolean;
  /** Estilo escolhido na criação do post (minimal força centralização horizontal). */
  postStyle?: "minimal" | "pexels" | "ai" | string;
  /** Posições iniciais de título/corpo definidas pelo template (sobrescrevem os cálculos genéricos). */
  initialTextBoxes?: {
    title?: { x: number; y: number; width: number; height: number };
    body?: { x: number; y: number; width: number; height: number };
  };
  /** Chave que dispara reset de posições do canvas (style/format/slide). */
  resetKey?: string;
  /** Posições controladas das caixas de título/corpo (para persistência por slide). */
  textBoxes?: TextBox[];
  onTextBoxesChange?: (boxes: TextBox[]) => void;
  /** Arquétipo primário do usuário — define hierarquia tipográfica do título/corpo. */
  primaryArchetype?: string | null;
  // Legacy compat
  onImageMove?: (id: string, x: number, y: number) => void;
  onImageResize?: (id: string, width: number, height: number) => void;
}

const RESIZE_HANDLE_SIZE = 16;

type Corner = "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r";

const CURSORS: Record<Corner, string> = {
  tl: "nwse-resize", tr: "nesw-resize", bl: "nesw-resize", br: "nwse-resize",
  t: "ns-resize", b: "ns-resize", l: "ew-resize", r: "ew-resize",
};

/**
 * Estima o fontSize ideal do título para caber na altura disponível.
 * Usa aproximação de largura média de caractere (~0.45 * fontSize) para evitar
 * medição DOM (que daria flicker). Reduz em passos de 2px até caber ou bater no piso.
 */
function fitTitleFontSize(
  rawText: string,
  boxWidth: number,
  maxHeight: number,
  baseFontSize: number,
  minFontSize: number,
  lineHeight: number,
): number {
  if (!rawText || boxWidth <= 0 || maxHeight <= 0) return baseFontSize;
  const stripped = rawText.replace(/<[^>]*>/g, "").trim();
  if (!stripped) return baseFontSize;
  const charCount = stripped.length;
  let size = baseFontSize;
  while (size > minFontSize) {
    const avgCharWidth = size * 0.45;
    const charsPerLine = Math.max(1, Math.floor(boxWidth / avgCharWidth));
    const lines = Math.ceil(charCount / charsPerLine);
    const heightNeeded = lines * size * lineHeight;
    if (heightNeeded <= maxHeight) return size;
    size -= 2;
  }
  return minFontSize;
}

export interface TextBox {
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
  canvasWidth = 1080, canvasHeight = 1350,
  showSlideNumber = true, slideNumberPosition, onSlideNumberMove,
  slideNumberBgColor, slideNumberTextColor, slideNumberSize,
  onSelectedTextChange, renderOrder: externalRenderOrder, onRenderOrderChange,
  showRulers = false, postStyle,
  initialTextBoxes, resetKey,
  textBoxes: controlledTextBoxes, onTextBoxesChange,
  primaryArchetype,
}) => {
  const typo = getArchetypeTypography(primaryArchetype);
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
  const [editingEl, setEditingEl] = useState<HTMLElement | null>(null);
  const canvasInnerRef = useRef<HTMLDivElement>(null);
  const [activeGuides, setActiveGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] });

  // Mede a altura real renderizada do título para reposicionar o corpo dinamicamente.
  const [measuredTitleHeight, setMeasuredTitleHeight] = useState<number | null>(null);
  const titleMeasureRef = useRef<HTMLDivElement | null>(null);

  const [localTextBoxes, setLocalTextBoxes] = useState<TextBox[]>([]);
  const isControlled = Array.isArray(controlledTextBoxes);
  const textBoxes = isControlled ? (controlledTextBoxes as TextBox[]) : localTextBoxes;
  const setTextBoxes = (updater: TextBox[] | ((prev: TextBox[]) => TextBox[])) => {
    const next = typeof updater === "function" ? (updater as (p: TextBox[]) => TextBox[])(textBoxes) : updater;
    if (isControlled) {
      onTextBoxesChange?.(next);
    } else {
      setLocalTextBoxes(next);
      onTextBoxesChange?.(next);
    }
  };
  const textBoxesInitialized = useRef(isControlled && (controlledTextBoxes as TextBox[]).length > 0);
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
    if (isControlled) {
      // Pai controla: marca como inicializado se já tem valores; senão deixa o effect default popular.
      textBoxesInitialized.current = (controlledTextBoxes as TextBox[]).length > 0;
      return;
    }
    textBoxesInitialized.current = false;
  }, [isCoverSlide, isLastSlide, isControlled, controlledTextBoxes]);

  // Reset quando muda formato/estilo: força recálculo a partir dos novos slots do template
  const lastResetKey = useRef<string | undefined>(resetKey);
  useEffect(() => {
    if (resetKey === undefined) return;
    if (lastResetKey.current === resetKey) return;
    lastResetKey.current = resetKey;
    // Quando o pai controla e já há boxes salvos, NÃO sobrescrever (preserva edições).
    if (isControlled && (controlledTextBoxes as TextBox[]).length > 0) return;
    const boxes = computeTextBoxPositions(layout, !!title, !!isCoverSlide);
    if (boxes.length > 0) {
      setTextBoxes(boxes);
      textBoxesInitialized.current = true;
    }
  }, [resetKey, layout, title, isCoverSlide, isControlled, controlledTextBoxes]);

  // Quando initialTextBoxes muda (novo layout do template), aplica imediatamente
  const lastInitialKey = useRef<string>("");
  useEffect(() => {
    const key = JSON.stringify(initialTextBoxes || {});
    if (key === lastInitialKey.current) return;
    if (key === "{}") return; // sem slots ainda
    lastInitialKey.current = key;
    if (isControlled && (controlledTextBoxes as TextBox[]).length > 0) return;
    const boxes = computeTextBoxPositions(layout, !!title, !!isCoverSlide);
    if (boxes.length > 0) {
      setTextBoxes(boxes);
      textBoxesInitialized.current = true;
    }
  }, [initialTextBoxes, layout, title, isCoverSlide, isControlled, controlledTextBoxes]);

  // Reposiciona o corpo dinamicamente abaixo da altura REAL renderizada do título.
  // Garante gap consistente de 60px independente do tamanho do título.
  useEffect(() => {
    if (!measuredTitleHeight) return;
    const dynamicGap = 60;
    setTextBoxes((prev) => {
      const titleBox = prev.find(t => t.type === "title");
      const bodyBox = prev.find(t => t.type === "body");
      if (!titleBox || !bodyBox) return prev;
      const desiredBodyY = titleBox.y + measuredTitleHeight + dynamicGap;
      // Só reposiciona se a diferença for significativa (>10px) — evita loops.
      if (Math.abs(bodyBox.y - desiredBodyY) < 10) return prev;
      // Não empurra o corpo para fora do canvas
      const maxBodyY = canvasHeight - 200;
      const clampedY = Math.min(desiredBodyY, maxBodyY);
      return prev.map(b => b.type === "body" ? { ...b, y: clampedY } : b);
    });
  }, [measuredTitleHeight, canvasHeight]);

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

      // Determine bounding box of the dragged element (in canvas coords)
      let bbox: { x: number; y: number; w: number; h: number } | null = null;
      if (dragging.isCta) {
        const w = 240, h = 80;
        bbox = { x: proposedX - w / 2, y: proposedY - h / 2, w, h };
      } else if (dragging.isText) {
        const tb = textBoxes.find(t => t.id === dragging.id);
        if (tb) bbox = { x: proposedX, y: proposedY, w: tb.width, h: tb.height };
      } else {
        const img = overlayImages.find(i => i.id === dragging.id);
        if (img) bbox = { x: proposedX, y: proposedY, w: img.width, h: img.height };
      }

      // Build snap targets: canvas + other elements
      const targets: Array<{ x: number; y: number; w: number; h: number }> = [
        { x: 0, y: 0, w: canvasWidth, h: canvasHeight },
      ];
      if (bbox) {
        for (const img of overlayImages) {
          if (img.id === dragging.id) continue;
          targets.push({ x: img.x, y: img.y, w: img.width, h: img.height });
        }
        for (const tb of textBoxes) {
          if (tb.id === dragging.id) continue;
          targets.push({ x: tb.x, y: tb.y, w: tb.width, h: tb.height });
        }
      }

      const TOL = 6 / scale; // tolerance in canvas units (≈6 screen px)
      let finalX = proposedX;
      let finalY = proposedY;
      const guidesV: number[] = [];
      const guidesH: number[] = [];

      if (bbox) {
        const elLinesX = [bbox.x, bbox.x + bbox.w / 2, bbox.x + bbox.w];
        const elLinesY = [bbox.y, bbox.y + bbox.h / 2, bbox.y + bbox.h];
        let bestDX = TOL + 1, snapDX = 0, snapLineX: number | null = null;
        let bestDY = TOL + 1, snapDY = 0, snapLineY: number | null = null;

        for (const t of targets) {
          const tLinesX = [t.x, t.x + t.w / 2, t.x + t.w];
          const tLinesY = [t.y, t.y + t.h / 2, t.y + t.h];
          for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
              const dxd = tLinesX[j] - elLinesX[i];
              if (Math.abs(dxd) < bestDX) { bestDX = Math.abs(dxd); snapDX = dxd; snapLineX = tLinesX[j]; }
              const dyd = tLinesY[j] - elLinesY[i];
              if (Math.abs(dyd) < bestDY) { bestDY = Math.abs(dyd); snapDY = dyd; snapLineY = tLinesY[j]; }
            }
          }
        }

        if (snapLineX !== null && bestDX <= TOL) {
          finalX = proposedX + snapDX;
          // Collect every target line that ends up aligned after snap
          const newElLinesX = [finalX + (bbox.x - proposedX), finalX + (bbox.x - proposedX) + bbox.w / 2, finalX + (bbox.x - proposedX) + bbox.w];
          for (const t of targets) {
            for (const tl of [t.x, t.x + t.w / 2, t.x + t.w]) {
              if (newElLinesX.some(el => Math.abs(el - tl) < 0.5)) guidesV.push(tl);
            }
          }
        }
        if (snapLineY !== null && bestDY <= TOL) {
          finalY = proposedY + snapDY;
          const newElLinesY = [finalY + (bbox.y - proposedY), finalY + (bbox.y - proposedY) + bbox.h / 2, finalY + (bbox.y - proposedY) + bbox.h];
          for (const t of targets) {
            for (const tl of [t.y, t.y + t.h / 2, t.y + t.h]) {
              if (newElLinesY.some(el => Math.abs(el - tl) < 0.5)) guidesH.push(tl);
            }
          }
        }
      }

      setActiveGuides({ v: Array.from(new Set(guidesV)), h: Array.from(new Set(guidesH)) });

      if (dragging.isCta) {
        onCtaMove?.(finalX, finalY);
      } else if (dragging.isText) {
        setTextBoxes(prev => prev.map(t => t.id === dragging.id ? { ...t, x: finalX, y: finalY } : t));
      } else {
        updateOverlay(dragging.id, { x: finalX, y: finalY });
      }
    };
    const handlePointerUp = () => {
      setDragging(null);
      setActiveGuides({ v: [], h: [] });
    };
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

  const isMinimalStyle = postStyle === "minimal";
  // Piso elevado para garantir presença visual do corpo do texto
  // (carrossel/quadrado: 44px). Ainda respeita aumentos manuais via inspector.
  const bodyFontSize = Math.max(44, fontSize || 44);
  // Body weight nunca pode ser bold — clamp para o peso máximo do arquétipo (300 ou 400).
  const bodyFontWeight = clampBodyWeight(fontWeight || "normal", typo.bodyWeight);
  const bodyFontStyle2 = fontStyle || "normal";
  // Em estilos minimalistas, força centralização horizontal sempre.
  const bodyTextAlign: "left" | "center" | "right" | "justify" = isMinimalStyle ? "center" : (textAlign || "center");
  const effectiveTitleAlign: "left" | "center" | "right" | "justify" = isMinimalStyle ? "center" : (titleTextAlign || "center");

  // Tamanho de título: respeita override do usuário; senão usa o do arquétipo (cover ganha boost).
  const archetypeTitleSize = isCoverSlide ? typo.titleSizeMax + 12 : typo.titleSizeMax;
  // Piso do título: nunca menor que o piso do arquétipo, e nunca menor que body + 18px
  // (garante hierarquia visual mesmo quando texto é longo).
  const archetypeTitleFloor = Math.max(42, typo.titleSizeMin, (fontSize || 44) + 18);
  // Ignora titleFontSize do usuário/template quando for menor que o mínimo do arquétipo.
  const userTitleSize = titleFontSize && titleFontSize >= typo.titleSizeMin ? titleFontSize : archetypeTitleSize;
  const resolvedTitleFontSize = Math.max(archetypeTitleFloor, userTitleSize);

  // Auto-fit do título: reduz fontSize quando o texto não cabe na altura entre
  // o slot do título e o slot do corpo (evita sobreposição visual).
  const titleBoxForFit = textBoxes.find(t => t.type === "title");
  const bodyBoxForFit = textBoxes.find(t => t.type === "body");
  const titleSafetyGap = 40; // px entre fim do título e início do corpo
  const availableTitleHeight = (titleBoxForFit && bodyBoxForFit)
    ? Math.max(80, bodyBoxForFit.y - titleBoxForFit.y - titleSafetyGap)
    : (titleBoxForFit?.height || 200);
  const titleBoxWidth = titleBoxForFit?.width || 880;
  const fittedTitleFontSize = fitTitleFontSize(
    title || "",
    titleBoxWidth,
    availableTitleHeight,
    resolvedTitleFontSize,
    archetypeTitleFloor,
    typo.titleLineHeight,
  );

  const resolvedTitleColor = titleColor || textColor;
  const resolvedTitleFont = titleFontFamily || displayFont;

  // Garante que a fonte do título seja carregada do Google Fonts e loga
  // confirmação para diagnóstico (a fonte aplicada == a do template).
  useEffect(() => {
    if (!resolvedTitleFont) return;
    const id = `gfont-${resolvedTitleFont.replace(/\s+/g, "-")}`;
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(resolvedTitleFont)}:wght@300;400;500;600;700;800;900&display=swap`;
      document.head.appendChild(link);
    }
    if ((document as any).fonts?.load) {
      (document as any).fonts.load(`600 48px '${resolvedTitleFont}'`).then(() => {
        const ok = (document as any).fonts.check(`600 48px '${resolvedTitleFont}'`);
        console.log("[title-font] resolvedTitleFont =", resolvedTitleFont, "loaded:", ok, "(titleFontFamily=", titleFontFamily, ", displayFont=", displayFont, ")");
      }).catch((err: any) => {
        console.warn("[title-font] failed to load", resolvedTitleFont, err);
      });
    }
  }, [resolvedTitleFont, titleFontFamily, displayFont]);

  // CTA longo é cortado na exibição do card (mantém apenas a 1ª frase/comando).
  // O texto completo continua disponível para a legenda do Instagram.
  const rawCtaText = ctaText || cta || "";
  const resolvedCtaText = (() => {
    if (!rawCtaText) return "";
    // Corta no 1º separador natural (": ", " — ", ". ") ou em 80 chars como fallback.
    const breakIdx = (() => {
      const candidates = [": ", " — ", ". ", "? "]
        .map(sep => rawCtaText.indexOf(sep))
        .filter(i => i > 20); // ignora separadores muito próximos do início
      return candidates.length > 0 ? Math.min(...candidates) : -1;
    })();
    if (breakIdx > 0 && breakIdx < 90) return rawCtaText.slice(0, breakIdx).trim();
    if (rawCtaText.length > 90) return rawCtaText.slice(0, 87).trim() + "…";
    return rawCtaText;
  })();
  const resolvedCtaBg = ctaBgColor || accentColor;
  const resolvedCtaText2 = ctaTextColor || bgColor;
  // Auto-shrink do CTA quando texto é longo (evita bloco gigante sobrepondo texto).
  const baseCtaFontSize = ctaFontSize || 27;
  const ctaTextLength = (resolvedCtaText || "").trim().length;
  const ctaShrinkRatio =
    ctaTextLength > 180 ? 0.55 :
    ctaTextLength > 120 ? 0.70 :
    ctaTextLength > 80 ? 0.85 : 1;
  const resolvedCtaFontSize = Math.max(14, Math.round(baseCtaFontSize * ctaShrinkRatio));

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
  // Ordem visual: foto de fundo → moldura → textos → barra/losango (sempre visíveis) → demais overlays
  const allIds = [...textBoxes.map(tb => tb.id), ...overlayImages.map(img => img.id)];
  const isFullPhoto = (id: string) => {
    const img = overlayImages.find(o => o.id === id);
    if (!img) return false;
    // Qualquer foto marcada como background do template é camada de fundo,
    // independentemente de suas dimensões atuais (evita que fique acima do título).
    if (id.startsWith("tpl-bg-")) return true;
    return img.type === "photo" && img.x <= 5 && img.y <= 5 && img.width >= canvasWidth - 10 && img.height >= canvasHeight - 10;
  };
  const isFrame = (id: string) => /^tpl-(mframe|frame)/.test(id);
  const isAccentDecoration = (id: string) => /^tpl-(mline|mornament|line|ornament)/.test(id);
  const isTextBoxId = (id: string) => textBoxes.some(t => t.id === id);
  const sortByVisualLayer = (ids: string[]) => {
    // 0 = fundo (foto full), 1 = moldura, 2 = demais overlays, 3 = barra/losango, 4 = textos (sempre topo p/ clique)
    const rank = (id: string) => {
      if (isFullPhoto(id)) return 0;
      if (isFrame(id)) return 1;
      if (isTextBoxId(id)) return 4;
      if (isAccentDecoration(id)) return 3;
      return 2;
    };
    return [...ids].sort((a, b) => {
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      // preserve original order within the same rank
      return ids.indexOf(a) - ids.indexOf(b);
    });
  };
  const effectiveRenderOrder = (() => {
    let merged: string[];
    if (externalRenderOrder && externalRenderOrder.length > 0) {
      // Preserva a ordem do parent para Frente/Trás funcionar nos ids existentes,
      // e rank-sort apenas os ids novos antes de anexar ao final.
      const existing = externalRenderOrder.filter(id => allIds.includes(id));
      const newIds = allIds.filter(id => !existing.includes(id));
      merged = [...existing, ...sortByVisualLayer(newIds)];
    } else {
      // Primeira montagem (sem ordem do parent): aplica o rank inicial.
      merged = sortByVisualLayer(allIds);
    }
    // Invariantes de segurança:
    // - fotos de fundo (tpl-bg-*) SEMPRE no fundo da pilha
    // - caixas de texto (título/corpo) SEMPRE no topo, para não ficarem
    //   escondidas atrás de decorativos/elementos e facilitar a seleção.
    const bgs = merged.filter(id => id.startsWith("tpl-bg-"));
    const texts = merged.filter(id => isTextBoxId(id));
    const rest = merged.filter(id => !id.startsWith("tpl-bg-") && !isTextBoxId(id));
    return [...bgs, ...rest, ...texts];
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
    img => img.type === "photo" && (
      img.id.startsWith("tpl-bg-") ||
      (img.x <= 5 && img.y <= 5 && img.width >= canvasWidth - 10 && img.height >= canvasHeight - 10)
    )
  );

  const renderTextBox = (tb: TextBox) => {
    const isSelected = selectedTextId === tb.id;
    const isEditing = editingTextId === tb.id;
    const isTitle = tb.type === "title";
    const content = isTitle ? title : text;

    // Decide a cor do halo/shadow com base na luminância do texto:
    // texto claro → halo escuro (preto); texto escuro → halo claro (branco).
    // Sem isso, texto escuro sobre foto escura ficava ilegível.
    const effectiveTextColor = isTitle ? (titleColor ?? resolvedTitleColor) : textColor;
    const textIsLight = isLightColor(effectiveTextColor);
    const haloRgb = textIsLight ? "0,0,0" : "255,255,255";

    // Halo localizado atrás do texto quando há foto de fundo (referência: blur amplo, suave)
    // Renderizado como pseudo-camada via box-shadow inset/blur SVG-like usando radial-gradient.
    const haloStyle: React.CSSProperties | undefined = hasPhotoBackground
      ? {
          position: "absolute",
          // Expande o halo bem além da caixa para suavizar bordas
          left: -tb.width * 0.15,
          top: -tb.height * 0.35,
          width: tb.width * 1.3,
          height: tb.height * 1.7,
          background:
            `radial-gradient(ellipse at center, rgba(${haloRgb},0.78) 0%, rgba(${haloRgb},0.6) 35%, rgba(${haloRgb},0.25) 70%, rgba(${haloRgb},0) 100%)`,
          filter: "blur(28px)",
          pointerEvents: "none",
          zIndex: 0,
          borderRadius: "50%",
        }
      : undefined;

    // Text-shadow mais amplo e suave (em camadas) para reforçar legibilidade do próprio texto.
    // Usa a mesma cor do halo (oposta à luminância do texto).
    const titleShadow =
      `0 2px 6px rgba(${haloRgb},0.65), 0 6px 24px rgba(${haloRgb},0.55), 0 0 60px rgba(${haloRgb},0.45)`;
    const bodyShadow =
      `0 1px 4px rgba(${haloRgb},0.6), 0 4px 18px rgba(${haloRgb},0.5), 0 0 48px rgba(${haloRgb},0.4)`;

    return (
      <div key={tb.id} data-overlay
        style={{
          position: "absolute", left: tb.x, top: tb.y, width: tb.width, minHeight: tb.height,
          cursor: isEditing ? "text" : "move", userSelect: isEditing ? "text" : "none",
          outline: isSelected ? "2px dashed rgba(255,255,255,0.7)" : "none", outlineOffset: 2,
          zIndex: getZIndex(tb.id), padding: "8px 16px", boxSizing: "border-box",
          touchAction: isEditing ? "auto" : "none",
        }}
        onPointerDown={(e) => handleTextPointerDown(e, tb)}
        onClick={(e) => { e.stopPropagation(); setSelectedTextId(tb.id); onSelectImage?.(null); }}
        onDoubleClick={(e) => { e.stopPropagation(); setEditingTextId(tb.id); }}
      >
        {haloStyle && <div aria-hidden style={haloStyle} />}
        <div
          contentEditable={isEditing}
          suppressContentEditableWarning
          className={isTitle ? "post-title-editable" : "post-body-editable"}
          ref={(el) => {
            if (isTitle && el) {
              titleMeasureRef.current = el;
              // Mede a altura real após o render
              requestAnimationFrame(() => {
                if (titleMeasureRef.current) {
                  const h = titleMeasureRef.current.scrollHeight;
                  setMeasuredTitleHeight((prev) => (prev !== h ? h : prev));
                }
              });
            }
            if (isEditing && el && editingEl !== el) {
              setEditingEl(el);
              inlineFormatBus.setActive(el, (html) => {
                const clean = sanitizeRichText(html);
                if (isTitle) onTitleChange?.(clean);
                else onTextChange?.(clean);
              });
            }
          }}
          onKeyDown={(e) => {
            if (!isEditing) return;
            const mod = e.metaKey || e.ctrlKey;
            if (!mod) return;
            const k = e.key.toLowerCase();
            if (k === "b" || k === "i" || k === "u") {
              e.preventDefault();
              try {
                document.execCommand(
                  k === "b" ? "bold" : k === "i" ? "italic" : "underline",
                  false,
                );
              } catch {}
            }
          }}
          onBlur={(e) => {
            // Se o foco foi para a toolbar flutuante OU para o painel lateral
            // (botões B/I/U), NÃO sai do modo de edição.
            const next = e.relatedTarget as HTMLElement | null;
            if (next && next.closest && (
              next.closest("[data-inline-format-toolbar]") ||
              next.closest("[data-inline-format-control]")
            )) {
              return;
            }
            const el = e.currentTarget;
            const html = sanitizeRichText(el.innerHTML || "");
            if (isTitle) onTitleChange?.(html);
            else onTextChange?.(html);
            inlineFormatBus.clearActive(el);
            setEditingTextId(null);
            setEditingEl(null);
          }}
          style={{
            fontFamily: isTitle ? `'${resolvedTitleFont}', sans-serif` : `'${bodyFont}', sans-serif`,
            fontSize: isTitle ? fittedTitleFontSize : bodyFontSize,
            fontWeight: isTitle ? typo.titleWeight : bodyFontWeight,
            fontStyle: isTitle ? "normal" : bodyFontStyle2,
            textAlign: isTitle ? effectiveTitleAlign : bodyTextAlign,
            lineHeight: isTitle ? typo.titleLineHeight : 1.55,
            letterSpacing: isTitle ? typo.titleLetterSpacing : undefined,
            color: isTitle ? (titleColor ?? resolvedTitleColor) : textColor,
            outline: "none", width: "100%", minHeight: "1em",
            opacity: 1,
            position: "relative",
            zIndex: 1,
            textShadow: hasPhotoBackground ? (isTitle ? titleShadow : bodyShadow) : undefined,
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(content || "") }}
        />

        {isSelected && renderResizeHandles(tb, true)}
      </div>
    );
  };

  const showCta = resolvedCtaText && (isLastSlide || isCoverSlide || (layout === "split" && cta));
  // CTA dinâmico: sempre abaixo do bloco de texto (body), com folga de 60px,
  // e SEMPRE acima do canto inferior direito (onde fica a logo) — pelo menos 200px de margem inferior.
  const bodyBox = textBoxes.find(t => t.type === "body");
  const titleBox = textBoxes.find(t => t.type === "title");
  const referenceBox = bodyBox || titleBox;
  // Posição preferencial do CTA: abaixo do corpo + 60px.
  // Antes havia cap em (canvasHeight - 200) que forçava CTA para CIMA do corpo
  // quando o corpo descia, causando sobreposição.
  // Agora: deixamos o CTA descer junto, garantindo que NUNCA sobreponha o texto.
  const preferredCtaY = referenceBox
    ? referenceBox.y + referenceBox.height + 60
    : (isCoverSlide ? Math.round(canvasHeight * 0.5) : isLastSlide ? Math.round(canvasHeight * 0.72) : Math.round(canvasHeight * 0.88));
  // Cap absoluto: não passar do limite inferior do canvas (deixa 100px para logo).
  const ctaMaxY = canvasHeight - 100;
  const computedCtaY = Math.min(ctaMaxY, preferredCtaY);
  const computedCtaX = referenceBox ? referenceBox.x + referenceBox.width / 2 : canvasWidth / 2;
  const defaultCtaPos = { x: computedCtaX, y: computedCtaY };
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
    // Full-canvas background photo → cover (preenche sem barras). Demais fotos = contain.
    const isFullCanvasPhoto =
      img.type === "photo" && (
        img.id.startsWith("tpl-bg-") ||
        (img.x <= 5 && img.y <= 5 &&
          img.width >= canvasWidth - 10 && img.height >= canvasHeight - 10)
      );
    // Decorativos do template (moldura, linha, losango, bloco) são SVGs que devem
    // preencher exatamente a caixa redimensionada — sem manter proporção quadrada
    // do SVG original. Usa "fill" para esticar não-uniformemente.
    const isTemplateDecoration = /^tpl-(mframe|frame|mline|line|mornament|ornament|block)/.test(img.id);
    const objectFit: React.CSSProperties["objectFit"] = isFullCanvasPhoto
      ? "cover"
      : isTemplateDecoration
        ? "fill"
        : "contain";
    // Para o background do template, força cobrir todo o canvas atual em
    // tamanho (ignora dimensões legadas), MAS respeita a posição manual do
    // usuário (x/y) — assim a foto de fundo é arrastável para reenquadrar.
    const isTplBg = img.id.startsWith("tpl-bg-");
    const boxLeft = isTplBg ? (typeof img.x === "number" ? img.x : 0) : img.x;
    const boxTop = isTplBg ? (typeof img.y === "number" ? img.y : 0) : img.y;
    const boxWidth = isTplBg ? canvasWidth : img.width;
    const boxHeight = isTplBg ? canvasHeight : img.height;
    return (
      <div key={img.id} data-overlay
        style={{
          position: "absolute", left: boxLeft, top: boxTop,
          width: boxWidth, height: boxHeight,
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
          style={{
            width: "100%", height: "100%", objectFit, pointerEvents: "none",
            opacity: img.opacity ?? 1,
            objectPosition: img.objectPosition || undefined,
          }}
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
      <style>{`
        .post-title-editable strong, .post-title-editable b { font-weight: 900 !important; }
        .post-title-editable em, .post-title-editable i { font-style: italic !important; }
        .post-title-editable u { text-decoration: underline !important; }
        .post-body-editable strong, .post-body-editable b { font-weight: 800 !important; }
        .post-body-editable em, .post-body-editable i { font-style: italic !important; }
        .post-body-editable u { text-decoration: underline !important; }
      `}</style>
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
          ref={canvasInnerRef}
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
                  height: "40%",
                  pointerEvents: "none",
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 60%, rgba(0,0,0,0) 100%)",
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
              <div className="px-12 py-5 rounded-2xl font-bold"
                style={{ backgroundColor: resolvedCtaBg, color: resolvedCtaText2, fontFamily: `'${displayFont}', sans-serif`, fontSize: resolvedCtaFontSize, whiteSpace: "pre-line", textAlign: "center", lineHeight: 1.15 }}>
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
              <div className="font-semibold"
                style={{ color: resolvedCtaBg, fontSize: Math.max(18, resolvedCtaFontSize - 6), opacity: 0.8, whiteSpace: "pre-line", lineHeight: 1.2 }}>
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

          {/* Dynamic alignment guides — visible only while dragging */}
          {(activeGuides.v.length > 0 || activeGuides.h.length > 0) && (
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 99999 }}>
              {activeGuides.v.map((x, i) => (
                <div key={`gv${i}`} style={{
                  position: "absolute", top: 0, bottom: 0, left: x,
                  width: 2 / scale, background: "#FF00FF",
                }} />
              ))}
              {activeGuides.h.map((y, i) => (
                <div key={`gh${i}`} style={{
                  position: "absolute", left: 0, right: 0, top: y,
                  height: 2 / scale, background: "#FF00FF",
                }} />
              ))}
            </div>
          )}
        </div>

        <InlineFormatToolbar containerEl={canvasInnerRef.current} />
        </div>
      </div>
    </div>
  );
};

export default PostCanvas;
