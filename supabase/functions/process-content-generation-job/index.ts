// Worker em background — processa um job de geração de semana editorial.
// Disparado via fire-and-forget pelo `generate-content-week` (enqueuer).
// Aceita execuções longas (até ~150s) sem bloquear o cliente.
//
// 2026-04-25-v5: migrado de Gemini para Claude Sonnet 4.5 + injeção
// obrigatória do contexto pessoal do criador (humanização).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractJsonFromLLM } from "../_shared/jsonExtract.ts";
import { EDITORIAL_GENERATOR_VERSION } from "../_shared/generatorVersion.ts";
import { sanitizeWeek } from "../_shared/editorialSanitize.ts";
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

async function processJob(jobId: string) {
  // Carrega o job
  const { data: job, error: jobErr } = await admin
    .from("content_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    console.error("Job não encontrado:", jobId, jobErr);
    return;
  }

  // Idempotência: se já foi processado, não roda de novo
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

    // Reservar crédito antes da chamada cara: deduz primeiro, devolve em caso de falha.
    // Usa CAS na coluna weekly_cycles para evitar corrida.
    const { data: balanceData } = await admin
      .from("user_balances")
      .select("weekly_cycles")
      .eq("user_id", userId)
      .single();

    if (!balanceData || balanceData.weekly_cycles < 1) {
      throw Object.assign(new Error("Créditos de ciclos semanais insuficientes."), {
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
      await updateJob(jobId, { progress_message: "Gerando seus 7 posts… pode levar até 2 minutos." });

      // Build prompts
      const previousSummary = (previousWeeks || [])
        .flat()
        .map((d: any) => `Dia ${d.day}: ${d.theme} (${d.format})`)
        .join("\n");

      const storybrandContext = renderStorybrandBlock(storybrand);
      const toneContext = renderToneBlock(tone_of_voice);

      // Carrega contexto pessoal do criador (humanização)
      const personal = await fetchPersonalQuestionnaire(userId);
      const personalContext = renderPersonalContext(personal);

      const systemPrompt = `Você é um especialista em branding e copy para Instagram. Você domina e aplica de forma OBRIGATÓRIA três frameworks (descritos em detalhe ao final deste prompt):
1) StoryBrand (Donald Miller) — clareza narrativa.
2) Obviously Awesome (April Dunford) — posicionamento específico.
3) Made to Stick (irmãos Heath) — princípios SUCCESs (Simples, Inesperado, Concreto, Crível, Emocional, Histórias).

Gere EXATAMENTE 7 novos dias de conteúdo editorial, SEM REPETIR temas, abordagens ou formatos dos conteúdos anteriores.

⚠️ CRÍTICO — FORMATO DE SAÍDA: Sua resposta DEVE começar com "[" e terminar com "]". NÃO use \`\`\` em hipótese alguma. NÃO escreva texto, comentário ou explicação antes ou depois do JSON. Não use vírgula final antes de "}" ou "]". Se você adicionar markdown fences ou texto fora do JSON, o sistema REJEITA a resposta.

REGRA DE LINGUAGEM (CRÍTICA):
StoryBrand, Obviously Awesome e Made to Stick são camadas ESTRATÉGICAS INTERNAS. NUNCA escreva os rótulos dessas metodologias dentro de "theme", "caption", "card_copy", "cta" ou "script". Os campos visíveis devem soar como copy de marketing real, não como template de framework.

PROIBIDO escrever literalmente (em qualquer campo visível):
"Problema Externo", "Problema Interno", "Problema Filosófico", "O Plano", "Chamada à Ação", "Chamada para Ação", "O Sucesso", "O Fracasso", "O Guia", "O Herói", "Sucesso vs Fracasso", "StoryBrand", "Framework", "Etapa do Framework", "Posicionamento", "Categoria", "SUCCES", "Made to Stick", "Obviously Awesome".

Não use prefixos como "Problema Externo: ...", "Plano: ...", "CTA: ...". Apenas escreva o conteúdo direto, em linguagem natural.

NUNCA prefixe os itens de "card_copy" com "Slide 1:", "Slide 2:", "Card 1:", "Página 1:", etc. Cada item do array JÁ É um slide; escreva apenas o conteúdo do slide.

ESTRATÉGIA DE COPY (OBRIGATÓRIA — aplique em TODA caption, card_copy e script):

A) GANCHO ESPECÍFICO DO NICHO (Made to Stick — Inesperado + Concreto):
- A primeira frase de cada caption e o primeiro slide de cada carrossel DEVEM conter um detalhe concreto, número, cena, dado contraintuitivo ou pergunta inesperada — específicos para o NICHO do cliente.
- PROIBIDO abrir com aberturas genéricas: "Você sabia que…", "5 dicas para…", "A importância de…", "Vamos falar sobre…", "Hoje vou te contar…", "Já parou para pensar…", "Imagine que…", "Você já se perguntou…".

B) POSICIONAMENTO (Obviously Awesome):
- Pelo menos 1 vez por dia, o conteúdo deve evidenciar: a categoria em que a marca atua, o que ela NÃO é (alternativa rejeitada) e o valor único entregue.

C) STORYBRAND como espinha dorsal interna:
- Cada dia explora INTERNAMENTE uma faceta (não cite a faceta no texto):
  - Dia 1: Herói (cliente) — desejo + identidade
  - Dia 2: Problema externo
  - Dia 3: Problema interno
  - Dia 4: Marca como guia
  - Dia 5: Plano
  - Dia 6: CTA
  - Dia 7: Sucesso vs Fracasso

D) ESTRUTURA OBRIGATÓRIA DE CARROSSEL (mínimo 5 slides):
- Slide 1: GANCHO concreto e inesperado.
- Slide 2: PROBLEMA SENTIDO.
- Slides do meio: INSIGHT + PROVA ou PASSOS.
- Último slide: CTA específico, verbal e direto.

E) HUMANIZAÇÃO via storytelling pessoal (CRÍTICO quando há contexto pessoal):
- Reserve 1 ou 2 dos 7 dias para posts em formato STORYTELLING que tecem paralelos entre a vida pessoal/história do criador (hobbies, esportes, valores, memórias) e as dores do cliente-alvo. Modelo de referência: "do tatame ao tribunal" — usar uma vivência concreta do criador como metáfora narrativa para o problema do cliente.
- Nos demais dias, use detalhes pessoais como TEMPERO: vocabulário do hobby, exemplos do dia a dia, cenas reais. Sem forçar.
- Nunca invente fatos pessoais. Use APENAS o que está no bloco "CONTEXTO PESSOAL DO CRIADOR".

EXEMPLOS DE CALIBRAÇÃO:
- ERRADO (genérico): "Você sabia que ter uma boa imagem é importante para a sua carreira?"
- CERTO (storytelling para advogado que pratica jiu-jitsu): "No jiu-jitsu, perdi 4 lutas seguidas porque acreditei que força bastava. Aprendi a estratégia. Em audiência trabalhista é igual: o cliente que entra com argumento bruto e sem postura também perde — mesmo com razão."
- ERRADO em CTA: "Saiba mais no link da bio."
- CERTO em CTA: "Comente AUDIÊNCIA e te mando o checklist de postura para o dia do julgamento."

O JSON deve ser um array com 7 objetos:
[
  {
    "day": 1,
    "theme": "...",
    "format": "reels|carrossel|stories|post",
    "caption": "LEGENDA COMPLETA pronta para postar",
    "card_copy": ["texto do slide 1", "texto do slide 2"],
    "cta": "CTA específico, verbal e direto",
    "script": "ROTEIRO COMPLETO apenas para Reels/Stories, string vazia para post/carrossel"
  }
]

REFORÇO ANTI META-NARRATIVA (CRÍTICO):
Nunca descreva a estratégia em termos teóricos. NÃO escreva frases como "a marca atua como guia do herói", "jornada do herói", "plano de 3 passos", "fracasso iminente", "categoria de mercado".

Regras estruturais:
- 7 dias obrigatórios
- Variar formatos ao longo da semana
- Para "post" e "carrossel", "script" DEVE ser ""
- "card_copy": carrossel ≥ 5 slides; post = 1 item; reels/stories = []
- Responda em português brasileiro`;

      const userPrompt = `# NEGÓCIO
Empresa: ${business?.company_name || "Não informado"}
Serviços: ${business?.services || "Não informado"}
Público-alvo: ${business?.target_audience || "Não informado"}
Nicho: ${niche || "Não informado"}${storybrandContext}${toneContext}${personalContext}

# CONTEÚDOS JÁ PUBLICADOS (NÃO REPETIR)
${previousSummary || "Nenhum conteúdo anterior."}

Gere 7 novos dias de conteúdo em JSON.`;

      // Frameworks injetados como texto denso (substitui PDFs para respeitar
      // o limite de 30k tokens/min da org Anthropic).
      const enrichedSystemPrompt = systemPrompt + renderEditorialFrameworks();

      // Uma única chamada paga, sem retry automático (evita cobrança duplicada).
      // max_tokens=6000: 7 posts com caption + carrossel completo + script
      // não cabem em 3500 (causa truncamento). 6000 é o teto seguro dentro
      // dos 170s de timeout do worker.
      const rawContent = await callClaude({
        systemPrompt: enrichedSystemPrompt,
        userText: userPrompt,
        max_tokens: 6000,
        timeoutMs: 170000,
        disableRetries: true,
      });

      let editorial = extractJsonFromLLM(rawContent);

      // Se o parse falhou, salva amostra do raw para diagnóstico antes de abortar.
      // Tentamos ainda uma recuperação manual: buscar até onde der dias completos.
      if (!Array.isArray(editorial) || editorial.length === 0) {
        console.error(
          `[job ${jobId}] Parse falhou. raw length=${rawContent?.length || 0}. ` +
          `Início: ${(rawContent || "").substring(0, 300)} | ` +
          `Fim: ${(rawContent || "").substring(Math.max(0, (rawContent || "").length - 300))}`
        );

        // Tentativa de salvar dias parciais: extrai cada `{ "day": N, ... }` fechado.
        const partial: any[] = [];
        const objRegex = /\{\s*"day"\s*:\s*\d+[\s\S]*?\n\s*\}/g;
        const matches = (rawContent || "").match(objRegex) || [];
        for (const m of matches) {
          try {
            const obj = JSON.parse(m);
            if (obj && typeof obj.day === "number") partial.push(obj);
          } catch { /* ignora item quebrado */ }
        }
        if (partial.length >= 3) {
          console.warn(`[job ${jobId}] Recuperados ${partial.length} dias parciais.`);
          editorial = partial;
        } else {
          throw Object.assign(new Error("Resposta inválida da IA"), {
            userMessage:
              "A IA respondeu de forma incompleta. Tente novamente — seu crédito de ciclo já foi devolvido.",
          });
        }
      }

      // Sanitização local (regex) — sem chamadas extras à IA.
      const sanitized = sanitizeWeek(editorial as any[]);

      const stamped = sanitized.map((d: any) => ({
        ...d,
        generator_version: EDITORIAL_GENERATOR_VERSION,
      }));

      // Persistir no relatório
      await updateJob(jobId, { progress_message: "Salvando conteúdo…" });

      const { data: reportRow } = await admin
        .from("reports")
        .select("editorial_weeks, version")
        .eq("id", job.report_id)
        .single();

      const currentWeeks: any[][] = Array.isArray(reportRow?.editorial_weeks) ? reportRow!.editorial_weeks : [];
      const updatedWeeks = [...currentWeeks, stamped];

      await admin
        .from("reports")
        .update({ editorial_weeks: updatedWeeks })
        .eq("id", job.report_id);

      // Sucesso
      await updateJob(jobId, {
        status: "completed",
        result: { editorial: stamped, generator_version: EDITORIAL_GENERATOR_VERSION },
        progress_message: "Concluído!",
        finished_at: new Date().toISOString(),
        error_message: null,
      });

      console.log(`Job ${jobId} concluído com sucesso.`);
    } catch (innerErr: any) {
      // Devolve crédito reservado em qualquer falha após a reserva
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

    // Confirma recepção imediatamente; processa em background.
    // @ts-ignore — EdgeRuntime existe no runtime Supabase
    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      // @ts-ignore
      EdgeRuntime.waitUntil(processJob(jobId));
    } else {
      // Fallback: processa síncrono (não esperado em produção)
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
