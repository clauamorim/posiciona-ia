// Diversidade editorial: anti-repetição de TEMA CENTRAL e FÓRMULA DE TÍTULO
// dentro da mesma semana e entre semanas.
//
// O detector é heurístico (regex) — usado como SINAL para a LLM evitar padrões
// saturados, e para validar a saída. NUNCA bloqueia a entrega: no máximo
// dispara um retry guiado e segue.

// ===== Concept groups (palavras-conceito que viram TEMA CENTRAL) =====

export type ConceptGroupId =
  | "grupo_a_autoridade"
  | "grupo_b_ticket"
  | "grupo_c_frequencia"
  | "grupo_d_generico"
  | "grupo_e_categoria"
  | "grupo_f_cliente_pergunta"
  | "grupo_g_frequencia_postagem"
  | "grupo_h_humanizar_bastidor"
  | "grupo_i_agradar_todos"
  | "grupo_j_cliente_pechincha"
  | "grupo_k_anti_cliente"
  | "grupo_l_bio_que_lista";

const CONCEPT_GROUPS: Record<ConceptGroupId, { label: string; terms: string[] }> = {
  grupo_a_autoridade: {
    label: "autoridade / referência / especialista",
    terms: ["autoridade", "autoridades", "referencia", "referencias", "especialista", "especialistas", "expertise"],
  },
  grupo_b_ticket: {
    label: "cliente premium / ticket / preço / cobrar",
    terms: ["premium", "ticket", "valor", "valores", "preco", "precos", "cobrar", "cobrando", "cobranca", "honorario", "honorarios"],
  },
  grupo_c_frequencia: {
    label: "postar todo dia / frequência / constância",
    terms: ["postar", "postagem", "postagens", "frequencia", "constancia", "diario", "diaria"],
  },
  grupo_d_generico: {
    label: "genérico / comum / igual / mais um",
    terms: ["generico", "genericos", "generica", "comum", "comuns", "igual", "iguais", "padrao", "padroes", "mais um", "mais uma"],
  },
  grupo_e_categoria: {
    label: "categoria / posicionamento / recorte",
    terms: ["categoria", "categorias", "posicionamento", "posicionamentos", "recorte", "recortes", "nicho", "nichar"],
  },
  grupo_f_cliente_pergunta: {
    label: "cliente premium pergunta antes de preço (você atende / atende meu caso / quanto custa antes)",
    terms: [
      "voce atende",
      "atende meu caso",
      "atende o meu caso",
      "quanto custa antes",
      "quanto custa antes de",
      "criterio antes de preco",
      "pergunta antes de perguntar o preco",
      "pergunta antes do preco",
    ],
  },
  grupo_g_frequencia_postagem: {
    label: "postar todo dia / aparecer todo dia / volume vs tese / consistência > frequência",
    terms: [
      "postar todo dia",
      "aparecer todo dia",
      "publicar todo dia",
      "aparecer mais",
      "frequencia",
      "consistencia",
      "volume vs tese",
      "trocar volume por tese",
      "consistencia maior que frequencia",
      "consistencia acima de frequencia",
      "consistencia > frequencia",
    ],
  },
  grupo_h_humanizar_bastidor: {
    label: "mostrar bastidor / humanizar marca / dia a dia humaniza / nivela por baixo",
    terms: [
      "mostrar bastidor",
      "mostrando o dia a dia",
      "mostrando dia a dia",
      "humanizar marca",
      "humanizar a marca",
      "humanizar perfil",
      "humanizar conta",
      "erro de humanizar",
      "o que e humanizar",
      "humanizar e mostrar",
      "humanizar virou",
      "bastidor humaniza",
      "dia a dia humaniza",
      "bastidor nivela",
      "nivela por baixo",
      "rotina humaniza",
      "rotina generica",
      "parecer estagiari",
      "parecer amador",
      "mostrar cafe da manha",
      "cafe da manha todo dia",
    ],
  },
  grupo_i_agradar_todos: {
    label: "agradar todo mundo / falar pra todos / não é pra todos / recorte de cliente",
    terms: [
      "agradar todo mundo",
      "agradar todos",
      "falar pra todos",
      "falar para todos",
      "nao e pra todos",
      "nao e para todos",
      "parar de tentar agradar",
      "recorte de cliente",
      "todo cliente serve",
    ],
  },
  grupo_j_cliente_pechincha: {
    label: "cliente que pechincha / cobrar mais / medo de subir preço / preço × valor",
    terms: [
      "cliente que pechincha",
      "paciente que pechincha",
      "ja pechinchando",
      "ja chega pechinchando",
      "chega pechinchando",
      "pedem desconto",
      "pedindo desconto",
      "preco x valor",
      "preco vs valor",
      "cobrar mais",
      "subir o preco",
      "subir preco",
      "perder cliente por preco",
      "cliente achar caro",
      "medo de cobrar",
      "achar caro",
      "10% mais barato",
      "dez por cento mais barato",
      "ninguem aceitar",
      "vai embora quando aparece alguem mais barato",
    ],
  },
  grupo_k_anti_cliente: {
    label: "quem o Posiciona NÃO atende / critério que separa / quem deveria primeiro resolver",
    terms: [
      "quem o posiciona nao atende",
      "quem o posiciona ajuda",
      "quem deveria primeiro resolver",
      "primeiro resolver outra coisa",
      "criterio que separa quem",
      "criterio tecnico que separa",
      "anti cliente",
      "anti-cliente",
      "nao e com a gente",
      "quem nao e cliente",
      "antes de virar cliente",
    ],
  },
  grupo_l_bio_que_lista: {
    label: "bio descreve função / lista credencial / bio sem recorte",
    terms: [
      "bio descreve",
      "bio lista",
      "bio so lista",
      "bio sem recorte",
      "bio que descreve a profissao",
      "lista credencial",
      "listando funcao",
      "lista de servicos",
      "descreve profissao nao recorte",
      "o erro do sobre",
      "erro de bio",
    ],
  },
};

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Detecta quais grupos de conceito aparecem no texto.
 * Recebe { theme, headline } e dá peso 2x ao theme.
 */
