// Mini-componentes compartilhados do template Governante.
// Portados de design-sources/governante/cards-data.jsx (sem globals window.*).

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// IDs reconhecidos pelo dispatcher do PostCanvas. Use sempre o helper
// `isKnownTemplate()` em vez de strings hardcoded ao testar se o editor
// está em modo template.
export const TEMPLATE_IDS = {
  SERTAO: "governante.sertao-profundo",
  CARTORIO: "governante.cartorio-de-bolso",
  MANUSCRITO: "governante.manuscrito",
  // Variações com foto. Mesma estrutura editorial (cover/clause/close) mas
  // com slot de imagem ocupando ~40% do card. URL vem de slideBackgrounds
  // (já populado pelo fluxo Pexels + carrossel) ou da galeria do usuário
  // via o toolbar "trocar fundo" existente.
  HORIZONTE: "governante.horizonte",
  RETRATO: "governante.retrato",
} as const;

/**
 * Luminância YIQ percebida (0..255) de uma cor hex. Usada para decidir
 * cor de body dinamicamente — se o fundo é escuro o body precisa ser
 * claro, e vice-versa.
 */
export function colorLuma(hex?: string | null): number {
  if (!hex) return 128;
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return 128;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/**
 * Escolhe a cor de body com contraste adequado ao fundo. Se o bg é
 * claro (luma > 140), usa `darkInk` (default grafite). Se é escuro,
 * usa `lightInk` (default areia).
 */
export function pickBodyColor(
  bgHex: string | undefined,
  darkInk: string = "#2C2C2C",
  lightInk: string = "#F5F0E8",
): string {
  return colorLuma(bgHex) > 140 ? darkInk : lightInk;
}

export const ALL_TEMPLATE_IDS: string[] = Object.values(TEMPLATE_IDS);

// Subset dos templates que aceitam slot de foto. Outros lugares (toolbar,
// dispatcher) usam isso pra decidir se a UI de troca de imagem deve aparecer
// mesmo quando o modo template está ativo.
export const PHOTO_TEMPLATE_IDS: string[] = [
  TEMPLATE_IDS.HORIZONTE,
  TEMPLATE_IDS.RETRATO,
];

export function isKnownTemplate(templateId?: string | null): boolean {
  return !!templateId && ALL_TEMPLATE_IDS.includes(templateId);
}

export function isPhotoTemplate(templateId?: string | null): boolean {
  return !!templateId && PHOTO_TEMPLATE_IDS.includes(templateId);
}

// ── PhotoSlot ────────────────────────────────────────────────────────
// Slot de imagem usado pelos templates de foto (Horizonte / Retrato).
//
// - `url` definido → renderiza <img> com object-fit: cover preenchendo
//   todo o contêiner. URL tipicamente vem de slideBackgrounds[i].url
//   (já populado pelo fluxo Pexels do PostEditorPage).
// - `url` ausente → mostra placeholder discreto com texto contextual
//   ("foto · CLÁUSULA · PRAZO", etc.). O placeholder não é clicável
//   nesse componente; usuário troca a imagem via o botão "trocar fundo"
//   já existente no toolbar do editor (que escreve em slideBackgrounds).
// - `frameColor` / `frameSide` → desenha a hairline dourada/mogno que
//   separa a foto do bloco de texto, característica visual das
//   variações com foto no design original.

export interface PhotoSlotProps {
  url?: string | null;
  placeholder?: string;
  /** Cor da hairline que enquadra a foto. */
  frameColor: string;
  /** Lado onde a hairline fica (bottom em Horizonte; right ou bottom em Retrato). */
  frameSide?: "bottom" | "right" | "top" | "left";
  /** Cor de fallback quando não há foto (tom da paleta). */
  fallbackBg?: string;
  /** Cor do texto do placeholder. */
  placeholderColor?: string;
  /**
   * object-position aplicado na <img>. Formato CSS ("50% 50%", "30% 70%").
   * Default "50% 50%" (center). Mudado via drag dentro do slot.
   */
  objectPosition?: string;
  /**
   * Callback disparado durante drag pra reposicionar a foto. Recebe a nova
   * string de object-position. Quando ausente, o slot fica não-arrastável
   * (modo "view only" — útil em previews/thumbnails).
   */
  onPositionChange?: (next: string) => void;
}

// Helper: parseia "50% 30%" → { x: 50, y: 30 }. Aceita também "center"
// e "left/right/top/bottom" (mapeia pra 0/50/100). Robusto pra entrada
// vinda de slideBackgrounds que pode estar em formato variado.
function parseObjectPosition(s: string | undefined | null): { x: number; y: number } {
  if (!s) return { x: 50, y: 50 };
  const tokenToPercent = (tok: string): number | null => {
    const t = tok.trim().toLowerCase();
    if (t === "center") return 50;
    if (t === "left" || t === "top") return 0;
    if (t === "right" || t === "bottom") return 100;
    const m = t.match(/^(-?\d+(?:\.\d+)?)%$/);
    if (m) return parseFloat(m[1]);
    return null;
  };
  const parts = s.trim().split(/\s+/);
  if (parts.length === 1) {
    const v = tokenToPercent(parts[0]);
    return v != null ? { x: v, y: 50 } : { x: 50, y: 50 };
  }
  const x = tokenToPercent(parts[0]);
  const y = tokenToPercent(parts[1]);
  return {
    x: x != null ? x : 50,
    y: y != null ? y : 50,
  };
}

const clampPct = (v: number) => Math.max(0, Math.min(100, v));

export const PhotoSlot: React.FC<PhotoSlotProps> = ({
  url,
  placeholder,
  frameColor,
  frameSide = "bottom",
  fallbackBg = "#0E2A20",
  placeholderColor = "#F5F0E8",
  objectPosition,
  onPositionChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    containerW: number;
    containerH: number;
    pointerId: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const draggable = !!url && !!onPositionChange;
  const currentPos = parseObjectPosition(objectPosition);
  const cssPos = `${currentPos.x}% ${currentPos.y}%`;

  const frameStyle: React.CSSProperties = {
    position: "absolute",
    background: frameColor,
    opacity: 0.85,
    pointerEvents: "none",
  };
  switch (frameSide) {
    case "bottom":
      Object.assign(frameStyle, { bottom: 0, left: 0, right: 0, height: 1 });
      break;
    case "top":
      Object.assign(frameStyle, { top: 0, left: 0, right: 0, height: 1 });
      break;
    case "right":
      Object.assign(frameStyle, { top: 0, bottom: 0, right: 0, width: 1 });
      break;
    case "left":
      Object.assign(frameStyle, { top: 0, bottom: 0, left: 0, width: 1 });
      break;
  }

  // Drag handlers — usa Pointer Events (cobre mouse + touch + pen num só
  // listener). setPointerCapture garante que o move chega mesmo quando o
  // cursor sai do slot durante o drag.
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggable) return;
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPosX: currentPos.x,
        startPosY: currentPos.y,
        containerW: rect.width,
        containerH: rect.height,
        pointerId: e.pointerId,
      };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Browsers podem rejeitar quando pointerId é inválido — ignorar.
      }
      setIsDragging(true);
      e.preventDefault();
    },
    [draggable, currentPos.x, currentPos.y],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = dragStateRef.current;
      if (!state || !onPositionChange) return;
      if (e.pointerId !== state.pointerId) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      // Sensibilidade: cada pixel de mouse move 100/container px% do
      // object-position. Invertido (-) porque arrastar pra direita deve
      // revelar mais da esquerda da imagem (deslocar pos x pra menor).
      const nextX = clampPct(state.startPosX - (dx / state.containerW) * 100);
      const nextY = clampPct(state.startPosY - (dy / state.containerH) * 100);
      onPositionChange(`${nextX.toFixed(1)}% ${nextY.toFixed(1)}%`);
    },
    [onPositionChange],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const state = dragStateRef.current;
      if (!state) return;
      const el = containerRef.current;
      if (el) {
        try {
          el.releasePointerCapture(state.pointerId);
        } catch {
          // OK — pode já estar liberado.
        }
      }
      dragStateRef.current = null;
      setIsDragging(false);
    },
    [],
  );

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: "absolute",
        inset: 0,
        background: fallbackBg,
        overflow: "hidden",
        cursor: draggable ? (isDragging ? "grabbing" : "move") : "default",
        // touch-action: none impede que o gesture native (scroll) compita
        // com o drag. Crítico em mobile.
        touchAction: draggable ? "none" : "auto",
        userSelect: "none",
      }}
      title={draggable ? "Arraste para reposicionar a foto" : undefined}
    >
      {url ? (
        <img
          src={url}
          alt=""
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: cssPos,
            pointerEvents: "none",
          }}
          draggable={false}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: placeholderColor,
            opacity: 0.4,
            fontFamily: '"Lato", sans-serif',
            fontSize: 11,
            letterSpacing: 2,
            textTransform: "uppercase",
            textAlign: "center",
            padding: 16,
            pointerEvents: "none",
          }}
        >
          {placeholder || "foto"}
        </div>
      )}
      <div style={frameStyle} />
    </div>
  );
};

