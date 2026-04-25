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
import { sanitizeWeek, sanitizePost, countWeekLeaks, countFrameworkLeaks } from "../_shared/editorialSanitize.ts";
import { callClaude, ClaudeError } from "../_shared/claudeClient.ts";
import {
  fetchEditorialReferencePdfs,
  fetchPersonalQuestionnaire,
  renderPersonalContext,
  renderStorybrandBlock,
  renderToneBlock,
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

      // Build prompts (mesma lógica da função antiga)
      const previousSummary = (previousWeeks || [])
        .flat()
        .map((d: any) => `Dia ${d.day}: ${d.theme} (${d.format})`)
        .join("\n");

      let storybrandContext = "";
      if (storybrand) {
        storybrandContext = `\n\nESTRATÉGIA STORYBRAND DA MARCA (use como base PRINCIPAL para criar conteúdo):
- Herói (Cliente): ${storybrand.hero || ""}
- Guia (Marca): ${storybrand.guide || ""}
- Problema Externo: ${storybrand.external_problem || ""}
- Problema Interno: ${storybrand.internal_problem || ""}
- Problema Filosófico: ${storybrand.philosophical_problem || ""}
- Plano: ${Array.isArray(storybrand.plan) ? storybrand.plan.join(", ") : storybrand.plan || ""}
- CTA: ${storybrand.cta || ""}
- Sucesso: ${storybrand.success || ""}
- Fracasso: ${storybrand.failure || ""}`;
      }

      let toneContext = "";
      if (tone_of_voice) {
        toneContext = `\n\nTOM DE VOZ DA MARCA:
- Resumo: ${tone_of_voice.summary || ""}
- Estilo de comunicação: ${tone_of_voice.communication_style || ""}
- Palavras para USAR: ${(tone_of_voice.words_to_use || []).join(", ")}
- Palavras para EVITAR: ${(tone_of_voice.words_to_avoid || []).join(", ")}
- Emoções para evocar: ${(tone_of_voice.emotions_to_evoke || []).join(", ")}`;
      }

      const systemPrompt = `Você é um especialista em branding e copy para Instagram. Você domina e aplica de forma OBRIGATÓRIA três referências (anexadas em PDF como contexto):
1) StoryBrand (Donald Miller) — clareza narrativa.
2) Obviously Awesome (April Dunford) — posicionamento específico (categoria, alternativas rejeitadas, atributos únicos, valor diferenciado para um público específico).
3) Made to Stick (irmãos Heath) — princípios SUCCES (Simples, Inesperado, Concreto, Crível, Emocional, Histórias) para ganchos memoráveis.

Gere EXATAMENTE 7 novos dias de conteúdo editorial, SEM REPETIR temas, abordagens ou formatos dos conteúdos anteriores.

⚠️ CRÍTICO — FORMATO DE SAÍDA: Sua resposta DEVE começar com "[" e terminar com "]". NÃO use \`\`\` em hipótese alguma. NÃO escreva texto, comentário ou explicação antes ou depois do JSON. Não use vírgula final antes de "}" ou "]". Se você adicionar markdown fences ou texto fora do JSON, o sistema REJEITA a resposta.

IMPORTANTE: Responda APENAS com um JSON válido, sem markdown, sem backticks.

REGRA DE LINGUAGEM (CRÍTICA):
StoryBrand, Obviously Awesome e Made to Stick são camadas ESTRATÉGICAS INTERNAS. NUNCA escreva os rótulos dessas metodologias dentro de "theme", "caption", "card_copy", "cta" ou "script". Os campos visíveis devem soar como copy de marketing real, não como template de framework.

PROIBIDO escrever literalmente (em qualquer campo visível):
"Problema Externo", "Problema Interno", "Problema Filosófico", "O Plano", "Chamada à Ação", "Chamada para Ação", "O Sucesso", "O Fracasso", "O Guia", "O Herói", "Sucesso vs Fracasso", "StoryBrand", "Framework", "Etapa do Framework", "Posicionamento", "Categoria", "SUCCES", "Made to Stick", "Obviously Awesome".

Não use prefixos como "Problema Externo: ...", "Plano: ...", "CTA: ...". Apenas escreva o conteúdo direto, em linguagem natural.

NUNCA prefixe os itens de "card_copy" com "Slide 1:", "Slide 2:", "Card 1:", "Página 1:", etc. Cada item do array JÁ É um slide; escreva apenas o conteúdo do slide.

ESTRATÉGIA DE COPY (OBRIGATÓRIA — aplique em TODA caption, card_copy e script):

A) GANCHO ESPECÍFICO DO NICHO (Made to Stick — Inesperado + Concreto):
- A primeira frase de cada caption e o primeiro slide de cada carrossel DEVEM conter um detalhe concreto, número, cena, dado contraintuitivo ou pergunta inesperada — específicos para o NICHO do cliente, não genéricos para "marketing", "vida" ou "negócios".
- PROIBIDO abrir com aberturas genéricas: "Você sabia que…", "5 dicas para…", "A importância de…", "Vamos falar sobre…", "Hoje vou te contar…", "Já parou para pensar…", "Imagine que…", "Você já se perguntou…".

B) POSICIONAMENTO (Obviously Awesome):
- Pelo menos 1 vez por dia, o conteúdo deve evidenciar: a categoria em que a marca atua (com termos do nicho), o que ela NÃO é (alternativa rejeitada) e o valor único entregue ao cliente específico.
- Evite genéricos como "ajudo pessoas a se conectarem com sua melhor versão". Use linguagem do nicho real do cliente.

C) STORYBRAND como espinha dorsal interna:
- Cada dia explora INTERNAMENTE uma faceta (não cite a faceta no texto):
  - Dia 1: Herói (cliente) — desejo + identidade
  - Dia 2: Problema externo — obstáculo prático e visível do nicho
  - Dia 3: Problema interno — frustração emocional específica
  - Dia 4: Marca como guia — empatia + autoridade
  - Dia 5: Plano — passos claros para contratar/aplicar
  - Dia 6: CTA — convocação clara e direta
  - Dia 7: Sucesso vs Fracasso — futuro positivo concreto e custo de não agir

D) ESTRUTURA OBRIGATÓRIA DE CARROSSEL (mínimo 5 slides):
- Slide 1: GANCHO concreto e inesperado, específico do nicho.
- Slide 2: PROBLEMA SENTIDO — descreva uma cena/situação que o cliente do nicho reconhece imediatamente.
- Slides do meio: INSIGHT + PROVA (números, cases, frase de autoridade) ou PASSOS práticos.
- Último slide: CTA específico (não "saiba mais"; algo verbal e claro como "Comente PLANO e te envio o roteiro").

EXEMPLOS DE CALIBRAÇÃO:
- ERRADO (genérico): "Você sabia que ter uma boa imagem é importante para a sua carreira?"
- CERTO (específico para advocacia trabalhista): "8 em cada 10 audiências trabalhistas que perdi no início tinham o mesmo erro: o cliente entrava na sala vestido como se estivesse no churrasco."
- ERRADO (genérico) em CTA: "Saiba mais no link da bio."
- CERTO em CTA: "Comente AUDIÊNCIA e te mando o checklist de postura para o dia do julgamento."
- ERRADO (genérico) abertura de caption: "5 dicas para melhorar seu marketing digital."
- CERTO: "Cliente que não responde no WhatsApp em 3 minutos some. Esse é o tempo que você tem para parar de soar como mais um."

O JSON deve ser um array com 7 objetos:
[
  {
    "day": 1,
    "theme": "...",
    "format": "reels|carrossel|stories|post",
    "caption": "LEGENDA COMPLETA pronta para postar (com gancho específico do nicho na primeira linha)",
    "card_copy": ["texto do slide/card 1", "texto do slide/card 2"],
    "cta": "CTA específico, verbal e direto",
    "script": "ROTEIRO COMPLETO apenas para Reels/Stories, string vazia para post/carrossel"
  }
]

REFORÇO ANTI META-NARRATIVA (CRÍTICO):
Nunca descreva a estratégia em termos teóricos. NÃO escreva frases como "a marca atua como guia do herói", "o herói da história", "a jornada do herói", "plano de 3 passos", "fracasso iminente", "categoria de mercado". Escreva a copy final, como se o leitor nunca tivesse ouvido falar de framework.
- ERRADO: "Como guia, mostramos ao herói o plano para superar o problema interno."
- CERTO: "Em 3 etapas, sua agenda da semana sai do caos para um sistema previsível."

Regras estruturais:
- 7 dias obrigatórios
- Variar formatos ao longo da semana
- Para "post" e "carrossel", "script" DEVE ser ""
- "card_copy": carrossel ≥ 5 slides; post = 1 item; reels/stories = []
- Responda em português brasileiro`;

      const userPrompt = `
Negócio: ${business?.company_name || "Não informado"}
Serviços: ${business?.services || "Não informado"}
Público-alvo: ${business?.target_audience || "Não informado"}
Nicho: ${niche || "Não informado"}
${storybrandContext}${toneContext}

CONTEÚDOS JÁ PUBLICADOS (NÃO REPETIR):
${previousSummary || "Nenhum conteúdo anterior."}

Gere 7 novos dias de conteúdo em JSON.`;

      const pdfParts = await fetchReferencePdfs();
      const userContent: any = pdfParts.length > 0
        ? [
            ...pdfParts.map(p => ({ type: "file", file: { filename: "reference.pdf", file_data: `data:application/pdf;base64,${p.data}` } })),
            { type: "text", text: userPrompt },
          ]
        : userPrompt;

      // Chamar Gemini com 1 retry
      let rawContent: string;
      try {
        rawContent = await callGemini(systemPrompt, userContent, 120000);
      } catch (firstError) {
        console.warn("Primeira tentativa do Gemini falhou, tentando novamente:", firstError);
        rawContent = await callGemini(systemPrompt, userContent, 120000);
      }

      let editorial = extractJsonFromLLM(rawContent);
      if (!Array.isArray(editorial) || editorial.length === 0) {
        throw Object.assign(new Error("Resposta inválida da IA"), {
          userMessage: "Não foi possível gerar a semana agora. Tente novamente em alguns segundos.",
        });
      }

      // Sanitização
      let sanitized = sanitizeWeek(editorial as any[]);
      let leaks = countWeekLeaks(sanitized);

      if (leaks > 0) {
        await updateJob(jobId, { progress_message: "Refinando linguagem dos posts…" });
        const leakingIndexes: number[] = [];
        sanitized.forEach((day: any, idx: number) => {
          if (countFrameworkLeaks(day) > 0) leakingIndexes.push(idx);
        });

        const dayRetrySystem = `Você é um especialista em copy para Instagram. Reescreva UM ÚNICO dia de conteúdo, sem rótulos de framework (proibido: "Problema Externo", "Plano", "CTA:", "Herói", "Guia", "StoryBrand", "Made to Stick", "Obviously Awesome", "Slide 1:", etc.). Responda APENAS com o objeto JSON do dia, sem markdown, sem texto extra. Estrutura: {"day": N, "theme": "...", "format": "reels|carrossel|stories|post", "caption": "...", "card_copy": [...], "cta": "...", "script": "..."}`;

        const results = await Promise.allSettled(
          leakingIndexes.map(async (idx) => {
            const original = sanitized[idx];
            const dayUserPrompt = `Negócio: ${business?.company_name || "—"}\nNicho: ${niche || "—"}\n\nReescreva este dia removendo qualquer rótulo de framework. Mantenha o tema central, o formato e a intenção, mas use copy direta de marketing.\n\nDia atual (com rótulos a remover):\n${JSON.stringify(original)}\n\nResponda APENAS com o objeto JSON do dia reescrito.`;
            const raw = await callGemini(dayRetrySystem, dayUserPrompt, 60000);
            const parsed = extractJsonFromLLM(raw);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              const cleanedDay = sanitizePost(parsed as Record<string, any>);
              if (countFrameworkLeaks(cleanedDay) < countFrameworkLeaks(original)) {
                return { idx, day: cleanedDay };
              }
            }
            return null;
          })
        );

        for (const r of results) {
          if (r.status === "fulfilled" && r.value) {
            sanitized[r.value.idx] = { ...sanitized[r.value.idx], ...r.value.day };
          }
        }
      }

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
