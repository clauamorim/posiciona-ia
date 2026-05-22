// Variação A — "Sertão Profundo" do arquétipo Governante.
// Refatoração 1:1 de design-sources/governante/cards-sertao.jsx
// (sem globals window.*, tipado com TypeScript).

import React, { useCallback } from "react";
import type {
  CardData,
  ClauseSlots,
  CloseSlots,
  CoverSlots,
  Format,
  SertaoTokens,
} from "./types";
import {
  AREIA,
  FORMATS,
  OURO,
  VERDE,
  peBodyFontFor,
  peRenderNum,
  peTinyCaps,
} from "./tokens";
import { PeDiamond, PeEyebrow, PeRule } from "./shared";

type SlotField =
  | keyof CoverSlots
  | keyof ClauseSlots
  | keyof CloseSlots;

interface SertaoCardProps {
  card: CardData;
  format: Format;
  tokens?: SertaoTokens;
  /** Quando definido, os textos do card viram contentEditable. */
  onEditSlot?: (field: SlotField, value: string) => void;
}

// ── EditableSpan ─────────────────────────────────────────────────────
// Span que vira contentEditable quando há onEdit. Sem rich text:
// quebra de linha vira espaço, paste é forçado a text/plain.
interface EditableSpanProps {
  field: SlotField;
  value: string;
  style?: React.CSSProperties;
  onEdit?: (field: SlotField, value: string) => void;
  as?: "span" | "div";
}

const editableBaseStyle: React.CSSProperties = {
  outline: "none",
  cursor: "text",
  transition: "box-shadow 120ms ease, background-color 120ms ease",
  borderRadius: 2,
};

const EditableSpan: React.FC<EditableSpanProps> = ({
  field,
  value,
  style,
  onEdit,
  as = "span",
}) => {
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

  const editableStyle: React.CSSProperties | undefined = onEdit
    ? { ...style, ...editableBaseStyle }
    : style;

  const focusProps = onEdit
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

  const commonProps = onEdit
    ? {
        contentEditable: true as const,
        suppressContentEditableWarning: true,
        spellCheck: false,
        onBlur: handleBlur,
        onKeyDown: handleKeyDown,
        onPaste: handlePaste,
        ...focusProps,
      }
    : {};

  // Usa key=value para forçar React a re-renderizar o conteúdo quando o
  // valor externo muda (necessário pois contentEditable não é controlado).
  const Tag = as as any;
  return (
    <Tag key={value} style={editableStyle} {...commonProps}>
      {value}
    </Tag>
  );
};

