// Worker em background — processa um job de geração de semana editorial.
// Disparado via fire-and-forget pelo `generate-content-week` (enqueuer).
// Aceita execuções longas (até ~150s) sem bloquear o cliente.
//
// 2026-04-25-v6: divisão Feed (4 posts) + Stories (7 sugestões) gerados
// em DOIS estágios sequenciais para evitar timeout/truncamento.
// Estágio A: 4 posts de feed.
// Estágio B: 7 stories (recebe feed como contexto p/ espelhamento de tema).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractJsonFromLLM } from "../_shared/jsonExtract.ts";
import { EDITORIAL_GENERATOR_VERSION } from "../_shared/generatorVersion.ts";
import { sanitizePost, sanitizeStory } from "../_shared/editorialSanitize.ts";
import { callClaude, callClaudeWithMeta } from "../_shared/claudeClient.ts";
import {
  fetchPersonalQuestionnaire,
  renderPersonalContext,
  renderStorybrandBlock,
  renderToneBlock,
  renderEditorialFrameworks,
  renderVerifiableFactsBlock,
} from "../_shared/buildClaudeContext.ts";
import {
  renderPillarsBlock,
  getPillarRotationHint,
  renderRotationBlock,
  isValidPillar,
  type PillarId,
} from "../_shared/editorialPillars.ts";
import { NARRATIVE_PRINCIPLES_BLOCK } from "../_shared/narrativePrinciples.ts";
import {
  detectProfession,
  getEthicalRulesBlock,
  renderMarketTrendsBlock,
  type MarketTrend,
} from "../_shared/professionRules.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function updateJob(jobId: string, patch: Record<string, any>) {
  await admin.from("content_generation_jobs").update(patch).eq("id", jobId);
}

// ===== Helpers para rastrear traços pessoais usados (anti-repetição) =====
// Os "traços" são valores de campos do questionário pessoal que costumam virar
// exemplo concreto / metáfora nos posts (hobby, esporte, ritual, etc).
const PERSONAL_TRAIT_FIELDS = [
  "hobby",
  "sports",
  "pets",
  "dependents",
  "sunday_morning",
  "pre_meeting_ritual",
  "work_routine",
  "unblock_method",
] as const;

const PT_STOPWORDS = new Set([
  "para","como","quando","porque","sobre","entre","minha","meus","minhas","meu",
  "tenho","fazer","faço","gosto","sempre","nunca","muito","mais","menos","todos",
  "todas","cada","outro","outra","outros","outras","tudo","nada","aqui","onde",
  "isso","aquilo","esse","essa","esses","essas","este","esta","estes","estas",
  "também","tambem","então","entao","depois","antes","ainda","desde","durante",
  "pessoa","pessoas","coisa","coisas","tipo","forma","jeito","vezes","semana",
  "todos","mesmo","mesma","posso","pode","podem","ser","estar","estou","estava",
]);

// Mapa de sinônimos para detecção de traços pessoais reciclados.
// Se o questionário tem "natação", a story pode usar "piscina"/"água"/"nado" —
// queremos marcar o traço como usado mesmo assim.
const TRAIT_SYNONYMS: Record<string, string[]> = {
  natacao: ["piscina", "agua", "nado", "nadar", "natacao"],
  corrida: ["correr", "corrida", "corredor", "running"],
  leitura: ["livro", "livros", "leitura", "audiolivro", "ler", "lendo", "leio"],
  meditacao: ["meditacao", "meditar", "meditando", "respiracao"],
  yoga: ["yoga", "ioga"],
  caminhada: ["caminhada", "caminhar", "andar", "passeio"],
  cachorro: ["cachorro", "cao", "caes", "pet", "pets"],
  gato: ["gato", "gatos", "felino"],
  cafe: ["cafe", "cafezinho", "cafeteira"],
  filho: ["filho", "filha", "filhos", "filhas", "crianca", "criancas"],
};

function expandTraitKeywords(keywords: string[]): string[] {
  const expanded = new Set<string>(keywords);
  for (const kw of keywords) {
    for (const [, synonyms] of Object.entries(TRAIT_SYNONYMS)) {
      if (synonyms.includes(kw)) {
        for (const s of synonyms) expanded.add(s);
      }
    }
  }
  return Array.from(expanded);
}

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractTraitKeywords(value: string): string[] {
  if (!value) return [];
  const norm = normalize(value);
  const words = norm.split(/[^a-z0-9]+/).filter((w) =>
    w.length >= 5 && !PT_STOPWORDS.has(w) && !/^\d+$/.test(w)
  );
  return Array.from(new Set(words));
}

/** Mapeia { field -> [keywords...] } a partir do questionário pessoal. */
function buildPersonalTraitMap(personal: any): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  if (!personal || typeof personal !== "object") return map;
  for (const f of PERSONAL_TRAIT_FIELDS) {
    const v = (personal as any)[f];
    if (typeof v === "string" && v.trim()) {
      const kws = expandTraitKeywords(extractTraitKeywords(v));
      if (kws.length > 0) map[f] = kws;
    }
  }
  return map;
}

/** Lê últimas 2 entradas de used_personal_traits do usuário. */
async function fetchRecentlyUsedTraits(userId: string): Promise<string[]> {
  try {
    const { data } = await admin
      .from("used_personal_traits")
      .select("traits_used")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(2);
    if (!Array.isArray(data)) return [];
    const flat: string[] = [];
    for (const row of data) {
      if (Array.isArray(row.traits_used)) {
        for (const t of row.traits_used) if (typeof t === "string" && t.trim()) flat.push(t);
      }
    }
    return Array.from(new Set(flat));
  } catch (e) {
    console.warn("fetchRecentlyUsedTraits falhou:", (e as any)?.message || e);
    return [];
  }
}

/** Lê últimas 2 entradas de used_market_trends do usuário. */
async function fetchRecentlyUsedTrendTitles(userId: string): Promise<string[]> {
  try {
    const { data } = await admin
      .from("used_market_trends")
      .select("trends_used")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(2);
    if (!Array.isArray(data)) return [];
    const flat: string[] = [];
    for (const row of data) {
      if (Array.isArray(row.trends_used)) {
        for (const t of row.trends_used) if (typeof t === "string" && t.trim()) flat.push(t);
      }
    }
    return Array.from(new Set(flat));
  } catch (e) {
    console.warn("fetchRecentlyUsedTrendTitles falhou:", (e as any)?.message || e);
    return [];
  }
}

