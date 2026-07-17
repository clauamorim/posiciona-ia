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
  fetchWorkspaceBrandType,
  fetchPersonalQuestionnaire,
  renderPersonalContext,
  fetchSalesNarrative,
  renderSalesNarrativeContext,
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
  extractSignaturesForWeek,
  findProhibitedTags,
  renderProhibitedMoldsBlock,
  type PostSignature,
} from "../_shared/patternSignature.ts";
import {
  detectProfession,
  getEthicalRulesBlock,
  renderMarketTrendsBlock,
  POSITIONING_GUARDRAIL_BLOCK,
  type MarketTrend,
} from "../_shared/professionRules.ts";
import {
  validatePostCompliance,
  feedPostToCompliance,
  renderComplianceRetryInstructions,
  type ComplianceViolation,
} from "../_shared/complianceValidator.ts";
import {
  buildDiversityHints,
  fingerprintPost,
  renderDiversityBlock,
  renderPillarPlanBlock,
  renderRetryInstructions,
  validateWeekDiversity,
  type FeedPostLike,
} from "../_shared/editorialDiversity.ts";
import {
  renderSubjectAxisBlock,
  validateWeekSubjects,
  renderSubjectRetryInstructions,
  normalizeSubject,
  SUBJECT_ROTATION_WEEKS,
  type RecentSubject,
} from "../_shared/editorialSubjects.ts";
import {
  FEED_DAYS,
  buildStoriesSystemPrompt,
  extractPartialDayObjects,
  type StoryDay,
} from "../_shared/storiesPromptBuilder.ts";
import { embedTextBatch, postToEmbedText } from "../_shared/embeddings.ts";
import { detectNamedCases } from "../_shared/editorialDiversity.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Dedup v3: extração SEMPRE + tese por cosine + 2º retry agressivo +
// marcação por dia (_dedup_failed) quando ambas tentativas falham.
const DEDUP_WINDOW_DAYS = 56;
const DEDUP_WINDOW_MS = DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const AUDIENCE_QUALIFICATION_THRESHOLD = 0.6;
const AUDIENCE_QUALIFICATION_WINDOW_DAYS = 14;
const THESIS_COSINE_THRESHOLD = 0.70;
const RECENT_HISTORY_WEEKS = 8;

/**
 * Threshold adaptativo de dedup por embedding.
 * Conforme o histórico cresce, a consistência de voz da marca eleva o baseline
 * de similaridade — threshold precisa subir para não entrar em loop de retentativas.
 */
function getAdaptiveDedupThreshold(historyWeekCount: number): number {
  // Calibrado empiricamente em 2026-07-13 com 10 pares reais do usuário 30da289f:
  //   REPEAT confirmado: min=0.9243, média=0.938
  //   DISTINCT confirmado: max=0.9212, média=0.886
  // Gap intrínseco entre as classes é apenas ~0.003 — cosine sozinho não separa
  // 100%. Threshold escolhido logo abaixo do repeat mais fraco; a zona cinza
  // (0.88-0.92) é coberta pelo bloqueio de subject_tag/thesis (dedupBlock).
  if (historyWeekCount < 10) return 0.90;
  if (historyWeekCount < 20) return 0.92;
  return 0.93;
}

// Hard cap de tempo total na fase de dedup de feed (evita worker shutdown por timeout).
const DEDUP_TOTAL_TIMEOUT_MS = 90_000;

// === STORIES DEDUP ===
// Apenas DIA 5 (recap/gancho livre) — DIAS 1-4 espelham feed (coberto pelo feed dedup),
// DIAS 6-7 são pessoais autênticos (repetição natural é desejável).
const STORIES_DEDUP_DAYS = [5];
const STORIES_DEDUP_THRESHOLD = 0.78;
const STORIES_DEDUP_WINDOW_DAYS = 56;
const STORIES_MAX_RETRIES = 2;

interface StoryDedupViolation {
  day: number;
  similarity: number;
  similar_story_text: string;
  similar_week_index: number;
}

function storyToEmbedText(s: { theme?: string; frames?: string[] }): string {
  const theme = (s?.theme || "").trim();
  const frames = Array.isArray(s?.frames) ? s.frames.filter(Boolean).join(" | ") : "";
  return [theme ? `Tema: ${theme}` : "", frames ? `Frames: ${frames}` : ""].filter(Boolean).join("\n").trim();
}

// Bug E fix: normaliza padrões (brand/framework/opening_form) para casamento
// robusto entre semanas. "método de 4 cortes" e "método de N cortes" precisam
// bater. Lower + strip acentos + numerais e palavras-número viram N + remove
// pontuação + colapsa espaços.
const PT_NUMBER_WORDS = new Set([
  "um","uma","dois","duas","tres","três","quatro","cinco","seis","sete","oito",
  "nove","dez","onze","doze","treze","catorze","quatorze","quinze","dezesseis",
  "dezessete","dezoito","dezenove","vinte","cem","cento","mil","n",
]);
function normalizePattern(s: string): string {
  if (!s) return "";
  let n = String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  n = n.replace(/\d+/g, " N ");
  n = n.replace(/[^\p{L}\p{N}\s]/gu, " ");
  const tokens = n.split(/\s+/).filter(Boolean).map((t) => (PT_NUMBER_WORDS.has(t) ? "N" : t));
  return tokens.join(" ").trim();
}

function jaccardSimilarity(a: string, b: string): number {
  const norm = (s: string) =>
    new Set(
      (s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2),
    );
  const A = norm(a);
  const B = norm(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const uni = A.size + B.size - inter;
  return uni > 0 ? inter / uni : 0;
}

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

/** Lê últimas 6 entradas de used_market_trends do usuário. */
async function fetchRecentlyUsedTrendTitles(userId: string): Promise<string[]> {
  try {
    const { data } = await admin
      .from("used_market_trends")
      .select("trends_used")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(6);
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
NORTE DE MONETIZAÇÃO: ensine algo que demonstra profundidade — não dica genérica. Profundidade é o que justifica ticket premium.
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
NORTE DE MONETIZAÇÃO: quebre crença comum do mercado que está custando dinheiro/resultado ao cliente. Quem desmistifica vira referência. Referência cobra mais.
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
    description: `evidencie categoria + critério de cliente ideal por VALOR (não por exclusão literal).
NORTE DE MONETIZAÇÃO: mostre o critério pelo qual esse profissional decide com quem trabalha — e por que esse critério gera melhor resultado para o cliente.
ESCOLHA UMA das seguintes estruturas de abertura (não use a mesma usada em semanas anteriores — varie):
  (A) Comparação com alternativa: "Existem dezenas de ferramentas que fazem [X]. Esta não é uma delas. Veja por quê."
  (B) Perfil do cliente ideal: "Se você é [perfil específico] e [situação concreta], leia até o fim."
  (C) História de não-encaixe: "Cliente chegou pedindo [coisa errada]. Recusei. Aqui está o porquê."
  (D) Definição por contraste: "[Categoria] resolve [problema A]. [Sua marca] resolve [problema diferente]. Não é a mesma coisa."
PROIBIDO o template "[Marca] não é para quem quer X — é para quem quer Y" — está saturado.
Estrutura interna:
  1) qual problema esse profissional resolve que justifica ticket premium
  2) por que a alternativa "mais barata" custa caro no longo prazo
  3) qual é o cliente ideal (perfil + critério de decisão por valor, não por preço)
  4) qual transformação concreta o cliente recebe que justifica o investimento`,
  },
  {
    label: "ANÁLISE DE MERCADO OU CASO",
    description: `se houver tendência relevante no bloco TENDÊNCIAS, use-a como gancho principal. Se não houver tendência pré-listada, pesquise no seu conhecimento um caso, decisão ou evento REAL e NOMEADO do nicho (empresa, pessoa, produto, lei) — nunca mini-caso hipotético genérico.
NORTE DE MONETIZAÇÃO: analise um caso (real ou hipotético com nomes reais) sob a ótica do seu método. Análise revela expertise. Expertise sustenta ticket.
ESCOLHA UMA das seguintes estruturas de abertura (não use a mesma usada em semanas anteriores — varie):
  (A) Manchete + virada: "[Evento real] aconteceu. Aqui está o que ninguém comentou."
  (B) Caso + analogia: "O que aconteceu com [empresa/pessoa] tem tudo a ver com [problema do leitor]."
  (C) Cronologia: "Em [data], [evento]. Em [data posterior], [consequência]. O padrão se repete em [contexto do leitor]."
  (D) Contraste de reações: "Quando [evento] aconteceu, [grupo A] reagiu de um jeito e [grupo B] de outro. Os que prosperaram fizeram X."
Estrutura interna: situação nomeada → decisão/desfecho → aprendizado para o leitor.`,
  },
] as const;
// FEED_DAYS importado de _shared/storiesPromptBuilder.ts

function buildFeedSystemPrompt(rotationOffset: number = 0, brandType: "pessoal" | "institucional" = "pessoal"): string {
  const inst = brandType === "institucional";
  return `Você é um especialista em branding e copy para Instagram. Domina e aplica de forma OBRIGATÓRIA três frameworks (descritos em detalhe ao final deste prompt):
1) StoryBrand — clareza narrativa.
2) Obviously Awesome (April Dunford) — posicionamento específico.
3) Made to Stick (irmãos Heath) — princípios SUCCESs.

Sua tarefa: gerar EXATAMENTE 4 posts de FEED para uma semana editorial. Os posts vão ocupar os DIAS ${FEED_DAYS.join(", ")} da semana.

# RITMO DA SEMANA — REGRA ABSOLUTA:
- DIAS 1, 2, 3, 4 (Seg-Qui): TÊM post de feed + stories temáticos.
- DIAS 5, 6, 7 (Sex, Sáb, Dom): NUNCA têm post de feed. São EXCLUSIVAMENTE stories (sexta = gancho conversacional / recap; sáb-dom = ${inst ? "bastidores leves da marca" : "stories pessoais leves"}).
- Você NÃO gera nada para os dias 5, 6, 7. Eles serão preenchidos com stories em outra etapa.
- Qualquer post que você gerar com "day" ≠ 1, 2, 3 ou 4 será DESCARTADO automaticamente.

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
- "A crença de que [X] resolve [Y]" / "A crença de que [X] vai [verbo qualquer]" (qualquer variante de "A crença de que..." está banida)
- "O Posiciona não é para quem quer [X] — é para quem quer [Y]"
- "[Marca] não é para quem [...] — é para quem [...]"
- "Tem um tipo de profissional que [...]"
- "Todo mundo diz que [...]" (use no MÁXIMO 1x a cada 4 semanas)

🚫 Templates de TÍTULO (não apenas abertura) banidos por saturação:
- "Os [N] elementos que [...]" / "Os [N] passos para [...]" / "Os [N] erros que [...]" — use no MÁXIMO 1x a cada 3 semanas, e quando usar varie o substantivo (elementos, decisões, perguntas, sinais, gatilhos, ajustes)
- "O que o caso [X] revela sobre [Y] para profissionais liberais" — está banido como TEMPLATE. Para posts de ANÁLISE, varie a construção do título:
  • "[Evento real]: o que [grupo X] precisa entender agora"
  • "Em [ano], [empresa/pessoa] fez [decisão]. Veja o que isso muda para [nicho]"
  • "[Caso] aconteceu há [tempo]. Por que [grupo do leitor] deveria ter aprendido com isso"
  • "Quando [evento] aconteceu, [grupo A] reagiu de X jeito. Os que prosperaram fizeram Y"
- "Postar com [X] não resolve [Y]" / "[Ação] não resolve [problema]" — varie a construção
- "Para quem [Marca] faz [X] — e para quem é melhor [Y]" / "Para quem o Posiciona [X] — e para quem [Y]" está banido como abertura literal.
  MAS o RECORTE de cliente ideal continua sendo eixo central — apenas reformule:
  • Comece pelo problema/dor específica do cliente premium (não pela frase de exclusão).
  • Mostre o critério de decisão por valor (não por preço).
  • Termine com convite para quem se reconhece — não com exclusão de quem não serve.
  EXEMPLO BOM: "Quando [problema específico que dói no cliente premium], há dois caminhos: [escolha barata que custa caro] ou [investimento que se paga]. Eu trabalho com quem escolhe o segundo."
- "[X] não constrói autoridade — [Y] constrói" / "[X] não constrói [coisa] — [Y] constrói" — está banido como TEMPLATE para DESMISTIFICAÇÃO. A construção "[ação A] não constrói [substantivo] — [ação B] constrói" foi usada em 2 semanas seguidas. Varie a estrutura completamente (não apenas o objeto).

🏷️ ORÇAMENTO DE MENÇÃO DA MARCA (CRÍTICO):
A palavra "Posiciona" (nome da marca) só pode aparecer em:
- 1 POST de feed por semana — APENAS no post de tipo POSICIONAMENTO
- 1 STORY por semana — APENAS na story que espelha o post de POSICIONAMENTO
Nos outros 3 posts e nas outras 6 stories, é PROIBIDO citar "Posiciona" pelo nome. Fale sobre o tema/método/insight sem usar a marca como anchor.
Motivo: cada post precisa funcionar como insight independente. Se 4 dos 4 posts mencionam a marca, o feed soa como anúncio repetitivo em vez de autoridade construída por consistência de pensamento.

Encerramentos proibidos:
- "o processo que transforma expertise em [presença / autoridade / reconhecimento]"
- "profissionais qualificados continuam invisíveis"
- "antes de qualquer post existir"

ENCERRAMENTOS RECOMENDADOS (priorize):
- Fechamentos que conectem expertise + ticket: ex. "A diferença entre ser mais um e ser o escolhido começa em como você se posiciona."
- Fechamentos que recortem cliente premium: ex. "Não trabalho para quem busca o mais barato. Trabalho para quem busca o melhor resultado."
- Fechamentos que validem valorização: ex. "Cobrar bem não é arrogância. É coerência com o que se entrega."

Vocabulário saturado (use no MÁXIMO 1 vez na semana inteira, somando feed + stories):
- "profissionais qualificados"
- "profissionais liberais"
- "identidade de marca"
- "autoridade digital"
- "Instagram que não representa quem é"

🎯 DESCRITORES DO PÚBLICO-ALVO (REGRA DE VARIEDADE):
Em vez de "profissionais qualificados" / "profissionais liberais" como descritor padrão (saturado), VARIE a cada post usando descritores específicos extraídos do contexto do criador. Modelos aceitáveis:
- Profissão + segmento: "advogadas de direito de família que atendem PJ", "médicos endocrinologistas focados em emagrecimento feminino"
- Característica + dor: "consultores experientes cansados de competir por preço", "psicólogas que atendem público de alto valor"
- Estágio + frustração: "profissionais com 10+ anos de experiência que viraram invisíveis no digital", "especialistas no offline que não conseguem traduzir competência no online"
- Volume + situação: "empresários que faturam acima de 500k/ano e ainda postam manualmente", "advogadas com 50+ clientes ativos e zero estratégia de aquisição"
REGRA: cada um dos 4 posts da semana DEVE usar um descritor DIFERENTE. Nunca repita "profissionais qualificados" em mais de 1 post da mesma semana. Use o bloco "NEGÓCIO" + "CONTEXTO PESSOAL" para extrair detalhes específicos do nicho do criador e construir descritores ricos.

DESCRITORES ADICIONAIS (use também — cobrem público em construção de autoridade):
- "profissional que decidiu parar de competir por preço"
- "[profissão] que quer ser pago pelo valor que entrega"
- "[profissão] em transição de volume para valor"
- "[profissão] construindo autoridade no digital"
- "[profissão] cansado de cliente que pechincha"

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

E) Pilar "bastidor" (${inst ? "bastidores da marca" : "storytelling pessoal"}):
- O pilar "bastidor" aparece NO MÁXIMO 1 vez por semana e SOMENTE se estiver na lista de pilares SUB-REPRESENTADOS desta semana (veja bloco ROTAÇÃO DE PILARES no prompt do usuário).
- Se "bastidor" NÃO estiver sub-representado, NENHUM post desta semana é pessoal (is_personal=false em todos).
${inst ? `- Quando usar, marque is_personal=true e use um fato REAL da marca (história de fundação, caso de cliente do bloco "NARRATIVA DE VENDA", processo interno) como metáfora para a dor do cliente. NUNCA vida pessoal de um indivíduo, NUNCA fato inventado.` : `- Quando usar, marque is_personal=true e use vivência REAL do criador (do bloco "CONTEXTO PESSOAL DO CRIADOR") como metáfora para a dor do cliente. Nunca invente fatos pessoais.`}

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
    "subject_tag": "assunto-concreto-em-kebab-case",
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
- "subject_tag" obrigatório: o ASSUNTO concreto do nicho em kebab-case; os 4 posts precisam usar 4 assuntos DIFERENTES e nenhum pode repetir assunto recente (ver bloco EIXO DE ASSUNTO).
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
5. Os 4 "subject_tag" são DIFERENTES entre si e nenhum repete assunto da lista ASSUNTOS USADOS RECENTEMENTE?
6. is_personal=true SOMENTE em post com pillar="bastidor"?
7. Cada número, case, métrica ou exemplo concreto citado existe LITERALMENTE no bloco FATOS VERIFICÁVEIS? Se não, foi reescrito como pergunta/hipótese explícita?
Confirme tudo antes de enviar.`;
}

// buildStoriesSystemPrompt e extractPartialDayObjects são importados de
// _shared/storiesPromptBuilder.ts (compartilhado com process-stories-generation-job).

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
  subject_tag?: string;
  _dedup_failed?: boolean;
}

