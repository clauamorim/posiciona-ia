// Variação C — "Manuscrito" do arquétipo Governante.
// Refatoração 1:1 de design-sources/governante/cards-manuscrito.jsx.
//
// Visual: split panel — metade superior na cor "verdeBg" (escura),
// metade inferior na cor "areiaInk" (clara). Numeral dourado gigante
// atravessa a divisão. A proporção do split varia por card (cria
// ritmo de carrossel). É a variação mais "art-directed".

import React from "react";
import type {
  CardData,
  ClauseSlots,
  CloseSlots,
  CoverSlots,
  Format,
  SertaoTokens,
} from "./types";
import { AREIA, FORMATS, MOGNO, OURO, VERDE, peBodyFontFor, peRenderNum, peTinyCaps } from "./tokens";
import { EditableSpan, FitGroup, LogoOverlay, PeDiamond, PeRule, pickBodyColor } from "./shared";

type SlotField = keyof CoverSlots | keyof ClauseSlots | keyof CloseSlots;

interface ManuscritoCardProps {
  card: CardData;
  format: Format;
  tokens?: SertaoTokens;
  slideIndex?: number;
  totalSlides?: number;
  onEditSlot?: (field: SlotField, value: string) => void;
  defaultBrandMark?: string;
}

// Proporção do split por card — cria ritmo visual ao longo do carrossel.
const SPLIT_RATIOS: Record<string, number> = {
  cover: 0.62,
  "01": 0.32,
  "02": 0.42,
  "03": 0.3,
  "04": 0.46,
  "05": 0.36,
  close: 0.28,
};

