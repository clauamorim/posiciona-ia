import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { selfies } = await req.json();
    if (!selfies || !Array.isArray(selfies) || selfies.length === 0 || selfies.length > 5) {
      return new Response(JSON.stringify({ error: "Envie de 1 a 5 selfies" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch brand data
    const [archetypesRes, reportRes] = await Promise.all([
      supabase
        .from("user_top_archetypes")
        .select("archetype_name, rank, score")
        .eq("user_id", user.id)
        .order("rank", { ascending: true })
        .limit(3),
      supabase
        .from("reports")
        .select("content")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
    ]);

    const archetypes = archetypesRes.data || [];
    const reportContent = reportRes.data?.content as Record<string, any> | null;

    if (archetypes.length === 0) {
      return new Response(JSON.stringify({ error: "Complete o questionário de arquétipos primeiro" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build style prompt from brand data
    const archetypeNames = archetypes.map((a: any) => a.archetype_name).join(", ");
    const visualIdentity = reportContent?.visual_identity || {};
    const palette = visualIdentity.color_palette || "";
    const style = visualIdentity.visual_style || "";
    const typography = visualIdentity.typography || "";

    const stylePrompt = `Transform this selfie into a professional brand portrait photo. 
IMPORTANT: Maintain the person's facial features, likeness, and identity exactly as they are.
Apply the following brand visual identity:
- Brand archetypes: ${archetypeNames}
- Color palette: ${palette || "Use colors that evoke " + archetypeNames}
- Visual style: ${style || "Professional, polished, aspirational"}
- Typography mood: ${typography || "Modern and clean"}

The portrait should feel like a professional branding photoshoot that captures the essence of the ${archetypes[0]?.archetype_name || "brand"} archetype.
Keep the background elegant and on-brand. The lighting should be cinematic and flattering.
Do NOT add text or watermarks.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate portraits one by one
    const portraits: string[] = [];
    for (let i = 0; i < selfies.length; i++) {
      const selfieBase64 = selfies[i];
      
      const imageUrl = selfieBase64.startsWith("data:")
        ? selfieBase64
        : `data:image/jpeg;base64,${selfieBase64}`;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-flash-image-preview",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: stylePrompt },
                { type: "image_url", image_url: { url: imageUrl } },
              ],
            },
          ],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        const status = response.status;
        if (status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos.", portraits }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (status === 402) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos para continuar.", portraits }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.error(`Portrait ${i + 1} error:`, status, await response.text());
        portraits.push(""); // empty placeholder for failed generation
        continue;
      }

      const data = await response.json();
      const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url || "";
      portraits.push(generatedImage);
    }

    return new Response(JSON.stringify({ portraits }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-portrait error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