const SertaoCard: React.FC<SertaoCardProps> = ({
  card,
  format,
  tokens = {},
  onEditSlot,
}) => {
  const { w, h } = FORMATS[format];
  const big = format === "9:16";
  const PAD_X = big ? 60 : 50;
  const PAD_Y = big ? 86 : 56;

  const verde = tokens.verdeBg || VERDE;
  const areia = tokens.areiaInk || AREIA;
  const ouro = tokens.ouroAccent || OURO;

  const ornaments = tokens.showOrnaments !== false;
  const bodyFam = peBodyFontFor(tokens.bodyFont);

  const styleBase: React.CSSProperties = {
    width: w,
    height: h,
    background: verde,
    color: areia,
    position: "relative",
    overflow: "hidden",
    fontFamily: '"Lato", system-ui, sans-serif',
    letterSpacing: 0.02,
  };

  // ── COVER ─────────────────────────────────────────────────────────
  if (card.kind === "cover") {
    return (
      <div style={styleBase}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(120% 80% at 50% 110%, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0) 60%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: `${PAD_Y}px ${PAD_X}px`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <EditableSpan
            field="eyebrow"
            value={tokens.eyebrowText || card.eyebrow}
            style={peTinyCaps(ouro, big ? 13 : 11)}
            onEdit={onEditSlot}
          />
          <PeRule color={ouro} mt={big ? 28 : 18} />

          <div style={{ marginTop: big ? 56 : 36 }}>
            <EditableSpan
              field="kicker"
              value={card.kicker}
              as="div"
              style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: big ? 44 : 32,
                color: ouro,
                letterSpacing: 0.5,
                lineHeight: 1,
              }}
              onEdit={onEditSlot}
            />
          </div>

          <EditableSpan
            field="countWord"
            value={card.countWord}
            as="div"
            style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 500,
              fontStyle: "italic",
              fontSize: big ? 132 : 96,
              lineHeight: 0.9,
              color: areia,
              marginTop: big ? 18 : 10,
              letterSpacing: -1.5,
            }}
            onEdit={onEditSlot}
          />

          <div
            style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 400,
              fontSize: big ? 38 : 28,
              lineHeight: 1.15,
              color: areia,
              marginTop: big ? 22 : 14,
              letterSpacing: -0.2,
              textWrap: "pretty" as any,
            }}
          >
            <EditableSpan
              field="titleLead"
              value={card.titleLead}
              onEdit={onEditSlot}
            />
            {card.titleTail ? (
              <>
                <span
                  style={{
                    color: areia,
                    opacity: 0.62,
                    fontStyle: "italic",
                    fontFamily: '"Cormorant Garamond", serif',
                    fontWeight: 400,
                  }}
                >
                  {" "}— {" "}
                </span>
                <EditableSpan
                  field="titleTail"
                  value={card.titleTail}
                  style={{
                    color: areia,
                    opacity: 0.62,
                    fontStyle: "italic",
                    fontFamily: '"Cormorant Garamond", serif',
                    fontWeight: 400,
                  }}
                  onEdit={onEditSlot}
                />
              </>
            ) : null}
          </div>

          <div style={{ flex: 1 }} />

          <PeRule color={ouro} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: big ? 18 : 12,
            }}
          >
            <EditableSpan
              field="footer"
              value={tokens.showSwipeHint !== false ? card.footer : "\u00A0"}
              style={peTinyCaps(ouro, big ? 12 : 10)}
              onEdit={onEditSlot}
            />
            {ornaments && <PeDiamond color={ouro} size={big ? 9 : 7} />}
            <span style={peTinyCaps(ouro, big ? 12 : 10)}>01 / 07</span>
          </div>
        </div>
      </div>
    );
  }

  // ── CLOSING ───────────────────────────────────────────────────────
  if (card.kind === "close") {
    return (
      <div style={styleBase}>
        <div
          style={{
            position: "absolute",
            inset: `${PAD_Y}px ${PAD_X}px`,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <EditableSpan
            field="eyebrow"
            value={card.eyebrow}
            style={peTinyCaps(ouro, big ? 13 : 11)}
            onEdit={onEditSlot}
          />
          <PeRule color={ouro} mt={big ? 28 : 18} />

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <EditableSpan
              field="title"
              value={card.title}
              as="div"
              style={{
                fontFamily: '"Playfair Display", serif',
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: big ? 72 : 52,
                lineHeight: 1.05,
                color: areia,
                letterSpacing: -1,
                textWrap: "balance" as any,
              }}
              onEdit={onEditSlot}
            />

            <div style={{ height: big ? 36 : 24 }} />

            <EditableSpan
              field="body"
              value={card.body}
              as="div"
              style={{
                fontFamily: bodyFam,
                fontWeight: 400,
                fontSize: big ? 28 : 22,
                lineHeight: 1.45,
                color: areia,
                opacity: 0.86,
                textWrap: "pretty" as any,
                fontStyle: bodyFam.includes("Cormorant") ? "italic" : "normal",
              }}
              onEdit={onEditSlot}
            />

            {ornaments && (
              <div
                style={{
                  marginTop: big ? 56 : 36,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <PeDiamond color={ouro} size={big ? 10 : 8} />
                <PeDiamond color={ouro} size={big ? 6 : 5} />
                <PeDiamond color={ouro} size={big ? 4 : 3} />
              </div>
            )}
          </div>

          <PeRule color={ouro} />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: big ? 18 : 12,
            }}
          >
            <EditableSpan
              field="cta"
              value={card.cta}
              style={peTinyCaps(ouro, big ? 12 : 10)}
              onEdit={onEditSlot}
            />
            <span style={peTinyCaps(ouro, big ? 12 : 10)}>07 / 07</span>
          </div>
        </div>
      </div>
    );
  }

  // ── CLAUSE ────────────────────────────────────────────────────────
  const numLabel = peRenderNum(card.num, tokens.numberingStyle);
  return (
    <div style={styleBase}>
      <div
        style={{
          position: "absolute",
          inset: `${PAD_Y}px ${PAD_X}px`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: big ? 14 : 10,
          }}
        >
          <div style={peTinyCaps(ouro, big ? 13 : 11)}>
            <span>CLÁUSULA &nbsp;·&nbsp; </span>
            <EditableSpan
              field="topic"
              value={card.topic}
              onEdit={onEditSlot}
            />
          </div>
        </div>
        <PeRule color={ouro} mt={big ? 28 : 18} />

        <div
          style={{
            fontFamily: '"Playfair Display", serif',
            fontStyle: "italic",
            fontWeight: 500,
            fontSize: big ? 220 : 160,
            lineHeight: 0.85,
            color: ouro,
            marginTop: big ? 36 : 22,
            letterSpacing: -4,
          }}
        >
          {numLabel}
        </div>

        <EditableSpan
          field="title"
          value={card.title}
          as="div"
          style={{
            fontFamily: '"Playfair Display", serif',
            fontWeight: 400,
            fontSize: big ? 48 : 36,
            lineHeight: 1.08,
            color: areia,
            marginTop: big ? 36 : 24,
            letterSpacing: -0.4,
            textWrap: "balance" as any,
          }}
          onEdit={onEditSlot}
        />

        <div style={{ height: big ? 24 : 16 }} />

        <EditableSpan
          field="body"
          value={card.body}
          as="div"
          style={{
            fontFamily: bodyFam,
            fontWeight: 400,
            fontStyle: bodyFam.includes("Cormorant") ? "italic" : "normal",
            fontSize: big ? 26 : 21,
            lineHeight: 1.4,
            color: areia,
            opacity: 0.78,
            textWrap: "pretty" as any,
          }}
          onEdit={onEditSlot}
        />

        <div style={{ flex: 1 }} />

        <PeRule color={ouro} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: big ? 18 : 12,
          }}
        >
          <span style={peTinyCaps(ouro, big ? 12 : 10)}>Posiciona Editorial</span>
          {ornaments && <PeDiamond color={ouro} size={big ? 7 : 5} />}
          <span style={peTinyCaps(ouro, big ? 12 : 10)}>
            {String(parseInt(card.num, 10) + 1).padStart(2, "0")} / 07
          </span>
        </div>
      </div>
    </div>
  );
};

export default SertaoCard;