// StoryDay agora vem do _shared/storiesPromptBuilder.ts

interface DayV6 {
  day: number;
  feed: FeedPost | null;
  story: StoryDay;
  generator_version: string;
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
      // Stories pessoais (dias 5-7) de semanas anteriores. Carregado direto do
      // DB no bloco abaixo porque previousWeeks vem stripado do frontend.
      let previousPersonalStoriesSummary = "";
      const rotationHint = getPillarRotationHint(previousPillarsByWeek);
      const rotationBlock = renderRotationBlock(rotationHint);
      // Offset cíclico (0..3) para variar qual tipo de post (EDU/DES/POS/MER) vai para o Dia 1 a cada semana.
      const rotationOffset = (previousWeeks?.length || 0) % 4;

      const storybrandContext = renderStorybrandBlock(storybrand);
      const toneContext = renderToneBlock(tone_of_voice);
      const verifiableFactsBlock = renderVerifiableFactsBlock(business);
      // Tipo de marca dirige o editorial: institucional não usa vida pessoal.
      const brandType = await fetchWorkspaceBrandType(userId);
      const personal = brandType === "institucional" ? null : await fetchPersonalQuestionnaire(userId);
      const personalContext = renderPersonalContext(personal);
      // Narrativa de Venda: enriquece o feed com objeções reais, casos cadastrados
      // e história de virada. Render block tem regras de uso por pilar e omite
      // campos vazios — seguro pra rascunhos parciais.
      const salesNarrative = await fetchSalesNarrative(userId);
      const salesNarrativeContext = renderSalesNarrativeContext(salesNarrative);

      // Profissão regulamentada (OAB / CFM) e tendências de mercado
      const { data: profileRow } = await admin
        .from("profiles")
        .select("profession, niche")
        .eq("user_id", userId)
        .maybeSingle();
      const professionCategory = detectProfession({
        profession: profileRow?.profession,
        niche: profileRow?.niche,
        // `business` vem do questionário — pode trazer pistas adicionais (services/target_audience)
        business_description: [business?.services, business?.target_audience, business?.company_name]
          .filter((v: any) => typeof v === "string" && v.trim())
          .join(" "),
      });
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