// ── LogoOverlay ──────────────────────────────────────────────────────
// Renderiza a logo do usuário como camada do template. Posição padrão:
// rodapé direito (canto inferior). Tamanho/opacidade/z-index controlados
// via tokens. A logo já chega com fundo removido (vem de fetchUserLogo,
// que garante PNG transparente via remove-background + chroma key).
//
// Z-index:
// - logoBehindText=true → zIndex 0, renderizado ANTES dos textos do
//   template, funcionando como marca d'água sutil grande
// - logoBehindText=false → zIndex 5, renderizado por cima dos textos
//   (mas dentro do card, que tem overflow:hidden, então não escapa)
//
// Posicionamento absoluto baseado em % do card. Como cada template tem
// seu próprio padding/footer, isso é um compromisso — fica meio "solto"
// no canto. Drag/posicionamento custom pode vir depois (igual feito pro
// PhotoSlot).

export interface LogoOverlayProps {
  /** URL da logo. Quando ausente ou showLogo=false, nada é renderizado. */
  url?: string | null;
  /** Toggle de visibilidade (default true se url existe). */
  show?: boolean;
  /** Largura da logo em % da largura do card (default 18). */
  sizePct?: number;
  /** Opacidade da logo (0..1, default 1). */
  opacity?: number;
  /** Quando true, fica como marca d'água (zIndex baixo, centro do card). */
  behindText?: boolean;
  /** Largura do card em px (vem do FORMATS) — usado pra calcular o tamanho da logo. */
  cardWidth: number;
  /** Altura do card em px. */
  cardHeight: number;
}