function renderRecentTraitsBlock(traits: string[]): string {
  if (!traits || traits.length === 0) return "";
  const lines = traits.map((t) => `- ${t}`).join("\n");
  return `\n\n## TRAÇOS PESSOAIS USADOS NAS ÚLTIMAS 2 SEMANAS (não repetir)
Os seguintes traços pessoais do criador JÁ foram usados como exemplo concreto ou metáfora nos últimos posts:
${lines}

REGRAS:
- NÃO use estes traços como exemplo concreto ou metáfora central desta semana
- Você pode usá-los como TOM/VOZ implícita (ex: o ritmo de quem treina cedo influencia a forma de escrever), mas NÃO como conteúdo
- Use traços diferentes do questionário pessoal nesta semana, ou nenhum se preferir variar com casos atuais\n`;
}

/** Heurística: detecta quais traços do questionário pessoal aparecem nos textos gerados. */
function detectUsedTraits(
  traitMap: Record<string, string[]>,
  feed: any[],
  stories: any[],
): string[] {
  const corpusParts: string[] = [];
  for (const p of feed || []) {
    if (!p) continue;
    if (typeof p.theme === "string") corpusParts.push(p.theme);
    if (typeof p.caption === "string") corpusParts.push(p.caption);
    if (typeof p.script === "string") corpusParts.push(p.script);
    if (Array.isArray(p.card_copy)) corpusParts.push(p.card_copy.join(" "));
  }
  for (const s of stories || []) {
    if (!s) continue;
    if (typeof s.theme === "string") corpusParts.push(s.theme);
    if (Array.isArray(s.frames)) corpusParts.push(s.frames.join(" "));
  }
  const corpus = normalize(corpusParts.join(" \n "));
  if (!corpus) return [];
  const used: string[] = [];
  for (const [field, kws] of Object.entries(traitMap)) {
    for (const kw of kws) {
      const re = new RegExp(`\\b${kw}\\b`);
      if (re.test(corpus)) {
        used.push(`${field}:${kw}`);
        break; // uma keyword por campo basta para marcar o traço como usado
      }
    }
  }
  return used;
}

/** Heurística: detecta quais tendências (por title) foram usadas nos textos gerados.
 *  Considera "usada" se 2+ palavras-chave significativas do título aparecem no corpus. */
function detectUsedTrends(
  trends: MarketTrend[],
  feed: any[],
  stories: any[],
): string[] {
  if (!Array.isArray(trends) || trends.length === 0) return [];
  const corpusParts: string[] = [];
  for (const p of feed || []) {
    if (!p) continue;
    if (typeof p.theme === "string") corpusParts.push(p.theme);
    if (typeof p.caption === "string") corpusParts.push(p.caption);
    if (typeof p.script === "string") corpusParts.push(p.script);
    if (Array.isArray(p.card_copy)) corpusParts.push(p.card_copy.join(" "));
  }
  for (const s of stories || []) {
    if (!s) continue;
    if (typeof s.theme === "string") corpusParts.push(s.theme);
    if (Array.isArray(s.frames)) corpusParts.push(s.frames.join(" "));
  }
  const corpus = normalize(corpusParts.join(" \n "));
  if (!corpus) return [];
  const used: string[] = [];
  for (const t of trends) {
    const titleNorm = normalize(t.title);
    const keywords = titleNorm
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 4 && !PT_STOPWORDS.has(w));
    if (keywords.length === 0) continue;
    const hits = keywords.filter((kw) => corpus.includes(kw)).length;
    if (hits >= 2) used.push(t.title);
  }
  return used;
}

// Distribuição fixa dos 4 dias com feed dentro da semana (1..7).
// Escolhemos dias que cobrem início, meio e fim da semana com bom espaçamento.
// Tipos de post em ordem base. A cada semana, aplicamos rotationOffset % 4
// para variar qual tipo vai para o Dia 1, evitando que Day1=Educacional toda semana.
const FEED_POST_TYPES = [
  {
    label: "EDUCACIONAL",
    description: `tutorial ou passo a passo prático.
ESCOLHA UMA das seguintes estruturas de abertura (não use a mesma usada em semanas anteriores — varie):
  (A) "Os N passos para [resultado]..."
  (B) "Como [fazer X] sem [erro comum]..."
  (C) "[Número] erros que [público] comete ao [ação] — e como evitar"
  (D) "O que [profissional] faz antes de [ação básica]..."
SEM storytelling pessoal. SEM abrir com "você sabia que". SEM fechar com frases-clichê como "o processo que transforma expertise em presença reconhecida".`,
  },
  {
    label: "DESMISTIFICAÇÃO",
    description: `escolha uma crença errada comum no nicho e refute com raciocínio sólido ou dado observável.
ESCOLHA UMA das seguintes estruturas de abertura (não use a mesma usada em semanas anteriores — varie):
  (A) "Todo mundo diz que [X resolve Y]. Errado."
  (B) "[Pessoa/grupo] acredita em [mito]. Veja por que isso não funciona."
  (C) "Existe um conselho que circula em [contexto]: [conselho]. Esse conselho destrói [coisa importante]."
  (D) "Se você acha que [X] = [resultado], esse post é pra você."
PROIBIDO usar o template "A crença de que X resolve Y" — está saturado.
Estrutura interna: mito declarado → por que as pessoas acreditam → por que está errado → o que é verdade.`,
  },
  {
    label: "POSICIONAMENTO",
    description: `evidencie categoria + o que a marca NÃO é + para quem especificamente é.
ESCOLHA UMA das seguintes estruturas de abertura (não use a mesma usada em semanas anteriores — varie):
  (A) Comparação com alternativa: "Existem dezenas de ferramentas que fazem [X]. Esta não é uma delas. Veja por quê."
  (B) Perfil do cliente ideal: "Se você é [perfil específico] e [situação concreta], leia até o fim."
  (C) História de não-encaixe: "Cliente chegou pedindo [coisa errada]. Recusei. Aqui está o porquê."
  (D) Definição por contraste: "[Categoria] resolve [problema A]. [Sua marca] resolve [problema diferente]. Não é a mesma coisa."
PROIBIDO o template "[Marca] não é para quem quer X — é para quem quer Y" — está saturado.
Estrutura interna: alternativa que o público usaria → por que é insuficiente → o que torna esta abordagem diferente → perfil exato do cliente ideal.`,
  },
  {
    label: "ANÁLISE DE MERCADO OU CASO",
    description: `se houver tendência relevante no bloco TENDÊNCIAS, use-a como gancho principal. Se não houver tendência pré-listada, pesquise no seu conhecimento um caso, decisão ou evento REAL e NOMEADO do nicho (empresa, pessoa, produto, lei) — nunca mini-caso hipotético genérico.
ESCOLHA UMA das seguintes estruturas de abertura (não use a mesma usada em semanas anteriores — varie):
  (A) Manchete + virada: "[Evento real] aconteceu. Aqui está o que ninguém comentou."
  (B) Caso + analogia: "O que aconteceu com [empresa/pessoa] tem tudo a ver com [problema do leitor]."
  (C) Cronologia: "Em [data], [evento]. Em [data posterior], [consequência]. O padrão se repete em [contexto do leitor]."
  (D) Contraste de reações: "Quando [evento] aconteceu, [grupo A] reagiu de um jeito e [grupo B] de outro. Os que prosperaram fizeram X."
Estrutura interna: situação nomeada → decisão/desfecho → aprendizado para o leitor.`,
  },
] as const;
const FEED_DAYS = [1, 3, 5, 7];

