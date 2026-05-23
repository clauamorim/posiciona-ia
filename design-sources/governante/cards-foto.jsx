// cards-foto.jsx — Governante com foto.
// Duas variações adicionais:
//   HorizonteCard — foto horizontal no topo, paleta Sertão Profundo (dark)
//   RetratoCard   — foto vertical (lateral em 4:5, topo em 9:16), Cartório (light)

const { PE_PALETTE: FtPalette, PE_FORMATS: FtFormats,
        PeEyebrow: FtEyebrow, PeRule: FtRule, PeDiamond: FtDiamond,
        peTinyCaps: ftTinyCaps, peBodyFontFor: ftBodyFont,
        peRenderNum: ftRenderNum } = window;

// Each card gets a stable slot id shared across 4:5 and 9:16, so dropping
// an image once fills both formats of the same card.
function slotId(prefix, card) {
  if (card.kind === 'cover') return `${prefix}-cover`;
  if (card.kind === 'close') return `${prefix}-close`;
  return `${prefix}-c${card.num}`;
}

function imagePlaceholder(card) {
  if (card.kind === 'cover')  return 'foto · escritório, autor ou propriedade';
  if (card.kind === 'close')  return 'foto · autor ou assinatura';
  const byTopic = {
    PRAZO: 'foto · agenda, calendário, marca-página',
    REAJUSTE: 'foto · sacas, balança, mercado',
    BENFEITORIAS: 'foto · benfeitoria, cerca, obra',
    'MEIO AMBIENTE': 'foto · reserva, mata, licenciamento',
    RESCISÃO: 'foto · cancelamento, fórum, papelada',
  };
  return byTopic[card.topic] || 'foto da cláusula';
}