export function detectConceptGroups(parts: { theme?: string; headline?: string; body?: string; cta?: string }): ConceptGroupId[] {
  const themeNorm = normalize(parts.theme || "");
  const headlineNorm = normalize(parts.headline || "");
  const bodyNorm = normalize((parts.body || "").slice(0, 400));
  const ctaNorm = normalize(parts.cta || "");
  // Theme conta 2x; body+cta entram com peso 1 para pegar grupo recorrente que
  // só aparece no corpo do post (ex: humanizar/bastidor sem estar no título).
  const combined = `${themeNorm} ${themeNorm} ${headlineNorm} ${bodyNorm} ${ctaNorm}`;
  const found = new Set<ConceptGroupId>();
  for (const [gid, group] of Object.entries(CONCEPT_GROUPS) as [ConceptGroupId, typeof CONCEPT_GROUPS[ConceptGroupId]][]) {
    for (const term of group.terms) {
      // word-boundary tolerante (terms são normalizados sem acento)
      const re = new RegExp(`(^|[^a-z0-9])${term.replace(/\s+/g, "\\s+")}([^a-z0-9]|$)`, "i");
      if (re.test(combined)) {
        found.add(gid);
        break;
      }
    }
  }
  return Array.from(found);
}

// ===== Fórmulas de título proibidas / saturadas =====

export type TitleFormulaId =
  | "dicotomia_travessao"
  | "lista_n_separam"
  | "pare_x_comece_y"
  | "x_nao_e_y_e_z"
  | "diferenca_entre"
  | "por_que_nao_verbo"
  | "o_que_nao_te_conta"
  | "verdade_sobre"
  | "palavra_grandiosa_ninguem"
  | "constroi_vs_ocupa"
  | "protocolo_n_perguntas"
  | "cliente_pediu_recusei"
  | "a_ideia_de_que_x_esta"
  | "cta_palavra_chave_direct"
  | "livre";

// Numerais por extenso em pt-BR (com e sem acento — o detector roda no título cru)
const PT_NUMBER_WORDS = "(?:dois|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte)";
const N_OR_WORD = `(?:\\d+|${PT_NUMBER_WORDS})`;

const FORMULA_PATTERNS: { id: Exclude<TitleFormulaId, "livre">; label: string; re: RegExp }[] = [
  // 1. "X não A — B"  ou  "X não é A — é B"  (dicotomia com travessão/hífen longo)
  {
    id: "dicotomia_travessao",
    label: 'dicotomia com travessão ("X não A — B")',
    re: /\bn[ãa]o\b[^—–\-]{2,80}[\s][—–]\s|\bn[ãa]o\b[^—–]{2,80}\s-\s/i,
  },
  // 2. "As N coisas/perguntas/erros que separam X de Y"
  {
    id: "lista_n_separam",
    label: 'lista numerada que "separa X de Y"',
    re: /\b(as|os)\s+\d+\s+\w+.*\bsepara(m)?\b/i,
  },
  // 3. "Pare de X. Comece a Y."
  {
    id: "pare_x_comece_y",
    label: '"Pare de X. Comece a Y."',
    re: /\bpare\s+de\b.+\bcomece\s+a\b/i,
  },
  // 4. "X não é Y. É Z."
  {
    id: "x_nao_e_y_e_z",
    label: '"X não é Y. É Z."',
    re: /\bn[ãa]o\s+[ée]\b[^.!?]{2,60}[.!?]\s*[ée]\s+\w/i,
  },
  // 5. "A diferença entre X e Y"
  {
    id: "diferenca_entre",
    label: '"A diferença entre X e Y"',
    re: /\b(a\s+)?diferen[çc]a\s+entre\b/i,
  },
  // 6. "Por que [profissional] não [verbo] [coisa óbvia]"
  {
    id: "por_que_nao_verbo",
    label: '"Por que X não [verbo] Y"',
    re: /\bpor\s+que\s+\w+.*\bn[ãa]o\b/i,
  },
  // 7. "O que [autoridade] não te conta sobre X"
  {
    id: "o_que_nao_te_conta",
    label: '"O que X não te conta"',
    re: /\bo\s+que\b.+\bn[ãa]o\s+(te|lhe)\s+conta(m)?\b/i,
  },
  // 8. "A verdade sobre X"
  {
    id: "verdade_sobre",
    label: '"A verdade sobre X"',
    re: /\b(a\s+)?verdade\s+(sobre|por\s+tr[áa]s)\b/i,
  },
  // 9. "X: a [palavra grandiosa] que [ninguém faz / ninguém te conta]"
  {
    id: "palavra_grandiosa_ninguem",
    label: '"…que ninguém faz/conta/vê"',
    re: /\bque\s+ningu[ée]m\s+(faz|conta|v[êe]|sabe|fala)\b/i,
  },
  // 10. "X que constrói autoridade vs Y que só ocupa"
  {
    id: "constroi_vs_ocupa",
    label: '"X que constrói … vs Y que só …"',
    re: /\bque\s+constr[óo]i\b.+\bvs\b|\bque\s+constr[óo]i\b.+\bque\s+s[óo]\b/i,
  },
  // 11. "Protocolo/método/checklist/guia/filtro (de N) perguntas/passos/filtros/camadas/critérios/regras/sinais"
  //     OU "As N perguntas/camadas/filtros/passos/critérios" (sem o substantivo de método)
  //     Aceita numeral por extenso (três, quatro, sete, etc.) ou dígito.
  {
    id: "protocolo_n_perguntas",
    label: '"Protocolo/método/filtro (N) perguntas/passos/sinais/decisões/etapas/elementos…" ou "As/Os N [substantivo]"',
    re: new RegExp(
      `(\\b(protocolo|checklist|guia|roteiro|m[eé]todo|filtro|sistema|framework)\\s+(de\\s+)?(${N_OR_WORD}\\s+)?(perguntas|passos|filtros|camadas|crit[ée]rios|regras|sinais|decis[õo]es|etapas|elementos|verifica[çc][õo]es|checagens|princ[íi]pios|chaves|pilares|movimentos|gatilhos)\\b)` +
      `|` +
      `(\\b(as|os|estas|estes|essas|esses|aquelas|aqueles)\\s+${N_OR_WORD}\\s+(perguntas|camadas|filtros|passos|crit[ée]rios|regras|sinais|decis[õo]es|etapas|elementos|verifica[çc][õo]es|checagens|princ[íi]pios|chaves|pilares|movimentos|gatilhos)\\b)`,
      "i",
    ),
  },
  // 12. "Cliente/paciente/[profissional] chega(ou) pedindo/dizendo X — recusei
  //     / disse não / não atendi / trabalho com / há dois diagnósticos / não é com"
  {
    id: "cliente_pediu_recusei",
    label: '"[Personagem] chega pedindo/dizendo X — triagem/recusa/diagnóstico"',
    re: /\b(quando\s+o[a]?\s+|cliente|paciente|advog\w*|m[eé]dic\w*|psic[oó]log\w*|dentista|nutric\w*|fisioterap\w*|profissional|consultor\w*|arquitet\w*|design\w*)[^.?!]{0,80}\b(pediu|chega|chegou|chegando|escreve|escreveu|procura|procurou|me\s+procurou|chega\s+dizendo|chegou\s+dizendo|chegou\s+pedindo|chegou\s+querendo)\b[^.?!]{0,200}\b(recusei|disse\s+n[ãa]o|n[ãa]o\s+aceitei|recusada?|recusado|n[ãa]o\s+atend[io]|trabalho\s+com|trabalha\s+com|n[ãa]o\s+[ée]\s+com|h[áa]\s+dois?\s+(diagn[óo]sticos?|caminhos|cen[áa]rios|leituras))\b/i,
  },
  // 13. "A ideia / a regra / o conselho de que 'X' está [verbo]ndo Y"
  {
    id: "a_ideia_de_que_x_esta",
    label: '"A ideia/regra/conselho de que ‘X’ está [verbo]ndo Y"',
    re: /\b(a\s+ideia|a\s+regra|o\s+conselho|a\s+cren[çc]a|o\s+mantra|o\s+discurso)\s+de\s+que\s+['"“”‘’][^'"“”‘’]{2,120}['"“”‘’]\s+(est[áa]|t[áa]|vem|anda)\s+\w+(ndo|nte)\b/i,
  },
  // 14. CTA "Me chame no direct com a palavra X" (e variações próximas)
  {
    id: "cta_palavra_chave_direct",
    label: '"Me chame/manda no direct com a palavra X" (CTA repetitivo)',
    re: /\b(me\s+(chame|chama|mande|manda|chamem)|envie|manda|mande|comente)\s+(no\s+(direct|dm)|um\s+dm|aqui|abaixo)\s+.{0,40}?\b(palavra|c[óo]digo|termo)\b/i,
  },
];

export function detectTitleFormula(title: string): TitleFormulaId {
  const t = (title || "").trim();
  if (!t) return "livre";
  for (const p of FORMULA_PATTERNS) {
    if (p.re.test(t)) return p.id;
  }
  return "livre";
}

// ===== Ancoradores concretos no título =====

export type AnchorId =
  | "nome_proprio"
  | "ano"
  | "numero_nao_redondo"
  | "pergunta_com_dado"
  | "cena_especifica";

const ROUND_NUMBERS = new Set(["5", "10", "20", "50", "100", "1000"]);
const PROPER_NOUN_STOPWORDS = new Set([
  "Por", "Como", "Quando", "Onde", "Quem", "Que", "Qual", "Quais", "Mas", "Mais",
  "Voce", "Você", "Eu", "Ele", "Ela", "Eles", "Elas", "Nos", "Nós", "Sua", "Seu",
  "Suas", "Seus", "Pare", "Comece", "Faça", "Faca", "Saiba", "Veja", "Diga",
  "Uma", "Um", "Os", "As", "A", "O", "E", "Em", "De", "Da", "Do", "Das", "Dos",
  "Para", "Pra", "Sobre", "Entre", "Sem", "Com", "Por", "Antes", "Depois",
]);

export function detectTitleAnchors(title: string): AnchorId[] {
  const t = (title || "").trim();
  if (!t) return [];
  const found: AnchorId[] = [];

  // Nome próprio: 2+ palavras capitalizadas seguidas, OU palavra capitalizada
  // que não esteja na lista de stopwords e não esteja no início absoluto.
  const words = t.split(/\s+/);
  const capitalized = words.filter((w, i) => {
    if (i === 0) return false; // começo da frase quase sempre é Capitalizado
    const clean = w.replace(/[^A-Za-zÀ-ÿ]/g, "");
    if (clean.length < 3) return false;
    if (!/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(clean)) return false;
    return !PROPER_NOUN_STOPWORDS.has(clean);
  });
  if (capitalized.length >= 1) found.push("nome_proprio");

  // Ano (1900-2099)
  if (/\b(19|20)\d{2}\b/.test(t)) found.push("ano");

  // Número não-redondo: número com 2+ dígitos que NÃO seja redondo,
  // ou valor monetário "R$ N", ou porcentagem "N%".
  const numberMatches = t.match(/\b\d{2,}\b/g) || [];
  const moneyOrPct = /R\$\s*\d|\d+\s*%/.test(t);
  const hasNonRound = numberMatches.some((n) => !ROUND_NUMBERS.has(n)) || moneyOrPct;
  if (hasNonRound) found.push("numero_nao_redondo");

  // Pergunta com dado: contém "?" e ao menos um número
  if (/\?/.test(t) && /\d/.test(t)) found.push("pergunta_com_dado");

  // Cena específica: dia da semana + hora ("quinta-feira, 14h", "segunda às 9h")
  if (/\b(segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)[a-z\-,\s]{0,12}\d{1,2}\s*h/i.test(t)) {
    found.push("cena_especifica");
  }

  return Array.from(new Set(found));
}

// ===== Pillar IDs aceitos no tracking =====
// Mantém os ids existentes do editorialPillars + "livre" como fallback.
export type TrackedPillar = string;

// ===== Bloco para o prompt: plano de pilares + exemplos =====

export function renderPillarPlanBlock(): string {
  return `

# PLANO EDITORIAL DA SEMANA — DIVERSIDADE DE TEMA E TÍTULO
Os 4 posts de feed devem cobrir TIPOS de conteúdo diferentes. Distribua entre estes ângulos sem repetir nenhum dentro da semana:
1. CASO REAL NOMEADO — empresa/marca/profissional real, com ano e contexto (ex: "Havaianas 1994", "Magazine Luiza 2011"). Pilar de profundidade.
2. METODOLOGIA PRÓPRIA — passo a passo de COMO o criador pensa/decide/executa. É processo, não opinião.
3. CRÍTICA A CRENÇA DO MERCADO — quebra de UMA crença específica do nicho. NO MÁXIMO 1 post por semana neste ângulo.
4. RECORTE DE CLIENTE IDEAL — perfil concreto de cliente premium, com problema específico nomeado.
5. RESULTADO TRANSFORMACIONAL — tipo de transformação que justifica investimento alto, com métrica ou consequência concreta.

REGRA: a semana deve cobrir 4 ângulos DIFERENTES entre si. Não use 2 posts no mesmo ângulo.

# PADRÃO DE TÍTULO RECOMENDADO
Priorize títulos com pelo menos UM destes ANCORADORES CONCRETOS:
- Nome próprio real (marca, empresa, profissional, autor)
- Ano específico ("em 1994", "três anos atrás")
- Número não-redondo ("R$ 47 mil", "84% dos casos", "11 meses") — evite 5, 10, 100
- Pergunta concreta com dado
- Cena específica ("Reunião de quinta-feira, 14h. Cliente diz…")

EXEMPLO BOM (usa nome próprio + ano + paralelo concreto com o nicho):
"Quando a Havaianas decidiu parar de ser sandália barata em 1994: a virada de posicionamento que advogados e médicos precisam estudar"

EXEMPLO RUIM (fórmula batida + palavra-conceito saturada + hype vazio):
"Postar todo dia não acelera autoridade — desacelera. A matemática que ninguém faz"`;
}

// ===== Bloco para o prompt: fórmulas banidas + conceitos a evitar =====

export interface DiversityHints {
  bannedFormulas: TitleFormulaId[]; // fórmulas usadas nas últimas 2 semanas
  dampenedConcepts: ConceptGroupId[]; // grupos centrais nas últimas 2 semanas
}

export function renderDiversityBlock(hints: DiversityHints): string {
  const allFormulasList = FORMULA_PATTERNS.map((p) => `- ${p.id}: ${p.label}`).join("\n");
  const banned = hints.bannedFormulas.length > 0
    ? hints.bannedFormulas.join(", ")
    : "nenhuma marcada";
  const dampened = hints.dampenedConcepts.length > 0
    ? hints.dampenedConcepts
      .map((g) => `${g} (${CONCEPT_GROUPS[g]?.label || ""})`)
      .join("; ")
    : "nenhum marcado";
  return `

# FÓRMULAS DE TÍTULO SATURADAS (use no MÁXIMO 1 vez por semana — de preferência ZERO)
${allFormulasList}

PROIBIDAS NESTA SEMANA (já usadas nas últimas 2 semanas): ${banned}

# CONCEITOS A EVITAR COMO TEMA CENTRAL
Cada um destes GRUPOS de palavras pode ser TEMA CENTRAL de NO MÁXIMO 1 post da semana (regra dura — 2 posts no mesmo grupo dispara retry):
- grupo_a_autoridade: autoridade / referência / especialista
- grupo_b_ticket: cliente premium / ticket / preço / cobrar
- grupo_c_frequencia: postar todo dia / frequência / constância
- grupo_d_generico: genérico / comum / igual / mais um
- grupo_e_categoria: categoria / posicionamento / recorte
- grupo_f_cliente_pergunta: "você atende meu caso?" / pergunta antes de preço
- grupo_g_frequencia_postagem: aparecer todo dia / volume vs tese / consistência > frequência
- grupo_h_humanizar_bastidor: mostrar bastidor / humanizar marca / nivela por baixo
- grupo_i_agradar_todos: agradar todo mundo / não é pra todos / recorte de cliente
- grupo_j_cliente_pechincha: paciente já pechinchando / preço × valor

CONCEITOS SATURADOS nas últimas 3 semanas (PROIBIDOS como tema central nesta semana — não use NENHUM post sobre eles): ${dampened}`;
}

// ===== Validação da semana gerada =====

export interface DiversityViolation {
  type:
    | "concept_group_overuse"
    | "banned_formula_overuse"
    | "pillar_duplicate"
    | "critica_crenca_overuse";
  detail: string;
  days: number[];
}

export interface FeedPostLike {
  day: number;
  theme?: string;
  caption?: any;
  pillar?: string;
  cta?: string;
  script?: string;
  card_copy?: string[];
}

function getHeadline(p: FeedPostLike): string {
  const c = p.caption;
  if (typeof c === "string") return c;
  if (c && typeof c === "object" && typeof c.headline === "string") return c.headline;
  return "";
}

function getBody(p: FeedPostLike): string {
  const parts: string[] = [];
  const c = p.caption;
  if (typeof c === "string") parts.push(c);
  else if (c && typeof c === "object") {
    if (typeof c.body === "string") parts.push(c.body);
    if (typeof c.headline === "string") parts.push(c.headline);
  }
  if (typeof p.script === "string") parts.push(p.script);
  if (Array.isArray(p.card_copy)) parts.push(p.card_copy.filter((s) => typeof s === "string").join(" "));
  return parts.join(" ").slice(0, 400);
}

export interface PostFingerprint {
  day: number;
  pillar: string;
  formula: TitleFormulaId;
  anchors: AnchorId[];
  concepts: ConceptGroupId[];
}

export function fingerprintPost(p: FeedPostLike): PostFingerprint {
  const headline = getHeadline(p);
  const body = getBody(p);
  const cta = (p.cta || "").toString();
  const titleForFormula = (p.theme || headline || "").toString();
  // Detecta fórmula no título OU no CTA (CTA repetitivo conta como fórmula).
  let formula = detectTitleFormula(titleForFormula);
  if (formula === "livre" && cta) {
    const ctaFormula = detectTitleFormula(cta);
    if (ctaFormula !== "livre") formula = ctaFormula;
  }
  return {
    day: p.day,
    pillar: (p.pillar && String(p.pillar).trim()) || "livre",
    formula,
    anchors: detectTitleAnchors(titleForFormula),
    concepts: detectConceptGroups({ theme: p.theme, headline, body, cta }),
  };
}

export function validateWeekDiversity(
  posts: FeedPostLike[],
  hints: DiversityHints,
): { ok: boolean; violations: DiversityViolation[]; fingerprints: PostFingerprint[] } {
  const fingerprints = posts.map(fingerprintPost);
  const violations: DiversityViolation[] = [];

  // Concept group overuse: > 2 posts no mesmo grupo central
  const conceptCount: Record<string, number[]> = {};
  for (const fp of fingerprints) {
    for (const g of fp.concepts) {
      (conceptCount[g] ||= []).push(fp.day);
    }
  }
  for (const [g, days] of Object.entries(conceptCount)) {
    if (days.length > 1) {
      violations.push({
        type: "concept_group_overuse",
        detail: `Grupo ${g} aparece como tema central em ${days.length} posts (máx 1 por semana).`,
        days,
      });
    }
  }

  // Conceitos saturados nas últimas semanas (dampenedConcepts) — qualquer uso já viola
  if (hints.dampenedConcepts && hints.dampenedConcepts.length > 0) {
    const dampenedSet = new Set(hints.dampenedConcepts);
    const hits: Record<string, number[]> = {};
    for (const fp of fingerprints) {
      for (const g of fp.concepts) {
        if (dampenedSet.has(g as ConceptGroupId)) {
          (hits[g] ||= []).push(fp.day);
        }
      }
    }
    for (const [g, days] of Object.entries(hits)) {
      violations.push({
        type: "concept_group_overuse",
        detail: `Grupo ${g} estava SATURADO (uso recente nas últimas 3 semanas) e voltou a aparecer.`,
        days,
      });
    }
  }

  // Banned formula overuse na semana (>1)
  const formulaCount: Record<string, number[]> = {};
  for (const fp of fingerprints) {
    if (fp.formula === "livre") continue;
    (formulaCount[fp.formula] ||= []).push(fp.day);
  }
  for (const [f, days] of Object.entries(formulaCount)) {
    if (days.length > 1) {
      violations.push({
        type: "banned_formula_overuse",
        detail: `Fórmula "${f}" usada em ${days.length} posts (máx 1).`,
        days,
      });
    }
    if (hints.bannedFormulas.includes(f as TitleFormulaId)) {
      violations.push({
        type: "banned_formula_overuse",
        detail: `Fórmula "${f}" estava PROIBIDA nesta semana (uso recente).`,
        days,
      });
    }
  }

  // Pillar duplicate (livre/legacy podem repetir)
  const pillarDays: Record<string, number[]> = {};
  for (const fp of fingerprints) {
    const p = fp.pillar.toLowerCase();
    if (p === "livre" || p === "legacy" || !p) continue;
    (pillarDays[p] ||= []).push(fp.day);
  }
  for (const [p, days] of Object.entries(pillarDays)) {
    if (days.length > 1) {
      violations.push({
        type: "pillar_duplicate",
        detail: `Pilar "${p}" repetido em ${days.length} posts.`,
        days,
      });
    }
  }

  // critica_crenca / mito > 1
  const criticaDays = fingerprints
    .filter((fp) => ["mito", "critica_crenca"].includes(fp.pillar.toLowerCase()))
    .map((fp) => fp.day);
  if (criticaDays.length > 1) {
    violations.push({
      type: "critica_crenca_overuse",
      detail: `Crítica a crença usada em ${criticaDays.length} posts (máx 1).`,
      days: criticaDays,
    });
  }

  return { ok: violations.length === 0, violations, fingerprints };
}

// ===== Hints a partir do histórico do banco =====

export function buildDiversityHints(
  rows: Array<{ title_formula?: string | null; central_concepts?: string[] | null; created_at?: string }>,
): DiversityHints {
  // "Recente" = últimas ~2 semanas; o caller já limita por LIMIT/intervalo.
  const formulas = new Set<TitleFormulaId>();
  const concepts = new Set<ConceptGroupId>();
  for (const r of rows || []) {
    const f = (r.title_formula || "").trim() as TitleFormulaId;
    if (f && f !== "livre" && FORMULA_PATTERNS.some((p) => p.id === f)) {
      formulas.add(f);
    }
    for (const c of r.central_concepts || []) {
      if (c in CONCEPT_GROUPS) concepts.add(c as ConceptGroupId);
    }
  }
  return {
    bannedFormulas: Array.from(formulas),
    dampenedConcepts: Array.from(concepts),
  };
}

// ===== Texto de retry guiado =====

export function renderRetryInstructions(violations: DiversityViolation[]): string {
  const list = violations
    .map((v, i) => `${i + 1}. ${v.detail} (dias afetados: ${v.days.join(", ")})`)
    .join("\n");
  return `

⚠️ AJUSTE NECESSÁRIO — DIVERSIDADE EDITORIAL
Sua resposta anterior violou as regras de diversidade abaixo:
${list}

REESCREVA APENAS os posts dos dias afetados, mantendo os demais. Para cada post reescrito:
- Use uma fórmula de título DIFERENTE das listadas como saturadas
- Mude o tema central para um grupo de conceito que ainda não foi usado 2x
- Inclua pelo menos 1 ancorador concreto (nome próprio, ano, número não-redondo, cena específica)
Retorne um array JSON apenas com os posts reescritos.`;
}
