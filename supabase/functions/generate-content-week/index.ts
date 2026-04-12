import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    
    // Get user from JWT
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

    const { business, niche, archetypes, previousWeeks } = await req.json();

    // Check weekly_cycles credits
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

    // Build summary of previous content to avoid repetition
    const previousSummary = (previousWeeks || [])
      .flat()
      .map((d: any) => `Dia ${d.day}: ${d.theme} (${d.format})`)
      .join("\n");

    const systemPrompt = `Você é um especialista em branding e marketing de conteúdo para Instagram.
Gere EXATAMENTE 7 novos dias de conteúdo editorial, SEM REPETIR temas, abordagens ou formatos dos conteúdos anteriores.

IMPORTANTE: Responda APENAS com um JSON válido, sem markdown, sem backticks.

O JSON deve ser um array com 7 objetos:
[
  {
    "day": 1,
    "theme": "...",
    "format": "reels|carrossel|stories|post",
    "caption": "LEGENDA COMPLETA pronta para postar",
    "card_copy": ["texto do slide/card 1", "texto do slide/card 2"],
    "cta": "CTA específico",
    "script": "ROTEIRO COMPLETO para Reels ou descrição visual para outros formatos"
  }
]

Regras:
- 7 dias obrigatórios
- Legendas completas prontas para copiar e colar
- Roteiros detalhados com gancho, desenvolvimento e CTA
- O campo "card_copy": para "carrossel", array com texto de CADA SLIDE (mínimo 5); para "post", array com 1 item (texto visual do card); para "reels"/"stories", array vazio []
- Variar formatos ao longo da semana
- NÃO repetir temas ou abordagens dos conteúdos anteriores
- Responda em português brasileiro`;

    const userPrompt = `
Negócio: ${business?.company_name || "Não informado"}
Serviços: ${business?.services || "Não informado"}
Público-alvo: ${business?.target_audience || "Não informado"}
Nicho: ${niche || "Não informado"}

Arquétipos:
- Primário: ${archetypes?.primary?.name}
- Secundário: ${archetypes?.secondary?.name}
- Terciário: ${archetypes?.tertiary?.name}

CONTEÚDOS JÁ PUBLICADOS (NÃO REPETIR):
${previousSummary || "Nenhum conteúdo anterior."}

Gere 7 novos dias de conteúdo em JSON.`;

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
          { role: "user", content: userPrompt },
        ],
        max_tokens: 6000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    let editorial: any;
    try {
      const cleaned = rawContent.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      editorial = JSON.parse(cleaned);
    } catch {
      throw new Error("Falha ao processar resposta da IA. Tente novamente.");
    }

    // Deduct 1 weekly cycle
    await supabase
      .from("user_balances")
      .update({ weekly_cycles: balanceData.weekly_cycles - 1 })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({ editorial }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