// ═══════════════════════════════════════════════════════════════════
// HorizonteCard — foto horizontal no topo, paleta Sertão Profundo
// ═══════════════════════════════════════════════════════════════════
function HorizonteCard({ card, format, t }) {
  const { w, h } = FtFormats[format];
  const big = format === '9:16';
  const IMG_H = big ? 400 : 270;
  const PAD_X = big ? 56 : 44;
  const PAD_Y = big ? 40 : 28;

  const verde = t.verdeBg || FtPalette.verde;
  const areia = t.areiaInk || FtPalette.areia;
  const ouro  = t.ouroAccent || FtPalette.ouro;
  const bodyFam = ftBodyFont(t.bodyFont);
  const numLabel = ftRenderNum(card.num, t.numberingStyle);
  const ornaments = t.showOrnaments !== false;
  const idx = card.kind === 'clause' ? parseInt(card.num) : null;

  const baseStyle = {
    width: w, height: h,
    background: verde, color: areia,
    position: 'relative', overflow: 'hidden',
    fontFamily: '"Lato", system-ui, sans-serif',
  };

  // Image slot — sits at the very top, full width
  const ImageBlock = ({ id }) => (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: IMG_H, background: '#0E2A20',
    }}>
      <image-slot
        id={id}
        style={{ display: 'block', width: '100%', height: '100%' }}
        shape="rect"
        placeholder={imagePlaceholder(card)}
        fit="cover"
      />
      {/* gold hairline framing the photo */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 1, background: ouro, opacity: 0.85 }} />
    </div>
  );

  // ── COVER ─────────────────────────────────────────────────────────
  if (card.kind === 'cover') {
    return (
      <div style={baseStyle}>
        <ImageBlock id={slotId('gov-horiz', card)} />

        <div style={{
          position: 'absolute', top: IMG_H, left: 0, right: 0, bottom: 0,
          padding: `${PAD_Y + 10}px ${PAD_X}px ${PAD_Y}px`,
          display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        }}>
          <FtEyebrow color={ouro} size={big ? 13 : 11}>
            {t.eyebrowText || card.eyebrow}
          </FtEyebrow>
          <FtRule color={ouro} mt={big ? 16 : 12} />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center' }}>
            <div style={{
              fontFamily: '"Cormorant Garamond", serif',
              fontStyle: 'italic', fontWeight: 400,
              fontSize: big ? 34 : 26, color: ouro,
              letterSpacing: 0.5, lineHeight: 1,
            }}>{card.kicker}</div>
            <div style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 500, fontStyle: 'italic',
              fontSize: big ? 88 : 64, lineHeight: 0.92,
              color: areia, letterSpacing: -1.5,
              marginTop: big ? 8 : 6,
            }}>{card.countWord}</div>
            <div style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 400, fontSize: big ? 26 : 20,
              lineHeight: 1.2, color: areia,
              marginTop: big ? 14 : 10,
              textWrap: 'pretty', maxWidth: '94%',
            }}>{card.titleLead} <span style={{
              fontFamily: '"Cormorant Garamond", serif',
              fontStyle: 'italic', opacity: 0.7,
            }}>— {card.titleTail}</span></div>
          </div>

          <FtRule color={ouro} />
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginTop: big ? 14 : 10 }}>
            <span style={ftTinyCaps(ouro, big ? 12 : 10)}>
              {t.showSwipeHint !== false ? card.footer : '\u00A0'}
            </span>
            {ornaments && <FtDiamond color={ouro} size={big ? 8 : 6} />}
            <span style={ftTinyCaps(ouro, big ? 12 : 10)}>01 / 07</span>
          </div>
        </div>
      </div>
    );
  }

  // ── CLOSE ─────────────────────────────────────────────────────────
  if (card.kind === 'close') {
    return (
      <div style={baseStyle}>
        <ImageBlock id={slotId('gov-horiz', card)} />

        <div style={{
          position: 'absolute', top: IMG_H, left: 0, right: 0, bottom: 0,
          padding: `${PAD_Y + 10}px ${PAD_X}px ${PAD_Y}px`,
          display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        }}>
          <FtEyebrow color={ouro} size={big ? 13 : 11}>{card.eyebrow}</FtEyebrow>
          <FtRule color={ouro} mt={big ? 16 : 12} />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center' }}>
            <div style={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: 'italic', fontWeight: 400,
              fontSize: big ? 50 : 38, lineHeight: 1.05,
              color: areia, letterSpacing: -0.8, textWrap: 'balance',
            }}>{card.title}</div>
            <div style={{ height: big ? 18 : 12 }} />
            <div style={{
              fontFamily: bodyFam, fontWeight: 400,
              fontStyle: bodyFam.includes('Cormorant') ? 'italic' : 'normal',
              fontSize: big ? 22 : 18, lineHeight: 1.45,
              color: areia, opacity: 0.86,
            }}>{card.body}</div>
          </div>

          <FtRule color={ouro} />
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginTop: big ? 14 : 10 }}>
            <span style={ftTinyCaps(ouro, big ? 12 : 10)}>{card.cta}</span>
            <span style={ftTinyCaps(ouro, big ? 12 : 10)}>07 / 07</span>
          </div>
        </div>
      </div>
    );
  }

  // ── CLAUSE ────────────────────────────────────────────────────────
  return (
    <div style={baseStyle}>
      <ImageBlock id={slotId('gov-horiz', card)} />

      <div style={{
        position: 'absolute', top: IMG_H, left: 0, right: 0, bottom: 0,
        padding: `${PAD_Y + 10}px ${PAD_X}px ${PAD_Y}px`,
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'baseline' }}>
          <FtEyebrow color={ouro} size={big ? 13 : 11}>
            CLÁUSULA &nbsp;·&nbsp; {card.topic}
          </FtEyebrow>
          <span style={ftTinyCaps(ouro, big ? 12 : 10)}>
            {String(idx + 1).padStart(2, '0')} / 07
          </span>
        </div>
        <FtRule color={ouro} mt={big ? 16 : 12} />

        <div style={{ display: 'flex', alignItems: 'baseline',
          gap: big ? 24 : 18, marginTop: big ? 22 : 14 }}>
          <div style={{
            fontFamily: '"Playfair Display", serif',
            fontStyle: 'italic', fontWeight: 500,
            fontSize: big ? 132 : 90, lineHeight: 0.9,
            color: ouro, letterSpacing: -3,
          }}>{numLabel}</div>
          <div style={{
            fontFamily: '"Playfair Display", serif',
            fontWeight: 400,
            fontSize: big ? 34 : 24, lineHeight: 1.08,
            color: areia, letterSpacing: -0.3,
            textWrap: 'balance', flex: 1,
            paddingBottom: big ? 16 : 10,
          }}>{card.title}</div>
        </div>

        <div style={{ height: big ? 18 : 12 }} />

        <div style={{
          fontFamily: bodyFam, fontWeight: 400,
          fontStyle: bodyFam.includes('Cormorant') ? 'italic' : 'normal',
          fontSize: big ? 22 : 18, lineHeight: 1.42,
          color: areia, opacity: 0.82, textWrap: 'pretty',
        }}>{card.body}</div>

        <div style={{ flex: 1 }} />

        <FtRule color={ouro} />
        <div style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginTop: big ? 14 : 10 }}>
          <span style={ftTinyCaps(ouro, big ? 12 : 10)}>Posiciona Editorial</span>
          {ornaments && <FtDiamond color={ouro} size={big ? 6 : 5} />}
          <span style={ftTinyCaps(ouro, big ? 12 : 10)}>{card.topic}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RetratoCard — foto vertical, paleta Cartório de Bolso (light)