export const LogoOverlay: React.FC<LogoOverlayProps> = ({
  url,
  show = true,
  sizePct = 18,
  opacity = 1,
  behindText = false,
  cardWidth,
  cardHeight,
}) => {
  if (!url || !show) return null;
  // sizePct é % da largura. A altura fica auto pra preservar aspect ratio.
  const widthPx = (cardWidth * Math.max(5, Math.min(80, sizePct))) / 100;

  // Quando atrás do texto (marca d'água): logo BEM grande, centralizada,
  // opacidade reduzida automaticamente se o usuário não setou. Z-index 0.
  if (behindText) {
    const wmSize = Math.min(cardWidth * 0.7, cardHeight * 0.7);
    return (
      <img
        src={url}
        alt=""
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: wmSize,
          height: "auto",
          opacity: Math.min(opacity, 0.18),
          zIndex: 0,
          pointerEvents: "none",
          userSelect: "none",
        }}
        draggable={false}
      />
    );
  }

  // Logo em primeiro plano: canto inferior direito, padding proporcional
  // ao card (~6% da largura). Z-index alto pra ficar acima do texto se
  // houver sobreposição, mas mesmo assim respeitando o overflow:hidden
  // do card.
  const padding = cardWidth * 0.06;
  return (
    <img
      src={url}
      alt=""
      style={{
        position: "absolute",
        bottom: padding,
        right: padding,
        width: widthPx,
        height: "auto",
        maxHeight: cardHeight * 0.18,
        objectFit: "contain",
        opacity,
        zIndex: 5,
        pointerEvents: "none",
        userSelect: "none",
      }}
      draggable={false}
    />
  );
};

