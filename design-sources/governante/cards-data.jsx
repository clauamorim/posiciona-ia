// cards-data.jsx — shared content + tokens for the Governante carousel.

const PE_PALETTE = {
  verde:   '#1B3A2D',
  ouro:    '#C9A84C',
  areia:   '#F5F0E8',
  grafite: '#2C2C2C',
  mogno:   '#8B4513',
  // softer derivatives
  verdeInk: '#102016',
  areiaTint: '#EEE7D7',
  ouroInk:  '#A98933',
};

// One canonical content array. Card 0 = cover, 1–5 = clauses, 6 = closing.
const PE_CARDS = [
  {
    kind: 'cover',
    eyebrow: 'POSICIONA EDITORIAL · DIREITO DO AGRO',
    kicker: 'Cláusulas',
    countWord: 'Sete',
    titleLead: 'cláusulas de arrendamento rural',
    titleTail: 'que eu releio antes de qualquer cliente assinar',
    footer: 'arraste para começar',
  },
  {
    kind: 'clause',
    num: '01',
    roman: 'I',
    topic: 'PRAZO',
    title: 'Prazo e renovação automática',
    body: 'Quem esquece de notificar, renova mais um ciclo inteiro.',
    detail: 'Marque na agenda o prazo de notificação prévia. A omissão prorroga o contrato pelas mesmas condições — e travar a renovação depois custa caro.',
  },
  {
    kind: 'clause',
    num: '02',
    roman: 'II',
    topic: 'REAJUSTE',
    title: 'Sacas, arrobas ou índice fixo?',
    body: 'Misturar critérios destrói a previsibilidade do contrato.',
    detail: 'Escolha um único parâmetro de reajuste e fixe a fórmula. Combinações híbridas viram disputa sempre que o mercado oscila.',
  },
  {
    kind: 'clause',
    num: '03',
    roman: 'III',
    topic: 'BENFEITORIAS',
    title: 'Quem faz, quem paga, quem leva.',
    body: 'Sem isso escrito, briga garantida no final do ciclo.',
    detail: 'Classifique as benfeitorias em necessárias, úteis e voluptuárias. Defina indenização e direito de retenção antes da primeira obra.',
  },
  {
    kind: 'clause',
    num: '04',
    roman: 'IV',
    topic: 'MEIO AMBIENTE',
    title: 'Responsabilidade ambiental durante o arrendamento.',
    body: 'É do dono da terra ou de quem produz nela? Defina antes.',
    detail: 'O passivo ambiental persegue a matrícula. Estipule responsabilidades por licenciamento, reserva legal e eventuais autuações enquanto a posse está com o arrendatário.',
  },
  {
    kind: 'clause',
    num: '05',
    roman: 'V',
    topic: 'RESCISÃO',
    title: 'Rescisão antecipada.',
    body: 'Aqui mora a maior parte das disputas que vejo no fórum.',
    detail: 'Especifique hipóteses, prazos de notificação, multas e o destino da safra em curso. Sem isso, o juiz decide por você.',
  },
  {
    kind: 'close',
    eyebrow: 'FECHAMENTO',
    title: 'Releia seu contrato esta semana.',
    body: 'Sem pressa. Onde você travar, está o nó.',
    cta: 'Salve para a próxima revisão.',
  },
];

const PE_FORMATS = {
  '4:5':  { w: 540, h: 675, label: '4:5  ·  1080×1350' },
  '9:16': { w: 540, h: 960, label: '9:16 ·  1080×1920' },
};

// ── shared mini-components & helpers ──────────────────────────────
function PeEyebrow({ children, color, size = 11, weight = 700 }) {
  return (
    <div style={{
      fontFamily: '"Lato", sans-serif',
      fontWeight: weight,
      fontSize: size,
      letterSpacing: 3,
      textTransform: 'uppercase',
      color,
    }}>{children}</div>
  );
}

function PeRule({ color, mt = 0, mb = 0, opacity = 0.9, height = 0.5 }) {
  return <div style={{ height, background: color, marginTop: mt, marginBottom: mb, opacity }} />;
}

function PeDiamond({ color, size = 6 }) {
  return <div style={{
    width: size, height: size, background: color,
    transform: 'rotate(45deg)', flex: '0 0 auto',
  }} />;
}

function peTinyCaps(color, size = 11) {
  return {
    fontFamily: '"Lato", sans-serif',
    fontWeight: 600, fontSize: size, letterSpacing: 2.4,
    textTransform: 'uppercase', color,
  };
}

function peBodyFontFor(key) {
  if (key === 'lato') return '"Lato", sans-serif';
  if (key === 'playfair') return '"Playfair Display", serif';
  return '"Cormorant Garamond", serif';
}

function peRenderNum(num, style) {
  if (!num) return '';
  if (style === 'bracketed') return `[ ${num} ]`;
  if (style === 'roman') {
    const map = { '01':'I', '02':'II', '03':'III', '04':'IV', '05':'V' };
    return map[num] || num;
  }
  return num;
}

Object.assign(window, {
  PE_PALETTE, PE_CARDS, PE_FORMATS,
  PeEyebrow, PeRule, PeDiamond,
  peTinyCaps, peBodyFontFor, peRenderNum,
});