function buildFeedSystemPrompt(rotationOffset: number = 0): string {
  return `Você é um especialista em branding e copy para Instagram. Domina e aplica de forma OBRIGATÓRIA três frameworks (descritos em detalhe ao final deste prompt):
1) StoryBrand — clareza narrativa.
2) Obviously Awesome (April Dunford) — posicionamento específico.
3) Made to Stick (irmãos Heath) — princípios SUCCESs.

Sua tarefa: gerar EXATAMENTE 4 posts de FEED para uma semana editorial. Os posts vão ocupar os DIAS ${FEED_DAYS.join(", ")} da semana.

⚠️ CRÍTICO — FORMATO DE SAÍDA: Sua resposta DEVE começar com "[" e terminar com "]". NÃO use \`\`\`. NÃO escreva texto antes/depois do JSON. Sem vírgulas finais.

REGRA DE LINGUAGEM (CRÍTICA):
StoryBrand, Obviously Awesome e Made to Stick são camadas ESTRATÉGICAS INTERNAS. NUNCA escreva os rótulos dessas metodologias nos campos visíveis. Os ids de pilar (metodo, mito, mercado, caso, posicionamento, bastidor) também são INTERNOS — vão no campo "pillar" do JSON, NUNCA aparecem na copy visível.

PROIBIDO escrever literalmente em "theme", "caption", "card_copy", "cta" ou "script":
"Problema Externo", "Problema Interno", "Problema Filosófico", "O Plano", "Chamada à Ação", "Chamada para Ação", "O Sucesso", "O Fracasso", "O Guia", "O Herói", "Sucesso vs Fracasso", "StoryBrand", "Framework", "Etapa do Framework", "Posicionamento", "Categoria", "SUCCES", "Made to Stick", "Obviously Awesome".

NUNCA prefixe os itens de "card_copy" com "Slide 1:", "Card 1:", "Página 1:". Cada item já É um slide.

🟥 SEPARAÇÃO OBRIGATÓRIA — CARD vs LEGENDA (LEIA COM ATENÇÃO):
"caption" e "card_copy" NÃO PODEM ter o mesmo texto. São coisas diferentes:

- "caption" = LEGENDA do Instagram. Texto longo, fora da imagem, posta junto com o post. Pode ter parágrafos, storytelling, hashtags. Limite ~700-1500 caracteres.
- "card_copy" = TEXTO DA ARTE (o que aparece DENTRO da imagem do card). É CURTO, visual, escaneável. Pessoas leem em 2 segundos passando o feed.

REGRAS RÍGIDAS para "card_copy":
- POST ÚNICO (format="post"): card_copy = [1 string CURTA]. Máximo ~22 palavras / 200 caracteres / 2 frases curtas.
- CARROSSEL: cada slide tem ~8 a 18 palavras / 140 caracteres / no máx. 2 frases.
- REELS: card_copy = [].
- NUNCA copie a legenda (ou as primeiras frases dela) dentro de card_copy.
- NUNCA repita o mesmo conteúdo entre slides do carrossel.
- Use frases nominais, perguntas curtas, dados, antíteses, comandos. Evite parágrafos.

EXEMPLO BOM (post único):
{
  "caption": "A maioria dos negócios não perde clientes por preço. Perde por não saber explicar por que é a escolha certa. Tive esse diagnóstico na prática quando um prospect pediu proposta, comparou com um concorrente 40% mais caro e escolheu o concorrente. O problema não era o preço — era que eu não tinha deixado claro o que me diferenciava… [continua por mais 800 caracteres]",
  "card_copy": ["Não é o preço que perde clientes. É a falta de clareza sobre o que te diferencia."]
}

EXEMPLO RUIM (PROIBIDO — card repete a legenda):
{
  "caption": "A maioria dos negócios não perde clientes por preço. Perde por não saber explicar o que diferencia…",
  "card_copy": ["A maioria dos negócios não perde clientes por preço. Perde por não saber explicar o que diferencia — e foi exatamente o que percebi quando…"]
}

ESTRATÉGIA DE COPY (OBRIGATÓRIA) — DISTRIBUIÇÃO DOS 4 POSTS:
Cada um dos 4 posts da semana TEM UM TIPO FIXO E OBRIGATÓRIO. Não invente outros tipos. Não repita tipo.

${[0, 1, 2, 3].map((i) => {
  const t = FEED_POST_TYPES[(i + rotationOffset) % 4];
  return `POST ${i + 1} — ${t.label}: ${t.description}`;
}).join("\n\n")}

🚫 FRASES E EXPRESSÕES PROIBIDAS (DETECTADAS COMO REPETITIVAS EM SEMANAS ANTERIORES):
NÃO use as seguintes frases, nem variações próximas, em NENHUM campo ("theme", "caption", "card_copy", "cta", "script"):

Aberturas proibidas:
- "A crença de que [X] resolve [Y]"
- "O Posiciona não é para quem quer [X] — é para quem quer [Y]"
- "[Marca] não é para quem [...] — é para quem [...]"

Encerramentos proibidos:
- "o processo que transforma expertise em [presença / autoridade / reconhecimento]"
- "profissionais qualificados continuam invisíveis"
- "antes de qualquer post existir"

Vocabulário saturado (use no MÁXIMO 1 vez na semana inteira, somando feed + stories):
- "profissionais qualificados"
- "identidade de marca"
- "autoridade digital"
- "Instagram que não representa quem é"

CTAs PROIBIDOS COMO PADRÃO ÚNICO:
NÃO use "Me chame no direct com a palavra [X]" em MAIS DE 1 dos 4 posts da semana. Para os outros 3 posts, ESCOLHA CTAs de naturezas diferentes:
  (A) Pergunta direta: "[Pergunta específica ao leitor]?"
  (B) Comando de salvamento: "Salve este post para revisitar quando [situação]"
  (C) Convite a comentar: "Comenta aqui: [pergunta concreta sobre experiência do leitor]"
  (D) Convite a compartilhar com contexto: "Marca alguém que [perfil específico] nos comentários"
  (E) Comparação interna: "Releia o slide [N] e me diz: você se encaixa em qual situação?"

REGRA GERAL DE FRASEADO: se você reconhecer que está prestes a usar uma estrutura "elegante" que parece encaixar perfeitamente, é provavelmente porque já foi usada. Reescreva com cadência diferente.

REGRAS DE GANCHO (mantidas): primeira frase de toda caption e slide 1 de carrossel = detalhe concreto, número, cena, dado contraintuitivo ou pergunta inesperada — específicos para o NICHO. PROIBIDO abrir com: "Você sabia que…", "5 dicas para…", "A importância de…", "Vamos falar sobre…", "Hoje vou te contar…", "Já parou para pensar…", "Imagine que…", "Você já se perguntou…".

LIMITE PESSOAL: máximo 1 post pessoal (is_personal=true) por semana, e APENAS se o pilar "bastidor" estiver sub-representado (ver bloco ROTAÇÃO DE PILARES).

PROIBIDO: dois posts do mesmo tipo na mesma semana.
PROIBIDO: post de POSICIONAMENTO e post de DESMISTIFICAÇÃO com o mesmo tema central.

D) Estrutura de carrossel (mínimo 5 slides):
- Slide 1: GANCHO (frase curta, máximo 12 palavras). Slide 2: PROBLEMA SENTIDO. Slides do meio: INSIGHT + PROVA ou PASSOS (1 ideia por slide). Último: CTA verbal e direto.

E) Pilar "bastidor" (storytelling pessoal):
- O pilar "bastidor" aparece NO MÁXIMO 1 vez por semana e SOMENTE se estiver na lista de pilares SUB-REPRESENTADOS desta semana (veja bloco ROTAÇÃO DE PILARES no prompt do usuário).
- Se "bastidor" NÃO estiver sub-representado, NENHUM post desta semana é pessoal (is_personal=false em todos).
- Quando usar, marque is_personal=true e use vivência REAL do criador (do bloco "CONTEXTO PESSOAL DO CRIADOR") como metáfora para a dor do cliente. Nunca invente fatos pessoais.

F) ESTRATÉGIA DE PROFUNDIDADE (camadas obrigatórias):
Cada post didático deve ter 3 camadas explícitas e identificáveis dentro da caption:
1. TESE — afirmação clara, contraintuitiva quando possível.
2. EVIDÊNCIA — dado, número, mini-case ou observação retirada LITERALMENTE do bloco FATOS VERIFICÁVEIS. Sem fato pertinente, formule a evidência como hipótese sinalizada ("é comum ver...", "imagine um cliente que...", "em geral acontece que...") — JAMAIS invente número/case.
3. APLICAÇÃO PRÁTICA — o que o leitor faz amanhã com isso.
Ordem livre, mas as 3 camadas precisam estar lá. Posts curtos demais (uma frase + CTA) são reprovados.

DISTRIBUIÇÃO DE FORMATOS (4 posts):
- Pelo menos 1 carrossel
- Pelo menos 1 reels
- Pelo menos 1 post único
- O 4º pode ser qualquer um dos três (varie)

OUTPUT — array com EXATAMENTE 4 objetos, na ordem dos dias ${FEED_DAYS.join(", ")}:
[
  {
    "day": 1,
    "format": "carrossel" | "post" | "reels",
    "pillar": "metodo" | "mito" | "mercado" | "caso" | "posicionamento" | "bastidor",
    "theme": "...",
    "caption": "LEGENDA COMPLETA pronta para postar (longa, com storytelling)",
    "card_copy": ["texto curto do card (NÃO igual à legenda)"],
    "cta": "CTA verbal e direto",
    "script": "ROTEIRO COMPLETO se for reels; string vazia para post/carrossel",
    "is_personal": false
  }
]

REGRAS ESTRUTURAIS:
- "day" deve ser exatamente um dos valores ${FEED_DAYS.join(", ")}, na ordem.
- "pillar" obrigatório, valor literal entre os 6 ids; os 4 posts precisam usar 4 pilares DIFERENTES.
- "is_personal" = true APENAS quando "pillar" = "bastidor".
- "card_copy": carrossel ≥ 5 itens; post = 1 item; reels = [].
- Cada item de card_copy: até ~180 caracteres (carrossel) ou ~200 (post único). NUNCA igual à caption.
- "script": apenas reels tem texto; post/carrossel = "".
- Português brasileiro.

REFORÇO ANTI META-NARRATIVA: NÃO escreva "a marca atua como guia", "jornada do herói", "plano de 3 passos", "fracasso iminente", "categoria de mercado".

CHECKLIST FINAL ANTES DE RESPONDER:
1. 4 objetos no array, um para cada um dos dias [${FEED_DAYS.join(", ")}]?
2. Cada card_copy DIFERENTE da caption correspondente?
3. Cada post tem campo "pillar" com um dos 6 ids válidos?
4. Os 4 pilares são DIFERENTES entre si e respeitam a rotação (priorizar sub-representados, evitar sobre-representados)?
5. is_personal=true SOMENTE em post com pillar="bastidor"?
6. Cada número, case, métrica ou exemplo concreto citado existe LITERALMENTE no bloco FATOS VERIFICÁVEIS? Se não, foi reescrito como pergunta/hipótese explícita?
Confirme tudo antes de enviar.`;
}