interface PeEyebrowProps {
  children: React.ReactNode;
  color: string;
  size?: number;
  weight?: number;
}

export const PeEyebrow: React.FC<PeEyebrowProps> = ({
  children,
  color,
  size = 11,
  weight = 700,
}) => (
  <div
    style={{
      fontFamily: '"Lato", sans-serif',
      fontWeight: weight,
      fontSize: size,
      letterSpacing: 3,
      textTransform: "uppercase",
      color,
    }}
  >
    {children}
  </div>
);

interface PeRuleProps {
  color: string;
  mt?: number;
  mb?: number;
  opacity?: number;
  height?: number;
}

export const PeRule: React.FC<PeRuleProps> = ({
  color,
  mt = 0,
  mb = 0,
  opacity = 0.9,
  height = 0.5,
}) => (
  <div
    style={{
      height,
      background: color,
      marginTop: mt,
      marginBottom: mb,
      opacity,
    }}
  />
);

interface PeDiamondProps {
  color: string;
  size?: number;
}

export const PeDiamond: React.FC<PeDiamondProps> = ({ color, size = 6 }) => (
  <div
    style={{
      width: size,
      height: size,
      background: color,
      transform: "rotate(45deg)",
      flex: "0 0 auto",
    }}
  />
);

// ── EditableSpan ─────────────────────────────────────────────────────
// Wrapper de slot editável usado por todos os componentes de template
// Governante (Sertão / Cartório / Manuscrito).
//
// Regras:
// - Slot vazio (value === "") NÃO renderiza nada — sem placeholder
//   visível pra evitar mistura de texto-exemplo com conteúdo real
// - Slot com valor renderiza normalmente; quando há onEdit, vira
//   contentEditable com foco visual em accent dourado

interface EditableSpanProps {
  field: string;
  value: string;
  style?: React.CSSProperties;
  onEdit?: (field: string, value: string) => void;
  as?: "span" | "div";
  placeholder?: string;
  /**
   * Quando true, mede o conteúdo e reduz fontSize iterativamente até
   * caber no contêiner pai (clientHeight × clientWidth). Útil pra
   * slots que recebem texto longo (titleLead, body, title). Lê o
   * fontSize de `style` como tamanho base.
   */
  autoFit?: boolean;
  /** Tamanho mínimo aceito quando autoFit reduz a fonte. */
  minFontSize?: number;
}

// Style aplicado em editáveis sem display forçado. Sem isso, o
// display: inline-block antigo impedia o texto longo de quebrar
// linha naturalmente — o que furava o auto-fit e empurrava o título
// pra fora do canvas.
const editableBaseStyle: React.CSSProperties = {
  outline: "none",
  cursor: "text",
  transition: "box-shadow 120ms ease, background-color 120ms ease",
  borderRadius: 2,
};

