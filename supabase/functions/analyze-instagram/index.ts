import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    const { username } = await req.json();
    if (!username) {
      return new Response(JSON.stringify({ error: "username is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's StoryBrand + archetypes
    const [reportRes, archRes] = await Promise.all([
      supabase.from("reports").select("content").eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(1).single(),
      supabase.from("user_top_archetypes").select("*").eq("user_id", userId).order("rank").limit(3),
    ]);

    const storyBrand = (reportRes.data?.content as any)?.storybrand || null;
    const visualIdentity = (reportRes.data?.content as any)?.visual_identity || null;
    const archetypes = archRes.data || [];

    // Firecrawl scrape
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: "Firecrawl não configurado" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url: `https://www.instagram.com/${username}/`,
        formats: ["screenshot", "markdown"],
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeRes.json();
    if (!scrapeRes.ok || !scrapeData.success) {
      console.error("Firecrawl error:", scrapeData);
      return new Response(JSON.stringify({ error: "Não foi possível acessar o perfil do Instagram. Verifique o @ e tente novamente." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const d = scrapeData.data || scrapeData;
    const profileData = d.markdown || "Conteúdo não disponível";
    const screenshotBase64 = d.screenshot || null;

    // Build AI prompt
    const systemPrompt = `Você é um especialista em branding e marketing digital. Analise o perfil do Instagram com base nos dados do StoryBrand e arquétipos do usuário. Retorne análise prática e acionável.`;

    const userPrompt = `
## Dados do Perfil do Instagram (@${username})
${profileData}

## StoryBrand do Usuário
${storyBrand ? JSON.stringify(storyBrand, null, 2) : "Não disponível"}

## Top 3 Arquétipos
${archetypes.map((a: any) => `${a.rank}. ${a.archetype_name} (${a.score}pts)`).join("\n")}

## Identidade Visual
${visualIdentity ? JSON.stringify(visualIdentity, null, 2) : "Não disponível"}

Analise os seguintes aspectos e forneça sugestões baseadas no StoryBrand e arquétipos:
1. Nome do Perfil
2. Bio
3. CTA (Call to Action)
4. Destaques
5. Posts Fixados
6. Aparência do Feed
7. Foto de Perfil
    `.trim();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages: any[] = [{ role: "system", content: systemPrompt }];

    if (screenshotBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/png;base64,${screenshotBase64}` } },
          { type: "text", text: userPrompt },
        ],
      });
    } else {
      messages.push({ role: "user", content: userPrompt });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        tools: [{
          type: "function",
          function: {
            name: "instagram_analysis",
            description: "Retorna a análise do perfil do Instagram",
            parameters: {
              type: "object",
              properties: {
                analysis: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      aspect: { type: "string", description: "Nome do aspecto analisado" },
                      current: { type: "string", description: "Situação atual detectada" },
                      suggestion: { type: "string", description: "Sugestão de melhoria baseada em StoryBrand e arquétipos" },
                    },
                    required: ["aspect", "current", "suggestion"],
                  },
                },
              },
              required: ["analysis"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "instagram_analysis" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro na análise com IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Resposta da IA inválida" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify({ analysis: parsed.analysis, screenshot: screenshotBase64 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-instagram error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
