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

// Distribuição fixa dos 4 dias com feed dentro da semana (1..7).
// Escolhemos dias que cobrem início, meio e fim da semana com bom espaçamento.
const FEED_DAYS = [1, 3, 5, 7];

function buildFeedSystemPrompt(): string {
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
  "caption": "Toda manhã, antes de qualquer reunião, eu nado. Não é ritual motivacional. É necessidade operacional. Porque descobri que análise de posicionamento profunda exige o mesmo tipo de clareza mental que nadar exige de técnica… [continua por mais 800 caracteres]",
  "card_copy": ["40 minutos de natação me ensinaram mais sobre posicionamento do que 18 anos de carreira."]
}

EXEMPLO RUIM (PROIBIDO — card repete a legenda):
{
  "caption": "Toda manhã, antes de qualquer reunião, eu nado…",
  "card_copy": ["Toda manhã, antes de qualquer reunião, eu nado. Não é ritual motivacional. É necessidade operacional…"]
}

ESTRATÉGIA DE COPY (OBRIGATÓRIA) — DISTRIBUIÇÃO FIXA DOS 4 POSTS:
Cada um dos 4 posts da semana TEM UM TIPO FIXO E OBRIGATÓRIO. Não invente outros tipos. Não repita tipo.

POST 1 — EDUCACIONAL: tutorial ou passo a passo prático.
Estrutura: problema concreto → passos numerados → resultado esperado.
SEM storytelling pessoal. SEM abrir com "você sabia que".

POST 2 — DESMISTIFICAÇÃO: escolha uma crença errada comum no nicho e refute com raciocínio sólido ou dado observável.
Estrutura: mito declarado → por que as pessoas acreditam → por que está errado → o que é verdade.

POST 3 — POSICIONAMENTO: evidencie categoria + o que a marca NÃO é + para quem especificamente é.
Estrutura: alternativa que o público usaria sem esta solução → por que essa alternativa é insuficiente → o que torna esta abordagem diferente → perfil exato do cliente ideal.

POST 4 — ANÁLISE DE MERCADO OU CASO: se houver tendência relevante no bloco TENDÊNCIAS, use-a. Se não houver, use mini-caso hipotético com estrutura situação → decisão → resultado.

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
- Storytelling pessoal: NO MÁXIMO 3 dos 7 stories podem ter is_personal=true. Os demais devem ser análise, dica ou quebra de mito alinhados ao pilar do feed do dia (quando houver) ou ao pilar sub-representado da semana.
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
- Português brasileiro.`;
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

      const storybrandContext = renderStorybrandBlock(storybrand);
      const toneContext = renderToneBlock(tone_of_voice);
      const verifiableFactsBlock = renderVerifiableFactsBlock(business);
      const personal = await fetchPersonalQuestionnaire(userId);
      const personalContext = renderPersonalContext(personal);

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
      const marketTrendsBlock = renderMarketTrendsBlock(marketTrends);

      // ==== ESTÁGIO A: Feed (4 posts) ====
      await updateJob(jobId, { progress_message: "Gerando seus 4 posts de feed (etapa 1 de 2)…" });

      const feedSystem =
        NARRATIVE_PRINCIPLES_BLOCK +
        ethicalBlock +
        "\n\n" +
        buildFeedSystemPrompt() +
        renderPillarsBlock() +
        renderEditorialFrameworks();
      const feedUser = `# NEGÓCIO
Empresa: ${business?.company_name || "Não informado"}
Serviços: ${business?.services || "Não informado"}
Público-alvo: ${business?.target_audience || "Não informado"}
Nicho: ${niche || "Não informado"}${verifiableFactsBlock}${storybrandContext}${toneContext}${personalContext}${rotationBlock}

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