export const EditableSpan: React.FC<EditableSpanProps> = ({
  field,
  value,
  style,
  onEdit,
  as = "span",
  placeholder,
  autoFit,
  minFontSize,
}) => {
  const fitRef = useRef<HTMLElement | null>(null);
  const baseSize = typeof style?.fontSize === "number"
    ? style.fontSize
    : parseFloat(String(style?.fontSize ?? "")) || 16;
  const [fittedSize, setFittedSize] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!autoFit) return;
    const el = fitRef.current;
    if (!el) return;

    const findBoundsHost = (): HTMLElement | null => {
      let node: HTMLElement | null = el.parentElement;
      while (node) {
        if (node.dataset && node.dataset.fitBounds != null) return node;
        node = node.parentElement;
      }
      return el.parentElement;
    };

    const fit = () => {
      const host = findBoundsHost();
      const limitH = host ? host.clientHeight : Infinity;
      const limitW = host ? host.clientWidth : Infinity;
      const min = minFontSize ?? Math.max(10, Math.round(baseSize * 0.35));

      let s = baseSize;
      el.style.fontSize = `${s}px`;
      let guard = 200;
      while (
        guard-- > 0 &&
        s > min &&
        (el.scrollHeight > limitH || el.scrollWidth > limitW)
      ) {
        s -= 1;
        el.style.fontSize = `${s}px`;
      }
      setFittedSize(s);
    };

    fit();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    const host = findBoundsHost();
    if (host) ro.observe(host);
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoFit, baseSize, minFontSize, value]);


  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      if (!onEdit) return;
      const next = (e.currentTarget.innerText || "").replace(/\s+\n/g, "\n").trim();
      if (next !== value) onEdit(field, next);
    },
    [field, value, onEdit],
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }, []);

  const isEditable = !!onEdit;
  const isEmpty = !value || value.length === 0;

  // Slot vazio colapsa por completo (não ocupa espaço vertical).
  if (isEmpty) return null;

  // Quando autoFit reduziu o size, sobrescreve o fontSize aplicado.
  const effectiveStyle: React.CSSProperties | undefined =
    autoFit && fittedSize != null && fittedSize !== baseSize
      ? { ...(style || {}), fontSize: fittedSize }
      : style;

  const editableStyle: React.CSSProperties | undefined = isEditable
    ? { ...effectiveStyle, ...editableBaseStyle }
    : effectiveStyle;

  const focusProps = isEditable
    ? {
        onFocus: (e: React.FocusEvent<HTMLElement>) => {
          e.currentTarget.style.boxShadow = "0 0 0 1px rgba(196,166,77,0.55)";
          e.currentTarget.style.backgroundColor = "rgba(196,166,77,0.06)";
        },
        onBlurCapture: (e: React.FocusEvent<HTMLElement>) => {
          e.currentTarget.style.boxShadow = "none";
          e.currentTarget.style.backgroundColor = "transparent";
        },
      }
    : {};

  const commonProps = isEditable
    ? {
        contentEditable: true as const,
        suppressContentEditableWarning: true,
        spellCheck: false,
        onBlur: handleBlur,
        onKeyDown: handleKeyDown,
        onPaste: handlePaste,
        title: placeholder,
        "aria-label": placeholder,
        ...focusProps,
      }
    : {};

  const Tag = as as any;
  return (
    <Tag
      key={value}
      ref={autoFit ? (fitRef as any) : undefined}
      style={editableStyle}
      {...commonProps}
    >
      {value}
    </Tag>
  );
};

// ── FitGroup ─────────────────────────────────────────────────────────
// Auto-fit a NÍVEL DE CONJUNTO de elementos.
//
// Caso resolvido: dentro de um wrapper (ex: a metade inferior do
// Manuscrito), título E corpo são editáveis e cada um cabe sozinho no
// wrapper — mas combinados extrapolam. O auto-fit por elemento (via
// EditableSpan.autoFit) não detecta esse overflow porque mede só seu
// próprio scrollHeight contra parent.clientHeight, e o parent é largo
// o suficiente pra cada elemento sozinho.
//
// Estratégia: medir scrollHeight do GRUPO inteiro contra um limite
// (maxHeight ou parent.clientHeight) e aplicar `transform: scale(s)`
// uniforme. Mantém proporções tipográficas perfeitas — title e body
// reduzem juntos.
//
// Trade-off: o conteúdo escalado fica visualmente mais estreito que o
// wrapper se não compensarmos width. Por isso compensamos com
// `width: ${100/scale}%` quando há redução — o conteúdo re-flui no
// width "ampliado", ocupando o mesmo espaço visual após o scale.

export interface FitGroupProps {
  children: React.ReactNode;
  /** Limite explícito em px. Se omitido, usa wrapper.clientHeight. */
  maxHeight?: number;
  /** Scale mínimo aceito (default 0.4, ~ -60% do tamanho original). */
  minScale?: number;
  /** Style adicional pro wrapper. */
  style?: React.CSSProperties;
}

