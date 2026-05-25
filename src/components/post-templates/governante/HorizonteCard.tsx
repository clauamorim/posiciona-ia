// Variação D — "Horizonte" do arquétipo Governante.
// Portado de design-sources/governante/cards-foto.jsx (HorizonteCard).
//
// Visual: foto horizontal ocupa o topo do card (~40% da altura). Texto
// editorial fica embaixo, em paleta escura (mesmo esqueleto do Sertão
// Profundo). Hairline dourada separa foto do bloco de texto.
//
// Imagem vem da prop `imageUrl` — tipicamente alimentada pelo state
// `slideBackgrounds[slideIndex].url` do PostEditorPage, que já é
// populado automaticamente quando o usuário gera o carrossel via
// Pexels. Para trocar a imagem de um slide específico, o usuário usa
// o botão "trocar fundo" do toolbar (já wired pra applyBackground-
// ToCurrentSlide).

import React from "react";
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
import { EditableSpan, PeDiamond, PeRule, PhotoSlot } from "./shared";

type SlotField =
  | keyof CoverSlots
  | keyof ClauseSlots
  | keyof CloseSlots;

interface HorizonteCardProps {
  card: CardData;
  format: Format;
  tokens?: SertaoTokens;
  slideIndex?: number;
  totalSlides?: number;
  onEditSlot?: (field: SlotField, value: string) => void;
  defaultBrandMark?: string;
  /** URL da foto desse slide (vem de slideBackgrounds[slideIndex] no PostEditorPage). */
  imageUrl?: string | null;
}

/** Placeholder contextual baseado no tipo do slide. */
function imagePlaceholder(card: CardData): string {
  if (card.kind === "cover") return "foto · capa";
  if (card.kind === "close") return "foto · autor ou assinatura";
  const topic = (card.topic || "").trim();
  return topic ? `foto · ${topic}` : "foto da cláusula";
}

