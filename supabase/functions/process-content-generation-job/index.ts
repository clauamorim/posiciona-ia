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
import { callClaude } from "../_shared/claudeClient.ts";
import {
  fetchPersonalQuestionnaire,
  renderPersonalContext,
  renderStorybrandBlock,
  renderToneBlock,
  renderEditorialFrameworks,
} from "../_shared/buildClaudeContext.ts";

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
StoryBrand, Obviously Awesome e Made to Stick são camadas ESTRATÉGICAS INTERNAS. NUNCA escreva os rótulos dessas metodologias nos campos visíveis.

PROIBIDO escrever literalmente em "theme", "caption", "card_copy", "cta" ou "script":
"Problema Externo", "Problema Interno", "Problema Filosófico", "O Plano", "Chamada à Ação", "Chamada para Ação", "O Sucesso", "O Fracasso", "O Guia", "O Herói", "Sucesso vs Fracasso", "StoryBrand", "Framework", "Etapa do Framework", "Posicionamento", "Categoria", "SUCCES", "Made to Stick", "Obviously Awesome".

NUNCA prefixe os itens de "card_copy" com "Slide 1:", "Card 1:", "Página 1:". Cada item já É um slide.

ESTRATÉGIA DE COPY (OBRIGATÓRIA):
A) Gancho específico do nicho (Made to Stick — Inesperado + Concreto):
- Primeira frase de toda caption e slide 1 de todo carrossel: detalhe concreto, número, cena, dado contraintuitivo ou pergunta inesperada — específicos para o NICHO.
- PROIBIDO abrir com: "Você sabia que…", "5 dicas para…", "A importância de…", "Vamos falar sobre…", "Hoje vou te contar…", "Já parou para pensar…", "Imagine que…", "Você já se perguntou…".

B) Posicionamento (Obviously Awesome): pelo menos 1 dos 4 posts deve evidenciar categoria + alternativa rejeitada + valor único.

C) StoryBrand interno: distribua facetas pelos 4 dias sem CITÁ-LAS:
- 1 post de problema/dor sentida pelo cliente
- 1 post de método/plano (passos práticos)
- 1 post de resultado/transformação concreta
- 1 post de prova/autoridade ou storytelling pessoal

D) Estrutura de carrossel (mínimo 5 slides):
- Slide 1: GANCHO. Slide 2: PROBLEMA SENTIDO. Slides do meio: INSIGHT + PROVA ou PASSOS. Último: CTA verbal e direto.

E) Humanização (storytelling pessoal):
- Reserve 1 dos 4 posts para storytelling pessoal (marque is_personal=true). Use vivência REAL do criador (do bloco "CONTEXTO PESSOAL DO CRIADOR") como metáfora para a dor do cliente. Modelo "do tatame ao tribunal".
- Posts pessoais podem aparecer no feed mas com BAIXA frequência (0 ou 1 por semana). A predominância de pessoal está nos stories.
- Nunca invente fatos. Se não houver contexto pessoal, NÃO marque is_personal.

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
    "theme": "...",
    "caption": "LEGENDA COMPLETA pronta para postar",
    "card_copy": ["slide 1", "slide 2", ...],
    "cta": "CTA verbal e direto",
    "script": "ROTEIRO COMPLETO se for reels; string vazia para post/carrossel",
    "is_personal": false
  }
]

REGRAS ESTRUTURAIS:
- "day" deve ser exatamente um dos valores ${FEED_DAYS.join(", ")}, na ordem.
- "card_copy": carrossel ≥ 5 itens; post = 1 item; reels = [].
- "script": apenas reels tem texto; post/carrossel = "".
- Português brasileiro.

REFORÇO ANTI META-NARRATIVA: NÃO escreva "a marca atua como guia", "jornada do herói", "plano de 3 passos", "fracasso iminente", "categoria de mercado".`;
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
- Predominância pessoal: pelo menos 4 dos 7 stories devem ter is_personal=true.
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
      // ==== Resumo de conteúdo anterior (compactado p/ não inflar prompts)
      // previousWeeks pode vir no shape v5 (array de posts) ou v6 (array de objetos { days }).
      const previousSummary = (previousWeeks || [])
        .flatMap((week: any) => {
          if (Array.isArray(week)) {
            // v5: array de posts simples
            return week.map((d: any) => `${d.theme || ""} (${d.format || ""})`);
          }
          // v6: { days: [...] }
          if (week && Array.isArray(week.days)) {
            return week.days
              .map((d: any) => d?.feed?.theme)
              .filter((t: any) => typeof t === "string" && t);
          }
          return [];
        })
        .filter(Boolean)
        .slice(-30) // limita a 30 últimos temas
        .join("\n");

      const storybrandContext = renderStorybrandBlock(storybrand);
      const toneContext = renderToneBlock(tone_of_voice);
      const personal = await fetchPersonalQuestionnaire(userId);
      const personalContext = renderPersonalContext(personal);

      // ==== ESTÁGIO A: Feed (4 posts) ====
      await updateJob(jobId, { progress_message: "Gerando seus 4 posts de feed (etapa 1 de 2)…" });

      const feedSystem = buildFeedSystemPrompt() + renderEditorialFrameworks();
      const feedUser = `# NEGÓCIO
