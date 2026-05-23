// app.jsx — composes the 3 variations × 2 formats × 7 cards in a DesignCanvas
// with a Tweaks panel for live token adjustments.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "verdeBg": "#1B3A2D",
  "ouroAccent": "#C9A84C",
  "areiaBg": "#F5F0E8",
  "mognoAccent": "#8B4513",
  "verdeInk": "#1B3A2D",
  "areiaInk": "#F5F0E8",
  "bodyFont": "cormorant",
  "numberingStyle": "decimal",
  "eyebrowText": "POSICIONA EDITORIAL · DIREITO DO AGRO",
  "showOrnaments": true,
  "showSwipeHint": true,
  "showProgress": true
}/*EDITMODE-END*/;

const { SertaoCard, CartorioCard, ManuscritoCard, HorizonteCard, RetratoCard,
        PE_CARDS, PE_FORMATS } = window;

const VARIATIONS = [
  { id: 'sertao',     name: 'Sertão Profundo',
    subtitle: 'Verde Cerrado · Ouro do Sertão · contraste alto',
    Comp: SertaoCard },
  { id: 'cartorio',   name: 'Cartório de Bolso',
    subtitle: 'Areia Fina · Verde Cerrado · grade assimétrica',
    Comp: CartorioCard },
  { id: 'manuscrito', name: 'Manuscrito',
    subtitle: 'Painel dividido · numeral atravessa a costura',
    Comp: ManuscritoCard },
  { id: 'horizonte',  name: 'Horizonte (foto horizontal)',
    subtitle: 'Foto larga no topo · paleta Sertão Profundo · arraste imagens',
    Comp: HorizonteCard },
  { id: 'retrato',    name: 'Retrato (foto vertical)',
    subtitle: 'Foto vertical · paleta Cartório · arraste imagens',
    Comp: RetratoCard },
];

const FORMATS = [
  { key: '4:5',  label: '4:5 · feed' },
  { key: '9:16', label: '9:16 · stories' },
];

function CardArtboardChildren({ Comp, card, format, t }) {
  // Wrap so the card sits flush against the artboard inner box.
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Comp card={card} format={format} t={t} />
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  return (
    <React.Fragment>
      <DesignCanvas>
        {VARIATIONS.map(v => FORMATS.map(f => {
          const { w, h } = PE_FORMATS[f.key];
          return (
            <DCSection
              key={`${v.id}-${f.key}`}
              id={`${v.id}-${f.key}`}
              title={`${v.name} — ${f.label}`}
              subtitle={v.subtitle}
              gap={40}
            >
              {PE_CARDS.map((card, i) => (
                <DCArtboard
                  key={`${v.id}-${f.key}-${i}`}
                  id={`${v.id}-${f.key}-${i}`}
                  label={
                    card.kind === 'cover' ? '01 · Capa' :
                    card.kind === 'close' ? '07 · Fechamento' :
                    `${String(i + 1).padStart(2, '0')} · ${card.topic}`
                  }
                  width={w}
                  height={h}
                >
                  <CardArtboardChildren
                    Comp={v.Comp} card={card} format={f.key} t={t}
                  />
                </DCArtboard>
              ))}
            </DCSection>
          );
        }))}
      </DesignCanvas>

      <TweaksPanel title="Tweaks · Governante">
        <TweakSection label="Conteúdo" />
        <TweakText label="Texto da assinatura"
          value={t.eyebrowText}
          onChange={(v) => setTweak('eyebrowText', v)} />
        <TweakRadio label="Numeração"
          value={t.numberingStyle}
          options={['decimal', 'roman', 'bracketed']}
          onChange={(v) => setTweak('numberingStyle', v)} />
        <TweakSelect label="Fonte do corpo"
          value={t.bodyFont}
          options={[
            { value: 'cormorant', label: 'Cormorant (itálico)' },
            { value: 'lato',      label: 'Lato (sem-serifa)' },
            { value: 'playfair',  label: 'Playfair (serifa)' },
          ]}
          onChange={(v) => setTweak('bodyFont', v)} />

        <TweakSection label="Ornamentos" />
        <TweakToggle label="Diamantes e marcas"
          value={t.showOrnaments}
          onChange={(v) => setTweak('showOrnaments', v)} />
        <TweakToggle label="Dica 'arraste para começar'"
          value={t.showSwipeHint}
          onChange={(v) => setTweak('showSwipeHint', v)} />

        <TweakSection label="Sertão Profundo" />
        <TweakColor label="Fundo verde"
          value={t.verdeBg}
          options={['#1B3A2D', '#102016', '#0E2A20', '#2C2C2C']}
          onChange={(v) => setTweak('verdeBg', v)} />
        <TweakColor label="Acento ouro"
          value={t.ouroAccent}
          options={['#C9A84C', '#A98933', '#D9BC5E', '#8B4513']}
          onChange={(v) => setTweak('ouroAccent', v)} />
        <TweakColor label="Tinta areia"
          value={t.areiaInk}
          options={['#F5F0E8', '#EEE7D7', '#FFFFFF', '#C9A84C']}
          onChange={(v) => setTweak('areiaInk', v)} />

        <TweakSection label="Cartório de Bolso" />
        <TweakColor label="Fundo areia"
          value={t.areiaBg}
          options={['#F5F0E8', '#EEE7D7', '#FAF6EE', '#E8DFC9']}
          onChange={(v) => setTweak('areiaBg', v)} />
        <TweakColor label="Acento mogno"
          value={t.mognoAccent}
          options={['#8B4513', '#A05522', '#6B3309', '#C9A84C']}
          onChange={(v) => setTweak('mognoAccent', v)} />
        <TweakColor label="Tinta verde"
          value={t.verdeInk}
          options={['#1B3A2D', '#102016', '#2C2C2C', '#0E2A20']}
          onChange={(v) => setTweak('verdeInk', v)} />
      </TweaksPanel>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