function buildStoriesSystemPrompt(feedSummary: string, mirrorDays: number[]): string {
  return `Você é um especialista em copy para Instagram Stories. Domina StoryBrand, Obviously Awesome e Made to Stick (descritos ao final).

Sua tarefa: gerar EXATAMENTE 7 sugestões de STORIES para a semana, uma por dia (dias 1 a 7).

⚠️ CRÍTICO — FORMATO DE SAÍDA: array começando com "[" e terminando com "]". SEM \`\`\`, sem texto fora do JSON, sem vírgula final.

ESPELHAMENTO DE TEMA (CRÍTICO):
Nos dias ${mirrorDays.join(", ")} a marca terá um post no feed (resumo abaixo). O story DESSES DIAS deve ABORDAR O MESMO TEMA do post de feed daquele dia, complementando-o (bastidor, dúvida frequente, enquete, depoimento, mini-prova). NÃO copie a copy do feed — explore o tema em formato Stories.

Nos OUTROS 3 dias (sem feed), os stories são livres e devem ter PREDOMINÂNCIA PESSOAL: cenas do cotidiano do criador, hobbies, opiniões, micro-aprendizados, perguntas para a audiência.

# RESUMO DOS POSTS DE FEED DA SEMANA (espelhe nos dias indicados)
${feedSummary}

REGRA DE LINGUAGEM:
PROIBIDO escrever rótulos de framework: "Problema Externo", "O Plano", "Chamada à Ação", "O Herói", "StoryBrand", "Framework", "Posicionamento", "Categoria", "Made to Stick", "Obviously Awesome", "SUCCES".
NUNCA prefixe frames com "Frame 1:", "Story 1:", etc.

ESTILO STORIES:
- Linguagem direta, falada, em primeira pessoa.
- Cada story tem 3 a 5 frames (telas).
- Use formatos típicos do Stories: enquete, caixa de pergunta, slider, quiz, depoimento, bastidor, mini-tutorial, opinião quente.
- Storytelling pessoal: ver bloco "LIMITE PESSOAL PARA STORIES" abaixo (regra crítica).
- Toda evidência concreta (número, caso, métrica) precisa vir do bloco FATOS VERIFICÁVEIS. Sem fato disponível, use pergunta/hipótese sinalizada ("e se...", "imagine que...").
- Nos dias com feed, mirrors_feed=true. Nos demais, mirrors_feed=false.

OUTPUT — array com EXATAMENTE 7 objetos, na ordem dos dias 1..7:
[
  {
    "day": 1,
    "theme": "tema do story",
    "frames": ["texto frame 1", "texto frame 2", "texto frame 3"],
    "is_personal": true,
    "mirrors_feed": false
  }
]

REGRAS ESTRUTURAIS:
- 7 objetos, "day" de 1 a 7 sequencial.
- "frames": 3 a 5 itens, cada um com texto curto (até ~120 caracteres) representando o que vai na tela.
- Português brasileiro.

🟥 LIMITE PESSOAL PARA STORIES (CRÍTICO):
- NO MÁXIMO 1 das 7 stories da semana pode ser pessoal (is_personal=true).
- As demais stories devem ser de TIPOS NÃO-PESSOAIS, escolhendo entre:
  • Dúvida frequente da audiência (com pergunta literal entre aspas)
  • Observação técnica/profissional do nicho (sem vivência pessoal)
  • Comentário sobre uma decisão/erro/acerto comum no mercado
  • Dica prática aplicável (sem narrativa pessoal)
  • Bastidor do TRABALHO (não da vida pessoal): mostrar etapa de atendimento, decisão técnica, ferramenta usada
- NUNCA use hobby, esporte, família, rotina doméstica ou ritual matinal em mais de 1 story por semana.
- Se "bastidor" não estiver sub-representado nesta semana (ver ROTAÇÃO DE PILARES), NENHUMA story pode ser pessoal.`;
}