Empresa: ${business?.company_name || "Não informado"}
Serviços: ${business?.services || "Não informado"}
Público-alvo: ${business?.target_audience || "Não informado"}
Nicho: ${niche || "Não informado"}${storybrandContext}${toneContext}${personalContext}

# TEMAS JÁ PUBLICADOS (NÃO REPETIR)
${previousSummary || "Nenhum conteúdo anterior."}

Gere agora os 4 posts de feed para os dias ${FEED_DAYS.join(", ")}.`;

      const feedRaw = await callClaude({
        systemPrompt: feedSystem,
        userText: feedUser,
        max_tokens: 6000,
        timeoutMs: 130000,
        disableRetries: true,
      });

      let feedParsed: any = extractJsonFromLLM(feedRaw);
      if (!Array.isArray(feedParsed) || feedParsed.length === 0) {
        // tentativa de recuperação parcial
        const partial: any[] = [];
        const objRegex = /\{\s*"day"\s*:\s*\d+[\s\S]*?\n\s*\}/g;
        const matches = (feedRaw || "").match(objRegex) || [];
        for (const m of matches) {
          try {
            const obj = JSON.parse(m);
            if (obj && typeof obj.day === "number") partial.push(obj);
          } catch { /* ignora */ }
        }
        if (partial.length >= 2) {
          console.warn(`[job ${jobId}] Estágio A: recuperados ${partial.length} posts parciais.`);
          feedParsed = partial;
        } else {
          console.error(`[job ${jobId}] Estágio A falhou. raw len=${feedRaw?.length || 0}. Início: ${(feedRaw||"").slice(0,300)}`);
          throw Object.assign(new Error("Estágio A inválido"), {
            userMessage: "A IA respondeu de forma incompleta na etapa do feed. Tente novamente — seu crédito foi devolvido.",
          });
        }
      }

      // Normaliza/sanitiza posts de feed e indexa por dia
      const feedByDay = new Map<number, FeedPost>();
      for (const p of feedParsed) {
        if (!p || typeof p !== "object") continue;
        const dayN = Number((p as any).day);
        if (!FEED_DAYS.includes(dayN)) continue;
        const cleaned = sanitizePost(p as Record<string, any>) as FeedPost;
        cleaned.day = dayN;
        cleaned.format = (cleaned.format || "post").toString().toLowerCase();
        if (cleaned.format === "stories") cleaned.format = "post";
        cleaned.is_personal = Boolean((cleaned as any).is_personal);
        feedByDay.set(dayN, cleaned);
      }

      // Garante que existe um post para cada dia esperado; se faltar, cria placeholder mínimo
      const feedFinal: FeedPost[] = FEED_DAYS.map((d) => {
        const existing = feedByDay.get(d);
        if (existing) return existing;
        console.warn(`[job ${jobId}] Estágio A: faltando post do dia ${d}, usando placeholder.`);
        return {
          day: d,
          format: "post",
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

      // ==== ESTÁGIO B: Stories (7) ====
      const feedSummaryForStories = feedFinal
        .map((p) => `Dia ${p.day} (${p.format}${p.is_personal ? ", pessoal" : ""}): ${p.theme}`)
        .join("\n");

      const storiesSystem = buildStoriesSystemPrompt(feedSummaryForStories, FEED_DAYS) + renderEditorialFrameworks();
      const storiesUser = `# NEGÓCIO
Empresa: ${business?.company_name || "Não informado"}
Serviços: ${business?.services || "Não informado"}
Público-alvo: ${business?.target_audience || "Não informado"}
Nicho: ${niche || "Não informado"}${storybrandContext}${toneContext}${personalContext}

Gere agora os 7 stories da semana.`;

      const storiesRaw = await callClaude({
        systemPrompt: storiesSystem,
        userText: storiesUser,
        max_tokens: 5000,
        timeoutMs: 100000,
        disableRetries: true,
      });

      let storiesParsed: any = extractJsonFromLLM(storiesRaw);
      if (!Array.isArray(storiesParsed) || storiesParsed.length === 0) {
        const partial: any[] = [];
        const objRegex = /\{\s*"day"\s*:\s*\d+[\s\S]*?\n\s*\}/g;
        const matches = (storiesRaw || "").match(objRegex) || [];
        for (const m of matches) {
          try {
            const obj = JSON.parse(m);
            if (obj && typeof obj.day === "number") partial.push(obj);
          } catch { /* ignora */ }
        }
        if (partial.length >= 4) {
          console.warn(`[job ${jobId}] Estágio B: recuperados ${partial.length} stories parciais.`);
          storiesParsed = partial;
        } else {
          // Falha do B: persiste apenas o feed e marca completed_partial — usuário pode regenerar só os stories
          console.error(`[job ${jobId}] Estágio B falhou. raw len=${storiesRaw?.length || 0}.`);
          await persistWeek(job.report_id, feedFinal, [], jobId);
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
      const weekObj = await persistWeek(job.report_id, feedFinal, storiesFinal, jobId);

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
): Promise<{ days: DayV6[] }> {
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

  const weekObj = { days };

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
