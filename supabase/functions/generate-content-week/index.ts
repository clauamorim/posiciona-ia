import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function fetchReferencePdfs(): Promise<{ mime_type: string; data: string }[]> {
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: docs } = await supabaseAdmin
      .from("reference_documents")
      .select("file_path, file_size")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(5);
    if (!docs?.length) return [];

    const parts: { mime_type: string; data: string }[] = [];
    let totalSize = 0;
    const MAX_TOTAL = 8 * 1024 * 1024;

    for (const doc of docs) {
      if (totalSize + doc.file_size > MAX_TOTAL) break;
      const { data: fileData, error } = await supabaseAdmin.storage
        .from("reference-pdfs")
        .download(doc.file_path);
      if (error || !fileData) continue;
      const arrayBuf = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = "";
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, Math.min(i + CHUNK, bytes.length))));
      }
      const b64 = btoa(binary);
      parts.push({ mime_type: "application/pdf", data: b64 });
      totalSize += doc.file_size;
    }
    return parts;
  } catch (e) {
    console.error("Error fetching reference PDFs:", e);
    return [];
  }
}

async function callGemini(systemPrompt: string, userContent: any): Promise<string> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { business, niche, previousWeeks, storybrand, tone_of_voice, weekNumber } = await req.json();

    // Check credits
    const { data: balanceData } = await supabase
      .from("user_balances")
      .select("weekly_cycles")
      .eq("user_id", user.id)
      .single();

    if (!balanceData || balanceData.weekly_cycles < 1) {
      return new Response(JSON.stringify({ error: "Créditos de ciclos semanais insuficientes. Adquira mais créditos para continuar gerando conteúdo." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduct atomically with a guard
    const { error: creditError, count } = await supabase
      .from("user_balances")
      .update({ weekly_cycles: balanceData.weekly_cycles - 1 })
      .eq("user_id", user.id)
      .gt("weekly_cycles", 0);

    if (creditError) {
      console.error("Credit deduction failed:", creditError);
      return new Response(JSON.stringify({ error: "Erro ao deduzir créditos. Tente novamente." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build summary of previous content to avoid repetition
    const previousSummary = (previousWeeks || [])
      .flat()
      .map((d: any) => `Dia ${d.day}: ${d.theme} (${d.format})`)
      .join("\n");

    // Build StoryBrand context
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

    // Build tone of voice context
    let toneContext = "";
    if (tone_of_voice) {
      toneContext = `\n\nTOM DE VOZ DA MARCA:
- Resumo: ${tone_of_voice.summary || ""}
- Estilo de comunicação: ${tone_of_voice.communication_style || ""}
- Palavras para USAR: ${(tone_of_voice.words_to_use || []).join(", ")}
- Palavras para EVITAR: ${(tone_of_voice.words_to_avoid || []).join(", ")}
- Emoções para evocar: ${(tone_of_voice.emotions_to_evoke || []).join(", ")}`;
    }

    const systemPrompt = `Você é um especialista em branding e marketing de conteúdo para Instagram, especializado na metodologia StoryBrand de Donald Miller.

Gere EXATAMENTE 7 novos dias de conteúdo editorial, SEM REPETIR temas, abordagens ou formatos dos conteúdos anteriores.

IMPORTANTE: Responda APENAS com um JSON válido, sem markdown, sem backticks.

ESTRATÉGIA DE CONTEÚDO — BASEADA EXCLUSIVAMENTE NO STORYBRAND:
Cada dia da semana deve explorar uma faceta diferente do framework StoryBrand:
- Dia 1: Foque no HERÓI (cliente) — mostre que você entende quem ele é, seus desejos e aspirações
- Dia 2: Explore o PROBLEMA EXTERNO — o obstáculo visível que o cliente enfrenta
- Dia 3: Aprofunde o PROBLEMA INTERNO — a frustração emocional, a dúvida, o medo
- Dia 4: Posicione a marca como GUIA — demonstre empatia e autoridade
- Dia 5: Apresente o PLANO — mostre os passos claros que o cliente deve seguir
- Dia 6: Faça o CTA com clareza — convoque à ação com urgência e propósito
- Dia 7: Contraste SUCESSO vs FRACASSO — pinte o futuro positivo e o custo de não agir

O JSON deve ser um array com 7 objetos:
[
  {
    "day": 1,
    "theme": "...",
    "format": "reels|carrossel|stories|post",
    "caption": "LEGENDA COMPLETA pronta para postar",
    "card_copy": ["texto do slide/card 1", "texto do slide/card 2"],
    "cta": "CTA específico",
    "script": "ROTEIRO COMPLETO apenas para Reels/Stories, string vazia para post/carrossel"
  }
]

Regras:
- 7 dias obrigatórios
- Legendas completas prontas para copiar e colar
- Roteiros detalhados com gancho, desenvolvimento e CTA APENAS para Reels e Stories
- Para "post" e "carrossel", o campo "script" DEVE ser string vazia ""
- O campo "card_copy": para "carrossel", array com texto de CADA SLIDE (mínimo 5); para "post", array com 1 item (texto visual do card); para "reels"/"stories", array vazio []
- Variar formatos ao longo da semana
- NÃO repetir temas ou abordagens dos conteúdos anteriores
- Use o StoryBrand e o tom de voz como guias EXCLUSIVOS de todo o conteúdo
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

    // Only fetch reference PDFs for the first week
    const isFirstWeek = !previousWeeks || previousWeeks.length === 0 || (weekNumber && weekNumber <= 1);
    const pdfParts = isFirstWeek ? await fetchReferencePdfs() : [];

    const userContent: any = pdfParts.length > 0
      ? [
          ...pdfParts.map(p => ({ type: "file", file: { filename: "reference.pdf", file_data: `data:application/pdf;base64,${p.data}` } })),
          { type: "text", text: userPrompt },
        ]
      : userPrompt;

    // Call Gemini with 1 retry
    let rawContent: string;
    try {
      rawContent = await callGemini(systemPrompt, userContent);
    } catch (firstError) {
      console.error("First Gemini attempt failed, retrying:", firstError);
      rawContent = await callGemini(systemPrompt, userContent);
    }

    let editorial: any;
    try {
      const cleaned = rawContent.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      editorial = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response:", rawContent.substring(0, 500));
      throw new Error("Falha ao processar resposta da IA. Tente novamente.");
    }

    return new Response(JSON.stringify({ editorial }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-content-week error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