      // Hints de diversidade — fórmulas e conceitos centrais usados nas últimas 2 semanas
      let diversityHints = { bannedFormulas: [] as any[], dampenedConcepts: [] as any[] };
      try {
        const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
        const { data: patternRows } = await admin
          .from("used_title_patterns")
          .select("title_formula, central_concepts, named_cases, created_at")
          .eq("user_id", userId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(40);
        diversityHints = buildDiversityHints((patternRows as any[]) || []);
      } catch (hintErr) {
        console.warn(`[job ${jobId}] buildDiversityHints falhou (ignorado):`, (hintErr as any)?.message || hintErr);
      }

      // === MOLDES PROIBIDOS — carrega signatures direto do DB, não do previousWeeks ===
      // Razão: previousWeeks vem stripado do frontend (apenas {day, theme, format}),
      // sem _dedup_metrics. As signatures estão persistidas em reports.editorial_weeks[].
      const currentWeekIdx = typeof job.week_index === "number" ? job.week_index : -1;
      const historicalSignaturesByWeek: Array<{ weekIndex: number; signatures: PostSignature[] }> = [];
      // Eixo de ASSUNTO: assuntos usados nas últimas semanas, lidos do subject_tag
      // de cada post já persistido (reports.editorial_weeks[].days[].feed.subject_tag).
      const recentSubjects: RecentSubject[] = [];
      try {
        const { data: reportRow } = await admin
          .from("reports")
          .select("editorial_weeks")
          .eq("id", job.report_id)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();
        const allWeeks = (reportRow?.editorial_weeks || []) as any[];
        const recent = allWeeks
          .filter((w: any) => {
            const wkIdx = w?._week_index ?? -1;
            return wkIdx >= 0 && wkIdx !== currentWeekIdx;
          })
          .sort((a: any, b: any) => (b._week_index ?? 0) - (a._week_index ?? 0))
          .slice(0, 8);
        const personalItems: string[] = [];
        const recentSubjectsByWeek: Array<{ weekIndex: number; subjects: Array<{ tag: string; theme?: string }> }> = [];
        for (const week of recent) {
          const wkIdx = week?._week_index ?? 0;
          const subjectsThisWeek: Array<{ tag: string; theme?: string }> = [];
          const sigs = week?._dedup_metrics?._pattern_signatures;
          if (Array.isArray(sigs) && sigs.length > 0) {
            historicalSignaturesByWeek.push({ weekIndex: wkIdx, signatures: sigs as PostSignature[] });
          }
          // Stories pessoais (Sex/Sáb/Dom) — tema, para anti-repetição de
          // cenário/figura/ritual no estágio B (haras, varanda, biografia da avó).
          const days = Array.isArray(week?.days) ? week.days : [];
          for (const d of days) {
            const feedPrev = d?.feed;
            if (feedPrev && typeof feedPrev.subject_tag === "string" && feedPrev.subject_tag.trim()) {
              subjectsThisWeek.push({
                tag: feedPrev.subject_tag.trim(),
                theme: typeof feedPrev.theme === "string" ? feedPrev.theme : undefined,
              });
            }
            const story = d?.story;
            if (story && typeof story.theme === "string" && story.theme.trim() && !story.mirrors_feed) {
              const dayN = typeof d?.day === "number" ? d.day : null;
              const labelDia = dayN === 6 ? "sábado" : dayN === 7 ? "domingo" : dayN === 5 ? "sexta" : `dia${dayN ?? "?"}`;
              personalItems.push(`[story-${labelDia}] ${story.theme.trim()}`);
            }
          }
          if (subjectsThisWeek.length > 0) {
            recentSubjectsByWeek.push({ weekIndex: wkIdx, subjects: subjectsThisWeek });
          }
        }
        // Achata os assuntos das últimas SUBJECT_ROTATION_WEEKS semanas (recent vem desc).
        for (const w of recentSubjectsByWeek.slice(0, SUBJECT_ROTATION_WEEKS)) {
          for (const s of w.subjects) {
            const tag = normalizeSubject(s.tag);
            if (tag) recentSubjects.push({ tag, raw: s.tag, weekIndex: w.weekIndex, theme: s.theme });
          }
        }
        // Mantém apenas os 10 stories pessoais mais recentes (≈ 3-4 semanas).
        previousPersonalStoriesSummary = personalItems.slice(-10).join("\n");
        console.log(`[stories-anti-repeat] week=${currentWeekIdx} prev_personal_stories=${personalItems.length}`);
      } catch (e: any) {
        console.warn("[pattern-signature] Falha ao carregar signatures históricas do DB:", e?.message || e);
      }
      const prohibitedTags = findProhibitedTags(historicalSignaturesByWeek);
      const prohibitedMoldsBlock = renderProhibitedMoldsBlock(historicalSignaturesByWeek, prohibitedTags);
      console.log(`[pattern-signature] ${historicalSignaturesByWeek.length} semanas com signatures carregadas do DB | ${prohibitedTags.length} tags proibidas: ${prohibitedTags.map((t) => t.tag).join(", ")}`);
      console.log(`[pattern-signature] prohibitedMoldsBlock length: ${prohibitedMoldsBlock.length} chars`);

      // ==== ESTÁGIO A: Feed (4 posts) ====
      await updateJob(jobId, { progress_message: "Gerando seus 4 posts de feed (etapa 1 de 2)…" });

      const feedSystem =
        NARRATIVE_PRINCIPLES_BLOCK +
        POSITIONING_GUARDRAIL_BLOCK +
        renderPillarPlanBlock() +
        renderDiversityBlock(diversityHints as any) +
        renderSubjectAxisBlock(recentSubjects) +
        ethicalBlock +
        "\n\n" +
        buildFeedSystemPrompt(rotationOffset, brandType) +
        renderPillarsBlock() +
        prohibitedMoldsBlock +
        renderEditorialFrameworks();
      const feedUser = `# NEGÓCIO
Empresa: ${business?.company_name || "Não informado"}
Serviços: ${business?.services || "Não informado"}
Público-alvo: ${business?.target_audience || "Não informado"}
Nicho: ${niche || "Não informado"}${verifiableFactsBlock}${storybrandContext}${toneContext}${personalContext}${salesNarrativeContext}${recentTraitsBlock}${rotationBlock}

# TEMAS JÁ PUBLICADOS (NÃO REPETIR — formato "[pilar] tema (formato)")
${previousSummary || "Nenhum conteúdo anterior."}${marketTrendsBlock}

ANTES DE GERAR, leia os TEMAS JÁ PUBLICADOS acima. Para CADA post desta semana:
1. Identifique se algum template/estrutura de abertura foi usado nos posts anteriores listados
2. Para o tipo de post da vez, ESCOLHA uma estrutura de abertura DIFERENTE das já usadas
3. Verifique se nenhuma das "FRASES PROIBIDAS" do system prompt aparece na sua saída
4. Confirme que os CTAs dos 4 posts são de naturezas diferentes (não todos "Me chame no direct")
5. Confirme que os 4 ASSUNTOS (subject_tag) são diferentes entre si E não repetem nenhum tema da lista acima — variar formato/pilar NÃO basta, o assunto precisa ser novo

Gere agora os 4 posts de feed para os dias ${FEED_DAYS.join(", ")}.`;

      const { text: feedRaw, stopReason: feedStop } = await callClaudeWithMeta({
        systemPrompt: feedSystem,
        userText: feedUser,
        model: "claude-opus-4-7",
        max_tokens: 8500,
        timeoutMs: 180000,
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
          if (!FEED_DAYS.includes(dayN)) {
            // Ritmo semanal: feed só em dias 1-4. Descarta o resto com log.
            if (Number.isFinite(dayN)) {
              console.warn(`[job ${jobId}] Ritmo: descartado post de feed do dia ${dayN} (fora de Seg-Qui).`);
            }
            continue;
          }
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

      // Retry automático: se faltam dias, pede só os dias faltantes.
      // Vale também para truncamento (max_tokens): o retry NÃO repete o pedido
      // inteiro — pede apenas os dias que faltam, que cabem no orçamento menor
      // do retry. Sem isso, semanas truncadas ficavam permanentemente com 2/4
      // posts (bug observado em produção em 14/07/2026).
      const missingDays = FEED_DAYS.filter((d) => !feedByDay.has(d));
      if (missingDays.length > 0) {
        console.warn(`[job ${jobId}] Estágio A: dias faltantes ${JSON.stringify(missingDays)}. Disparando retry direcionado.`);
        await updateJob(jobId, { progress_message: "Refinando seus posts de feed (ajuste fino)…" });

        const retryUser = `${feedUser}

⚠️ ATENÇÃO: na resposta anterior, faltaram os posts dos dias ${missingDays.join(", ")}. Gere AGORA EXATAMENTE ${missingDays.length} post(s) — um para CADA UM dos dias ${missingDays.join(", ")}. Mantenha as MESMAS regras (formatos variados, frameworks internos, sem repetir temas já gerados). Retorne um array JSON com ${missingDays.length} objeto(s).`;

        try {
          const { text: retryRaw, stopReason: retryStop } = await callClaudeWithMeta({
            systemPrompt: feedSystem,
            userText: retryUser,
            model: "claude-opus-4-7",
            max_tokens: 4500,
            timeoutMs: 120000,
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

      // ==== Validação de diversidade + retry guiado (não bloqueia entrega) ====
      // Escopo do retry: a semana INTEIRA é re-prompt-ada com `feedUser`, mas só os
      // dias retornados pela LLM substituem `feedFinal` (replaceMap). Na prática a
      // LLM costuma reescrever só os dias listados em `renderRetryInstructions`,
      // mantendo os demais como contexto no prompt original.
      try {
        const validation = validateWeekDiversity(feedFinal as unknown as FeedPostLike[], diversityHints as any);
        console.log(
          `[editorial-diversity] week=${job.week_index} user=${userId} violations=${JSON.stringify(
            validation.violations.map((v) => v.rule),
          )} retry_triggered=${!validation.ok}`,
        );
        if (!validation.ok) {
          console.warn(`[job ${jobId}] diversidade: violações detectadas`, validation.violations);
          await updateJob(jobId, { progress_message: "Ajustando diversidade dos posts…" });
          const retryUser = `${feedUser}${renderRetryInstructions(validation.violations)}`;
          try {
            const { text: divRetryRaw } = await callClaudeWithMeta({
              systemPrompt: feedSystem,
              userText: retryUser,
              model: "claude-opus-4-7",
              max_tokens: 4500,
              timeoutMs: 120000,
              disableRetries: true,
            });
            let divRetryParsed: any = extractJsonFromLLM(divRetryRaw);
            if (!Array.isArray(divRetryParsed) || divRetryParsed.length === 0) {
              divRetryParsed = extractPartialDayObjects(divRetryRaw);
            }
            if (Array.isArray(divRetryParsed) && divRetryParsed.length > 0) {
              const replaceMap = new Map<number, FeedPost>();
              for (const p of divRetryParsed) {
                if (!p || typeof p !== "object") continue;
                const dayN = Number((p as any).day);
                if (!FEED_DAYS.includes(dayN)) continue;
                const cleaned = sanitizePost(p as Record<string, any>) as FeedPost;
                cleaned.day = dayN;
                cleaned.format = (cleaned.format || "post").toString().toLowerCase();
                if (cleaned.format === "stories") cleaned.format = "post";
                cleaned.is_personal = Boolean((cleaned as any).is_personal);
                replaceMap.set(dayN, cleaned);
              }
              // Snapshot dos títulos antes da substituição para log estruturado.
              const beforeTitles = new Map<number, string>();
              feedFinal.forEach((p) => beforeTitles.set(p.day, String((p as any).theme || "")));
              for (let i = 0; i < feedFinal.length; i++) {
                const r = replaceMap.get(feedFinal[i].day);
                if (r) feedFinal[i] = r;
              }
              // Log por-dia: regra detectada + título original + título reescrito.
              for (const v of validation.violations) {
                for (const day of v.days) {
                  const r = replaceMap.get(day);
                  console.log(
                    `[editorial-diversity-fix] week=${job.week_index} day=${day}\n` +
                    `  detected_rule=${(v as any).type || (v as any).rule}\n` +
                    `  detail=${JSON.stringify(v.detail)}\n` +
                    `  original_title=${JSON.stringify(beforeTitles.get(day) || "")}\n` +
                    `  regenerated_title=${JSON.stringify(r ? String((r as any).theme || "") : "(não reescrito)")}\n` +
                    `  iterations=1`,
                  );
                }
              }
              const after = validateWeekDiversity(feedFinal as unknown as FeedPostLike[], diversityHints as any);
              if (!after.ok) {
                console.warn(`[job ${jobId}] [editorial-diversity] retry-violation`, {
                  user_id: userId,
                  week_index: job.week_index,
                  violations: after.violations,
                });
              } else {
                console.log(`[job ${jobId}] [editorial-diversity] retry-ok`);
              }
            } else {
              console.warn(`[job ${jobId}] diversidade: retry sem posts válidos, mantendo versão original.`);
            }
          } catch (divRetryErr: any) {
            console.warn(`[job ${jobId}] diversidade: retry falhou (mantendo versão original):`, divRetryErr?.message || divRetryErr);
          }
        }
      } catch (divErr) {
        console.warn(`[job ${jobId}] validação de diversidade falhou (ignorada):`, (divErr as any)?.message || divErr);
      }

      // ==== Validação de ROTAÇÃO DE ASSUNTO + retry guiado (não bloqueia entrega) ====
      // Eixo de TEMA: complementa a diversidade (forma) e a rotação de pilar
      // (intenção). É o eixo que faltava — impede o mesmo ASSUNTO de voltar
      // semana após semana sob formato/pilar diferentes.
      let subjectByDayFinal: Record<number, string> = {};
      try {
        const subjValidation = validateWeekSubjects(feedFinal as any, recentSubjects);
        subjectByDayFinal = subjValidation.subjectByDay;
        console.log(
          `[editorial-subject] week=${job.week_index} user=${userId} subjects=${JSON.stringify(subjectByDayFinal)} violations=${JSON.stringify(subjValidation.violations.map((v) => v.rule))} retry_triggered=${!subjValidation.ok}`,
        );
        if (!subjValidation.ok) {
          console.warn(`[job ${jobId}] assunto: violações detectadas`, subjValidation.violations);
          await updateJob(jobId, { progress_message: "Variando os assuntos da semana…" });
          const retryUser = `${feedUser}${renderSubjectRetryInstructions(subjValidation.violations, recentSubjects)}`;
          try {
            const { text: subjRetryRaw } = await callClaudeWithMeta({
              systemPrompt: feedSystem,
              userText: retryUser,
              model: "claude-opus-4-7",
              max_tokens: 4500,
              timeoutMs: 120000,
              disableRetries: true,
            });
            let subjParsed: any = extractJsonFromLLM(subjRetryRaw);
            if (!Array.isArray(subjParsed) || subjParsed.length === 0) {
              subjParsed = extractPartialDayObjects(subjRetryRaw);
            }
            if (Array.isArray(subjParsed) && subjParsed.length > 0) {
              const replaceMap = new Map<number, FeedPost>();
              for (const p of subjParsed) {
                if (!p || typeof p !== "object") continue;
                const dayN = Number((p as any).day);
                if (!FEED_DAYS.includes(dayN)) continue;
                const cleaned = sanitizePost(p as Record<string, any>) as FeedPost;
                cleaned.day = dayN;
                cleaned.format = (cleaned.format || "post").toString().toLowerCase();
                if (cleaned.format === "stories") cleaned.format = "post";
                cleaned.is_personal = Boolean((cleaned as any).is_personal);
                replaceMap.set(dayN, cleaned);
              }
              for (let i = 0; i < feedFinal.length; i++) {
                const r = replaceMap.get(feedFinal[i].day);
                if (r) feedFinal[i] = r;
              }
              const after = validateWeekSubjects(feedFinal as any, recentSubjects);
              subjectByDayFinal = after.subjectByDay;
              console.log(
                `[job ${jobId}] [editorial-subject] retry ${after.ok ? "ok" : "ainda-viola"} subjects=${JSON.stringify(after.subjectByDay)}`,
              );
            } else {
              console.warn(`[job ${jobId}] assunto: retry sem posts válidos, mantendo versão original.`);
            }
          } catch (subjRetryErr: any) {
            console.warn(`[job ${jobId}] assunto: retry falhou (mantendo versão original):`, subjRetryErr?.message || subjRetryErr);
          }
        }
      } catch (subjErr) {
        console.warn(`[job ${jobId}] validação de assunto falhou (ignorada):`, (subjErr as any)?.message || subjErr);
      }

      // ==== Validação de compliance ético (profissões regulamentadas) ====
      // Roda APÓS diversidade. Retry guiado apenas para violações "high".
      // Nunca bloqueia entrega — falhas persistentes são logadas para auditoria.
      try {
        if (professionCategory !== "outro") {
          const perPostViolations: Array<{ day: number; idx: number; violations: ComplianceViolation[] }> = [];
          feedFinal.forEach((p, idx) => {
            const v = validatePostCompliance(feedPostToCompliance(p), professionCategory);
            if (v.length === 0) return;
            const high = v.filter((x) => x.severity === "high");
            const medium = v.filter((x) => x.severity === "medium");
            if (high.length > 0) {
              console.warn(`[job ${jobId}] [compliance] day=${p.day} HIGH violations:`, high);
              perPostViolations.push({ day: p.day, idx, violations: v });
            } else if (medium.length > 0) {
              console.log(`[job ${jobId}] [compliance] day=${p.day} medium violations:`, medium);
            }
          });

          console.log(
            `[editorial-compliance] week=${job.week_index} user=${userId} profession=${professionCategory} violations=${JSON.stringify(
              perPostViolations.flatMap((p) => p.violations.map((v) => `${p.day}:${v.rule}`)),
            )} retry_triggered=${perPostViolations.length > 0}`,
          );

          if (perPostViolations.length > 0) {
            await updateJob(jobId, { progress_message: "Ajustando compliance ético dos posts…" });
            // Retry PARCIAL: pedimos para a LLM reescrever apenas os dias violadores.
            // Passamos os demais posts como "contexto a preservar" para evitar
            // incoerências de tema/sequência narrativa na semana.
            const violatingDays = new Set(perPostViolations.map((p) => p.day));
            const keepContext = feedFinal
              .filter((p) => !violatingDays.has(p.day))
              .map((p) => `Dia ${p.day} (MANTER, não reescrever): tema="${p.theme}" | título="${(p as any).title || ""}"`)
              .join("\n");
            const retryUser = `${feedUser}\n\n# CONTEXTO DA SEMANA (NÃO REESCREVER)\nOs posts abaixo já foram aprovados e devem ser respeitados como contexto narrativo. Não repita seus temas/ângulos nos posts reescritos.\n${keepContext}${renderComplianceRetryInstructions(
              perPostViolations.map(({ day, violations }) => ({ day, violations })),
            )}`;
            try {
              const { text: compRetryRaw } = await callClaudeWithMeta({
                systemPrompt: feedSystem,
                userText: retryUser,
                model: "claude-opus-4-7",
                max_tokens: 4500,
                timeoutMs: 120000,
                disableRetries: true,
              });
              let compRetryParsed: any = extractJsonFromLLM(compRetryRaw);
              if (!Array.isArray(compRetryParsed) || compRetryParsed.length === 0) {
                compRetryParsed = extractPartialDayObjects(compRetryRaw);
              }
              if (Array.isArray(compRetryParsed) && compRetryParsed.length > 0) {
                const replaceMap = new Map<number, FeedPost>();
                for (const p of compRetryParsed) {
                  if (!p || typeof p !== "object") continue;
                  const dayN = Number((p as any).day);
                  if (!FEED_DAYS.includes(dayN)) continue;
                  const cleaned = sanitizePost(p as Record<string, any>) as FeedPost;
                  cleaned.day = dayN;
                  cleaned.format = (cleaned.format || "post").toString().toLowerCase();
                  if (cleaned.format === "stories") cleaned.format = "post";
                  cleaned.is_personal = Boolean((cleaned as any).is_personal);
                  replaceMap.set(dayN, cleaned);
                }
                for (let i = 0; i < feedFinal.length; i++) {
                  const r = replaceMap.get(feedFinal[i].day);
                  if (r) feedFinal[i] = r;
                }
                // Re-checa: se ainda houver "high", aceita e loga.
                feedFinal.forEach((p) => {
                  const after = validatePostCompliance(feedPostToCompliance(p), professionCategory);
                  const stillHigh = after.filter((x) => x.severity === "high");
                  if (stillHigh.length > 0) {
                    console.warn(`[job ${jobId}] [compliance] HIGH violation persisted day=${p.day}`, {
                      user_id: userId,
                      profession: professionCategory,
                      violations: stillHigh,
                    });
                  }
                });
              } else {
                console.warn(`[job ${jobId}] compliance: retry sem posts válidos, mantendo versão original.`);
              }
            } catch (compRetryErr: any) {
              console.warn(`[job ${jobId}] compliance: retry falhou (mantendo versão original):`, compRetryErr?.message || compRetryErr);
            }
          }
        }
      } catch (compErr) {
        console.warn(`[job ${jobId}] validação de compliance falhou (ignorada):`, (compErr as any)?.message || compErr);
      }


      // ==== SAVE PARCIAL: persiste o feed ANTES de iniciar Estágio B ====
      // Se o Claude falhar no Estágio B (instabilidade da API), o feed (4 chamadas pagas)
      // não é perdido. A entrada parcial é substituída quando os stories chegarem.
      const wkIdxForPartial = typeof job.week_index === "number" ? job.week_index : 0;

      // Métricas do detector semântico — persistidas dentro de editorial_weeks[i]
      // para histórico/calibração. Sobrevive ao try/catch.
      let dedupMeta: Record<string, any> | null = null;
      const dedupFailedDays: number[] = [];
      // Hoisted para escopo externo — usada tanto pelo dedup quanto pelo
      // bloco [embed-persist] após o try/catch do dedup. Declarada aqui
      // (não dentro do try) para sobreviver ao fechamento do bloco.
      const finalVectorByDay = new Map<number, number[]>();

      // ==== Dedup v3: extração SEMPRE + 5 dimensões + 2 retries ====
      const dedupStartTime = Date.now();
      const adaptiveThreshold = getAdaptiveDedupThreshold(previousWeeks?.length || 0);
      const dedupTimeBudgetExceeded = () => (Date.now() - dedupStartTime) > DEDUP_TOTAL_TIMEOUT_MS;
      console.log(`[semantic-dedup] adaptive-threshold week=${typeof job.week_index === "number" ? job.week_index : 0} history=${previousWeeks?.length || 0} threshold=${adaptiveThreshold}`);
      try {
        const candidates = feedFinal
          .map((p, idx) => ({ p, idx }))
          .filter(({ p }) => p && (p.theme || p.caption));
        if (candidates.length === 0) throw new Error("no_candidates");

        // ---- 1) Embedding match (últimos 56d) ----
        const candTexts = candidates.map(({ p }) => postToEmbedText(p));
        const candVectors = await embedTextBatch(candTexts);
        // Acumulador de vetores finais por dia — alimentado por cand inicial + reval 1º + 2º retry.
        // Persistido ANTES do save parcial para que próximas semanas vejam estes embeddings.
        // finalVectorByDay hoisted acima do try — apenas popula aqui.
        for (let i = 0; i < candVectors.length; i++) {
          const v = candVectors[i];
          if (v) finalVectorByDay.set(candidates[i].p.day, v);
        }
        const since = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
        type EmbMatch = { day: number; matches: any[]; topSim: number };
        const embeddingViolations: EmbMatch[] = [];
        for (let i = 0; i < candVectors.length; i++) {
          const vec = candVectors[i];
          if (!vec) continue;
          const day = candidates[i].p.day;
          const { data, error } = await admin.rpc("match_post_embeddings", {
            p_user_id: userId,
            p_query: vec as any,
            p_since: since,
            p_threshold: adaptiveThreshold,
            p_limit: 5,
          });
          if (error) {
            console.warn(`[semantic-dedup] rpc error day=${day}:`, error.message);
            continue;
          }
          if (Array.isArray(data) && data.length > 0) {
            const topSim = Math.max(...data.map((m: any) => Number(m.similarity) || 0));
            embeddingViolations.push({ day, matches: data, topSim });
            for (const m of data) {
              console.log(
                `[semantic-dedup-fix] week=${wkIdxForPartial} day=${day} matched_week=${m.week_index} matched_day=${m.day_index} similarity=${Number(m.similarity).toFixed(3)}`,
              );
            }
          }
        }

        // ---- 2) Extração SEMPRE via Gemini Flash Lite ----
        type DayTargets = {
          day: number;
          brands: string[];
          frameworks: string[];
          opening_forms: string[];
          thesis_summary: string;
          audience_qualification_score: number;
          match_theses: { week_index: number; day_index: number; thesis: string; similarity: number }[];
        };
        let dayTargets: DayTargets[] = [];
        let extractionSource: "gemini-flash-lite" | "fallback-raw" = "fallback-raw";
        try {
          const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
          if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");

          const matchesByDay = new Map(embeddingViolations.map((v) => [v.day, v.matches]));
          const extractionInput = candidates
            .map(({ p }) => {
              const candText = postToEmbedText(p).slice(0, 700);
              const dayMatches = matchesByDay.get(p.day);
              const matchesText = dayMatches && dayMatches.length > 0
                ? dayMatches
                    .map(
                      (m: any, idx: number) =>
                        `${idx + 1}. [Sem ${m.week_index ?? "?"} dia ${m.day_index ?? "?"} sim=${Number(m.similarity).toFixed(2)}] ${String(m.text_used || "").slice(0, 500)}`,
                    )
                    .join("\n")
                : "(nenhum match — match_theses=[])";
              return (
                `## Dia ${p.day}\n` +
                `### CANDIDATE:\n${candText}\n` +
                `### MATCHES:\n${matchesText}`
              );
            })
            .join("\n\n");

          const extractionSystem =
            "Você extrai padrões repetitivos de posts de redes sociais em português. " +
            "Para CADA dia listado, identifique a partir do CANDIDATE: " +
            "(1) brands — marcas/produtos/autores/livros citados nominalmente OU por descrição inequívoca. " +
            "NORMALIZAÇÃO: 'Strunk & White'/'Elements of Style' → 'Strunk & White'. Use nome canônico. " +
            "(2) frameworks — estruturas numéricas/metodológicas (ex.: 'método de 4 cortes' → 'método de N elementos'). " +
            "(3) opening_forms — fôrmas narrativas de abertura recorrentes. " +
            "Trate 'A [crença/regra/ideia/conselho] de X está Y' como UMA fôrma única — retorne 'A [crença/regra/ideia] de X está Y'. " +
            "(4) thesis_summary — UMA frase em pt-BR com a tese central do CANDIDATE no formato '[sujeito] [verbo] [consequência]'. " +
            "(5) audience_qualification_score — 0.0 a 1.0 (0=técnico puro; 1=post inteiro sobre 'atendo X, não atendo Y'). " +
            "(6) match_theses — array com a thesis_summary de CADA um dos MATCHES (vazio se não houver MATCHES). " +
            "Retorne APENAS um JSON array, sem markdown: " +
            '[{"day": N, "brands": [], "frameworks": [], "opening_forms": [], "thesis_summary": "...", "audience_qualification_score": 0.0, "match_theses": [{"week_index": N, "day_index": N, "thesis": "...", "similarity": 0.0}]}].';

          const extractionResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                { role: "system", content: extractionSystem },
                { role: "user", content: extractionInput },
              ],
            }),
          });
          if (!extractionResp.ok) throw new Error(`gateway ${extractionResp.status}`);
          const extractionJson = await extractionResp.json();
          const parsed = extractJsonFromLLM(String(extractionJson?.choices?.[0]?.message?.content || ""));
          if (!Array.isArray(parsed)) throw new Error("extração não retornou array");
          dayTargets = parsed
            .filter((t: any) => t && Number.isFinite(Number(t.day)))
            .map((t: any) => ({
              day: Number(t.day),
              brands: Array.isArray(t.brands) ? t.brands.map(String) : [],
              frameworks: Array.isArray(t.frameworks) ? t.frameworks.map(String) : [],
              opening_forms: Array.isArray(t.opening_forms) ? t.opening_forms.map(String) : [],
              thesis_summary: typeof t.thesis_summary === "string" ? t.thesis_summary : "",
              audience_qualification_score: Math.max(0, Math.min(1, Number(t.audience_qualification_score) || 0)),
              match_theses: Array.isArray(t.match_theses)
                ? t.match_theses
                    .filter((m: any) => m && typeof m === "object")
                    .map((m: any) => ({
                      week_index: Number(m.week_index ?? -1),
                      day_index: Number(m.day_index ?? -1),
                      thesis: typeof m.thesis === "string" ? m.thesis : "",
                      similarity: Number(m.similarity) || 0,
                    }))
                : [],
            }));
          extractionSource = "gemini-flash-lite";
        } catch (extractErr: any) {
          console.warn(`[semantic-dedup] entity-extraction-failed (fallback):`, extractErr?.message || extractErr);
          dayTargets = [];
        }

        // ---- 3) Carrega histórico (últimas 8 semanas) ----
        const recentBrands = new Set<string>();
        const recentFrameworks = new Set<string>();
        const recentOpeningForms = new Set<string>();
        const brandLastSeen = new Map<string, { value: string; weekIndex: number }>();
        const frameworkLastSeen = new Map<string, { value: string; weekIndex: number }>();
        const openingFormLastSeen = new Map<string, { value: string; weekIndex: number }>();
        const recentTheses: { week_index: number; thesis: string }[] = [];
        const recentAudienceScores: { week_index: number; score: number }[] = [];
        try {
          const { data: reportRow } = await admin
            .from("reports")
            .select("editorial_weeks")
            .eq("id", job.report_id)
            .maybeSingle();
          const allWeeks: any[] = Array.isArray(reportRow?.editorial_weeks) ? reportRow!.editorial_weeks : [];
          const sortedRecent = allWeeks
            .filter((w) => w && typeof w === "object" && Number(w._week_index ?? w.week_index ?? -1) !== wkIdxForPartial)
            .sort((a, b) => Number(b._week_index ?? b.week_index ?? 0) - Number(a._week_index ?? a.week_index ?? 0))
            .slice(0, RECENT_HISTORY_WEEKS);
          const audienceCutoff = Date.now() - AUDIENCE_QUALIFICATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;
          const addInto = (
            obj: any,
            set: Set<string>,
            lastSeen: Map<string, { value: string; weekIndex: number }>,
            wIdx: number,
          ) => {
            if (!obj) return;
            const push = (x: any) => {
              if (typeof x !== "string") return;
              const v = x.trim();
              if (!v) return;
              set.add(v);
              const key = normalizePattern(v);
              if (!key) return;
              const prev = lastSeen.get(key);
              if (!prev || prev.weekIndex < wIdx) lastSeen.set(key, { value: v, weekIndex: wIdx });
            };
            if (Array.isArray(obj)) obj.forEach(push);
            else if (typeof obj === "object") {
              for (const v of Object.values(obj)) {
                if (Array.isArray(v)) v.forEach(push);
                else push(v);
              }
            }
          };
          for (const w of sortedRecent) {
            const dm = (w as any)._dedup_metrics || {};
            const wIdx = Number(w._week_index ?? w.week_index ?? -1);
            addInto(dm.extracted_brands_by_day, recentBrands, brandLastSeen, wIdx);
            addInto(dm.extracted_frameworks_by_day, recentFrameworks, frameworkLastSeen, wIdx);
            addInto(dm.extracted_opening_forms_by_day, recentOpeningForms, openingFormLastSeen, wIdx);
            addInto(dm.matches_blocked, recentBrands, brandLastSeen, wIdx); // v2 legacy
            if (dm.thesis_summaries && typeof dm.thesis_summaries === "object") {
              for (const th of Object.values(dm.thesis_summaries)) {
                if (typeof th === "string" && th.trim()) recentTheses.push({ week_index: wIdx, thesis: th.trim() });
              }
            }
            const generatedAt = (w as any)._generated_at || dm.ts;
            const inAudienceWindow = generatedAt ? Date.parse(String(generatedAt)) >= audienceCutoff : true;
            if (inAudienceWindow && dm.audience_qualification_scores && typeof dm.audience_qualification_scores === "object") {
              for (const v of Object.values(dm.audience_qualification_scores)) {
                const n = Number(v);
                if (Number.isFinite(n) && n > AUDIENCE_QUALIFICATION_THRESHOLD) {
                  recentAudienceScores.push({ week_index: wIdx, score: n });
                }
              }
            }
          }
        } catch (histErr: any) {
          console.warn(`[semantic-dedup] history-load-failed (ignorado):`, histErr?.message || histErr);
        }


        // ---- 4) Tese por cosine sim ----
        type ThesisBlock = { day: number; thesis: string; matchedThesis: string; matchedWeek: number; sim: number };
        const thesisCosineBlocks: ThesisBlock[] = [];
        try {
          const candidateTheses = dayTargets.filter((t) => t.thesis_summary).map((t) => ({ day: t.day, thesis: t.thesis_summary }));
          if (candidateTheses.length > 0 && recentTheses.length > 0) {
            const allTexts = [...candidateTheses.map((c) => c.thesis), ...recentTheses.map((r) => r.thesis)];
            const allVecs = await embedTextBatch(allTexts);
            const candVecs2 = allVecs.slice(0, candidateTheses.length);
            const histVecs = allVecs.slice(candidateTheses.length);
            const cosine = (a: number[], b: number[]) => {
              let dot = 0, na = 0, nb = 0;
              const len = Math.min(a.length, b.length);
              for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
              const denom = Math.sqrt(na) * Math.sqrt(nb);
              return denom > 0 ? dot / denom : 0;
            };
            for (let i = 0; i < candidateTheses.length; i++) {
              const cv = candVecs2[i]; if (!cv) continue;
              let bestSim = 0; let bestIdx = -1;
              for (let j = 0; j < histVecs.length; j++) {
                const hv = histVecs[j]; if (!hv) continue;
                const s = cosine(cv, hv);
                if (s > bestSim) { bestSim = s; bestIdx = j; }
              }
              if (bestSim > THESIS_COSINE_THRESHOLD && bestIdx >= 0) {
                const matched = recentTheses[bestIdx];
                thesisCosineBlocks.push({
                  day: candidateTheses[i].day,
                  thesis: candidateTheses[i].thesis,
                  matchedThesis: matched.thesis,
                  matchedWeek: matched.week_index,
                  sim: bestSim,
                });
                console.log(`[semantic-dedup] thesis-cosine-blocked week=${wkIdxForPartial} day=${candidateTheses[i].day} sim=${bestSim.toFixed(3)}`);
              }
            }
          }
        } catch (te: any) {
          console.warn(`[semantic-dedup] thesis-cosine-failed (ignorado):`, te?.message || te);
        }

        // ---- 5) Saturação de público ----
        const audienceSaturationByDay = new Map<number, { week_index: number; score: number }>();
        if (recentAudienceScores.length > 0) {
          const top = [...recentAudienceScores].sort((a, b) => b.score - a.score)[0];
          for (const t of dayTargets) {
            if (t.audience_qualification_score > AUDIENCE_QUALIFICATION_THRESHOLD) {
              audienceSaturationByDay.set(t.day, top);
            }
          }
          if (audienceSaturationByDay.size > 0) {
            console.log(`[semantic-dedup] audience-saturation week=${wkIdxForPartial} days=${JSON.stringify(Array.from(audienceSaturationByDay.keys()))}`);
          }
        }

        // ---- 6) Repetição de brand/framework/opening-form (normalizado) ----
        const repeatedBrandsByDay = new Map<number, string[]>();
        const repeatedFrameworksByDay = new Map<number, string[]>();
        const repeatedOpeningFormsByDay = new Map<number, string[]>();
        for (const t of dayTargets) {
          const rb: string[] = [];
          for (const b of t.brands) {
            const seen = brandLastSeen.get(normalizePattern(b));
            if (seen) {
              rb.push(seen.value);
              console.log(
                `[semantic-dedup] brand-repeat-detected week=${wkIdxForPartial} day=${t.day} brand=${JSON.stringify(b)} matched=${JSON.stringify(seen.value)} last_seen_week=${seen.weekIndex}`,
              );
            }
          }
          const rf: string[] = [];
          for (const f of t.frameworks) {
            const seen = frameworkLastSeen.get(normalizePattern(f));
            if (seen) {
              rf.push(seen.value);
              console.log(
                `[semantic-dedup] framework-repeat-detected week=${wkIdxForPartial} day=${t.day} framework=${JSON.stringify(f)} matched=${JSON.stringify(seen.value)} last_seen_week=${seen.weekIndex}`,
              );
            }
          }
          const ro: string[] = [];
          for (const o of t.opening_forms) {
            const seen = openingFormLastSeen.get(normalizePattern(o));
            if (seen) {
              ro.push(seen.value);
              console.log(
                `[semantic-dedup] opening-form-repeat-detected week=${wkIdxForPartial} day=${t.day} form=${JSON.stringify(o)} matched=${JSON.stringify(seen.value)} last_seen_week=${seen.weekIndex}`,
              );
            }
          }
          if (rb.length) repeatedBrandsByDay.set(t.day, rb);
          if (rf.length) repeatedFrameworksByDay.set(t.day, rf);
          if (ro.length) repeatedOpeningFormsByDay.set(t.day, ro);
        }
        if (repeatedBrandsByDay.size > 0) {
          console.log(`[semantic-dedup] brand-repetition week=${wkIdxForPartial} days=${JSON.stringify(Array.from(repeatedBrandsByDay.entries()))}`);
        }
        if (repeatedFrameworksByDay.size > 0) {
          console.log(`[semantic-dedup] framework-repetition week=${wkIdxForPartial} days=${JSON.stringify(Array.from(repeatedFrameworksByDay.entries()))}`);
        }
        if (repeatedOpeningFormsByDay.size > 0) {
          console.log(`[semantic-dedup] opening-form-repetition week=${wkIdxForPartial} days=${JSON.stringify(Array.from(repeatedOpeningFormsByDay.entries()))}`);
        }


        // ---- 7) Persiste meta SEMPRE ----
        const extracted_brands_by_day: Record<number, string[]> = {};
        const extracted_frameworks_by_day: Record<number, string[]> = {};
        const extracted_opening_forms_by_day: Record<number, string[]> = {};
        const thesis_summaries: Record<number, string> = {};
        const audience_qualification_scores: Record<number, number> = {};
        for (const t of dayTargets) {
          extracted_brands_by_day[t.day] = t.brands;
          extracted_frameworks_by_day[t.day] = t.frameworks;
          extracted_opening_forms_by_day[t.day] = t.opening_forms;
          if (t.thesis_summary) thesis_summaries[t.day] = t.thesis_summary;
          audience_qualification_scores[t.day] = t.audience_qualification_score;
        }
        const preRetryMaxSim = embeddingViolations.length > 0 ? Math.max(...embeddingViolations.map((v) => v.topSim)) : 0;
        dedupMeta = {
          pre_retry_max_sim: Number(preRetryMaxSim.toFixed(3)),
          post_retry_max_sim: null,
          second_retry_max_sim: null,
          days_regenerated: embeddingViolations.map((v) => v.day),
          matches_blocked: Array.from(new Set([...recentBrands, ...recentFrameworks])),
          entity_extraction_source: extractionSource,
          threshold: adaptiveThreshold,
          thesis_threshold: THESIS_COSINE_THRESHOLD,
          window_days: DEDUP_WINDOW_DAYS,
          extracted_brands_by_day,
          extracted_frameworks_by_day,
          extracted_opening_forms_by_day,
          thesis_summaries,
          audience_qualification_scores,
          ts: new Date().toISOString(),
        };
        console.log(
          `[semantic-dedup] entities-extracted week=${wkIdxForPartial} brands=${JSON.stringify(extracted_brands_by_day)} thesis=${JSON.stringify(thesis_summaries)} audience=${JSON.stringify(audience_qualification_scores)}`,
        );

        // ---- 8) Dias violadores (5 dimensões) ----
        const violatingDaysSet = new Set<number>();
        for (const v of embeddingViolations) violatingDaysSet.add(v.day);
        for (const tb of thesisCosineBlocks) violatingDaysSet.add(tb.day);
        for (const d of repeatedBrandsByDay.keys()) violatingDaysSet.add(d);
        for (const d of repeatedFrameworksByDay.keys()) violatingDaysSet.add(d);
        for (const d of repeatedOpeningFormsByDay.keys()) violatingDaysSet.add(d);
        for (const d of audienceSaturationByDay.keys()) violatingDaysSet.add(d);

        console.log(
          `[semantic-dedup] week=${wkIdxForPartial} user=${userId} candidates=${candidates.length} violations=${violatingDaysSet.size} (emb=${embeddingViolations.length} thesis=${thesisCosineBlocks.length} brand=${repeatedBrandsByDay.size} framework=${repeatedFrameworksByDay.size} opening_form=${repeatedOpeningFormsByDay.size} audience=${audienceSaturationByDay.size})`,
        );

        if (violatingDaysSet.size === 0) {
          // nada a fazer — dedupMeta já persistido
        } else {
          await updateJob(jobId, { progress_message: "Removendo repetições semânticas…" });

          // ---- 9) Anti-prompt 1º retry ----
          if (dedupTimeBudgetExceeded()) {
            console.warn(`[semantic-dedup] time-budget-exceeded antes do 1º retry week=${wkIdxForPartial} — aceitando posts atuais`);
            dedupMeta._dedup_partial_due_to_timeout = true;
          } else {
          const violatingDays = Array.from(violatingDaysSet);
          dedupMeta.days_regenerated = violatingDays;
          const dayTargetsByDay = new Map(dayTargets.map((t) => [t.day, t]));
          const embByDay = new Map(embeddingViolations.map((v) => [v.day, v]));
          const thesisBlocksByDay = new Map<number, ThesisBlock[]>();
          for (const tb of thesisCosineBlocks) {
            if (!thesisBlocksByDay.has(tb.day)) thesisBlocksByDay.set(tb.day, []);
            thesisBlocksByDay.get(tb.day)!.push(tb);
          }

          const keepContext = feedFinal
            .filter((p) => !violatingDaysSet.has(p.day))
            .map((p) => `Dia ${p.day} (MANTER, não reescrever): tema="${p.theme}"`)
            .join("\n");

          // ── Passo B1 (PAUTAS FRESCAS) e Passo D (RESTRIÇÕES DURAS) removidos em S19 ──
          // B1: removido porque na S19 devolveu 0 pautas mesmo com 2 vigentes disponíveis
          //     no cache do usuário (advogado::leilões, 3 no cache, 1 queimada em 56d).
          //     H5 (material novo reduz thesis_sim) NÃO foi testada de forma limpa —
          //     a query B1 tem bug nos filtros extras (concept-group saturado +
          //     tag pré-retry). Se retomar H5, começar auditando a query, NÃO assumir
          //     que material novo é inerte.
          // D: removido porque violations de fórmula/concept-group vieram byte-a-byte
          //    idênticas entre S18 e S19 — o modelo ignora restrições textuais desse
          //    tipo no retry corretivo. editorial-diversity segue como validador
          //    pós-geração (registro/telemetria), só deixa de tentar influenciar o retry.



          const dedupBlock =
            `\n\n# ⚠️ DEDUPLICAÇÃO SEMÂNTICA (CRÍTICO)\n` +

            `Os dias listados abaixo possuem ângulo/tese semanticamente próximos a posts já gerados nos últimos ${DEDUP_WINDOW_DAYS} dias. ` +
            `Reescreva cada um com um ângulo radicalmente diferente. Mantenha tema, tom e formato compatíveis com a semana, mas o NÚCLEO precisa mudar.\n\n` +
            violatingDays
              .map((day) => {
                const t = dayTargetsByDay.get(day);
                const emb = embByDay.get(day);
                const proibicoes: string[] = [];
                const repBrands = repeatedBrandsByDay.get(day);
                if (repBrands && repBrands.length > 0) {
                  proibicoes.push(`NÃO cite (já usados nas últimas 8 semanas): ${repBrands.join(", ")}`);
                } else if (t && t.brands.length > 0 && emb) {
                  proibicoes.push(`NÃO cite: ${t.brands.join(", ")} (sim_top=${emb.topSim.toFixed(2)})`);
                }
                const repFw = repeatedFrameworksByDay.get(day);
                if (repFw && repFw.length > 0) proibicoes.push(`NÃO use frameworks repetidos: ${repFw.join(" | ")}`);
                else if (t && t.frameworks.length > 0) proibicoes.push(`NÃO use o framework: ${t.frameworks.join(" | ")}`);
                const repOf = repeatedOpeningFormsByDay.get(day);
                if (repOf && repOf.length > 0) proibicoes.push(`NÃO use fôrmas narrativas repetidas (já usadas nas últimas 8 semanas): ${repOf.join(" | ")}`);
                else if (t && t.opening_forms.length > 0) proibicoes.push(`NÃO use a fôrma narrativa: ${t.opening_forms.join(" | ")}`);

                const thesisStr = (thesisBlocksByDay.get(day) || [])
                  .map(
                    (tb) =>
                      `TESE PROIBIDA (já defendida em Sem ${tb.matchedWeek}, cosine=${tb.sim.toFixed(2)}):\n` +
                      `"${tb.matchedThesis}"\n` +
                      `Reescreva defendendo uma tese RADICALMENTE diferente — não basta trocar o público citado. A consequência precisa mudar.`,
                  )
                  .join("\n\n");

                const sat = audienceSaturationByDay.get(day);
                let audienceBlock = "";
                if (sat && t) {
                  audienceBlock =
                    `\nPOST PROIBIDO: audience_qualification_score = ${t.audience_qualification_score.toFixed(2)}. ` +
                    `Já houve outro post de qualificação na Semana ${sat.week_index} (score=${sat.score.toFixed(2)}). ` +
                    `Limite: 1 a cada ${AUDIENCE_QUALIFICATION_WINDOW_DAYS} dias.\nReescreva sobre OUTRO ângulo (técnico, case, observação, crítica) — NÃO sobre qualificar público.\n`;
                }

                const matchesEcho = emb
                  ? emb.matches
                      .map(
                        (m: any, idx: number) =>
                          `   ${idx + 1}. (sim=${Number(m.similarity).toFixed(2)}) ${String(m.text_used || "").slice(0, 400)}`,
                      )
                      .join("\n")
                  : "(nenhum match de embedding — bloqueio por outra dimensão)";

                // H2: bloqueia explicitamente o subject_tag da versão que falhou.
                // A LLM tende a preservar o subject_tag por inércia no retry
                // (é a tese que ela acabou de defender e argumentou), o que
                // mantém a similaridade alta mesmo reescrevendo o texto.
                const failingPost = feedFinal.find((p) => p.day === day) as any;
                const failingTag = failingPost?.subject_tag ? String(failingPost.subject_tag).trim() : "";
                const subjectTagBlock = failingTag
                  ? `\n🚫 SUBJECT_TAG PROIBIDO neste retry: "${failingTag}"\n` +
                    `Você acabou de usar essa tese e ela colidiu com o histórico. ESCOLHA UM subject_tag NOVO ` +
                    `(3-5 palavras kebab-case) que defenda uma tese DIFERENTE. Manter o mesmo subject_tag ` +
                    `= falha automática do retry.\n`
                  : "";

                return (
                  `## Dia ${day} — proibições nominais\n` +
                  (proibicoes.length > 0 ? proibicoes.join("\n") + "\n" : "") +
                  subjectTagBlock +
                  (thesisStr ? "\n" + thesisStr + "\n" : "") +
                  audienceBlock +
                  `\nNÃO use case de marca grande tomando decisão de produto polêmica como gancho.\n\n` +
                  `Famílias narrativas alternativas (escolha 1):\n` +
                  `(a) nicho técnico real do profissional\n` +
                  `(b) crítica a livro/autor de referência (NÃO Strunk & White, NÃO Marcus Aurelius)\n` +
                  `(c) comparação histórica não-tecnológica\n` +
                  `(d) erro profissional pessoal\n\n` +
                  `Ângulos a evitar:\n${matchesEcho}`
                );
              })
              .join("\n\n") +
            `\n\nRetorne APENAS um JSON array com os dias reescritos (mesmo schema do feed).`;


          const retryUser = `${feedUser}\n\n# CONTEXTO DA SEMANA (NÃO REESCREVER)\n${keepContext}${dedupBlock}`;
          // Snapshot pré-retry pra instrumentar mudança de subject_tag (H2).
          const preRetryTagsByDay = new Map<number, string>();
          for (const p of feedFinal) {
            preRetryTagsByDay.set(p.day, String((p as any).subject_tag || "").trim());
          }

          // Fix S19 (bug pre=0.000): calcula generic_post_sim pré-retry pra TODOS
          // os dias violando, não só os que entraram por embedding. Antes, days que
          // entraram por thesis/brand/framework/audience/opening-form ficavam sem
          // entrada em embByDay e o log mostrava pre=0.000 (falso zero).
          const preRetrySimByDay = new Map<number, number>();
          try {
            const preCands = feedFinal.filter((p) => violatingDaysSet.has(p.day) && (p.theme || p.caption));
            const preTexts = preCands.map((p) => postToEmbedText(p));
            const preVecs = await embedTextBatch(preTexts);
            for (let i = 0; i < preVecs.length; i++) {
              const vec = preVecs[i]; if (!vec) continue;
              const day = preCands[i].day;
              const embHit = embByDay.get(day);
              if (embHit) { preRetrySimByDay.set(day, embHit.topSim); continue; }
              const { data } = await admin.rpc("match_post_embeddings", {
                p_user_id: userId, p_query: vec as any, p_since: since, p_threshold: 0.0, p_limit: 1,
              });
              const top = Array.isArray(data) && data.length > 0 ? Number(data[0].similarity) || 0 : 0;
              preRetrySimByDay.set(day, top);
            }
          } catch (e: any) {
            console.warn(`[dedup-retry] pre-retry-sim-skipped:`, e?.message || e);
          }


          let retriedDays: number[] = [];
          try {
            const { text: dedupRaw } = await callClaudeWithMeta({
              systemPrompt: feedSystem,
              userText: retryUser,
              model: "claude-opus-4-7",
              max_tokens: 4500,
              timeoutMs: 120000,
              disableRetries: true,
            });
            let parsed1: any = extractJsonFromLLM(dedupRaw);
            if (!Array.isArray(parsed1) || parsed1.length === 0) parsed1 = extractPartialDayObjects(dedupRaw);
            if (Array.isArray(parsed1) && parsed1.length > 0) {
              const replaceMap = new Map<number, FeedPost>();
              for (const p of parsed1) {
                if (!p || typeof p !== "object") continue;
                const dayN = Number((p as any).day);
                if (!FEED_DAYS.includes(dayN)) continue;
                const cleaned = sanitizePost(p as Record<string, any>) as FeedPost;
                cleaned.day = dayN;
                cleaned.format = (cleaned.format || "post").toString().toLowerCase();
                if (cleaned.format === "stories") cleaned.format = "post";
                cleaned.is_personal = Boolean((cleaned as any).is_personal);
                replaceMap.set(dayN, cleaned);
              }
              for (let i = 0; i < feedFinal.length; i++) {
                const r = replaceMap.get(feedFinal[i].day);
                if (r) feedFinal[i] = r;
              }
              retriedDays = Array.from(replaceMap.keys());
              // [dedup-retry] log 1: mudança de subject_tag por dia (H2).
              for (const [dayN, r] of replaceMap.entries()) {
                const oldRaw = preRetryTagsByDay.get(dayN) || "";
                const newRaw = String((r as any).subject_tag || "").trim();
                const oldN = normalizeSubject(oldRaw);
                const newN = normalizeSubject(newRaw);
                console.log(
                  `[dedup-retry] day=${dayN} old_tag="${oldRaw}" new_tag="${newRaw}" tag_changed=${oldN !== newN && !!newN}`,
                );
              }

              console.log(`[semantic-dedup] week=${wkIdxForPartial} retry-1 applied days=${replaceMap.size}`);
            } else {
              console.warn(`[semantic-dedup] retry-1 sem posts válidos, mantendo versão original.`);
            }
          } catch (re: any) {
            console.warn(`[semantic-dedup] retry-1 falhou (mantendo original):`, re?.message || re);
          }


          // ---- 10) Revalidação 1º retry ----
          const failingAfterFirst: { day: number; sim: number }[] = [];
          if (retriedDays.length > 0) {
            try {
              const revalCands = feedFinal.filter((p) => retriedDays.includes(p.day) && (p.theme || p.caption));
              const revalTexts = revalCands.map((p) => postToEmbedText(p));
              const revalVecs = await embedTextBatch(revalTexts);

              // [dedup-retry] log 2: isolar cosseno de TESE (subject_tag+theme vs recentTheses)
              // do cosseno GENÉRICO do post inteiro. Embed em batch pra 1 chamada só.
              let newThesisByDay = new Map<number, number>();
              try {
                const thesisCandTexts = revalCands.map((p) => {
                  const tag = String((p as any).subject_tag || "").trim();
                  return `${tag}. ${p.theme || ""}`.trim();
                });
                const recentThesisTexts = recentTheses.map((r) => r.thesis);
                if (thesisCandTexts.length > 0 && recentThesisTexts.length > 0) {
                  const allVecs = await embedTextBatch([...thesisCandTexts, ...recentThesisTexts]);
                  const candVecs = allVecs.slice(0, thesisCandTexts.length);
                  const histVecs = allVecs.slice(thesisCandTexts.length);
                  const dot = (a: number[], b: number[]) => {
                    let s = 0; for (let k = 0; k < a.length; k++) s += a[k] * b[k]; return s;
                  };
                  const norm = (a: number[]) => Math.sqrt(dot(a, a)) || 1;
                  for (let i = 0; i < candVecs.length; i++) {
                    const cv = candVecs[i]; if (!cv) continue;
                    const cn = norm(cv);
                    let best = 0;
                    for (const hv of histVecs) {
                      if (!hv) continue;
                      const s = dot(cv, hv) / (cn * norm(hv));
                      if (s > best) best = s;
                    }
                    newThesisByDay.set(revalCands[i].day, best);
                  }
                }
              } catch (te: any) {
                console.warn(`[dedup-retry] thesis-sim-skipped:`, te?.message || te);
              }

              let postRetryMax = 0;
              for (let i = 0; i < revalVecs.length; i++) {
                const vec = revalVecs[i]; if (!vec) continue;
                const day = revalCands[i].day;
                finalVectorByDay.set(day, vec);
                const { data } = await admin.rpc("match_post_embeddings", {
                  p_user_id: userId, p_query: vec as any, p_since: since, p_threshold: 0.0, p_limit: 1,
                });
                const top = Array.isArray(data) && data.length > 0 ? Number(data[0].similarity) || 0 : 0;
                if (top > postRetryMax) postRetryMax = top;
                if (top > adaptiveThreshold) failingAfterFirst.push({ day, sim: top });
                console.log(
                  `[semantic-dedup] post-retry week=${wkIdxForPartial} day=${day} pre=${(preRetrySimByDay.get(day) ?? embByDay.get(day)?.topSim ?? 0).toFixed(3)} post=${top.toFixed(3)}`,
                );
                const oldThesisSim = Math.max(
                  0,
                  ...(thesisBlocksByDay.get(day) || []).map((tb) => tb.sim),
                );
                const newThesisSim = newThesisByDay.get(day);
                console.log(
                  `[dedup-retry] day=${day} old_thesis_sim=${oldThesisSim.toFixed(3)} new_thesis_sim=${
                    typeof newThesisSim === "number" ? newThesisSim.toFixed(3) : "n/a"
                  } generic_post_sim=${top.toFixed(3)}`,
                );
              }
              dedupMeta.post_retry_max_sim = Number(postRetryMax.toFixed(3));
            } catch (rv: any) {
              console.warn(`[semantic-dedup] revalidation-skipped:`, rv?.message || rv);
            }
          }


          // ---- 11) 2º retry REMOVIDO em S19 ----
          // Motivo: nas semanas 17-19, o 2º retry NUNCA executou de fato — o
          // time-budget de 90s sempre estourava antes dele disparar. A tentativa
          // de trocar Opus por Sonnet no 2º retry (Passo C) ficou sem exercício
          // porque o gatilho é o budget, não o modelo. Simplificação: aceita o
          // 1º retry como resposta final; dias que ainda excedem adaptiveThreshold
          // são marcados _dedup_failed e a semana é persistida com _dedup_warning.
          for (const f of failingAfterFirst) {
            if (f.sim > adaptiveThreshold) {
              dedupFailedDays.push(f.day);
              const idx = feedFinal.findIndex((p) => p.day === f.day);
              if (idx >= 0) (feedFinal[idx] as any)._dedup_failed = true;
            }
          }
          if (dedupFailedDays.length > 0) {
            console.log(`[semantic-dedup] dedup-failed week=${wkIdxForPartial} days=${JSON.stringify(dedupFailedDays)}`);
            dedupMeta.dedup_failed_days = dedupFailedDays;
            dedupMeta.final_max_sim = Math.max(...failingAfterFirst.map((f) => f.sim));
            (dedupMeta as any)._dedup_warning = true;
          }
          } // end else (time budget ok for 1st retry)
        }
      } catch (semErr: any) {
        console.warn(`[semantic-dedup] erro geral (ignorado):`, semErr?.message || semErr);
      }



      // === EXTRAIR SIGNATURES DO FEED RECÉM-GERADO ===
      // Roda APÓS o dedup do feed (feedFinal é o conjunto final). As signatures
      // são persistidas em _dedup_metrics._pattern_signatures e usadas pela
      // próxima semana como restrição negativa. Falha silenciosa — nunca bloqueia.
      let weekPatternSignatures: PostSignature[] = [];
      try {
        const postsForSignature = feedFinal.map((p) => ({
          day: p.day,
          theme: (p as any).theme,
          caption: (p as any).caption,
          card_copy: (p as any).card_copy,
          script: (p as any).script,
        }));
        weekPatternSignatures = await extractSignaturesForWeek(postsForSignature);
        console.log(`[pattern-signature] extraídas ${weekPatternSignatures.length} signatures pra semana ${wkIdxForPartial}`);
      } catch (e: any) {
        console.warn("[pattern-signature] extract para semana atual falhou (continuando):", e?.message || e);
      }

      // Monta extraMeta para persistir flag/métricas no JSONB editorial_weeks[i]
      // Eixo de assunto: persiste o mapa dia→assunto (também fica no próprio post,
      // em feed.subject_tag, que é a fonte primária lida pelas próximas semanas).
      const subjectTagsByDay: Record<number, string> = {};
      for (const p of feedFinal) {
        const tag = normalizeSubject(String((p as any).subject_tag || "")) || subjectByDayFinal[p.day] || "";
        if (tag) subjectTagsByDay[p.day] = tag;
      }
      const dedupMetricsWithSigs = {
        ...(dedupMeta || {}),
        ...(weekPatternSignatures.length > 0 ? { _pattern_signatures: weekPatternSignatures } : {}),
        ...(Object.keys(subjectTagsByDay).length > 0 ? { subject_tags_by_day: subjectTagsByDay } : {}),
      };
      const weekExtraMeta: Record<string, any> | undefined =
        dedupMeta || weekPatternSignatures.length > 0
          ? {
              _dedup_metrics: dedupMetricsWithSigs,
              ...((dedupMeta as any)?._dedup_warning ? { _dedup_warning: true } : {}),
            }
          : undefined;

      // ==== Persistência de embeddings ANTES do save parcial ====
      // Garante que mesmo semanas que falham no Estágio B alimentem o guardrail
      // semântico das próximas. Reaproveita vetores já calculados (cand + retries).
      try {
        const rows: any[] = [];
        for (const p of feedFinal) {
          if (!p || (!p.theme && !p.caption)) continue;
          const vec = finalVectorByDay.get(p.day);
          if (!vec) {
            // Fallback: dia que não passou pelo bloco de dedup — calcula agora.
            const v = (await embedTextBatch([postToEmbedText(p)]))[0];
            if (!v) continue;
            finalVectorByDay.set(p.day, v);
          }
          const usedVec = finalVectorByDay.get(p.day)!;
          const textUsed = postToEmbedText(p);
          const named = detectNamedCases(
            `${p.theme || ""} ${(p as any).title || ""} ${p.caption || ""} ${(p.card_copy || []).join(" ")} ${p.cta || ""}`,
          );
          rows.push({
            user_id: userId,
            report_id: job.report_id,
            week_index: wkIdxForPartial,
            day_index: p.day,
            post_kind: "feed",
            text_used: textUsed,
            embedding: usedVec,
            named_cases: named,
          });
        }
        if (rows.length > 0) {
          const { error: embErr } = await admin
            .from("post_embeddings")
            .upsert(rows, { onConflict: "user_id,report_id,week_index,day_index,post_kind" });
          if (embErr) {
            console.warn(`[embed-persist] upsert falhou (pre-partial):`, embErr.message);
          } else {
            console.log(`[embed-persist] week=${wkIdxForPartial} upserted=${rows.length} (pre-partial)`);
          }
        } else {
          console.warn(`[embed-persist] week=${wkIdxForPartial} sem vetores válidos para inserir (pre-partial)`);
        }
      } catch (embPrePartialErr: any) {
        console.warn(`[embed-persist] erro pre-partial (ignorado):`, embPrePartialErr?.message || embPrePartialErr);
      }

      let partialPersisted = false;
      try {
        await persistWeek(job.report_id, feedFinal, [], jobId, marketTrends, wkIdxForPartial, true, weekExtraMeta);
        partialPersisted = true;
        console.log(`[job ${jobId}] Feed persistido (save parcial). Iniciando Estágio B.`);
        console.log(`[content-job] week=${wkIdxForPartial} user=${userId} stage=A status=success`);
      } catch (partialErr) {
        console.error(`[job ${jobId}] Falha ao salvar parcial do feed (segue tentando estágio B):`, partialErr);
      }

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
        POSITIONING_GUARDRAIL_BLOCK +
        ethicalBlock +
        "\n\n" +
        buildStoriesSystemPrompt(
          feedSummaryForStories,
          FEED_DAYS,
          undefined,
          previousPersonalStoriesSummary,
          brandType,
        ) +
        renderPillarsBlock() +
        renderEditorialFrameworks();
      const storiesUser = `# NEGÓCIO
Empresa: ${business?.company_name || "Não informado"}
Serviços: ${business?.services || "Não informado"}
Público-alvo: ${business?.target_audience || "Não informado"}
Nicho: ${niche || "Não informado"}${verifiableFactsBlock}${storybrandContext}${toneContext}${personalContext}${salesNarrativeContext}${marketTrendsBlock}

Gere agora os 7 stories da semana.`;

      let storiesRaw: string;
      let storiesStop: string | undefined;
      try {
        const result = await callClaudeWithMeta({
          systemPrompt: storiesSystem,
          userText: storiesUser,
          model: "claude-opus-4-7",
          max_tokens: 7000,
          timeoutMs: 150000,
          disableRetries: true,
        });
        storiesRaw = result.text;
        storiesStop = result.stopReason;
      } catch (storiesCallErr: any) {
        // Estágio B caiu (instabilidade da API Anthropic, timeout, etc).
        // O feed JÁ foi persistido antes (save parcial). Marcamos o job como
        // completed_partial e NÃO reembolsamos o crédito (feed foi entregue).
        console.error(`[job ${jobId}] Estágio B levantou exceção:`, storiesCallErr?.message || storiesCallErr);
        console.log(`[content-job] week=${wkIdxForPartial} user=${userId} stage=B status=failure partial_saved=${partialPersisted}`);
        if (!partialPersisted) {
          try {
            await persistWeek(job.report_id, feedFinal, [], jobId, marketTrends, wkIdxForPartial, true, weekExtraMeta);
            partialPersisted = true;
          } catch (e) {
            console.error(`[job ${jobId}] Falha ao persistir feed após exceção do Estágio B:`, e);
          }
        }
        creditReserved = false; // não devolver crédito — feed foi entregue
        await updateJob(jobId, {
          status: "completed",
          result: {
            stage: "completed_partial",
            partial: true,
            feed: feedFinal,
            stories: [],
            stage_b_error: storiesCallErr?.message || "Stories indisponíveis no momento (instabilidade da IA).",
            generator_version: EDITORIAL_GENERATOR_VERSION,
          },
          progress_message: "Feed gerado. Stories falharam — regenere os stories para completar.",
          finished_at: new Date().toISOString(),
          error_message: "Stories indisponíveis no momento (instabilidade da IA). Use o botão de regenerar story em cada dia.",
        });
        return;
      }
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
          console.log(`[content-job] week=${wkIdxForPartial} user=${userId} stage=B status=failure partial_saved=true`);
          await persistWeek(job.report_id, feedFinal, [], jobId, marketTrends, wkIdxForPartial, true, weekExtraMeta);
          creditReserved = false;
          await updateJob(jobId, {
            status: "completed",
            result: {
              stage: "completed_partial",
              partial: true,
              feed: feedFinal,
              stories: [],
              stage_b_error: "Stories não gerados — conteúdo truncado ou vazio.",
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

      // === LOOP DE DEDUP DE STORIES (apenas DIA 5) ===
      // Escopo cirúrgico: apenas dias em STORIES_DEDUP_DAYS. Falha não bloqueia
      // a entrega — registramos métrica e seguimos.
      const storiesDedupMeta: Record<string, any> = {};
      try {
        const checkViolations = async (
          targets: StoryDay[],
        ): Promise<StoryDedupViolation[]> => {
          const out: StoryDedupViolation[] = [];
          const eligible = targets.filter((s) => STORIES_DEDUP_DAYS.includes(s.day));
          if (eligible.length === 0) return out;
          const texts = eligible.map((s) => storyToEmbedText(s));
          const vecs = await embedTextBatch(texts);
          for (let i = 0; i < eligible.length; i++) {
            const story = eligible[i];
            const text = texts[i];
            const vec = vecs[i];
            if (!text || text.length < 20 || !vec) continue;
            const { data: matches, error: matchErr } = await admin.rpc("match_story_embeddings", {
              p_user_id: userId,
              p_query_embedding: vec as any,
              p_day_index: story.day,
              p_threshold: STORIES_DEDUP_THRESHOLD,
              p_window_days: STORIES_DEDUP_WINDOW_DAYS,
              p_exclude_report_id: job.report_id,
            });
            if (matchErr) {
              console.warn(`[stories-dedup] match_story_embeddings erro:`, matchErr.message);
              continue;
            }
            if (Array.isArray(matches) && matches.length > 0) {
              const top = matches[0] as any;
              out.push({
                day: story.day,
                similarity: Number(top.similarity) || 0,
                similar_story_text: String(top.story_text || ""),
                similar_week_index: Number(top.week_index) || 0,
              });
            }
          }
          return out;
        };

        const regenerateOne = async (
          violation: StoryDedupViolation,
          attempt: number,
        ): Promise<StoryDay | null> => {
          const antiPrompt = `# REPETIÇÃO DETECTADA — REGERAR STORY DO DIA ${violation.day}
A story do DIA ${violation.day} desta semana está MUITO PARECIDA (${(violation.similarity * 100).toFixed(0)}% de similaridade) com uma story da semana ${violation.similar_week_index}:

TEMA PROIBIDO (já usado anteriormente): "${violation.similar_story_text.slice(0, 300)}"

REGRA: gere APENAS a story do DIA ${violation.day} com tema completamente diferente. Mude o ângulo, a pergunta-gancho, a estrutura narrativa. NÃO toque nas stories dos outros dias.

OUTPUT: retorne UM ÚNICO objeto JSON (não array) com a forma:
{ "day": ${violation.day}, "theme": "...", "frames": ["...", "..."], "is_personal": false, "mirrors_feed": false }

Esta é a tentativa ${attempt} de ${STORIES_MAX_RETRIES}.`;

          const regenSystem =
            NARRATIVE_PRINCIPLES_BLOCK +
            POSITIONING_GUARDRAIL_BLOCK +
            ethicalBlock +
            "\n\n" +
            buildStoriesSystemPrompt(
              feedSummaryForStories,
              FEED_DAYS,
              antiPrompt,
              previousPersonalStoriesSummary,
              brandType,
            ) +
            renderPillarsBlock() +
            renderEditorialFrameworks();
          try {
            const regenRaw = await callClaude({
              systemPrompt: regenSystem,
              userText: storiesUser + `\n\n${antiPrompt}`,
              model: "claude-opus-4-7",
              max_tokens: 1500,
              timeoutMs: 90000,
              disableRetries: true,
            });
            let parsed: any = extractJsonFromLLM(regenRaw);
            if (Array.isArray(parsed)) parsed = parsed.find((p: any) => Number(p?.day) === violation.day) || parsed[0];
            if (!parsed || typeof parsed !== "object") {
              const partial = extractPartialDayObjects(regenRaw);
              parsed = partial.find((p: any) => Number(p?.day) === violation.day) || partial[0];
            }
            if (!parsed || typeof parsed !== "object") return null;
            const cleaned = sanitizeStory(parsed as Record<string, any>) as StoryDay;
            cleaned.day = violation.day;
            cleaned.is_personal = false;
            cleaned.mirrors_feed = false;
            if (!Array.isArray(cleaned.frames)) cleaned.frames = [];
            return cleaned;
          } catch (regenErr: any) {
            console.warn(`[stories-dedup] regen DIA ${violation.day} falhou:`, regenErr?.message || regenErr);
            return null;
          }
        };

        let storiesAttempt = 0;
        let violations = await checkViolations(storiesFinal);
        while (violations.length > 0 && storiesAttempt < STORIES_MAX_RETRIES) {
          storiesAttempt++;
          console.log(
            `[stories-dedup] Tentativa ${storiesAttempt}: ${violations.length} violações no(s) DIA(s) ${violations.map((v) => v.day).join(",")}`,
          );
          const regenerated: StoryDay[] = [];
          for (const v of violations) {
            const nw = await regenerateOne(v, storiesAttempt);
            if (nw) {
              const idx = storiesFinal.findIndex((s) => s.day === v.day);
              if (idx >= 0) storiesFinal[idx] = nw;
              regenerated.push(nw);
            }
          }
          if (regenerated.length === 0) break;
          violations = await checkViolations(regenerated);
        }

        if (violations.length > 0) {
          console.warn(`[stories-dedup] FALHA: ${violations.length} violações persistem após ${STORIES_MAX_RETRIES} retries`);
          storiesDedupMeta.stories_dedup_failed_days = violations.map((v) => v.day);
          storiesDedupMeta.stories_dedup_violations = violations;
        } else {
          storiesDedupMeta.stories_dedup_success = true;
          storiesDedupMeta.stories_dedup_attempts = storiesAttempt;
        }

        // Persiste embeddings APENAS dos dias deduplicados
        for (const story of storiesFinal) {
          if (!STORIES_DEDUP_DAYS.includes(story.day)) continue;
          const text = storyToEmbedText(story);
          if (!text || text.length < 20) continue;
          try {
            const vec = (await embedTextBatch([text]))[0];
            if (!vec) continue;
            const { error: insErr } = await admin.from("story_embeddings").insert({
              user_id: userId,
              report_id: job.report_id,
              week_index: wkIdxForPartial,
              day_index: story.day,
              embedding: vec as any,
              story_text: text,
            });
            if (insErr) {
              console.warn(`[stories-dedup] insert embedding DIA ${story.day} falhou:`, insErr.message);
            }
          } catch (e: any) {
            console.warn(`[stories-dedup] persist DIA ${story.day} erro:`, e?.message || e);
          }
        }
      } catch (storiesDedupErr: any) {
        console.warn(`[stories-dedup] erro geral (ignorado):`, storiesDedupErr?.message || storiesDedupErr);
      }

      // Mescla métricas de dedup de stories no extraMeta da semana
      const weekExtraMetaWithStories: Record<string, any> | undefined =
        weekExtraMeta || Object.keys(storiesDedupMeta).length > 0
          ? { ...(weekExtraMeta || {}), ...storiesDedupMeta }
          : undefined;

      // Persiste a semana completa
      await updateJob(jobId, { progress_message: "Salvando conteúdo…" });
      const weekObj = await persistWeek(job.report_id, feedFinal, storiesFinal, jobId, marketTrends, wkIdxForPartial, false, weekExtraMetaWithStories);
      console.log(`[content-job] week=${wkIdxForPartial} user=${userId} stage=B status=success partial_saved=true`);

      // Embeddings já foram upsertados ANTES do save parcial (Fix D).
      // Não re-inserimos aqui para evitar duplicação; o upsert é idempotente
      // por (user_id, report_id, week_index, day_index, post_kind).



      // Persiste fingerprints de diversidade + log de telemetria estruturado
      try {
        const wkIdx = typeof job.week_index === "number" ? job.week_index : 0;
        const fingerprints = feedFinal.map((p) => fingerprintPost(p as unknown as FeedPostLike));
        const rows = fingerprints.map((fp) => ({
          user_id: userId,
          report_id: job.report_id,
          week_index: wkIdx,
          day_index: fp.day,
          pillar: fp.pillar,
          title_formula: fp.formula,
          title_anchors: fp.anchors,
          central_concepts: fp.concepts,
          named_cases: fp.named_cases,
        }));
        const { error: patternErr } = await admin.from("used_title_patterns").insert(rows);
        if (patternErr) {
          console.warn(`[job ${jobId}] used_title_patterns insert falhou:`, patternErr.message);
        }
        const finalCheck = validateWeekDiversity(feedFinal as unknown as FeedPostLike[], diversityHints as any);
        console.log(
          `[editorial-diversity] week=W${wkIdx + 1} user=${userId}\n` +
          `  pillars=${JSON.stringify(fingerprints.map((f) => f.pillar))}\n` +
          `  formulas=${JSON.stringify(fingerprints.map((f) => f.formulas))}\n` +
          `  named_cases=${JSON.stringify(fingerprints.map((f) => f.named_cases))}\n` +
          `  concept_groups_central=${JSON.stringify(fingerprints.map((f) => f.concepts))}\n` +
          `  violations=${JSON.stringify(finalCheck.violations)}`,
        );
      } catch (patternTrackErr) {
        console.warn(`[job ${jobId}] persistência de title patterns falhou (ignorada):`, (patternTrackErr as any)?.message || patternTrackErr);
      }

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
  weekIndex?: number,
  isPartial: boolean = false,
  extraMeta?: Record<string, any>,
): Promise<{ days: DayV6[]; market_trends?: MarketTrend[]; _partial?: boolean; _week_index?: number; _stage_b_failed?: boolean }> {
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

  const weekObj: any = { days };
  if (marketTrends && marketTrends.length > 0) {
    weekObj.market_trends = marketTrends;
  }
  if (typeof weekIndex === "number") {
    weekObj._week_index = weekIndex;
  }
  // start_date: segunda-feira (America/Sao_Paulo) da semana em que a semana foi gerada.
  // Persistir como YYYY-MM-DD permite que a UI mostre datas reais sem recalcular.
  try {
    const nowFmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
    const [yy, mm, dd] = nowFmt.split("-").map(Number);
    if (yy && mm && dd) {
      const dt = new Date(Date.UTC(yy, mm - 1, dd, 12));
      const dow = dt.getUTCDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      dt.setUTCDate(dt.getUTCDate() + diff);
      const iso = dt.toISOString().slice(0, 10);
      weekObj.start_date = iso;
    }
  } catch (_e) { /* fallback silencioso — UI usa report.created_at */ }
  if (isPartial) {
    weekObj._partial = true;
    // Quando isPartial=false (chamada final), se stories vazio, marca falha do Estágio B
  } else if (stories.length === 0) {
    weekObj._partial = true;
    weekObj._stage_b_failed = true;
  }
  if (extraMeta && typeof extraMeta === "object") {
    Object.assign(weekObj, extraMeta);
  }

  const { data: reportRow } = await admin
    .from("reports")
    .select("editorial_weeks")
    .eq("id", reportId)
    .single();

  const currentWeeks: any[] = Array.isArray(reportRow?.editorial_weeks) ? reportRow!.editorial_weeks : [];

  // Idempotência: remove QUALQUER entrada existente com o mesmo week_index antes de anexar.
  // Cobre tanto o save parcial inicial quanto reexecuções/retentativas do Estágio B.
  let cleanedWeeks = currentWeeks;
  let replaced = false;
  if (typeof weekIndex === "number") {
    cleanedWeeks = currentWeeks.filter((w: any) => {
      const wi = w?._week_index ?? w?.week_index;
      if (wi === weekIndex) {
        replaced = true;
        return false;
      }
      return true;
    });
  }
  const updatedWeeks = [...cleanedWeeks, weekObj];

  await admin
    .from("reports")
    .update({ editorial_weeks: updatedWeeks })
    .eq("id", reportId);

  console.log(
    `[job ${jobId}] Semana persistida (${days.length} dias, feed=${feed.length}, stories=${stories.length}, partial=${Boolean(weekObj._partial)}, replaced=${replaced}).`,
  );
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
