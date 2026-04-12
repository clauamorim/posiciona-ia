import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { format, theme, dayNumber, business, niche, archetypes, existingPosts } = await req.json();

    if (!format || !business) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingTitles = (existingPosts || []).map((p: any) => `- ${p.theme}: ${p.caption?.substring(0, 80)}`).join("\n");

    const systemPrompt = `Você é um especialista em conteúdo para Instagram. Gere UM ÚNICO post novo.

IMPORTANTE: Responda APENAS com um JSON válido, sem markdown, sem backticks.

O JSON deve seguir EXATAMENTE esta estrutura:
{
  "day": ${dayNumber || 1},
  "theme": "...",
  "format": "${format}",
  "caption": "...",
  "card_copy": ["..."],
  "cta": "...",
  "script": "..."
}

Regras:
- O tema e conteúdo devem ser COMPLETAMENTE DIFERENTES dos posts existentes listados abaixo
- Para "carrossel": card_copy deve ter mínimo 5 slides
- Para "post": card_copy deve ter 1 item com texto visual
- Para "reels"/"stories": card_copy pode ser []
- "script" deve ter roteiro completo para reels, ou descrição visual para outros
- "caption" é a legenda completa pronta para Instagram
- Responda em português brasileiro`;

    const userPrompt = `Negócio: ${business.company_name || ""}
Serviços: ${business.services || ""}
Público: ${business.target_audience || ""}
Nicho: ${niche || ""}
Arquétipo primário: ${archetypes?.primary?.archetype_name || archetypes?.primary?.name || ""}

Posts já existentes (NÃO repita nenhum deles):
${existingTitles || "Nenhum"}

Gere 1 novo post no formato "${format}" agora.`;

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
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    let post: any;
    try {
      const cleaned = rawContent.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      post = JSON.parse(cleaned);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    return new Response(JSON.stringify({ post }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