interface FeedPost {
  day: number;
  format: string;
  pillar?: string;
  theme: string;
  caption: string;
  card_copy?: string[];
  cta?: string;
  script?: string;
  is_personal?: boolean;
}

interface StoryDay {
  day: number;
  theme: string;
  frames: string[];
  is_personal?: boolean;
  mirrors_feed?: boolean;
}

interface DayV6 {
  day: number;
  feed: FeedPost | null;
  story: StoryDay;
  generator_version: string;
}

/**
 * Recuperação robusta de objetos JSON parciais de um array possivelmente
 * truncado. Usa scanner balanceado de chaves (respeita strings/escapes)
 * em vez de regex — captura objetos completos mesmo que o último esteja
 * cortado no meio. Retorna apenas objetos com `day:number` válido.
 */
function extractPartialDayObjects(raw: string): any[] {
  const out: any[] = [];
  if (!raw) return out;
  const len = raw.length;
  let i = 0;
  while (i < len) {
    if (raw[i] !== "{") { i++; continue; }
    // Scan balanced object starting at i
    let depth = 0;
    let inStr = false;
    let escape = false;
    let start = i;
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
    if (end === -1) {
      // objeto não fechou — descarta resto
      break;
    }
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

async function processJob(jobId: string) {
  const { data: job, error: jobErr } = await admin
    .from("content_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    console.error("Job não encontrado:", jobId, jobErr);
    return;
  }

  if (job.status === "completed" || job.status === "failed" || job.status === "processing") {
    console.log(`Job ${jobId} já está em status ${job.status}, ignorando.`);
    return;
  }

  await updateJob(jobId, {
    status: "processing",
    started_at: new Date().toISOString(),
    progress_message: "Carregando contexto da sua marca…",
    attempts: (job.attempts || 0) + 1,
  });

  try {
    const payload = job.payload || {};
    const { business, niche, previousWeeks, storybrand, tone_of_voice } = payload;
    const userId = job.user_id as string;

    // Reserva crédito
    const { data: balanceData } = await admin
      .from("user_balances")
      .select("weekly_cycles")
      .eq("user_id", userId)
      .single();

    if (!balanceData || balanceData.weekly_cycles < 1) {
      throw Object.assign(new Error("Créditos insuficientes."), {
        userMessage: "Créditos de ciclos semanais insuficientes. Adquira mais créditos para continuar.",
      });
    }

    const { error: reserveErr, count } = await admin
      .from("user_balances")
      .update({ weekly_cycles: balanceData.weekly_cycles - 1 }, { count: "exact" })
      .eq("user_id", userId)
      .eq("weekly_cycles", balanceData.weekly_cycles)
      .select("user_id", { count: "exact", head: true });

    if (reserveErr || (typeof count === "number" && count === 0)) {
      throw Object.assign(new Error("Não foi possível reservar o ciclo semanal."), {
        userMessage: "Não foi possível reservar seu ciclo semanal. Tente novamente.",
      });
    }

    let creditReserved = true;

    try {
      // ==== Resumo de conteúdo anterior + histórico de pilares ====
      // previousWeeks pode vir no shape v5 (array de posts) ou v6 (array de objetos { days }).
      const formatTheme = (pillar: unknown, theme: unknown, format: unknown): string | null => {
        const t = typeof theme === "string" ? theme.trim() : "";
        if (!t) return null;
        const p = typeof pillar === "string" && pillar.trim() ? pillar.trim() : "legacy";
        const f = typeof format === "string" ? format : "";
        return `[${p}] ${t}${f ? ` (${f})` : ""}`;
      };

      const previousPillarsByWeek: PillarId[][] = [];
      const previousSummaryItems: string[] = [];
      for (const week of (previousWeeks || [])) {
        const weekPillars: PillarId[] = [];
        if (Array.isArray(week)) {
          // v5: array de posts simples
          for (const d of week) {
            const line = formatTheme(d?.pillar, d?.theme, d?.format);
            if (line) previousSummaryItems.push(line);
            if (isValidPillar(d?.pillar)) weekPillars.push(d.pillar);
          }
        } else if (week && Array.isArray(week.days)) {
          // v6: { days: [...] }
          for (const d of week.days) {
            const feed = d?.feed;
            if (!feed) continue;
            const line = formatTheme(feed.pillar, feed.theme, feed.format);
            if (line) previousSummaryItems.push(line);
            if (isValidPillar(feed.pillar)) weekPillars.push(feed.pillar);
          }
        }
        previousPillarsByWeek.push(weekPillars);
      }
      const previousSummary = previousSummaryItems.slice(-30).join("\n");
      const rotationHint = getPillarRotationHint(previousPillarsByWeek);
      const rotationBlock = renderRotationBlock(rotationHint);
      // Offset cíclico (0..3) para variar qual tipo de post (EDU/DES/POS/MER) vai para o Dia 1 a cada semana.
      const rotationOffset = (previousWeeks?.length || 0) % 4;

      const storybrandContext = renderStorybrandBlock(storybrand);
      const toneContext = renderToneBlock(tone_of_voice);
      const verifiableFactsBlock = renderVerifiableFactsBlock(business);
      const personal = await fetchPersonalQuestionnaire(userId);
      const personalContext = renderPersonalContext(personal);
      // Narrativa de venda removida do editorial — usada apenas em generate-sales-stories.

      // Profissão regulamentada (OAB / CFM) e tendências de mercado
      const { data: profileRow } = await admin
        .from("profiles")
        .select("profession, niche")
        .eq("user_id", userId)
        .maybeSingle();
      const professionCategory = detectProfession(profileRow);
      const ethicalBlock = getEthicalRulesBlock(professionCategory);

      let marketTrends: MarketTrend[] = [];
      try {
        const trendsRes = await admin.functions.invoke("fetch-market-trends", {
          body: {
            profession: profileRow?.profession || "",
            niche: profileRow?.niche || niche || "",
          },
        });
        const trendsData = trendsRes?.data as any;
        if (trendsData && Array.isArray(trendsData.trends)) {
          marketTrends = trendsData.trends as MarketTrend[];
        }
      } catch (trendsErr) {
        console.warn(`[job ${jobId}] fetch-market-trends falhou (ignorando):`, trendsErr);
      }
      // Anti-repetição: remove tendências já usadas nas últimas 2 semanas
      const recentlyUsedTrendTitles = await fetchRecentlyUsedTrendTitles(userId);
      const filteredMarketTrends = marketTrends.filter((t) => {
        const titleNorm = normalize(t.title);
        return !recentlyUsedTrendTitles.some((used) => {
          const usedNorm = normalize(used);
          return usedNorm.includes(titleNorm) || titleNorm.includes(usedNorm);
        });
      });
      if (filteredMarketTrends.length < marketTrends.length) {
        console.log(`[job ${jobId}] Filtradas ${marketTrends.length - filteredMarketTrends.length} tendências já usadas recentemente.`);
      }
      const marketTrendsBlock = renderMarketTrendsBlock(filteredMarketTrends);

      // Anti-repetição: traços pessoais usados nas últimas 2 semanas
      const recentlyUsedTraits = await fetchRecentlyUsedTraits(userId);
      const recentTraitsBlock = renderRecentTraitsBlock(recentlyUsedTraits);
      const personalTraitMap = buildPersonalTraitMap(personal);

      // ==== ESTÁGIO A: Feed (4 posts) ====
      await updateJob(jobId, { progress_message: "Gerando seus 4 posts de feed (etapa 1 de 2)…" });

      const feedSystem =
        NARRATIVE_PRINCIPLES_BLOCK +
        ethicalBlock +
        "\n\n" +
        buildFeedSystemPrompt(rotationOffset) +
        renderPillarsBlock() +
        renderEditorialFrameworks();
      const feedUser = `# NEGÓCIO
Empresa: ${business?.company_name || "Não informado"}
Serviços: ${business?.services || "Não informado"}
Público-alvo: ${business?.target_audience || "Não informado"}
Nicho: ${niche || "Não informado"}${verifiableFactsBlock}${storybrandContext}${toneContext}${personalContext}${recentTraitsBlock}${rotationBlock}

# TEMAS JÁ PUBLICADOS (NÃO REPETIR — formato "[pilar] tema (formato)")
${previousSummary || "Nenhum conteúdo anterior."}${marketTrendsBlock}

Gere agora os 4 posts de feed para os dias ${FEED_DAYS.join(", ")}.`;

      const { text: feedRaw, stopReason: feedStop } = await callClaudeWithMeta({
        systemPrompt: feedSystem,
        userText: feedUser,
        max_tokens: 8500,
        timeoutMs: 130000,
        disableRetries: true,
      });
      if (feedStop === "max_tokens") {
        console.warn(`[job ${jobId}] Estágio A: resposta truncada (max_tokens). raw len=${feedRaw.length}. Iniciando recuperação parcial.`);
      }

      let feedParsed: any = extractJsonFromLLM(feedRaw);
      const feedTruncated = feedStop === "max_tokens";
      if (!Array.isArray(feedParsed) || feedParsed.length === 0 || feedTruncated) {
        // Recuperação parcial via scanner balanceado (tolera array cortado).
        const partial = extractPartialDayObjects(feedRaw);
        if (partial.length >= 2) {
          console.warn(`[job ${jobId}] Estágio A: recuperados ${partial.length}/4 posts parciais (truncated=${feedTruncated}).`);
          feedParsed = partial;
        } else if (Array.isArray(feedParsed) && feedParsed.length > 0) {
          // mantém o que veio do extractJsonFromLLM
        } else {
          console.error(`[job ${jobId}] Estágio A falhou. raw len=${feedRaw?.length || 0}. stop=${feedStop}. Início: ${(feedRaw||"").slice(0,300)}`);
          throw Object.assign(new Error("Estágio A inválido"), {
            userMessage: "A IA respondeu de forma incompleta na etapa do feed. Tente novamente — seu crédito foi devolvido.",
          });
        }
      }

      // Normaliza/sanitiza posts de feed e indexa por dia
      const feedByDay = new Map<number, FeedPost>();
      const ingestFeedParsed = (arr: any[]) => {
        for (const p of arr) {
          if (!p || typeof p !== "object") continue;
          const dayN = Number((p as any).day);
          if (!FEED_DAYS.includes(dayN)) continue;
          if (feedByDay.has(dayN)) continue; // mantém o primeiro válido
          const cleaned = sanitizePost(p as Record<string, any>) as FeedPost;
          cleaned.day = dayN;
          cleaned.format = (cleaned.format || "post").toString().toLowerCase();
          if (cleaned.format === "stories") cleaned.format = "post";
          cleaned.is_personal = Boolean((cleaned as any).is_personal);
          feedByDay.set(dayN, cleaned);
        }
      };
      ingestFeedParsed(feedParsed);

      // Retry automático: se faltam dias E a resposta NÃO foi truncada, pede só os dias faltantes.
      // Truncamento real (max_tokens) não se beneficia de repetir o mesmo prompt.
      const missingDays = FEED_DAYS.filter((d) => !feedByDay.has(d));
      if (missingDays.length > 0 && !feedTruncated) {
        console.warn(`[job ${jobId}] Estágio A: dias faltantes ${JSON.stringify(missingDays)}. Disparando retry direcionado.`);
        await updateJob(jobId, { progress_message: "Refinando seus posts de feed (ajuste fino)…" });

        const retryUser = `${feedUser}

⚠️ ATENÇÃO: na resposta anterior, faltaram os posts dos dias ${missingDays.join(", ")}. Gere AGORA EXATAMENTE ${missingDays.length} post(s) — um para CADA UM dos dias ${missingDays.join(", ")}. Mantenha as MESMAS regras (formatos variados, frameworks internos, sem repetir temas já gerados). Retorne um array JSON com ${missingDays.length} objeto(s).`;

        try {
          const { text: retryRaw, stopReason: retryStop } = await callClaudeWithMeta({
            systemPrompt: feedSystem,
            userText: retryUser,
            max_tokens: 4500,
            timeoutMs: 90000,
            disableRetries: true,
          });
          let retryParsed: any = extractJsonFromLLM(retryRaw);
          if (!Array.isArray(retryParsed) || retryParsed.length === 0) {
            retryParsed = extractPartialDayObjects(retryRaw);
          }
          if (Array.isArray(retryParsed) && retryParsed.length > 0) {
            const before = feedByDay.size;
            ingestFeedParsed(retryParsed);
            console.log(`[job ${jobId}] Estágio A retry: recuperou ${feedByDay.size - before} post(s) extra(s) (stop=${retryStop}).`);
          } else {
            console.warn(`[job ${jobId}] Estágio A retry: não conseguiu extrair posts. stop=${retryStop}, raw len=${retryRaw?.length || 0}.`);
          }
        } catch (retryErr: any) {
          // Não falha o job inteiro por causa do retry — segue com placeholder.
          console.warn(`[job ${jobId}] Estágio A retry falhou:`, retryErr?.message || retryErr);
        }
      }

      // Garante que existe um post para cada dia esperado; se faltar, cria placeholder mínimo
      const feedFinal: FeedPost[] = FEED_DAYS.map((d) => {
        const existing = feedByDay.get(d);
        if (existing) return existing;
        console.warn(`[job ${jobId}] Estágio A: faltando post do dia ${d} mesmo após retry, usando placeholder.`);
        return {
          day: d,
          format: "post",
          pillar: "legacy",
          theme: "Conteúdo a definir",
          caption: "",
          card_copy: [],
          cta: "",
          script: "",
          is_personal: false,
        };
      });

      // Persiste resultado parcial — permite retomar se o estágio B falhar
      await updateJob(jobId, {
        progress_message: "Gerando seus 7 stories da semana (etapa 2 de 2)…",
        result: { stage: "feed_done", feed: feedFinal, generator_version: EDITORIAL_GENERATOR_VERSION },
      });

      // Pausa curta entre estágios para reduzir picos no input-TPM da Anthropic
      // e evitar 429 quando duas chamadas grandes acontecem na mesma janela.
      await new Promise((r) => setTimeout(r, 2000));

      // ==== ESTÁGIO B: Stories (7) ====
      const feedSummaryForStories = feedFinal
        .map((p) => `Dia ${p.day} (${p.format}${p.pillar ? `, pilar=${p.pillar}` : ""}${p.is_personal ? ", pessoal" : ""}): ${p.theme}`)
        .join("\n");

      const storiesSystem =
        NARRATIVE_PRINCIPLES_BLOCK +
        ethicalBlock +
        "\n\n" +
        buildStoriesSystemPrompt(feedSummaryForStories, FEED_DAYS) +
        renderPillarsBlock() +
        renderEditorialFrameworks();
      const storiesUser = `# NEGÓCIO
Empresa: ${business?.company_name || "Não informado"}
Serviços: ${business?.services || "Não informado"}
Público-alvo: ${business?.target_audience || "Não informado"}
Nicho: ${niche || "Não informado"}${verifiableFactsBlock}${storybrandContext}${toneContext}${personalContext}${marketTrendsBlock}

Gere agora os 7 stories da semana.`;

      const { text: storiesRaw, stopReason: storiesStop } = await callClaudeWithMeta({
        systemPrompt: storiesSystem,
        userText: storiesUser,
        max_tokens: 7000,
        timeoutMs: 100000,
        disableRetries: true,
      });
      if (storiesStop === "max_tokens") {
        console.warn(`[job ${jobId}] Estágio B: resposta truncada (max_tokens). raw len=${storiesRaw.length}. Iniciando recuperação parcial.`);
      }

      let storiesParsed: any = extractJsonFromLLM(storiesRaw);
      const storiesTruncated = storiesStop === "max_tokens";
      if (!Array.isArray(storiesParsed) || storiesParsed.length === 0 || storiesTruncated) {
        const partial = extractPartialDayObjects(storiesRaw);
        if (partial.length >= 4) {
          console.warn(`[job ${jobId}] Estágio B: recuperados ${partial.length}/7 stories parciais (truncated=${storiesTruncated}).`);
          storiesParsed = partial;
        } else if (Array.isArray(storiesParsed) && storiesParsed.length > 0) {
          // mantém o que veio
        } else {
          // Falha do B: persiste apenas o feed e marca completed_partial — usuário pode regenerar só os stories
          console.error(`[job ${jobId}] Estágio B falhou. raw len=${storiesRaw?.length || 0}. stop=${storiesStop}`);
          await persistWeek(job.report_id, feedFinal, [], jobId, marketTrends);
          await updateJob(jobId, {
            status: "completed",
            result: {
              stage: "completed_partial",
              feed: feedFinal,
              stories: [],
              generator_version: EDITORIAL_GENERATOR_VERSION,
            },
            progress_message: "Feed gerado. Stories falharam — regenere os stories para completar.",
            finished_at: new Date().toISOString(),
            error_message: "Stories não gerados — use o botão de regenerar story em cada dia.",
          });
          return;
        }
      }

      const storiesByDay = new Map<number, StoryDay>();
      for (const s of storiesParsed) {
        if (!s || typeof s !== "object") continue;
        const dayN = Number((s as any).day);
        if (dayN < 1 || dayN > 7) continue;
        const cleaned = sanitizeStory(s as Record<string, any>) as StoryDay;
        cleaned.day = dayN;
        cleaned.is_personal = Boolean((cleaned as any).is_personal);
        cleaned.mirrors_feed = FEED_DAYS.includes(dayN);
        if (!Array.isArray(cleaned.frames)) cleaned.frames = [];
        storiesByDay.set(dayN, cleaned);
      }

      const storiesFinal: StoryDay[] = [1, 2, 3, 4, 5, 6, 7].map((d) => {
        const existing = storiesByDay.get(d);
        if (existing) return existing;
        console.warn(`[job ${jobId}] Estágio B: faltando story do dia ${d}, usando placeholder.`);
        return {
          day: d,
          theme: "Story a definir",
          frames: [],
          is_personal: !FEED_DAYS.includes(d),
          mirrors_feed: FEED_DAYS.includes(d),
        };
      });

      // Persiste a semana completa
      await updateJob(jobId, { progress_message: "Salvando conteúdo…" });
      const weekObj = await persistWeek(job.report_id, feedFinal, storiesFinal, jobId, marketTrends);

      // Anti-repetição: registra quais traços pessoais aparecem nos textos gerados
      try {
        const usedTraits = detectUsedTraits(personalTraitMap, feedFinal, storiesFinal);
        if (usedTraits.length > 0) {
          const { error: traitErr } = await admin.from("used_personal_traits").insert({
            user_id: userId,
            report_id: job.report_id,
            week_index: typeof job.week_index === "number" ? job.week_index : null,
            traits_used: usedTraits,
          });
          if (traitErr) {
            console.warn(`[job ${jobId}] used_personal_traits insert falhou:`, traitErr.message);
          } else {
            console.log(`[job ${jobId}] traços pessoais usados registrados:`, usedTraits);
          }
        }
      } catch (traitTrackErr) {
        console.warn(`[job ${jobId}] rastreio de traços pessoais falhou (ignorado):`, (traitTrackErr as any)?.message || traitTrackErr);
      }

      // Anti-repetição: registra quais tendências de mercado foram usadas nos textos gerados
      try {
        const usedTrends = detectUsedTrends(filteredMarketTrends, feedFinal, storiesFinal);
        if (usedTrends.length > 0) {
          const { error: trendErr } = await admin.from("used_market_trends").insert({
            user_id: userId,
            report_id: job.report_id,
            week_index: typeof job.week_index === "number" ? job.week_index : null,
            trends_used: usedTrends,
          });
          if (trendErr) {
            console.warn(`[job ${jobId}] used_market_trends insert falhou:`, trendErr.message);
          } else {
            console.log(`[job ${jobId}] tendências usadas registradas:`, usedTrends);
          }
        }
      } catch (trendTrackErr) {
        console.warn(`[job ${jobId}] rastreio de tendências falhou (ignorado):`, (trendTrackErr as any)?.message || trendTrackErr);
      }

      await updateJob(jobId, {
        status: "completed",
        result: {
          stage: "completed",
          week: weekObj,
          generator_version: EDITORIAL_GENERATOR_VERSION,
          // back-compat com o frontend antigo (não quebra o flag editorial)
          editorial: weekObj.days,
        },
        progress_message: "Concluído!",
        finished_at: new Date().toISOString(),
        error_message: null,
      });

      console.log(`Job ${jobId} concluído com sucesso.`);
    } catch (innerErr: any) {
      if (creditReserved) {
        try {
          const { data: cur } = await admin
            .from("user_balances")
            .select("weekly_cycles")
            .eq("user_id", userId)
            .single();
          if (cur) {
            await admin
              .from("user_balances")
              .update({ weekly_cycles: (cur.weekly_cycles || 0) + 1 })
              .eq("user_id", userId);
          }
        } catch (refundErr) {
          console.error("Falha ao devolver crédito:", refundErr);
        }
      }
      throw innerErr;
    }
  } catch (err: any) {
    console.error(`Job ${jobId} falhou:`, err);
    const userMessage = typeof err?.userMessage === "string" && err.userMessage.trim()
      ? err.userMessage
      : "Não foi possível gerar a semana agora. Tente novamente em alguns segundos.";
    await updateJob(jobId, {
      status: "failed",
      error_message: userMessage,
      progress_message: null,
      finished_at: new Date().toISOString(),
    });
  }
}

async function persistWeek(
  reportId: string,
  feed: FeedPost[],
  stories: StoryDay[],
  jobId: string,
  marketTrends: MarketTrend[] = [],
): Promise<{ days: DayV6[]; market_trends?: MarketTrend[] }> {
  const feedByDay = new Map(feed.map((f) => [f.day, f]));
  const storyByDay = new Map(stories.map((s) => [s.day, s]));

  const days: DayV6[] = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
    day: d,
    feed: feedByDay.get(d) ?? null,
    story: storyByDay.get(d) ?? {
      day: d,
      theme: "",
      frames: [],
      is_personal: !FEED_DAYS.includes(d),
      mirrors_feed: FEED_DAYS.includes(d),
    },
    generator_version: EDITORIAL_GENERATOR_VERSION,
  }));

  const weekObj: { days: DayV6[]; market_trends?: MarketTrend[] } = { days };
  if (marketTrends && marketTrends.length > 0) {
    weekObj.market_trends = marketTrends;
  }

  const { data: reportRow } = await admin
    .from("reports")
    .select("editorial_weeks")
    .eq("id", reportId)
    .single();

  const currentWeeks: any[] = Array.isArray(reportRow?.editorial_weeks) ? reportRow!.editorial_weeks : [];
  const updatedWeeks = [...currentWeeks, weekObj];

  await admin
    .from("reports")
    .update({ editorial_weeks: updatedWeeks })
    .eq("id", reportId);

  console.log(`[job ${jobId}] Semana persistida (${days.length} dias, feed=${feed.length}, stories=${stories.length}).`);
  return weekObj;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const jobId = body?.jobId;

    if (!jobId || typeof jobId !== "string") {
      return new Response(JSON.stringify({ error: "jobId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // @ts-ignore — EdgeRuntime existe no runtime Supabase
    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      // @ts-ignore
      EdgeRuntime.waitUntil(processJob(jobId));
    } else {
      await processJob(jobId);
    }

    return new Response(JSON.stringify({ accepted: true, jobId }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("process-content-generation-job error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
