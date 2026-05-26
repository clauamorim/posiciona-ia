// Variação E — "Retrato" do arquétipo Governante.
// Portado de design-sources/governante/cards-foto.jsx (RetratoCard).
//
// Visual: foto VERTICAL.
//  - Em 4:5  → foto à esquerda (≈44% da largura), texto à direita
//  - Em 9:16 → foto no topo (≈58% da altura), texto embaixo
// Paleta clara (areia/verde/mogno) — mesmo esqueleto do Cartório.
//
// Default recomendado para POST ÚNICO (em vez de carrossel), porque a
// proporção da foto à esquerda funciona bem com uma só "página" de
// conteúdo e o usuário pode usar fotos próprias (do Retrato de Marca
// dele, por exemplo).

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
  MOGNO,
  VERDE,
  peBodyFontFor,
  peRenderNum,
  peTinyCaps,
} from "./tokens";
import { EditableSpan, LogoOverlay, PeDiamond, pickBodyColor, PhotoSlot } from "./shared";

type SlotField =
  | keyof CoverSlots
  | keyof ClauseSlots
  | keyof CloseSlots;

interface RetratoCardProps {
  card: CardData;
  format: Format;
  tokens?: SertaoTokens;
  slideIndex?: number;
  totalSlides?: number;
  onEditSlot?: (field: SlotField, value: string) => void;
  defaultBrandMark?: string;
  /** URL da foto desse slide. */
  imageUrl?: string | null;
  /** object-position CSS aplicado na foto (ex: "50% 30%"). */
  imagePosition?: string | null;
  /** Callback quando o usuário arrasta a foto pra reposicionar. */
  onImagePositionChange?: (next: string) => void;
}

function imagePlaceholder(card: CardData): string {
  if (card.kind === "cover") return "foto · capa";
  if (card.kind === "close") return "foto · autor";
  const topic = (card.topic || "").trim();
  return topic ? `foto · ${topic}` : "foto da cláusula";
}

