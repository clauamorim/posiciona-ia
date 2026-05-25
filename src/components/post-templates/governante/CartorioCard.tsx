// Variação B — "Cartório de Bolso" do arquétipo Governante.
// Refatoração 1:1 de design-sources/governante/cards-cartorio.jsx
// (sem globals window.*, tipado).
//
// Visual: fundo claro (verdeBg renderiza como base "areia"), título em
// "areiaInk" (cor escura forte), numeração e detalhes em "ouroAccent"
// (renderiza como o mogno marrom-bronze original). Grafite (#2C2C2C)
// fica hardcoded como body — readability em qualquer paleta clara.

import React from "react";
import type {
  CardData,
  ClauseSlots,
  CloseSlots,
  CoverSlots,
  Format,
  SertaoTokens,
} from "./types";
import { AREIA, FORMATS, MOGNO, VERDE, peBodyFontFor, peRenderNum, peTinyCaps } from "./tokens";
import { EditableSpan, FitGroup, LogoOverlay, PeDiamond, PeRule, pickBodyColor } from "./shared";

type SlotField = keyof CoverSlots | keyof ClauseSlots | keyof CloseSlots;

interface CartorioCardProps {
  card: CardData;
  format: Format;
  tokens?: SertaoTokens;
  slideIndex?: number;
  totalSlides?: number;
  onEditSlot?: (field: SlotField, value: string) => void;
  defaultBrandMark?: string;
}