export const FitGroup: React.FC<FitGroupProps> = ({
  children,
  maxHeight,
  minScale = 0.4,
  style,
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const lastMeasuredRef = useRef<{ contentH: number; limitH: number } | null>(null);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;

    const fit = () => {
      // Reset transform + width pra medir o tamanho natural.
      content.style.transform = "";
      content.style.width = "100%";
      const contentH = content.scrollHeight;
      const limitH = maxHeight ?? wrapper.clientHeight;
      if (!limitH || !contentH) return;

      // Evita re-render desnecessário quando nada mudou (ResizeObserver
      // pode disparar repetido em browsers diferentes).
      const last = lastMeasuredRef.current;
      if (last && last.contentH === contentH && last.limitH === limitH) return;
      lastMeasuredRef.current = { contentH, limitH };

      const next = contentH > limitH
        ? Math.max(minScale, limitH / contentH)
        : 1;
      setScale(next);
    };

    fit();

    if (typeof ResizeObserver === "undefined") return;
    // Observa só o wrapper — mudanças do content vêm do nosso próprio
    // scale, então observar content causa loop.
    const ro = new ResizeObserver(() => {
      // requestAnimationFrame evita re-medir antes do browser ter
      // pintado o estado anterior.
      requestAnimationFrame(fit);
    });
    ro.observe(wrapper);
    return () => ro.disconnect();
  }, [maxHeight, minScale, children]);

  return (
    <div
      ref={wrapperRef}
      style={{ flex: 1, minHeight: 0, overflow: "hidden", ...style }}
    >
      <div
        ref={contentRef}
        style={{
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
          // Compensa width pro conteúdo re-fluir no mesmo espaço visual.
          width: scale < 1 ? `${100 / scale}%` : "100%",
        }}
      >
        {children}
      </div>
    </div>
  );
};

// ── FitText ──────────────────────────────────────────────────────────
// Auto-shrink de fonte pra caber em altura/largura disponível.
//
// Caso: texto da linha editorial nem sempre cabe na caixa desenhada pelo
// template (especialmente titleLead da capa, title/body do close, body
// da cláusula). Em vez de cortar com overflow:hidden ou empurrar o
// layout, o componente mede o conteúdo após cada render e reduz o
// fontSize em passos de 1px até caber dentro do contêiner pai
// (clientHeight × clientWidth do parentElement), respeitando minSize.
//
// O contêiner pai PRECISA ter altura/largura determinada (não auto).
// No nosso uso, os pais são sempre divs com `flex: 1` ou `height` fixa
// dentro de cartões 540×675 ou 540×960, então funciona.

interface FitTextProps {
  baseSize: number;
  minSize?: number;
  /** Limite explícito em px. Se omitido, usa parentElement.clientHeight. */
  maxHeight?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
  as?: "div" | "span";
}

export const FitText: React.FC<FitTextProps> = ({
  baseSize,
  minSize,
  maxHeight,
  style,
  children,
  as = "div",
}) => {
  const ref = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState(baseSize);
  const min = minSize ?? Math.max(10, Math.round(baseSize * 0.45));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const fit = () => {
      const parent = el.parentElement;
      const limitH = maxHeight ?? (parent ? parent.clientHeight : Infinity);
      const limitW = parent ? parent.clientWidth : Infinity;

      let s = baseSize;
      el.style.fontSize = `${s}px`;
      // Iteração defensiva — máx 80 passos pra não bloquear se algo der errado.
      let guard = 80;
      while (
        guard-- > 0 &&
        s > min &&
        (el.scrollHeight > limitH || el.scrollWidth > limitW)
      ) {
        s -= 1;
        el.style.fontSize = `${s}px`;
      }
      setSize(s);
    };

    fit();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(fit);
    if (el.parentElement) ro.observe(el.parentElement);
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseSize, min, maxHeight, children]);

  const Tag = as as any;
  return (
    <Tag ref={ref as any} style={{ fontSize: size, ...style }}>
      {children}
    </Tag>
  );
};