// 4:5  → foto à esquerda × 4/9 da largura
// 9:16 → foto no topo × 5/8 da altura
// ═══════════════════════════════════════════════════════════════════
function RetratoCard({ card, format, t }) {
  const { w, h } = FtFormats[format];
  const big = format === '9:16';

  // Image geometry
  const IMG_W = big ? w : Math.round(w * 0.44);                  // 4:5 side
  const IMG_H = big ? Math.round(h * 0.58) : h;                  // 4:5 full height
  const TXT_LEFT = big ? 0 : IMG_W;
  const TXT_TOP  = big ? IMG_H : 0;
  const TXT_W = big ? w : (w - IMG_W);
  const TXT_H = big ? (h - IMG_H) : h;

  const PAD_X = big ? 44 : 28;
  const PAD_Y = big ? 36 : 36;

  const areia   = t.areiaBg || FtPalette.areia;
  const verde   = t.verdeInk || FtPalette.verde;
  const grafite = FtPalette.grafite;
  const mogno   = t.mognoAccent || FtPalette.mogno;
  const bodyFam = ftBodyFont(t.bodyFont);
  const numLabel = ftRenderNum(card.num, t.numberingStyle);
  const ornaments = t.showOrnaments !== false;
  const idx = card.kind === 'clause' ? parseInt(card.num) : null;

  const baseStyle = {
    width: w, height: h,
    background: areia, color: grafite,
    position: 'relative', overflow: 'hidden',
    fontFamily: '"Lato", system-ui, sans-serif',
  };

  // Vertical image block
  const ImageBlock = ({ id }) => (
    <div style={{
      position: 'absolute',
      top: 0, left: 0, width: IMG_W, height: IMG_H,
      background: '#E4DCC4',
    }}>
      <image-slot
        id={id}
        style={{ display: 'block', width: '100%', height: '100%' }}
        shape="rect"
        placeholder={imagePlaceholder(card)}
        fit="cover"
      />
      {/* mogno hairline framing the photo */}
      <div style={{ position: 'absolute',
        ...(big
          ? { bottom: 0, left: 0, right: 0, height: 1 }
          : { top: 0, bottom: 0, right: 0, width: 1 }),
        background: mogno, opacity: 0.7 }} />
    </div>
  );

  // Text area helper to position content uniformly
  const TextArea = ({ children }) => (
    <div style={{
      position: 'absolute',
      top: TXT_TOP, left: TXT_LEFT, width: TXT_W, height: TXT_H,
      padding: `${PAD_Y}px ${PAD_X}px`,
      display: 'flex', flexDirection: 'column',
      boxSizing: 'border-box',
    }}>{children}</div>
  );

  // ── COVER ─────────────────────────────────────────────────────────
  if (card.kind === 'cover') {
    return (
      <div style={baseStyle}>
        <ImageBlock id={slotId('gov-retr', card)} />
        <TextArea>
          <span style={ftTinyCaps(mogno, big ? 12 : 9)}>
            {t.eyebrowText || card.eyebrow}
          </span>
          <div style={{ height: 1, background: mogno, opacity: 0.6,
            marginTop: big ? 14 : 10 }} />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center' }}>
            <div style={{
              fontFamily: '"Cormorant Garamond", serif',
              fontStyle: 'italic', fontWeight: 400,
              fontSize: big ? 32 : 20, color: mogno,
              lineHeight: 1, marginBottom: big ? 12 : 6,
            }}>{card.kicker}</div>
            <div style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 500, fontStyle: 'italic',
              fontSize: big ? 116 : 64, lineHeight: 0.92,
              color: verde, letterSpacing: -2,
            }}>{card.countWord}</div>
            <div style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 400, fontSize: big ? 28 : 20,
              lineHeight: 1.18, color: verde,
              marginTop: big ? 18 : 12,
              textWrap: 'pretty', maxWidth: '94%',
            }}>{card.titleLead}</div>
            <div style={{
              fontFamily: '"Cormorant Garamond", serif',
              fontStyle: 'italic',
              fontSize: big ? 22 : 16, lineHeight: 1.32,
              color: grafite, opacity: 0.78,
              marginTop: big ? 10 : 6, maxWidth: '92%',
            }}>{card.titleTail}.</div>
          </div>

          <div style={{ height: 1, background: mogno, opacity: 0.6 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginTop: big ? 12 : 8 }}>
            <span style={ftTinyCaps(mogno, big ? 12 : 9)}>
              {t.showSwipeHint !== false ? card.footer : '\u00A0'}
            </span>
            {ornaments && <FtDiamond color={mogno} size={big ? 7 : 5} />}
            <span style={ftTinyCaps(mogno, big ? 12 : 9)}>I — VII</span>
          </div>
        </TextArea>
      </div>
    );
  }

  // ── CLOSE ─────────────────────────────────────────────────────────
  if (card.kind === 'close') {
    return (
      <div style={baseStyle}>
        <ImageBlock id={slotId('gov-retr', card)} />
        <TextArea>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline' }}>
            <span style={ftTinyCaps(mogno, big ? 12 : 9)}>{card.eyebrow}</span>
            <span style={ftTinyCaps(mogno, big ? 12 : 9)}>VII / VII</span>
          </div>
          <div style={{ height: 1, background: mogno, opacity: 0.6,
            marginTop: big ? 14 : 10 }} />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center' }}>
            <div style={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: 'italic', fontWeight: 500,
              fontSize: big ? 52 : 30, lineHeight: 1.04,
              color: verde, letterSpacing: -0.8, textWrap: 'balance',
            }}>{card.title}</div>
            <div style={{ height: big ? 22 : 14 }} />
            <div style={{
              fontFamily: bodyFam, fontWeight: 400,
              fontStyle: bodyFam.includes('Cormorant') ? 'italic' : 'normal',
              fontSize: big ? 22 : 16, lineHeight: 1.42,
              color: grafite, opacity: 0.88,
            }}>{card.body}</div>
          </div>

          <div style={{ height: 1, background: mogno, opacity: 0.6 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between',
            marginTop: big ? 12 : 8 }}>
            <span style={ftTinyCaps(verde, big ? 12 : 9)}>{card.cta}</span>
            <span style={ftTinyCaps(mogno, big ? 12 : 9)}>Posiciona</span>
          </div>
        </TextArea>
      </div>
    );
  }

  // ── CLAUSE ────────────────────────────────────────────────────────
  return (
    <div style={baseStyle}>
      <ImageBlock id={slotId('gov-retr', card)} />
      <TextArea>
        <div style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'baseline' }}>
          <span style={ftTinyCaps(mogno, big ? 12 : 9)}>
            CLÁUSULA · {card.topic}
          </span>
          <span style={ftTinyCaps(mogno, big ? 12 : 9)}>
            {String(idx + 1).padStart(2, '0')}/07
          </span>
        </div>
        <div style={{ height: 1, background: mogno, opacity: 0.5,
          marginTop: big ? 14 : 10 }} />

        <div style={{ marginTop: big ? 22 : 16, display: 'flex',
          alignItems: 'baseline', gap: big ? 18 : 10 }}>
          <div style={{
            fontFamily: '"Playfair Display", serif',
            fontStyle: 'italic', fontWeight: 500,
            fontSize: big ? 116 : 64, lineHeight: 0.88,
            color: mogno, letterSpacing: -3,
          }}>{numLabel}</div>
          <div style={{
            fontFamily: '"Playfair Display", serif',
            fontWeight: 400,
            fontSize: big ? 30 : 18, lineHeight: 1.06,
            color: verde, letterSpacing: -0.3,
            textWrap: 'balance', flex: 1,
            paddingBottom: big ? 14 : 6,
          }}>{card.title}</div>
        </div>

        <div style={{ height: big ? 16 : 10 }} />

        <div style={{
          fontFamily: bodyFam, fontWeight: 400,
          fontStyle: bodyFam.includes('Cormorant') ? 'italic' : 'normal',
          fontSize: big ? 20 : 14, lineHeight: 1.4,
          color: grafite, opacity: 0.82, textWrap: 'pretty',
        }}>{card.body}</div>

        <div style={{ flex: 1 }} />

        <div style={{ height: 1, background: mogno, opacity: 0.5 }} />
        <div style={{ marginTop: big ? 12 : 8,
          display: 'flex', justifyContent: 'space-between' }}>
          <span style={ftTinyCaps(verde, big ? 11 : 9)}>Releia antes de assinar</span>
          <span style={ftTinyCaps(mogno, big ? 11 : 9)}>Posiciona</span>
        </div>
      </TextArea>
    </div>
  );
}

Object.assign(window, { HorizonteCard, RetratoCard });
