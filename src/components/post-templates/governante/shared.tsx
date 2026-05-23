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
} as const;

export const ALL_TEMPLATE_IDS: string[] = Object.values(TEMPLATE_IDS);

export function isKnownTemplate(templateId?: string | null): boolean {
  return !!templateId && ALL_TEMPLATE_IDS.includes(templateId);
}

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

const editableBaseStyle: React.CSSProperties = {
  outline: "none",
  cursor: "text",
  transition: "box-shadow 120ms ease, background-color 120ms ease",
  borderRadius: 2,
  minWidth: 4,
  minHeight: "1em",
  display: "inline-block",
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

    const fit = () => {
      const parent = el.parentElement;
      const limitH = parent ? parent.clientHeight : Infinity;
      const limitW = parent ? parent.clientWidth : Infinity;
      const min = minFontSize ?? Math.max(10, Math.round(baseSize * 0.45));

      let s = baseSize;
      el.style.fontSize = `${s}px`;
      let guard = 80;
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
    if (el.parentElement) ro.observe(el.parentElement);
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
