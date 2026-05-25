// Variação A — "Sertão Profundo" do arquétipo Governante.
// Refatoração 1:1 de design-sources/governante/cards-sertao.jsx
// (sem globals window.*, tipado com TypeScript).

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
import { EditableSpan, FitGroup, LogoOverlay, PeDiamond, PeRule } from "./shared";

type SlotField =
  | keyof CoverSlots
  | keyof ClauseSlots
  | keyof CloseSlots;

interface SertaoCardProps {
  card: CardData;
  format: Format;
  tokens?: SertaoTokens;
  /** Índice do slide dentro do carrossel (0..6). Usado para paginação `01/07`. */
  slideIndex?: number;
  /** Total de slides (default 7). */
  totalSlides?: number;
  /** Quando definido, os textos do card viram contentEditable. */
  onEditSlot?: (field: SlotField, value: string) => void;
  /**
   * Nome do negócio do usuário, usado como default do `brandMark` no rodapé
   * dos slides de cláusula. Vem de `business_questionnaires.company_name`.
   * Se vazio, cai para "Posiciona Editorial".
   */
  defaultBrandMark?: string;
}

const SertaoCard: React.FC<SertaoCardProps> = ({
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

  const verde = tokens.verdeBg || VERDE;
  const areia = tokens.areiaInk || AREIA;
  const ouro = tokens.ouroAccent || OURO;

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
    background: verde,
    color: areia,
    position: "relative",
    overflow: "hidden",
    fontFamily: '"Lato", system-ui, sans-serif',
    letterSpacing: 0.02,
  };

  // Camada da logo (PNG transparente). Aparece em todos os kinds.
  const logoNode = (
    <LogoOverlay
      url={tokens.logoUrl}
      show={tokens.showLogo !== false}
      sizePct={typeof tokens.logoSize === "number" ? tokens.logoSize : 18}
      opacity={typeof tokens.logoOpacity === "number" ? tokens.logoOpacity : 1}
      behindText={tokens.logoBehindText === true}
      cardWidth={w}
      cardHeight={h}
    />
  );

  // Paginação derivada do índice do slide (fallback p/ parse de card.num).
  const pageNum =
    typeof slideIndex === "number"
      ? slideIndex + 1
      : card.kind === "clause"
        ? parseInt(card.num, 10) + 1
        : card.kind === "cover"
          ? 1
          : totalSlides;
  // Em post único (totalSlides=1) não faz sentido mostrar "01 / 01".
  const showPageLabel = totalSlides > 1;
  const pageLabel = `${String(pageNum).padStart(2, "0")} / ${String(totalSlides).padStart(2, "0")}`;

  // ── COVER ─────────────────────────────────────────────────────────
  if (card.kind === "cover") {
    // Fallback elegante: quando a IA não entrega kicker + countWord, a capa
    // editorial original fica visualmente esvaziada (vide IMG_4881). Nesse
    // caso renderizamos um layout "editorial enxuto" — eyebrow + régua +
    // título italic grande centralizado + corpo + footer — igual ao close
    // mas reutilizando os slots do cover.
    const hasRichCover = Boolean((card.kicker || "").trim() || (card.countWord || "").trim());
    if (!hasRichCover) {
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
              value={tokens.eyebrowText || card.eyebrow}
              style={peTinyCaps(ouro, big ? 13 : 11)}
              onEdit={onEditSlot}
              placeholder="EYEBROW · CATEGORIA"
            />
            <PeRule color={ouro} mt={big ? 28 : 18} />

            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div
                data-fit-bounds="coverLeanTitle"
                style={{ maxHeight: big ? 320 : 220, overflow: "hidden" }}
              >
                <EditableSpan
                  field="titleLead"
                  value={card.titleLead}
                  as="div"
                  autoFit
                  style={{
                    fontFamily: '"Playfair Display", serif',
                    fontStyle: "italic",
                    fontWeight: 400,
                    fontSize: (big ? 68 : 48) * sCoverTitle,
                    lineHeight: 1.05,
                    color: areia,
                    letterSpacing: -0.8,
                    textWrap: "balance" as any,
                  }}
                  onEdit={onEditSlot}
                  placeholder="Título da capa"
                />
              </div>

              <div style={{ height: big ? 32 : 22 }} />

              <div
                data-fit-bounds="coverLeanBody"
                style={{ maxHeight: big ? 220 : 150, overflow: "hidden" }}
              >
                <EditableSpan
                  field="body"
                  value={(card as any).body || ""}
                  as="div"
                  autoFit
                  style={{
                    fontFamily: bodyFam,
                    fontStyle: bodyFam.includes("Cormorant") ? "italic" : "normal",
                    fontWeight: 400,
                    fontSize: big ? 26 : 20,
                    lineHeight: 1.45,
                    color: areia,
                    opacity: 0.82,
                    textWrap: "pretty" as any,
                  }}
                  onEdit={onEditSlot}
                  placeholder="Corpo de abertura"
                />
              </div>

              {ornaments && (
                <div style={{ marginTop: big ? 48 : 32, display: "flex", alignItems: "center", gap: 14 }}>
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
                field="footer"
                value={tokens.showSwipeHint !== false ? card.footer : ""}
                style={peTinyCaps(ouro, big ? 12 : 10)}
                onEdit={onEditSlot}
                placeholder="arraste"
              />
              {ornaments && <PeDiamond color={ouro} size={big ? 9 : 7} />}
              {showPageLabel && <span style={peTinyCaps(ouro, big ? 12 : 10)}>{pageLabel}</span>}
            </div>
          </div>
          {logoNode}
        </div>
      );
    }

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
            placeholder="EYEBROW · CATEGORIA"
          />
          <PeRule color={ouro} mt={big ? 28 : 18} />

          <div
            data-fit-bounds="kicker"
            style={{ marginTop: big ? 56 : 36, maxHeight: big ? 60 : 42, overflow: "hidden" }}
          >
            <EditableSpan
              field="kicker"
              value={card.kicker}
              as="div"
              autoFit
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
              placeholder="Kicker"
            />
          </div>

          <div
            data-fit-bounds="countWord"
            style={{ marginTop: big ? 18 : 10, maxHeight: big ? 150 : 110, overflow: "hidden" }}
          >
            <EditableSpan
              field="countWord"
              value={card.countWord}
              as="div"
              autoFit
              style={{
                fontFamily: '"Playfair Display", serif',
                fontWeight: 500,
                fontStyle: "italic",
                fontSize: (big ? 132 : 96) * sCoverCount,
                lineHeight: 0.9,
                color: areia,
                letterSpacing: -1.5,
              }}
              onEdit={onEditSlot}
              placeholder="Sete"
            />
          </div>

          <div
            data-fit-bounds="titleLead"
            style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 400,
              fontSize: (big ? 38 : 28) * sCoverTitle,
              lineHeight: 1.15,
              color: areia,
              marginTop: big ? 22 : 14,
              letterSpacing: -0.2,
              textWrap: "pretty" as any,
              maxHeight: big ? 220 : 150,
              overflow: "hidden",
            }}
          >
            <EditableSpan
              field="titleLead"
              value={card.titleLead}
              autoFit
              onEdit={onEditSlot}
              placeholder="Título principal da capa"
            />
            {card.titleTail || onEditSlot ? (
              <>
                {card.titleTail ? (
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
                ) : null}
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
                  placeholder="complemento"
                />
              </>
            ) : null}
          </div>

          <div
            data-fit-bounds="coverBody"
            style={{ marginTop: big ? 28 : 18, maxHeight: big ? 180 : 110, overflow: "hidden" }}
          >
            <EditableSpan
              field="body"
              value={(card as any).body || ""}
              as="div"
              autoFit
              style={{
                fontFamily: bodyFam,
                fontStyle: bodyFam.includes("Cormorant") ? "italic" : "normal",
                fontWeight: 400,
                fontSize: big ? 24 : 18,
                lineHeight: 1.4,
                color: areia,
                opacity: 0.78,
                textWrap: "pretty" as any,
              }}
              onEdit={onEditSlot}
              placeholder="Corpo de abertura"
            />
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
              value={tokens.showSwipeHint !== false ? card.footer : ""}
              style={peTinyCaps(ouro, big ? 12 : 10)}
              onEdit={onEditSlot}
              placeholder="arraste"
            />
            {ornaments && <PeDiamond color={ouro} size={big ? 9 : 7} />}
            {showPageLabel && <span style={peTinyCaps(ouro, big ? 12 : 10)}>{pageLabel}</span>}
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
            placeholder="FECHAMENTO"
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
            <div
              data-fit-bounds="closeTitle"
              style={{ maxHeight: big ? 260 : 180, overflow: "hidden" }}
            >
              <EditableSpan
                field="title"
                value={card.title}
                as="div"
                autoFit
                style={{
                  fontFamily: '"Playfair Display", serif',
                  fontStyle: "italic",
                  fontWeight: 400,
                  fontSize: (big ? 72 : 52) * sCloseTitle,
                  lineHeight: 1.05,
                  color: areia,
                  letterSpacing: -1,
                  textWrap: "balance" as any,
                }}
                onEdit={onEditSlot}
                placeholder="Frase final"
              />
            </div>

            <div style={{ height: big ? 36 : 24 }} />

            <div
              data-fit-bounds="closeBody"
              style={{ maxHeight: big ? 220 : 150, overflow: "hidden" }}
            >
              <EditableSpan
                field="body"
                value={card.body}
                as="div"
                autoFit
                style={{
                  fontFamily: bodyFam,
                  fontWeight: 400,
                  fontSize: (big ? 28 : 22) * sCloseBody,
                  lineHeight: 1.45,
                  color: areia,
                  opacity: 0.86,
                  textWrap: "pretty" as any,
                  fontStyle: bodyFam.includes("Cormorant") ? "italic" : "normal",
                }}
                onEdit={onEditSlot}
                placeholder="Texto de apoio do fechamento"
              />
            </div>


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
              placeholder="Chamada para ação"
            />
            {showPageLabel && <span style={peTinyCaps(ouro, big ? 12 : 10)}>{pageLabel}</span>}
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
            {sectionLabel ? <span>{sectionLabel}&nbsp;·&nbsp;</span> : null}
            <EditableSpan
              field="topic"
              value={card.topic}
              onEdit={onEditSlot}
              placeholder="TÓPICO"
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

        <div
          data-fit-bounds="clauseTitle"
          style={{ marginTop: big ? 36 : 24, maxHeight: big ? 180 : 120, overflow: "hidden" }}
        >
          <EditableSpan
            field="title"
            value={card.title}
            as="div"
            autoFit
            style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 400,
              fontSize: big ? 48 : 36,
              lineHeight: 1.08,
              color: areia,
              letterSpacing: -0.4,
              textWrap: "balance" as any,
            }}
            onEdit={onEditSlot}
            placeholder="Título da cláusula"
          />
        </div>

        <div style={{ height: big ? 24 : 16 }} />

        <div
          data-fit-bounds="clauseBody"
          style={{ maxHeight: big ? 260 : 170, overflow: "hidden" }}
        >
          <EditableSpan
            field="body"
            value={card.body}
            as="div"
            autoFit
            style={{
              fontFamily: bodyFam,
              fontWeight: 400,
              fontStyle: bodyFam.includes("Cormorant") ? "italic" : "normal",
              fontSize: (big ? 26 : 21) * sClauseBody,
              lineHeight: 1.4,
              color: areia,
              opacity: 0.78,
              textWrap: "pretty" as any,
            }}
            onEdit={onEditSlot}
            placeholder="Texto da cláusula"
          />
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
          <span style={peTinyCaps(ouro, big ? 12 : 10)}>{brandMark}</span>
          {ornaments && <PeDiamond color={ouro} size={big ? 7 : 5} />}
          {showPageLabel && <span style={peTinyCaps(ouro, big ? 12 : 10)}>{pageLabel}</span>}
        </div>
      </div>
      {logoNode}
    </div>
  );
};

export default SertaoCard;
