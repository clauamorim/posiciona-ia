import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STYLE_VARIATIONS = [
  "Professional studio portrait with soft, controlled lighting and a clean, elegant background. High-end corporate branding style. Shot on a medium-format camera with shallow depth of field.",
  "Outdoor portrait with warm, golden-hour natural light. Relaxed yet professional, with a softly blurred natural background. Captured with a 85mm lens for natural compression.",
  "Editorial magazine cover style portrait. Dramatic lighting with high contrast. Bold, confident pose and cinematic atmosphere. Studio lighting with a single key light and subtle fill.",
  "Corporate headshot with clean, neutral background. Even lighting, sharp focus, polished and approachable look. Two-light setup with soft modifiers.",
  "Artistic and creative portrait with unique color grading, textured background, and expressive lighting. Fashion-forward and memorable. Shot with natural window light and reflectors.",
];

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check credit balance
    const { data: balanceData } = await supabase
      .from("user_balances")
      .select("portrait_credits_included, portrait_credits_extra")
      .eq("user_id", user.id)
      .single();

    const included = balanceData?.portrait_credits_included ?? 0;
    const extra = balanceData?.portrait_credits_extra ?? 0;

    if (included + extra <= 0) {
      return new Response(JSON.stringify({ error: "Sem créditos de retrato disponíveis. Compre um pacote de retratos." }), {
        status: 400,
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

    const archetypeNames = archetypes.map((a: any) => a.archetype_name).join(", ");
    const visualIdentity = reportContent?.visual_identity || {};
    const palette = visualIdentity.color_palette || "";
    const style = visualIdentity.visual_style || "";
    const typography = visualIdentity.typography || "";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate 1 portrait with random style
    const styleIndex = Math.floor(Math.random() * STYLE_VARIATIONS.length);
    const variationStyle = STYLE_VARIATIONS[styleIndex];

    const referenceImages = selfies.map((s: string) => ({
      type: "image_url" as const,
      image_url: { url: s.startsWith("data:") ? s : `data:image/jpeg;base64,${s}` },
    }));

    const refCount = selfies.length > 1 ? ` I'm providing ${selfies.length} reference photos of the same person from different angles to help you accurately capture their features.` : "";

    const prompt = `Transform these reference selfie(s) into a hyper-realistic professional brand portrait photograph. The result MUST look like a real photograph taken in a professional studio — NOT a digital illustration, painting, or AI-generated looking image.${refCount}

CRITICAL REALISM RULES:
- Maintain the person's EXACT facial features, skin texture, pores, and natural imperfections. Do NOT smooth or idealize the skin.
- Hair MUST look natural with some loose strands, flyaway hairs, and natural texture — overly styled or perfectly arranged hair looks artificial.
- Eyes must have natural reflections and catchlights from the lighting setup.
- Clothing should have realistic fabric texture, natural wrinkles and folds.
- The overall image should be indistinguishable from a photograph taken with a professional DSLR or mirrorless camera.

Style variation: ${variationStyle}

Apply the following brand visual identity subtly through lighting, color grading, and atmosphere:
- Brand archetypes: ${archetypeNames}
- Color palette influence: ${palette || "Use tones that evoke " + archetypeNames}
- Visual style: ${style || "Professional, polished, aspirational"}
- Typography mood: ${typography || "Modern and clean"}

The portrait should subtly capture the essence of the ${archetypes[0]?.archetype_name || "brand"} archetype through body language, expression, and lighting — NOT through costumes, props, or literal archetype representations.
Do NOT add text, watermarks, or any graphic overlays.
Do NOT make the person look like a character or caricature. This is a professional branding photo, not cosplay.`;

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
              { type: "text", text: prompt },
              ...referenceImages,
            ],
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes no gateway. Contate o suporte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("Portrait generation error:", status, errText);
      return new Response(JSON.stringify({ error: "Erro ao gerar retrato. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url || "";

    if (!generatedImage) {
      return new Response(JSON.stringify({ error: "Nenhuma imagem gerada. Tente novamente." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Consume 1 credit: included first, then extra
    if (included > 0) {
      await supabaseAdmin.from("user_balances").update({
        portrait_credits_included: included - 1,
      }).eq("user_id", user.id);
    } else {
      await supabaseAdmin.from("user_balances").update({
        portrait_credits_extra: extra - 1,
      }).eq("user_id", user.id);
    }

    // Log
    await supabaseAdmin.from("credit_logs").insert({
      user_id: user.id,
      credit_type: "portrait",
      amount: -1,
      description: `Retrato gerado (estilo ${styleIndex + 1})`,
    });

    return new Response(JSON.stringify({ portrait: generatedImage, style_index: styleIndex }), {
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
