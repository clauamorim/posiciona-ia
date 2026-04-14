import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STUDIO_STYLES = [
  "Professional studio portrait, soft controlled lighting, clean neutral gray backdrop with subtle tonal gradient. Medium-format camera, shallow depth of field, two-light setup with large softboxes.",
  "Warm neutral-toned seamless backdrop with subtle texture and tonal variation simulating studio lighting. Rembrandt lighting, single key light, subtle shadow on one side. 85mm f/1.4 lens.",
  "Dark charcoal backdrop with subtle gradient lighting from behind. Dramatic single key light from 45 degrees with subtle rim light. Cinematic feel.",
  "Deep navy/dark teal textured backdrop with warm spotlight glow. Butterfly lighting, soft flattering light. Fashion-editorial approach.",
  "Muted olive-gray backdrop with soft vignette and warm fill light. Two-light setup, elegant and understated. Professional branding aesthetic.",
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

    const [balanceRes, profileRes, archetypesRes, reportRes] = await Promise.all([
      supabase.from("user_balances").select("portrait_credits_included, portrait_credits_extra").eq("user_id", user.id).single(),
      supabase.from("profiles").select("gender").eq("user_id", user.id).single(),
      supabase.from("user_top_archetypes").select("archetype_name, rank, score").eq("user_id", user.id).order("rank", { ascending: true }).limit(3),
      supabase.from("reports").select("content").eq("user_id", user.id).eq("status", "completed").order("created_at", { ascending: false }).limit(1).single(),
    ]);

    const included = balanceRes.data?.portrait_credits_included ?? 0;
    const extra = balanceRes.data?.portrait_credits_extra ?? 0;

    if (included + extra <= 0) {
      return new Response(JSON.stringify({ error: "Sem créditos de retrato disponíveis. Compre um pacote de retratos." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { selfies, wardrobeVariation } = await req.json();
    if (!selfies || !Array.isArray(selfies) || selfies.length === 0 || selfies.length > 5) {
      return new Response(JSON.stringify({ error: "Envie de 1 a 5 selfies" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const archetypes = archetypesRes.data || [];
    const reportContent = reportRes.data?.content as Record<string, any> | null;
    const gender = profileRes.data?.gender || "Não informado";

    if (archetypes.length === 0) {
      return new Response(JSON.stringify({ error: "Complete o questionário de arquétipos primeiro" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const archetypeNames = archetypes.map((a: any) => a.archetype_name).join(", ");
    const figurino = reportContent?.figurino || {};

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const styleIndex = Math.floor(Math.random() * STUDIO_STYLES.length);
    const studioStyle = STUDIO_STYLES[styleIndex];

    const referenceImages = selfies.map((s: string) => ({
      type: "image_url" as const,
      image_url: { url: s.startsWith("data:") ? s : `data:image/jpeg;base64,${s}` },
    }));

    // Build wardrobe line
    let wardrobeLine = "";
    if (figurino.pecas_chave?.length > 0 || figurino.cores_roupa?.length > 0) {
      const allPieces = figurino.pecas_chave || [];
      const allColors = figurino.cores_roupa || [];
      const allAccessories = figurino.acessorios || [];

      let pieces: string[], colors: string[], accessories: string[];
      if (typeof wardrobeVariation === "number" && wardrobeVariation > 0) {
        const offset = wardrobeVariation;
        pieces = allPieces.length > 0 ? [allPieces[offset % allPieces.length], allPieces[(offset + 1) % allPieces.length], allPieces[(offset + 2) % allPieces.length]].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i) : [];
        colors = allColors.length > 0 ? [allColors[offset % allColors.length], allColors[(offset + 1) % allColors.length]].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i) : [];
        accessories = allAccessories.length > 0 ? [allAccessories[offset % allAccessories.length]] : [];
      } else {
        pieces = allPieces.slice(0, 3);
        colors = allColors.slice(0, 3);
        accessories = allAccessories.slice(0, 2);
      }

      const genderLabel = gender === "Feminino" ? "Female" : gender === "Masculino" ? "Male" : "Neutral";
      wardrobeLine = `\nWardrobe: ${pieces.join(", ")}. Colors: ${colors.join(", ")}. Accessories: ${accessories.join(", ")}. Gender: ${genderLabel}.`;
      if (figurino.cabelo) wardrobeLine += ` Hair: ${figurino.cabelo}.`;
      if (figurino.maquiagem_grooming) {
        wardrobeLine += gender === "Feminino" ? ` Makeup: ${figurino.maquiagem_grooming}.` : ` Grooming: ${figurino.maquiagem_grooming}.`;
      }
    }

    const prompt = `You are a portrait photographer. Study the reference photos carefully. Reproduce the EXACT SAME PERSON — same face shape, nose, eyes, eyebrows, lips, jawline, skin tone, hair color/texture, facial hair, moles, freckles, wrinkles, age, ethnicity. The output must be immediately recognizable as the same individual.

Create a hyper-realistic professional studio photograph. NOT an illustration, NOT a painting, NOT AI-looking.

REALISM: Keep all facial asymmetries. Skin must show natural pores, texture, fine lines — no airbrushing or plastic skin. Hair must have natural flyaways. Eyes must have natural catchlights. Clothing must have realistic fabric wrinkles. If hands are visible: exactly 5 fingers per hand, correct proportions.

STUDIO: ${studioStyle}
Always use a studio backdrop — never outdoor or nature.

Brand archetypes: ${archetypeNames}. Express through body language and expression, not costumes or props.${wardrobeLine}

No text, no watermarks, no overlays. Professional branding photo indistinguishable from a real DSLR photograph.`;

    // Send reference images FIRST, then the text prompt
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          {
            role: "user",
            content: [
              ...referenceImages,
              { type: "text", text: prompt },
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

    if (included > 0) {
      await supabaseAdmin.from("user_balances").update({
        portrait_credits_included: included - 1,
      }).eq("user_id", user.id);
    } else {
      await supabaseAdmin.from("user_balances").update({
        portrait_credits_extra: extra - 1,
      }).eq("user_id", user.id);
    }

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