const ManuscritoCard: React.FC<ManuscritoCardProps> = ({
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
  const PAD_Y = big ? 70 : 48;

  const verde = tokens.verdeBg || VERDE; // top
  const areia = tokens.areiaInk || AREIA; // bottom
  const ouro = tokens.ouroAccent || OURO;
  const mogno = tokens.secondaryAccent || tokens.ouroAccent || MOGNO;
  // O body sempre aparece na faixa inferior (cor `areia`). Se essa for
  // escura (arquétipo energia), body precisa ser claro; caso contrário,
  // grafite. Sem isso, o texto ficava ilegível em paletas escuras.
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
  const numLabel = card.kind === "clause" ? peRenderNum(card.num, tokens.numberingStyle) : "";
  const showPageLabel = totalSlides > 1;

  const splitKey =
    card.kind === "cover" ? "cover" : card.kind === "close" ? "close" : card.num;
  const splitRatio = SPLIT_RATIOS[splitKey] ?? 0.4;
  const splitY = Math.round(h * splitRatio);

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

  const split = (
    <>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: splitY, background: verde }} />
      <div style={{ position: "absolute", top: splitY - 0.5, left: 0, right: 0, height: 1, background: ouro }} />
    </>
  );

  const pageLabel = `${
    typeof slideIndex === "number"
      ? String(slideIndex + 1).padStart(2, "0")
      : card.kind === "clause"
        ? String(parseInt(card.num, 10) + 1).padStart(2, "0")
        : card.kind === "cover"
          ? "01"
          : String(totalSlides).padStart(2, "0")
  } / ${String(totalSlides).padStart(2, "0")}`;

  // ── COVER ─────────────────────────────────────────────────────────
  if (card.kind === "cover") {
    return (
      <div style={styleBase}>
        {split}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: splitY,
            padding: `${PAD_Y}px ${PAD_X}px`,
            display: "flex",
            flexDirection: "column",
            color: areia,
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <EditableSpan field="eyebrow" value={tokens.eyebrowText || card.eyebrow} style={peTinyCaps(ouro, big ? 12 : 10)} onEdit={onEditSlot as any} placeholder="EYEBROW" />
            {showPageLabel && <span style={peTinyCaps(ouro, big ? 12 : 10)}>MMXXVI</span>}
          </div>
          <div style={{ flex: 1 }} />
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
              lineHeight: 1,
            }}
            onEdit={onEditSlot as any}
            placeholder="Kicker"
          />
          <div style={{ height: big ? 16 : 10 }} />
          <EditableSpan
            field="countWord"
            value={card.countWord}
            as="div"
            style={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: "italic",
              fontWeight: 500,
              fontSize: (big ? 156 : 116) * sCoverCount,
              lineHeight: 0.86,
              color: areia,
              letterSpacing: -3,
            }}
            onEdit={onEditSlot as any}
            placeholder="Sete"
          />
        </div>

        <div
          style={{
            position: "absolute",
            top: splitY,
            left: 0,
            right: 0,
            bottom: 0,
            padding: `${big ? 44 : 30}px ${PAD_X}px ${PAD_Y}px`,
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
          }}
        >
          {/* titleLead + titleTail dentro do FitGroup pra escalar juntos. */}
          <FitGroup>
            <EditableSpan
              field="titleLead"
              value={card.titleLead}
              as="div"
              style={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 400,
                fontSize: (big ? 40 : 30) * sCoverTitle,
                lineHeight: 1.12,
                color: verde,
                letterSpacing: -0.3,
                textWrap: "pretty" as any,
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
                marginTop: big ? 14 : 10,
              }}
              onEdit={onEditSlot as any}
              placeholder="complemento"
            />
          </FitGroup>

          <PeRule color={mogno} opacity={0.5} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: big ? 14 : 10 }}>
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
        {split}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: splitY,
            padding: `${PAD_Y}px ${PAD_X}px`,
            color: areia,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxSizing: "border-box",
          }}
        >
          <EditableSpan field="eyebrow" value={card.eyebrow} style={peTinyCaps(ouro, big ? 12 : 10)} onEdit={onEditSlot as any} placeholder="FECHAMENTO" />
          {showPageLabel && <span style={peTinyCaps(ouro, big ? 12 : 10)}>VII / VII</span>}
        </div>

        <div
          style={{
            position: "absolute",
            top: splitY,
            left: 0,
            right: 0,
            bottom: 0,
            padding: `${big ? 60 : 44}px ${PAD_X}px ${PAD_Y}px`,
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
          }}
        >
          {ornaments && (
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: big ? 24 : 16 }}>
              <PeDiamond color={ouro} size={big ? 12 : 10} />
              <div style={{ height: 1, width: big ? 64 : 48, background: ouro, opacity: 0.6 }} />
            </div>
          )}
          {/* FitGroup mede title+spacer+body como um conjunto e aplica
              scale uniforme se extrapolar. Substitui o auto-fit por
              elemento — que falhava quando o overflow vinha da SOMA dos
              elementos (cada um sozinho cabia, mas combinados não). */}
          <FitGroup>
            <EditableSpan
              field="title"
              value={card.title}
              as="div"
              style={{
                fontFamily: '"Playfair Display", serif',
                fontStyle: "italic",
                fontWeight: 500,
                fontSize: (big ? 80 : 58) * sCloseTitle,
                lineHeight: 1.02,
                color: verde,
                letterSpacing: -1.2,
                textWrap: "balance" as any,
              }}
              onEdit={onEditSlot as any}
              placeholder="Frase de fechamento"
            />
            <div style={{ height: big ? 30 : 20 }} />
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

          <PeRule color={mogno} opacity={0.5} />
          <div style={{ marginTop: big ? 14 : 10, display: "flex", justifyContent: "space-between" }}>
            <EditableSpan field="cta" value={card.cta} style={peTinyCaps(verde, big ? 13 : 11)} onEdit={onEditSlot as any} placeholder="Chamada à ação" />
            <span style={peTinyCaps(mogno, big ? 12 : 10)}>{brandMark}</span>
          </div>
        </div>
        {logoNode}
      </div>
    );
  }

  // ── CLAUSE ────────────────────────────────────────────────────────
  // Numeral gigante atravessa a divisória entre verde (topo) e areia (base).
  const numFontSize = big ? 280 : 210;
  const numOffsetTop = splitY - numFontSize * 0.62;

  return (
    <div style={styleBase}>
      {split}

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: splitY,
          padding: `${PAD_Y}px ${PAD_X}px 0`,
          color: areia,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={peTinyCaps(ouro, big ? 12 : 10)}>
            {sectionLabel ? <span>{sectionLabel}&nbsp;·&nbsp;</span> : null}
            <EditableSpan field="topic" value={card.topic} onEdit={onEditSlot as any} placeholder="TÓPICO" />
          </div>
          {showPageLabel && <span style={peTinyCaps(ouro, big ? 12 : 10)}>{pageLabel}</span>}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          top: numOffsetTop,
          right: PAD_X,
          fontFamily: '"Playfair Display", serif',
          fontStyle: "italic",
          fontWeight: 500,
          fontSize: numFontSize,
          lineHeight: 1,
          color: ouro,
          letterSpacing: -6,
          pointerEvents: "none",
          textShadow: "0 0 0 transparent",
        }}
      >
        {numLabel}
      </div>

      <div
        style={{
          position: "absolute",
          top: splitY,
          left: 0,
          right: 0,
          bottom: 0,
          padding: `${big ? 56 : 38}px ${PAD_X}px ${PAD_Y}px`,
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
        }}
      >
        {/* topic-italic + title + body envolvidos no FitGroup pra escala
            conjunta. O topic-italic é decorativo (cor mogno suave) e
            também encolhe junto se preciso. */}
        <FitGroup>
          <div style={{ fontFamily: '"Cormorant Garamond", serif', fontStyle: "italic", fontSize: big ? 26 : 20, color: mogno, letterSpacing: 0.4, marginBottom: big ? 10 : 6 }}>
            {(card.topic || "").toLowerCase()}
          </div>
          <EditableSpan
            field="title"
            value={card.title}
            as="div"
            style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 400,
              fontSize: big ? 48 : 36,
              lineHeight: 1.06,
              color: verde,
              letterSpacing: -0.4,
              textWrap: "balance" as any,
              maxWidth: "85%",
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
              fontSize: (big ? 26 : 21) * sClauseBody,
              lineHeight: 1.42,
              color: bodyColor,
              opacity: 0.82,
              textWrap: "pretty" as any,
              maxWidth: "88%",
            }}
            onEdit={onEditSlot as any}
            placeholder="Texto da cláusula"
          />
        </FitGroup>

        <PeRule color={mogno} opacity={0.5} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: big ? 14 : 10 }}>
          <span style={peTinyCaps(verde, big ? 12 : 10)}>Releia antes de assinar</span>
          {ornaments && <PeDiamond color={mogno} size={big ? 7 : 5} />}
          <span style={peTinyCaps(mogno, big ? 12 : 10)}>{brandMark}</span>
        </div>
      </div>
      {logoNode}
    </div>
  );
};

export default ManuscritoCard;