const RetratoCard: React.FC<RetratoCardProps> = ({
  card,
  format,
  tokens = {},
  onEditSlot,
  slideIndex,
  totalSlides = 7,
  defaultBrandMark,
  imageUrl,
  imagePosition,
  onImagePositionChange,
}) => {
  const sectionLabel = (tokens.sectionLabel ?? "CLÁUSULA").trim();
  const brandMark = (tokens.brandMark ?? defaultBrandMark ?? "Posiciona Editorial").trim();
  const { w, h } = FORMATS[format];
  const big = format === "9:16";

  // Geometria da foto: em 4:5 fica à esquerda (44% da largura, altura total);
  // em 9:16 fica no topo (58% da altura, largura total).
  const IMG_W = big ? w : Math.round(w * 0.44);
  const IMG_H = big ? Math.round(h * 0.58) : h;
  const TXT_LEFT = big ? 0 : IMG_W;
  const TXT_TOP = big ? IMG_H : 0;
  const TXT_W = big ? w : w - IMG_W;
  const TXT_H = big ? h - IMG_H : h;

  const PAD_X = big ? 44 : 28;
  const PAD_Y = big ? 36 : 36;

  // Cartório-style: bg claro (areia), tinta forte (verde escuro), accent mogno.
  // Em Retrato, `verdeBg` do token vira o ACCENT/INK (verde escuro do título),
  // `areiaInk` vira o BG (areia clara) — invertendo o sentido habitual.
  const areia = tokens.verdeBg || AREIA;
  const verde = tokens.areiaInk || VERDE;
  const mogno = tokens.ouroAccent || MOGNO;
  // Body se adapta à luminância do bg (mesmo helper usado em Cartório/Manuscrito).
  const bodyColor = pickBodyColor(areia, "#2C2C2C", "#F5F0E8");
  const bodyFam = peBodyFontFor(tokens.bodyFont);
  const ornaments = tokens.showOrnaments !== false;
  const clamp = (v: number | undefined, min = 0.6, max = 1.4) =>
    typeof v === "number" && isFinite(v) ? Math.min(max, Math.max(min, v)) : 1;
  const sCloseTitle = clamp(tokens.closeTitleScale);
  const sCloseBody = clamp(tokens.closeBodyScale);
  const sCoverTitle = clamp(tokens.coverTitleScale);
  const sCoverCount = clamp(tokens.coverCountScale);
  const sClauseBody = clamp(tokens.clauseBodyScale);

  const styleBase: React.CSSProperties = {
    width: w,
    height: h,
    background: areia,
    color: bodyColor,
    position: "relative",
    overflow: "hidden",
    fontFamily: '"Lato", system-ui, sans-serif',
  };

  // Camada da logo controlada via tokens. Mesma instância em todos os 3 kinds.
  const logoNode = (
    <LogoOverlay
      url={tokens.logoUrl}
      show={tokens.showLogo !== false}
      sizePct={typeof tokens.logoSize === "number" ? tokens.logoSize : 18}
      opacity={typeof tokens.logoOpacity === "number" ? tokens.logoOpacity : 1}
      behindText={tokens.logoBehindText === true}
      cardWidth={w}
      cardHeight={h}
      logoX={tokens.logoX}
      logoY={tokens.logoY}
    />
  );

  // Bloco da foto — esquerda (4:5) ou topo (9:16).
  const imageBlock = (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: IMG_W,
        height: IMG_H,
      }}
    >
      <PhotoSlot
        url={imageUrl}
        placeholder={imagePlaceholder(card)}
        frameColor={mogno}
        frameSide={big ? "bottom" : "right"}
        fallbackBg="#E4DCC4"
        placeholderColor={verde}
        objectPosition={imagePosition ?? undefined}
        onPositionChange={onImagePositionChange}
      />
    </div>
  );

  // Área de texto, posicionada conforme orientação.
  const textWrapStyle: React.CSSProperties = {
    position: "absolute",
    top: TXT_TOP,
    left: TXT_LEFT,
    width: TXT_W,
    height: TXT_H,
    padding: `${PAD_Y}px ${PAD_X}px`,
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
  };

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

  // ── COVER ─────────────────────────────────────────────────────────
  if (card.kind === "cover") {
    return (
      <div style={styleBase}>
        {imageBlock}
        <div style={textWrapStyle}>
          <EditableSpan
            field="eyebrow"
            value={tokens.eyebrowText || card.eyebrow}
            style={peTinyCaps(mogno, big ? 12 : 9)}
            onEdit={onEditSlot as any}
            placeholder="EYEBROW"
          />
          <div style={{ height: 1, background: mogno, opacity: 0.6, marginTop: big ? 14 : 10 }} />

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <EditableSpan
              field="kicker"
              value={card.kicker}
              as="div"
              style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: big ? 32 : 20,
                color: mogno,
                lineHeight: 1,
                marginBottom: big ? 12 : 6,
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
                fontSize: (big ? 116 : 64) * sCoverCount,
                lineHeight: 0.92,
                color: verde,
                letterSpacing: -2,
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
                fontSize: (big ? 28 : 20) * sCoverTitle,
                lineHeight: 1.18,
                color: verde,
                marginTop: big ? 18 : 12,
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
                fontSize: big ? 22 : 16,
                lineHeight: 1.32,
                color: bodyColor,
                opacity: 0.78,
                marginTop: big ? 10 : 6,
                maxWidth: "92%",
              }}
              onEdit={onEditSlot as any}
              placeholder="complemento"
            />
            {((card as any).body || onEditSlot) && (
              <EditableSpan
                field="body"
                value={(card as any).body || ""}
                as="div"
                autoFit
                style={{
                  fontFamily: bodyFam,
                  fontWeight: 400,
                  fontStyle: bodyFam.includes("Cormorant") ? "italic" : "normal",
                  fontSize: big ? 18 : 13,
                  lineHeight: 1.45,
                  color: bodyColor,
                  opacity: 0.72,
                  marginTop: big ? 14 : 8,
                  maxWidth: "94%",
                  textWrap: "pretty" as any,
                }}
                onEdit={onEditSlot as any}
                placeholder="Corpo de abertura"
              />
            )}
          </div>

          <div style={{ height: 1, background: mogno, opacity: 0.6 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: big ? 12 : 8 }}>
            <EditableSpan
              field="footer"
              value={tokens.showSwipeHint !== false ? card.footer : ""}
              style={peTinyCaps(mogno, big ? 12 : 9)}
              onEdit={onEditSlot as any}
              placeholder="arraste"
            />
            {ornaments && <PeDiamond color={mogno} size={big ? 7 : 5} />}
            {showPageLabel && <span style={peTinyCaps(mogno, big ? 12 : 9)}>I — VII</span>}
          </div>
        </div>
        {logoNode}
      </div>
    );
  }

  // ── CLOSING ───────────────────────────────────────────────────────
  if (card.kind === "close") {
    return (
      <div style={styleBase}>
        {imageBlock}
        <div style={textWrapStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <EditableSpan
              field="eyebrow"
              value={card.eyebrow}
              style={peTinyCaps(mogno, big ? 12 : 9)}
              onEdit={onEditSlot as any}
              placeholder="FECHAMENTO"
            />
            {showPageLabel && <span style={peTinyCaps(mogno, big ? 12 : 9)}>VII / VII</span>}
          </div>
          <div style={{ height: 1, background: mogno, opacity: 0.6, marginTop: big ? 14 : 10 }} />

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <EditableSpan
              field="title"
              value={card.title}
              as="div"
              autoFit
              style={{
                fontFamily: '"Playfair Display", serif',
                fontStyle: "italic",
                fontWeight: 500,
                fontSize: (big ? 52 : 30) * sCloseTitle,
                lineHeight: 1.04,
                color: verde,
                letterSpacing: -0.8,
                textWrap: "balance" as any,
              }}
              onEdit={onEditSlot as any}
              placeholder="Frase de fechamento"
            />
            <div style={{ height: big ? 22 : 14 }} />
            <EditableSpan
              field="body"
              value={card.body}
              as="div"
              autoFit
              style={{
                fontFamily: bodyFam,
                fontWeight: 400,
                fontStyle: bodyFam.includes("Cormorant") ? "italic" : "normal",
                fontSize: (big ? 22 : 16) * sCloseBody,
                lineHeight: 1.42,
                color: bodyColor,
                opacity: 0.88,
              }}
              onEdit={onEditSlot as any}
              placeholder="Texto de apoio"
            />
          </div>

          <div style={{ height: 1, background: mogno, opacity: 0.6 }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: big ? 12 : 8 }}>
            <EditableSpan
              field="cta"
              value={card.cta}
              style={peTinyCaps(verde, big ? 12 : 9)}
              onEdit={onEditSlot as any}
              placeholder="Chamada à ação"
            />
            <span style={peTinyCaps(mogno, big ? 12 : 9)}>{brandMark}</span>
          </div>
        </div>
        {logoNode}
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
          <div style={peTinyCaps(mogno, big ? 12 : 9)}>
            {sectionLabel ? <span>{sectionLabel}&nbsp;·&nbsp;</span> : null}
            <EditableSpan field="topic" value={card.topic} onEdit={onEditSlot as any} placeholder="TÓPICO" />
          </div>
          {showPageLabel && <span style={peTinyCaps(mogno, big ? 12 : 9)}>{pageLabel}</span>}
        </div>
        <div style={{ height: 1, background: mogno, opacity: 0.5, marginTop: big ? 14 : 10 }} />

        <div style={{ marginTop: big ? 22 : 16, display: "flex", alignItems: "baseline", gap: big ? 18 : 10 }}>
          <div
            style={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: big ? 116 : 64,
              lineHeight: 0.88,
              color: mogno,
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
              fontSize: big ? 30 : 18,
              lineHeight: 1.06,
              color: verde,
              letterSpacing: -0.3,
              textWrap: "balance" as any,
              flex: 1,
              paddingBottom: big ? 14 : 6,
            }}
            onEdit={onEditSlot as any}
            placeholder="Título da cláusula"
          />
        </div>

        <div style={{ height: big ? 16 : 10 }} />

        <EditableSpan
          field="body"
          value={card.body}
          as="div"
          autoFit
          style={{
            fontFamily: bodyFam,
            fontWeight: 400,
            fontStyle: bodyFam.includes("Cormorant") ? "italic" : "normal",
            fontSize: (big ? 20 : 14) * sClauseBody,
            lineHeight: 1.4,
            color: bodyColor,
            opacity: 0.82,
            textWrap: "pretty" as any,
          }}
          onEdit={onEditSlot as any}
          placeholder="Texto da cláusula"
        />

        <div style={{ flex: 1 }} />

        <div style={{ height: 1, background: mogno, opacity: 0.5 }} />
        <div style={{ marginTop: big ? 12 : 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={peTinyCaps(verde, big ? 11 : 9)}>Releia antes de assinar</span>
          {ornaments && <PeDiamond color={mogno} size={big ? 6 : 5} />}
          <span style={peTinyCaps(mogno, big ? 11 : 9)}>{brandMark}</span>
        </div>
      </div>
      {logoNode}
    </div>
  );
};

export default RetratoCard;