const HorizonteCard: React.FC<HorizonteCardProps> = ({
  card,
  format,
  tokens = {},
  onEditSlot,
  slideIndex,
  totalSlides = 7,
  defaultBrandMark,
  imageUrl,
}) => {
  const sectionLabel = (tokens.sectionLabel ?? "CLÁUSULA").trim();
  const brandMark = (tokens.brandMark ?? defaultBrandMark ?? "Posiciona Editorial").trim();
  const { w, h } = FORMATS[format];
  const big = format === "9:16";

  // Foto ocupa ~40% da altura. Em 9:16 (canvas mais alto), valor absoluto
  // maior pra manter proporção visual com o texto embaixo.
  const IMG_H = big ? Math.round(h * 0.42) : Math.round(h * 0.4);
  const PAD_X = big ? 56 : 44;
  const PAD_Y = big ? 40 : 28;

  const verde = tokens.verdeBg || VERDE;
  const areia = tokens.areiaInk || AREIA;
  const ouro = tokens.ouroAccent || OURO;
  const bodyFam = peBodyFontFor(tokens.bodyFont);
  const ornaments = tokens.showOrnaments !== false;

  const pageNum =
    typeof slideIndex === "number"
      ? slideIndex + 1
      : card.kind === "clause"
        ? parseInt(card.num, 10) + 1
        : card.kind === "cover"
          ? 1
          : totalSlides;
  const showPageLabel = totalSlides > 1;
  const pageLabel = `${String(pageNum).padStart(2, "0")} / ${String(totalSlides).padStart(2, "0")}`;

  const styleBase: React.CSSProperties = {
    width: w,
    height: h,
    background: verde,
    color: areia,
    position: "relative",
    overflow: "hidden",
    fontFamily: '"Lato", system-ui, sans-serif',
  };

  // Bloco da foto — sempre no topo, full-width.
  const imageBlock = (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: IMG_H }}>
      <PhotoSlot
        url={imageUrl}
        placeholder={imagePlaceholder(card)}
        frameColor={ouro}
        frameSide="bottom"
        fallbackBg="#0E2A20"
        placeholderColor={areia}
      />
    </div>
  );

  // Wrapper do texto — começa onde a foto termina.
  const textWrapStyle: React.CSSProperties = {
    position: "absolute",
    top: IMG_H,
    left: 0,
    right: 0,
    bottom: 0,
    padding: `${PAD_Y + 10}px ${PAD_X}px ${PAD_Y}px`,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  };

  // ── COVER ─────────────────────────────────────────────────────────
  if (card.kind === "cover") {
    return (
      <div style={styleBase}>
        {imageBlock}
        <div style={textWrapStyle}>
          <EditableSpan
            field="eyebrow"
            value={tokens.eyebrowText || card.eyebrow}
            style={peTinyCaps(ouro, big ? 13 : 11)}
            onEdit={onEditSlot as any}
            placeholder="EYEBROW · CATEGORIA"
          />
          <PeRule color={ouro} mt={big ? 16 : 12} />

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <EditableSpan
              field="kicker"
              value={card.kicker}
              as="div"
              style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: big ? 34 : 26,
                color: ouro,
                letterSpacing: 0.5,
                lineHeight: 1,
              }}
              onEdit={onEditSlot as any}
              placeholder="Kicker"
            />
            <EditableSpan
              field="countWord"
              value={card.countWord}
              as="div"
              style={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 500,
                fontStyle: "italic",
                fontSize: big ? 88 : 64,
                lineHeight: 0.92,
                color: areia,
                letterSpacing: -1.5,
                marginTop: big ? 8 : 6,
              }}
              onEdit={onEditSlot as any}
              placeholder="Sete"
            />
            <EditableSpan
              field="titleLead"
              value={card.titleLead}
              as="div"
              autoFit
              style={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 400,
                fontSize: big ? 26 : 20,
                lineHeight: 1.2,
                color: areia,
                marginTop: big ? 14 : 10,
                textWrap: "pretty" as any,
                maxWidth: "94%",
              }}
              onEdit={onEditSlot as any}
              placeholder="Título principal"
            />
            <EditableSpan
              field="titleTail"
              value={card.titleTail}
              as="div"
              style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontStyle: "italic",
                fontSize: big ? 22 : 18,
                lineHeight: 1.3,
                color: areia,
                opacity: 0.7,
                marginTop: big ? 8 : 6,
              }}
              onEdit={onEditSlot as any}
              placeholder="complemento"
            />
          </div>

          <PeRule color={ouro} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: big ? 14 : 10 }}>
            <EditableSpan
              field="footer"
              value={tokens.showSwipeHint !== false ? card.footer : ""}
              style={peTinyCaps(ouro, big ? 12 : 10)}
              onEdit={onEditSlot as any}
              placeholder="arraste"
            />
            {ornaments && <PeDiamond color={ouro} size={big ? 8 : 6} />}
            {showPageLabel && <span style={peTinyCaps(ouro, big ? 12 : 10)}>{pageLabel}</span>}
          </div>
        </div>
      </div>
    );
  }

  // ── CLOSING ───────────────────────────────────────────────────────
  if (card.kind === "close") {
    return (
      <div style={styleBase}>
        {imageBlock}
        <div style={textWrapStyle}>
          <EditableSpan
            field="eyebrow"
            value={card.eyebrow}
            style={peTinyCaps(ouro, big ? 13 : 11)}
            onEdit={onEditSlot as any}
            placeholder="FECHAMENTO"
          />
          <PeRule color={ouro} mt={big ? 16 : 12} />

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <EditableSpan
              field="title"
              value={card.title}
              as="div"
              autoFit
              style={{
                fontFamily: '"Playfair Display", serif',
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: big ? 50 : 38,
                lineHeight: 1.05,
                color: areia,
                letterSpacing: -0.8,
                textWrap: "balance" as any,
              }}
              onEdit={onEditSlot as any}
              placeholder="Frase de fechamento"
            />
            <div style={{ height: big ? 18 : 12 }} />
            <EditableSpan
              field="body"
              value={card.body}
              as="div"
              autoFit
              style={{
                fontFamily: bodyFam,
                fontWeight: 400,
                fontStyle: bodyFam.includes("Cormorant") ? "italic" : "normal",
                fontSize: big ? 22 : 18,
                lineHeight: 1.45,
                color: areia,
                opacity: 0.86,
              }}
              onEdit={onEditSlot as any}
              placeholder="Texto de apoio"
            />
          </div>

          <PeRule color={ouro} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: big ? 14 : 10 }}>
            <EditableSpan
              field="cta"
              value={card.cta}
              style={peTinyCaps(ouro, big ? 12 : 10)}
              onEdit={onEditSlot as any}
              placeholder="Chamada à ação"
            />
            <span style={peTinyCaps(ouro, big ? 12 : 10)}>{brandMark}</span>
          </div>
        </div>
      </div>
    );
  }

  // ── CLAUSE ────────────────────────────────────────────────────────
  const numLabel = peRenderNum(card.num, tokens.numberingStyle);
  return (
    <div style={styleBase}>
      {imageBlock}
      <div style={textWrapStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={peTinyCaps(ouro, big ? 13 : 11)}>
            {sectionLabel ? <span>{sectionLabel}&nbsp;·&nbsp;</span> : null}
            <EditableSpan field="topic" value={card.topic} onEdit={onEditSlot as any} placeholder="TÓPICO" />
          </div>
          {showPageLabel && <span style={peTinyCaps(ouro, big ? 12 : 10)}>{pageLabel}</span>}
        </div>
        <PeRule color={ouro} mt={big ? 16 : 12} />

        <div style={{ display: "flex", alignItems: "baseline", gap: big ? 24 : 18, marginTop: big ? 22 : 14 }}>
          <div
            style={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: big ? 132 : 90,
              lineHeight: 0.9,
              color: ouro,
              letterSpacing: -3,
            }}
          >
            {numLabel}
          </div>
          <EditableSpan
            field="title"
            value={card.title}
            as="div"
            autoFit
            style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 400,
              fontSize: big ? 34 : 24,
              lineHeight: 1.08,
              color: areia,
              letterSpacing: -0.3,
              textWrap: "balance" as any,
              flex: 1,
              paddingBottom: big ? 16 : 10,
            }}
            onEdit={onEditSlot as any}
            placeholder="Título da cláusula"
          />
        </div>

        <div style={{ height: big ? 18 : 12 }} />

        <EditableSpan
          field="body"
          value={card.body}
          as="div"
          autoFit
          style={{
            fontFamily: bodyFam,
            fontWeight: 400,
            fontStyle: bodyFam.includes("Cormorant") ? "italic" : "normal",
            fontSize: big ? 22 : 18,
            lineHeight: 1.42,
            color: areia,
            opacity: 0.82,
            textWrap: "pretty" as any,
          }}
          onEdit={onEditSlot as any}
          placeholder="Texto da cláusula"
        />

        <div style={{ flex: 1 }} />

        <PeRule color={ouro} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: big ? 14 : 10 }}>
          <span style={peTinyCaps(ouro, big ? 12 : 10)}>{brandMark}</span>
          {ornaments && <PeDiamond color={ouro} size={big ? 6 : 5} />}
          <span style={peTinyCaps(ouro, big ? 12 : 10)}>{(card.topic || "").toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};

export default HorizonteCard;
