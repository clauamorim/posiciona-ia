import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STUDIO_STYLES = [
  "Professional studio portrait with soft, controlled lighting and a clean, neutral gray background. High-end corporate branding style. Shot on a medium-format camera with shallow depth of field. Two-light setup with large softboxes.",
  "Elegant studio portrait with warm, neutral-toned seamless backdrop. Rembrandt lighting with a single key light creating subtle shadow on one side. Shot with an 85mm f/1.4 lens.",
  "Modern studio headshot with pure white background and even, diffused lighting. Clean and polished. Ring light combined with fill light for minimal shadows.",
  "Sophisticated studio portrait with dark charcoal backdrop. Dramatic single key light from 45 degrees with subtle rim light separating subject from background. Cinematic feel.",
  "Clean studio portrait with light beige/cream backdrop. Butterfly lighting setup. Soft, flattering light that emphasizes natural features. Fashion-editorial approach.",
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

    // Fetch balance, profile (gender), archetypes, and report in parallel
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
    const visualIdentity = reportContent?.visual_identity || {};
    const palette = visualIdentity.palette?.map((c: any) => c.hex).join(", ") || "";
    const figurino = reportContent?.figurino || {};

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Random studio style
    const styleIndex = Math.floor(Math.random() * STUDIO_STYLES.length);
    const studioStyle = STUDIO_STYLES[styleIndex];

    const referenceImages = selfies.map((s: string) => ({
      type: "image_url" as const,
      image_url: { url: s.startsWith("data:") ? s : `data:image/jpeg;base64,${s}` },
    }));

    const refCount = selfies.length > 1 ? ` I'm providing ${selfies.length} reference photos of the same person from different angles to help you accurately capture their features.` : "";

    // Build wardrobe instructions from figurino with variation support
    let wardrobeInstructions = "";
    if (figurino.pecas_chave?.length > 0 || figurino.cores_roupa?.length > 0 || figurino.acessorios?.length > 0) {
      const allPieces = figurino.pecas_chave || [];
      const allColors = figurino.cores_roupa || [];
      const allAccessories = figurino.acessorios || [];

      // If wardrobeVariation is specified, pick different subsets
      let pieces: string[], colors: string[], accessories: string[];
      if (typeof wardrobeVariation === "number" && wardrobeVariation > 0) {
        const offset = wardrobeVariation;
        pieces = allPieces.length > 0 ? [allPieces[offset % allPieces.length], allPieces[(offset + 1) % allPieces.length], allPieces[(offset + 2) % allPieces.length]].filter((v, i, a) => a.indexOf(v) === i) : [];
        colors = allColors.length > 0 ? [allColors[offset % allColors.length], allColors[(offset + 1) % allColors.length]].filter((v, i, a) => a.indexOf(v) === i) : [];
        accessories = allAccessories.length > 0 ? [allAccessories[offset % allAccessories.length]] : [];
      } else {
        pieces = allPieces.slice(0, 3);
        colors = allColors.slice(0, 3);
        accessories = allAccessories.slice(0, 2);
      }

      wardrobeInstructions = `\n\nSTRATEGIC WARDROBE (based on brand archetypes):
- Dress the person in: ${pieces.join(", ")}
- Clothing colors: ${colors.join(", ")}
- Accessories: ${accessories.join(", ")}
- Gender: ${gender === "Feminino" ? "Female" : gender === "Masculino" ? "Male" : "Neutral"}`;
      if (gender === "Feminino" && figurino.maquiagem_grooming) {
        wardrobeInstructions += `\n- Makeup style: ${figurino.maquiagem_grooming}`;
      }
      if (gender === "Masculino" && figurino.maquiagem_grooming) {
        wardrobeInstructions += `\n- Grooming: ${figurino.maquiagem_grooming}`;
      }
      if (figurino.cabelo) {
        wardrobeInstructions += `\n- Hair style: ${figurino.cabelo}`;
      }
    }

    const prompt = `IDENTITY PRESERVATION IS THE #1 PRIORITY. You MUST reproduce the EXACT same person from the reference photos. Study every detail: face shape, nose, eyes, eyebrows, lips, jawline, skin color, hair color and texture, facial hair, moles, freckles, wrinkles. The generated portrait MUST be immediately recognizable as the same person.

Transform these reference selfie(s) into a hyper-realistic professional brand portrait photograph. The result MUST look like a real photograph taken in a professional studio — NOT a digital illustration, painting, or AI-generated looking image.${refCount}

CRITICAL IDENTITY RULES:
- The person in the output MUST be the EXACT same person as in the reference photos — same face, same features, same ethnicity, same age
- Do NOT generate a generic or idealized person. Copy the SPECIFIC facial features from the references
- If the reference shows a specific skin tone, reproduce it EXACTLY
- Compare your output with the references — they must be clearly the same individual

CRITICAL REALISM RULES:
- Maintain the person's EXACT facial features, bone structure, and proportions. Do NOT idealize or beautify.
- Preserve ALL facial asymmetries — do NOT mirror or symmetrize the face. Real faces are asymmetric.
- Skin MUST show natural pores, texture, fine lines, and color variation. Do NOT apply plastic, airbrushed, or porcelain-smooth skin. Think "high-end retouching" not "beauty filter".
- Hair MUST look natural with some loose strands, flyaway hairs, and natural texture — overly styled or perfectly arranged hair looks artificial.
- Eyes must have natural reflections and catchlights from the lighting setup.
- Clothing should have realistic fabric texture, natural wrinkles and folds.
- HANDS: If hands are visible in the frame, ensure EXACTLY 5 fingers per hand with correct proportions, natural joint bending, and realistic positioning. Pay special attention to thumb placement and finger spacing.

STUDIO BACKGROUND — MANDATORY:
${studioStyle}
Do NOT use outdoor backgrounds, nature scenes, or any non-studio setting. ALWAYS use a professional studio backdrop.

Apply the following brand visual identity subtly through lighting, color grading, and atmosphere:
- Brand archetypes: ${archetypeNames}
- Color palette influence for grading: ${palette || "tones that evoke " + archetypeNames}
${wardrobeInstructions}

The portrait should subtly capture the essence of the ${archetypes[0]?.archetype_name || "brand"} archetype through body language, expression, and lighting — NOT through costumes, props, or literal archetype representations.
Do NOT add text, watermarks, or any graphic overlays.
Do NOT make the person look like a character or caricature. This is a professional branding photo.
The overall image should be indistinguishable from a photograph taken with a professional DSLR or mirrorless camera.`;

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
