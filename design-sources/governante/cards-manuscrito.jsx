// cards-manuscrito.jsx — Variação C: Manuscrito
// Split panel — verde top, areia bottom (split position shifts per card),
// big gold serif numeral straddling the seam. Most "art-directed" of the three.

const { PE_PALETTE: MnPalette, PE_FORMATS: MnFormats,
        PeEyebrow: MnEyebrow, PeRule: MnRule, PeDiamond: MnDiamond,
        peTinyCaps: mnTinyCaps, peBodyFontFor: mnBodyFont,
        peRenderNum: mnRenderNum } = window;

// Split ratio per card index (cover…close) — creates carousel rhythm.
const MN_SPLITS = {
  cover: 0.62,   // verde dominates cover
  '01':  0.32,
  '02':  0.42,
  '03':  0.30,
  '04':  0.46,
  '05':  0.36,
  close: 0.28,
};

function ManuscritoCard({ card, format, t }) {
  const { w, h } = MnFormats[format];
  const big = format === '9:16';
  const PAD_X = big ? 60 : 50;
  const PAD_Y = big ? 70 : 48;

  const verde = t.verdeBg || MnPalette.verde;
  const areia = t.areiaBg || MnPalette.areia;
  const ouro  = t.ouroAccent || MnPalette.ouro;
  const mogno = t.mognoAccent || MnPalette.mogno;
  const grafite = MnPalette.grafite;

  const ornaments = t.showOrnaments !== false;
  const bodyFam = mnBodyFont(t.bodyFont);
  const numLabel = mnRenderNum(card.num, t.numberingStyle);

  const splitKey = card.kind === 'cover' ? 'cover' :
                   card.kind === 'close' ? 'close' : card.num;
  const splitRatio = MN_SPLITS[splitKey] ?? 0.4;
  const splitY = Math.round(h * splitRatio);

  const styleBase = {
    width: w, height: h,
    background: areia, color: grafite,
    position: 'relative', overflow: 'hidden',
    fontFamily: '"Lato", system-ui, sans-serif',
  };

  // Common verde top + areia bottom split
  const split = (
    <React.Fragment>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0,
        height: splitY, background: verde }} />
      <div style={{ position: 'absolute', top: splitY - 0.5, left: 0, right: 0,
        height: 1, background: ouro }} />
    </React.Fragment>
  );

  // ── COVER ─────────────────────────────────────────────────────────
  if (card.kind === 'cover') {
    return (
      <div style={styleBase}>
        {split}
        {/* upper area — verde */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0,
          height: splitY, padding: `${PAD_Y}px ${PAD_X}px`,
          display: 'flex', flexDirection: 'column',
          color: areia, boxSizing: 'border-box',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline' }}>
            <span style={mnTinyCaps(ouro, big ? 12 : 10)}>{t.eyebrowText || card.eyebrow}</span>
            <span style={mnTinyCaps(ouro, big ? 12 : 10)}>MMXXVI</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{
            fontFamily: '"Cormorant Garamond", serif',
            fontStyle: 'italic', fontWeight: 400,
            fontSize: big ? 44 : 32,
            color: ouro, lineHeight: 1,
          }}>{card.kicker}</div>
          <div style={{ height: big ? 16 : 10 }} />
          <div style={{
            fontFamily: '"Playfair Display", serif',
            fontStyle: 'italic', fontWeight: 500,
            fontSize: big ? 156 : 116, lineHeight: 0.86,
            color: areia, letterSpacing: -3,
          }}>{card.countWord}</div>
        </div>

        {/* lower area — areia */}
        <div style={{ position: 'absolute', top: splitY, left: 0, right: 0, bottom: 0,
          padding: `${big ? 44 : 30}px ${PAD_X}px ${PAD_Y}px`,
          display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        }}>
          <div style={{
            fontFamily: '"Playfair Display", serif',
            fontWeight: 400, fontSize: big ? 40 : 30,
            lineHeight: 1.12, color: verde,
            letterSpacing: -0.3, textWrap: 'pretty',
          }}>{card.titleLead}</div>
          <div style={{
            fontFamily: '"Cormorant Garamond", serif',
            fontStyle: 'italic',
            fontSize: big ? 28 : 22,
            lineHeight: 1.3, color: grafite, opacity: 0.78,
            marginTop: big ? 14 : 10,
          }}>{card.titleTail}.</div>

          <div style={{ flex: 1 }} />

          <MnRule color={mogno} opacity={0.5} />
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginTop: big ? 14 : 10 }}>
            <span style={mnTinyCaps(mogno, big ? 12 : 10)}>
              {t.showSwipeHint !== false ? card.footer : '\u00A0'}
            </span>
            {ornaments && <MnDiamond color={mogno} size={big ? 8 : 6} />}
            <span style={mnTinyCaps(mogno, big ? 12 : 10)}>I — VII</span>
          </div>
        </div>
      </div>
    );
  }

  // ── CLOSING ───────────────────────────────────────────────────────
  if (card.kind === 'close') {
    return (
      <div style={styleBase}>
        {split}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0,
          height: splitY, padding: `${PAD_Y}px ${PAD_X}px`,
          color: areia, display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', boxSizing: 'border-box',
        }}>
          <span style={mnTinyCaps(ouro, big ? 12 : 10)}>{card.eyebrow}</span>
          <span style={mnTinyCaps(ouro, big ? 12 : 10)}>VII / VII</span>
        </div>

        <div style={{ position: 'absolute', top: splitY, left: 0, right: 0, bottom: 0,
          padding: `${big ? 60 : 44}px ${PAD_X}px ${PAD_Y}px`,
          display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        }}>
          {ornaments && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: big ? 24 : 16 }}>
              <MnDiamond color={ouro} size={big ? 12 : 10} />
              <div style={{ height: 1, width: big ? 64 : 48, background: ouro, opacity: 0.6 }} />
            </div>
          )}
          <div style={{
            fontFamily: '"Playfair Display", serif',
            fontStyle: 'italic', fontWeight: 500,
            fontSize: big ? 80 : 58,
            lineHeight: 1.02, color: verde,
            letterSpacing: -1.2, textWrap: 'balance',
          }}>{card.title}</div>
          <div style={{ height: big ? 30 : 20 }} />
          <div style={{
            fontFamily: bodyFam, fontWeight: 400,
            fontStyle: bodyFam.includes('Cormorant') ? 'italic' : 'normal',
            fontSize: big ? 28 : 22, lineHeight: 1.45,
            color: grafite, opacity: 0.88,
            maxWidth: '88%',
          }}>{card.body}</div>

          <div style={{ flex: 1 }} />

          <MnRule color={mogno} opacity={0.5} />
          <div style={{ marginTop: big ? 14 : 10,
            display: 'flex', justifyContent: 'space-between' }}>
            <span style={mnTinyCaps(verde, big ? 13 : 11)}>{card.cta}</span>
            <span style={mnTinyCaps(mogno, big ? 12 : 10)}>Posiciona Editorial</span>
          </div>
        </div>
      </div>
    );
  }

  // ── CLAUSE ────────────────────────────────────────────────────────
  // Upper verde band has eyebrow + topic. Big gold numeral STRADDLES the seam.
  // Lower areia has title + body. The numeral is positioned absolutely so it
  // bleeds across both bands — that's the manuscrito's signature move.
  const numFontSize = big ? 280 : 210;
  const numOffsetTop = splitY - numFontSize * 0.62;  // numeral baseline lands on seam
  return (
    <div style={styleBase}>
      {split}

      {/* upper band — verde with eyebrow */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0,
        height: splitY, padding: `${PAD_Y}px ${PAD_X}px 0`,
        color: areia, boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'baseline' }}>
          <span style={mnTinyCaps(ouro, big ? 12 : 10)}>
            CLÁUSULA &nbsp;·&nbsp; {card.topic}
          </span>
          <span style={mnTinyCaps(ouro, big ? 12 : 10)}>
            {String(parseInt(card.num) + 1).padStart(2, '0')} / 07
          </span>
        </div>
      </div>

      {/* the giant numeral — straddles the seam */}
      <div style={{
        position: 'absolute',
        top: numOffsetTop, right: PAD_X,
        fontFamily: '"Playfair Display", serif',
        fontStyle: 'italic', fontWeight: 500,
        fontSize: numFontSize, lineHeight: 1,
        color: ouro, letterSpacing: -6,
        pointerEvents: 'none',
        textShadow: '0 0 0 transparent',
      }}>{numLabel}</div>

      {/* lower band — areia with title + body */}
      <div style={{ position: 'absolute', top: splitY, left: 0, right: 0, bottom: 0,
        padding: `${big ? 56 : 38}px ${PAD_X}px ${PAD_Y}px`,
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
      }}>
        <div style={{
          fontFamily: '"Cormorant Garamond", serif',
          fontStyle: 'italic', fontSize: big ? 26 : 20,
          color: mogno, letterSpacing: 0.4,
          marginBottom: big ? 10 : 6,
        }}>{card.topic.toLowerCase()}</div>
        <div style={{
          fontFamily: '"Playfair Display", serif',
          fontWeight: 400,
          fontSize: big ? 48 : 36,
          lineHeight: 1.06, color: verde,
          letterSpacing: -0.4, textWrap: 'balance',
          maxWidth: '85%',
        }}>{card.title}</div>
        <div style={{ height: big ? 22 : 14 }} />
        <div style={{
          fontFamily: bodyFam, fontWeight: 400,
          fontStyle: bodyFam.includes('Cormorant') ? 'italic' : 'normal',
          fontSize: big ? 26 : 21, lineHeight: 1.42,
          color: grafite, opacity: 0.82, textWrap: 'pretty',
          maxWidth: '88%',
        }}>{card.body}</div>

        <div style={{ flex: 1 }} />

        <MnRule color={mogno} opacity={0.5} />
        <div style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginTop: big ? 14 : 10 }}>
          <span style={mnTinyCaps(verde, big ? 12 : 10)}>Releia antes de assinar</span>
          {ornaments && <MnDiamond color={mogno} size={big ? 7 : 5} />}
          <span style={mnTinyCaps(mogno, big ? 12 : 10)}>Posiciona Editorial</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ManuscritoCard });
