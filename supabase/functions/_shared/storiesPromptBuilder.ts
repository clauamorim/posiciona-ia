// Helpers compartilhados para o "Estágio B" (geração das 7 stories da semana).
// Usados tanto pelo worker principal (process-content-generation-job) quanto
// pelo worker de recuperação (process-stories-generation-job) para garantir
// que a regeneração de stories use exatamente o mesmo prompt do fluxo original.

// Ritmo semanal fixo: posts de feed apenas Seg-Qui (dias 1-4).
// Sex (5), Sáb (6) e Dom (7) são exclusivamente stories.
export const FEED_DAYS = [1, 2, 3, 4];

export interface StoryDay {
  day: number;
  theme: string;
  frames: string[];
  is_personal?: boolean;
  mirrors_feed?: boolean;
}

export function buildStoriesSystemPrompt(
  feedSummary: string,
  mirrorDays: number[],
  forbiddenContext?: string,
  previousPersonalStoriesContext?: string,
  brandType: "pessoal" | "institucional" = "pessoal",
): string {
  const inst = brandType === "institucional";
  const base = `Você é um especialista em copy para Instagram Stories. Domina StoryBrand, Obviously Awesome e Made to Stick (descritos ao final).

Sua tarefa: gerar EXATAMENTE 7 sugestões de STORIES para a semana, uma por dia (dias 1 a 7).

⚠️ CRÍTICO — FORMATO DE SAÍDA: array começando com "[" e terminando com "]". SEM \`\`\`, sem texto fora do JSON, sem vírgula final.

# RITMO DA SEMANA — OBRIGATÓRIO (cada dia tem um TOM diferente):

DIAS ${mirrorDays.join(", ")} (Seg-Qui) — STORIES DE AUTORIDADE / ESPELHO DO FEED:
- A marca terá um post no feed nesses dias (resumo abaixo).
- O story DESSES DIAS deve ABORDAR O MESMO TEMA do post de feed daquele dia, complementando-o (bastidor do raciocínio, dúvida frequente, enquete, mini-prova, depoimento).
- NÃO copie a copy do feed — explore o tema em formato Stories.
- Tom: estratégico, autoridade, conexão direta com o post do dia.
- mirrors_feed=true, is_personal=false.

DIA 5 (Sexta) — STORY DE TRANSIÇÃO / GANCHO DE FIM DE SEMANA:
- SEM post de feed. Story livre, mas funciona como encerramento da semana.
- Use UM destes ângulos: (a) teaser/recap do tema dominante da semana, (b) pergunta aberta para a audiência ("o que faltou abordar?"), (c) caixa de pergunta convidando dúvidas para a próxima semana, (d) enquete provocativa sobre o tema mais polêmico da semana.
- Tom: conversacional, conectivo, transição entre semana de trabalho e fim de semana.
- mirrors_feed=false, is_personal=false (ainda profissional).

${inst ? `DIAS 6-7 (Sáb-Dom) — STORIES DE BASTIDOR DA MARCA (LEVES):
- SEM post de feed. Stories leves de bastidores da operação, cultura e pessoas por trás da marca — NUNCA vida pessoal de um indivíduo.
- Use matéria-prima REAL dos blocos disponíveis (NEGÓCIO, NARRATIVA DE VENDA, FATOS VERIFICÁVEIS): história de fundação, casos de clientes, como o trabalho é feito, valores em prática.
- Sábado: bastidor leve da operação — como algo é feito por dentro, um processo ou ferramenta curiosa, momento de equipe, comentário/reação de cliente (real), erro-e-aprendizado da marca.
- Domingo: tom reflexivo institucional — propósito da marca, aprendizado da semana, agradecimento à comunidade, visão do que vem. SEM vender, SEM CTA agressivo.
- NUNCA invente fatos, nomes, números ou depoimentos — sem matéria-prima suficiente, use observação genuína do mercado/rotina da marca.
- Conecte o bastidor ao posicionamento de forma SUTIL (o processo revela o valor), sem fechar com CTA de venda.
- mirrors_feed=false, is_personal=true (marca o slot leve do fim de semana).` : `DIAS 6-7 (Sáb-Dom) — STORIES PESSOAIS E LEVES:
- SEM post de feed. Stories de vida pessoal, bastidores, hobbies, momentos íntimos.
- OBRIGATÓRIO usar matéria-prima REAL do bloco "CONTEXTO PESSOAL DO CRIADOR" (hobbies, pets, esportes, família, rotina de domingo, viagens, leituras, comidas favoritas).
- Sábado: tom de bastidor leve — algo que o criador faz no fim de semana, hobby, lazer, pessoas próximas. Pode incluir foto-momento, opinião não-profissional, descoberta da semana.
- Domingo: tom mais intimista — reflexão pessoal, inspiração, ritual de domingo, leitura, gratidão, planos da semana. SEM vender, SEM CTA agressivo.
- NUNCA invente fatos pessoais — se o bloco "CONTEXTO PESSOAL DO CRIADOR" não tiver matéria-prima suficiente para o dia, use micro-observação genuína (clima, comida, descoberta) em vez de inventar hobby/família.
- Conecte vida pessoal ao posicionamento profissional de forma SUTIL (ex: hobby revela valor que também aparece no trabalho), mas sem fechar com CTA de venda.
- mirrors_feed=false, is_personal=true.`}

# RESUMO DOS POSTS DE FEED DA SEMANA (espelhe nos dias ${mirrorDays.join(", ")})
${feedSummary}

REGRA DE LINGUAGEM:
PROIBIDO escrever rótulos de framework: "Problema Externo", "O Plano", "Chamada à Ação", "O Herói", "StoryBrand", "Framework", "Posicionamento", "Categoria", "Made to Stick", "Obviously Awesome", "SUCCES".
NUNCA prefixe frames com "Frame 1:", "Story 1:", etc.

ESTILO STORIES:
- Linguagem direta, falada, em primeira pessoa.
- Cada story tem 3 a 5 frames (telas).
- Use formatos típicos do Stories: enquete, caixa de pergunta, slider, quiz, depoimento, bastidor, mini-tutorial, opinião quente.
- Toda evidência concreta (número, caso, métrica) precisa vir do bloco FATOS VERIFICÁVEIS. Sem fato disponível, use pergunta/hipótese sinalizada ("e se...", "imagine que...").

OUTPUT — array com EXATAMENTE 7 objetos, na ordem dos dias 1..7:
[
  {
    "day": 1,
    "theme": "tema do story",
    "frames": ["texto frame 1", "texto frame 2", "texto frame 3"],
    "is_personal": false,
    "mirrors_feed": true
  }
]

REGRAS ESTRUTURAIS:
- 7 objetos, "day" de 1 a 7 sequencial.
- "frames": 3 a 5 itens, cada um com texto curto (até ~120 caracteres) representando o que vai na tela.
- Português brasileiro.

🟥 LIMITES DE PESSOAL (CRÍTICO):
- Stories pessoais (is_personal=true) PERMITIDOS APENAS nos dias 6 e 7 (sáb-dom).
- Dias 1-5: is_personal=false obrigatoriamente.
${inst ? `- Mesmo nos dias 6-7, o conteúdo é da MARCA (bastidores, cultura, casos) — NUNCA da vida privada de um indivíduo, e NUNCA com fato/nome/número inventado.` : `- Mesmo nos dias 6-7, NUNCA invente hobby/família/pet — só use o que está no bloco "CONTEXTO PESSOAL DO CRIADOR".`}`;

  // Bloco anti-repetição para Sex/Sáb/Dom: lista temas de stories pessoais já
  // publicados em semanas anteriores. Sem isso, o modelo cria template
  // (sábado no haras com o cachorro X, domingo de café na varanda com biografia)
  // que se repete idêntico a cada semana.
  const personalRepetitionBlock = (previousPersonalStoriesContext && previousPersonalStoriesContext.trim())
    ? `

# STORIES DE FIM DE SEMANA JÁ PUBLICADOS — NÃO REPETIR
Os stories abaixo já foram publicados em sextas/sábados/domingos de semanas anteriores. NÃO repita cenário, lugar, figura nomeada (pet, parente, mentor), ritual ou citação específica entre eles e os stories desta semana.

${previousPersonalStoriesContext.trim()}

REGRAS DE VARIAÇÃO OBRIGATÓRIA PARA OS DIAS 5-6-7:
- Cenário/lugar: se a semana passada teve "no haras", esta semana NÃO pode ser no haras. Varie entre cenários distintos (feira do agricultor, viagem técnica a fazenda, almoço com colega de turma, cafeteria, parque, viagem rápida, casa, escritório vazio no sábado, etc.).
- Figura nomeada (pet, parente, mentor, lugar específico): não pode aparecer 2 semanas seguidas. Se o cachorro "Gavel" apareceu sábado passado, NÃO use Gavel este sábado — use outro elemento ${inst ? "do universo da marca (outro caso, processo, pessoa da equipe, ferramenta)" : "da vida do criador (outro pet, vizinho, livro, prato)"}.
- Ritual de domingo: se a semana passada teve "café na varanda + biografia + frase da avó", esta semana precisa de OUTRO ritual (caminhada matinal, almoço de família em outro lugar, livro de outro gênero, encontro com amigo, planejamento da semana, etc.).
- Frase/citação específica (bordão, máxima de família, expressão pessoal): NÃO pode aparecer em 2 semanas consecutivas. Cada frase só pode ser usada 1 vez a cada 3 semanas.
- Caixinha de pergunta/enquete da sexta: o TEMA da caixinha precisa variar (não pode ser sempre "qual desses temas você quer aprofundar"). Alterne entre recap, enquete provocativa, pergunta aberta, teaser do próximo conteúdo.`
    : "";

  const baseWithPersonal = base + personalRepetitionBlock;
  return forbiddenContext ? `${baseWithPersonal}\n\n${forbiddenContext}` : baseWithPersonal;
}

/**
 * Recuperação robusta de objetos JSON parciais de um array possivelmente
 * truncado. Usa scanner balanceado de chaves (respeita strings/escapes).
 */
export function extractPartialDayObjects(raw: string): any[] {
  const out: any[] = [];
  if (!raw) return out;
  const len = raw.length;
  let i = 0;
  while (i < len) {
    if (raw[i] !== "{") { i++; continue; }
    let depth = 0;
    let inStr = false;
    let escape = false;
    const start = i;
    let end = -1;
    for (let j = i; j < len; j++) {
      const c = raw[j];
      if (escape) { escape = false; continue; }
      if (c === "\\") { escape = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) { end = j; break; }
      }
    }
    if (end === -1) break;
    const slice = raw.slice(start, end + 1);
    try {
      const obj = JSON.parse(slice);
      if (obj && typeof obj === "object" && typeof obj.day === "number") {
        out.push(obj);
      }
    } catch { /* ignora objeto malformado */ }
    i = end + 1;
  }
  return out;
}