const CartorioCard: React.FC<CartorioCardProps> = ({
  card,
  format,
  tokens = {},
  onEditSlot,
  slideIndex,
  totalSlides = 7,
  defaultBrandMark,
}) => {
  const sectionLabel = (tokens.sectionLabel ?? "CLÁUSULA").trim();
  const brandMark = (tokens.brandMark ?? defaultBrandMark ?? "Posiciona Editorial").trim();
  const { w, h } = FORMATS[format];
  const big = format === "9:16";
  const PAD_X = big ? 60 : 50;
  const PAD_Y = big ? 86 : 56;

  // Token roles em Cartório:
  // - verdeBg => fundo claro (areia)
  // - areiaInk => título / cor forte (verde)
  // - ouroAccent => detalhes / numerais (mogno)
  const areia = tokens.verdeBg || AREIA;
  const verde = tokens.areiaInk || VERDE;
  const mogno = tokens.ouroAccent || MOGNO;
  // Cor de body dinâmica: precisa contrastar com o bg. Em paletas claras
  // (elegância), grafite escuro. Em paletas escuras (energia), cremoso.
  const bodyColor = pickBodyColor(areia, "#2C2C2C", "#F5F0E8");

  const ornaments = tokens.showOrnaments !== false;
  const bodyFam = peBodyFontFor(tokens.bodyFont);
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

  // Camada da logo (igual nos 3 kinds).
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
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(120% 80% at 50% 0%, rgba(27,58,45,0.045) 0%, rgba(27,58,45,0) 50%)",
          }}
        />
        <div style={{ position: "absolute", inset: `${PAD_Y}px ${PAD_X}px`, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <EditableSpan field="eyebrow" value={tokens.eyebrowText || card.eyebrow} style={peTinyCaps(mogno, big ? 12 : 10)} onEdit={onEditSlot as any} placeholder="EYEBROW · CATEGORIA" />
            {showPageLabel && <span style={peTinyCaps(mogno, big ? 12 : 10)}>2026</span>}
          </div>
          <PeRule color={mogno} mt={big ? 22 : 14} />

          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <EditableSpan
              field="kicker"
              value={card.kicker}
              as="div"
              style={{
                fontFamily: '"Cormorant Garamond", serif',
                fontStyle: "italic",
                fontWeight: 400,
                fontSize: big ? 38 : 28,
                color: mogno,
                lineHeight: 1,
                marginBottom: big ? 18 : 12,
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
                fontSize: (big ? 168 : 120) * sCoverCount,
                lineHeight: 0.86,
                color: verde,
                letterSpacing: -3,
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
                fontSize: (big ? 40 : 30) * sCoverTitle,
                lineHeight: 1.12,
                color: verde,
                marginTop: big ? 26 : 18,
                letterSpacing: -0.3,
                textWrap: "pretty" as any,
                maxWidth: "92%",
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
                fontSize: big ? 28 : 22,
                lineHeight: 1.3,
                color: bodyColor,
                opacity: 0.78,
                marginTop: big ? 16 : 10,
                maxWidth: "88%",
              }}
              onEdit={onEditSlot as any}
              placeholder="complemento do título"
            />
          </div>

          <PeRule color={mogno} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: big ? 16 : 10 }}>
            <EditableSpan
              field="footer"
              value={tokens.showSwipeHint !== false ? card.footer : ""}
              style={peTinyCaps(mogno, big ? 12 : 10)}
              onEdit={onEditSlot as any}
              placeholder="arraste"
            />
            {ornaments && <PeDiamond color={mogno} size={big ? 8 : 6} />}
            {showPageLabel && <span style={peTinyCaps(mogno, big ? 12 : 10)}>I — VII</span>}
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
        <div style={{ position: "absolute", inset: `${PAD_Y}px ${PAD_X}px`, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <EditableSpan field="eyebrow" value={card.eyebrow} style={peTinyCaps(mogno, big ? 12 : 10)} onEdit={onEditSlot as any} placeholder="FECHAMENTO" />
            {showPageLabel && <span style={peTinyCaps(mogno, big ? 12 : 10)}>VII / VII</span>}
          </div>
          <PeRule color={mogno} mt={big ? 22 : 14} />

          {/* FitGroup mede o conjunto ornaments+spacer+title+spacer+body e
              aplica scale uniforme quando o conjunto extrapola — resolve
              o caso onde cada elemento cabe sozinho mas a soma não. */}
          <FitGroup style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {ornaments && <PeDiamond color={mogno} size={big ? 12 : 10} />}
            <div style={{ height: big ? 36 : 26 }} />
            <EditableSpan
              field="title"
              value={card.title}
              as="div"
              style={{
                fontFamily: '"Playfair Display", serif',
                fontStyle: "italic",
                fontWeight: 500,
                fontSize: (big ? 76 : 56) * sCloseTitle,
                lineHeight: 1.02,
                color: verde,
                letterSpacing: -1.2,
                textWrap: "balance" as any,
              }}
              onEdit={onEditSlot as any}
              placeholder="Frase de fechamento"
            />
            <div style={{ height: big ? 32 : 22 }} />
            <EditableSpan
              field="body"
              value={card.body}
              as="div"
              style={{
                fontFamily: bodyFam,
                fontWeight: 400,
                fontStyle: bodyFam.includes("Cormorant") ? "italic" : "normal",
                fontSize: (big ? 28 : 22) * sCloseBody,
                lineHeight: 1.45,
                color: bodyColor,
                opacity: 0.88,
                maxWidth: "88%",
              }}
              onEdit={onEditSlot as any}
              placeholder="Texto de apoio"
            />
          </FitGroup>

          <PeRule color={mogno} />
          <div style={{ marginTop: big ? 16 : 10, display: "flex", justifyContent: "space-between" }}>
            <EditableSpan field="cta" value={card.cta} style={peTinyCaps(verde, big ? 13 : 11)} onEdit={onEditSlot as any} placeholder="Chamada à ação" />
            <span style={peTinyCaps(mogno, big ? 12 : 10)}>{brandMark}</span>
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
      <div style={{ position: "absolute", inset: `${PAD_Y}px ${PAD_X}px`, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={peTinyCaps(mogno, big ? 12 : 10)}>
            {sectionLabel ? <span>{sectionLabel}&nbsp;·&nbsp;</span> : null}
            <EditableSpan field="topic" value={card.topic} onEdit={onEditSlot as any} placeholder="TÓPICO" />
          </div>
          {showPageLabel && <span style={peTinyCaps(mogno, big ? 12 : 10)}>{pageLabel}</span>}
        </div>
        <PeRule color={mogno} mt={big ? 22 : 14} />

        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: big ? 40 : 28, alignContent: "center", alignItems: "start", paddingTop: big ? 40 : 24 }}>
          <div style={{ fontFamily: '"Playfair Display", serif', fontStyle: "italic", fontWeight: 500, fontSize: big ? 240 : 180, lineHeight: 0.78, color: mogno, letterSpacing: -6, alignSelf: "start", marginTop: -8 }}>
            {numLabel}
          </div>
          {/* FitGroup envolve title+body do clause — mesmo motivo do close. */}
          <FitGroup style={{ display: "flex", flexDirection: "column", justifyContent: "flex-start", paddingTop: big ? 18 : 10 }}>
            <EditableSpan
              field="title"
              value={card.title}
              as="div"
              style={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 400,
                fontSize: big ? 44 : 32,
                lineHeight: 1.08,
                color: verde,
                letterSpacing: -0.3,
                textWrap: "balance" as any,
              }}
              onEdit={onEditSlot as any}
              placeholder="Título da cláusula"
            />
            <div style={{ height: big ? 22 : 14 }} />
            <EditableSpan
              field="body"
              value={card.body}
              as="div"
              style={{
                fontFamily: bodyFam,
                fontWeight: 400,
                fontStyle: bodyFam.includes("Cormorant") ? "italic" : "normal",
                fontSize: (big ? 26 : 20) * sClauseBody,
                lineHeight: 1.42,
                color: bodyColor,
                opacity: 0.82,
                textWrap: "pretty" as any,
              }}
              onEdit={onEditSlot as any}
              placeholder="Texto da cláusula"
            />
          </FitGroup>
        </div>

        <PeRule color={mogno} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: big ? 16 : 10 }}>
          <span style={peTinyCaps(verde, big ? 12 : 10)}>Releia antes de assinar</span>
          {ornaments && <PeDiamond color={mogno} size={big ? 7 : 5} />}
          <span style={peTinyCaps(mogno, big ? 12 : 10)}>{brandMark}</span>
        </div>
      </div>
      {logoNode}
    </div>
  );
};

export default CartorioCard;
