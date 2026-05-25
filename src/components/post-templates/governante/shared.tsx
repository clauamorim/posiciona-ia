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

export function isKnownTemplate(templateId?: string | null): boolean {
  return !!templateId && ALL_TEMPLATE_IDS.includes(templateId);
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
}

export const PhotoSlot: React.FC<PhotoSlotProps> = ({
  url,
  placeholder,
  frameColor,
  frameSide = "bottom",
  fallbackBg = "#0E2A20",
  placeholderColor = "#F5F0E8",
}) => {
  const frameStyle: React.CSSProperties = {
    position: "absolute",
    background: frameColor,
    opacity: 0.85,
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

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: fallbackBg,
        overflow: "hidden",
      }}
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
            objectPosition: "center center",
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
          }}
        >
          {placeholder || "foto"}
        </div>
      )}
      <div style={frameStyle} />
    </div>
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
