// cards-cartorio.jsx — Variação B: Cartório de Bolso
// Areia base (cream), Verde for titles, Grafite body, Mogno number accents.
// Asymmetric grid with the clause number as a giant left-edge mark.

const { PE_PALETTE: CtPalette, PE_FORMATS: CtFormats,
        PeEyebrow: CtEyebrow, PeRule: CtRule, PeDiamond: CtDiamond,
        peTinyCaps: ctTinyCaps, peBodyFontFor: ctBodyFont,
        peRenderNum: ctRenderNum } = window;

function CartorioCard({ card, format, t }) {
  const { w, h } = CtFormats[format];
  const big = format === '9:16';
  const PAD_X = big ? 60 : 50;
  const PAD_Y = big ? 86 : 56;

  const areia   = t.areiaBg || CtPalette.areia;
  const verde   = t.verdeInk || CtPalette.verde;
  const grafite = CtPalette.grafite;
  const mogno   = t.mognoAccent || CtPalette.mogno;

  const numLabel = ctRenderNum(card.num, t.numberingStyle);
  const ornaments = t.showOrnaments !== false;
  const bodyFam = ctBodyFont(t.bodyFont);

  const styleBase = {
    width: w, height: h,
    background: areia, color: grafite,
    position: 'relative', overflow: 'hidden',
    fontFamily: '"Lato", system-ui, sans-serif',
  };

  // ── COVER ─────────────────────────────────────────────────────────
  if (card.kind === 'cover') {
    return (
      <div style={styleBase}>
        <div style={{ position: 'absolute', inset: 0, background:
          'radial-gradient(120% 80% at 50% 0%, rgba(27,58,45,0.045) 0%, rgba(27,58,45,0) 50%)' }} />

        <div style={{ position: 'absolute', inset: `${PAD_Y}px ${PAD_X}px`,
          display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline' }}>
            <span style={ctTinyCaps(mogno, big ? 12 : 10)}>{t.eyebrowText || card.eyebrow}</span>
            <span style={ctTinyCaps(mogno, big ? 12 : 10)}>2026</span>
          </div>
          <CtRule color={mogno} mt={big ? 22 : 14} />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center' }}>
            <div style={{
              fontFamily: '"Cormorant Garamond", serif',
              fontStyle: 'italic', fontWeight: 400,
              fontSize: big ? 38 : 28, color: mogno,
              lineHeight: 1, marginBottom: big ? 18 : 12,
            }}>{card.kicker}</div>

            <div style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 500, fontStyle: 'italic',
              fontSize: big ? 168 : 120, lineHeight: 0.86,
              color: verde, letterSpacing: -3,
            }}>{card.countWord}</div>

            <div style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 400, fontSize: big ? 40 : 30,
              lineHeight: 1.12, color: verde,
              marginTop: big ? 26 : 18,
              letterSpacing: -0.3, textWrap: 'pretty',
              maxWidth: '92%',
            }}>{card.titleLead}</div>

            <div style={{
              fontFamily: '"Cormorant Garamond", serif',
              fontStyle: 'italic',
              fontSize: big ? 28 : 22,
              lineHeight: 1.3, color: grafite, opacity: 0.78,
              marginTop: big ? 16 : 10, maxWidth: '88%',
            }}>{card.titleTail}.</div>
          </div>

          <CtRule color={mogno} />
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', marginTop: big ? 16 : 10 }}>
            <span style={ctTinyCaps(mogno, big ? 12 : 10)}>
              {t.showSwipeHint !== false ? card.footer : '\u00A0'}
            </span>
            {ornaments && <CtDiamond color={mogno} size={big ? 8 : 6} />}
            <span style={ctTinyCaps(mogno, big ? 12 : 10)}>I — VII</span>
          </div>
        </div>
      </div>
    );
  }

  // ── CLOSING ───────────────────────────────────────────────────────
  if (card.kind === 'close') {
    return (
      <div style={styleBase}>
        <div style={{ position: 'absolute', inset: `${PAD_Y}px ${PAD_X}px`,
          display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline' }}>
            <span style={ctTinyCaps(mogno, big ? 12 : 10)}>{card.eyebrow}</span>
            <span style={ctTinyCaps(mogno, big ? 12 : 10)}>VII / VII</span>
          </div>
          <CtRule color={mogno} mt={big ? 22 : 14} />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column',
            justifyContent: 'center' }}>
            {ornaments && <CtDiamond color={mogno} size={big ? 12 : 10} />}
            <div style={{ height: big ? 36 : 26 }} />
            <div style={{
              fontFamily: '"Playfair Display", serif',
              fontStyle: 'italic', fontWeight: 500,
              fontSize: big ? 76 : 56,
              lineHeight: 1.02, color: verde,
              letterSpacing: -1.2, textWrap: 'balance',
            }}>{card.title}</div>
            <div style={{ height: big ? 32 : 22 }} />
            <div style={{
              fontFamily: bodyFam, fontWeight: 400,
              fontStyle: bodyFam.includes('Cormorant') ? 'italic' : 'normal',
              fontSize: big ? 28 : 22, lineHeight: 1.45,
              color: grafite, opacity: 0.88,
              maxWidth: '88%',
            }}>{card.body}</div>
          </div>

          <CtRule color={mogno} />
          <div style={{ marginTop: big ? 16 : 10,
            display: 'flex', justifyContent: 'space-between' }}>
            <span style={ctTinyCaps(verde, big ? 13 : 11)}>{card.cta}</span>
            <span style={ctTinyCaps(mogno, big ? 12 : 10)}>Posiciona Editorial</span>
          </div>
        </div>
      </div>
    );
  }

  // ── CLAUSE ────────────────────────────────────────────────────────
  return (
    <div style={styleBase}>
      <div style={{ position: 'absolute', inset: `${PAD_Y}px ${PAD_X}px`,
        display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'baseline' }}>
          <span style={ctTinyCaps(mogno, big ? 12 : 10)}>
            CLÁUSULA &nbsp;·&nbsp; {card.topic}
          </span>
          <span style={ctTinyCaps(mogno, big ? 12 : 10)}>
            {String(parseInt(card.num) + 1).padStart(2, '0')} / 07
          </span>
        </div>
        <CtRule color={mogno} mt={big ? 22 : 14} />

        <div style={{ flex: 1, display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          columnGap: big ? 40 : 28,
          alignContent: 'center', alignItems: 'start',
          paddingTop: big ? 40 : 24,
        }}>
          <div style={{
            fontFamily: '"Playfair Display", serif',
            fontStyle: 'italic', fontWeight: 500,
            fontSize: big ? 240 : 180, lineHeight: 0.78,
            color: mogno, letterSpacing: -6,
            alignSelf: 'start', marginTop: -8,
          }}>{numLabel}</div>

          <div style={{ display: 'flex', flexDirection: 'column',
            justifyContent: 'flex-start', paddingTop: big ? 18 : 10 }}>
            <div style={{
              fontFamily: '"Playfair Display", serif',
              fontWeight: 400, fontSize: big ? 44 : 32,
              lineHeight: 1.08, color: verde,
              letterSpacing: -0.3, textWrap: 'balance',
            }}>{card.title}</div>
            <div style={{ height: big ? 22 : 14 }} />
            <div style={{
              fontFamily: bodyFam, fontWeight: 400,
              fontStyle: bodyFam.includes('Cormorant') ? 'italic' : 'normal',
              fontSize: big ? 26 : 20, lineHeight: 1.42,
              color: grafite, opacity: 0.82, textWrap: 'pretty',
            }}>{card.body}</div>

            {big && (
              <React.Fragment>
                <div style={{ height: 26 }} />
                <div style={{
                  fontFamily: '"Lato", sans-serif',
                  fontWeight: 400, fontSize: 19, lineHeight: 1.5,
                  color: grafite, opacity: 0.6,
                  borderLeft: `2px solid ${mogno}`,
                  paddingLeft: 16, textWrap: 'pretty',
                }}>{card.detail}</div>
              </React.Fragment>
            )}
          </div>
        </div>

        <CtRule color={mogno} />
        <div style={{ display: 'flex', justifyContent: 'space-between',
          marginTop: big ? 16 : 10 }}>
          <span style={ctTinyCaps(verde, big ? 12 : 10)}>Releia antes de assinar</span>
          {ornaments && <CtDiamond color={mogno} size={big ? 7 : 5} />}
          <span style={ctTinyCaps(mogno, big ? 12 : 10)}>Posiciona Editorial</span>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { CartorioCard });
