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

    const reportContent = reportRes.data?.content as Record<string, any> | null;

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
    const gender = profileRes.data?.gender || "Não informado";

    if (archetypes.length === 0) {
      return new Response(JSON.stringify({ error: "Complete o questionário de arquétipos primeiro" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Build wardrobe line (simplified to not compete with facial fidelity)
    let wardrobeLine = "";
    if (figurino.pecas_chave?.length > 0 || figurino.cores_roupa?.length > 0) {
      const allPieces = figurino.pecas_chave || [];
      const allColors = figurino.cores_roupa || [];

      let pieces: string[], colors: string[];
      if (typeof wardrobeVariation === "number" && wardrobeVariation > 0) {
        const offset = wardrobeVariation;
        pieces = allPieces.length > 0 ? [allPieces[offset % allPieces.length], allPieces[(offset + 1) % allPieces.length]].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i) : [];
        colors = allColors.length > 0 ? [allColors[offset % allColors.length]] : [];
      } else {
        pieces = allPieces.slice(0, 2);
        colors = allColors.slice(0, 2);
      }

      const genderLabel = gender === "Feminino" ? "Female" : gender === "Masculino" ? "Male" : "Neutral";
      wardrobeLine = `\nClothing suggestion (secondary priority): ${pieces.join(", ")}. Colors: ${colors.join(", ")}. Gender: ${genderLabel}.`;
    }

    const prompt = `CRITICAL INSTRUCTION: This is an IMAGE EDITING task, NOT image generation. You must transform the reference photos into a professional studio portrait while preserving the EXACT SAME PERSON.

FACIAL FIDELITY IS THE #1 PRIORITY — above all other instructions.

Study the reference photos with extreme attention. Reproduce the EXACT SAME PERSON:
- Same face shape, nose, eyes, eyebrows, lips, jawline, skin tone
- Same hair color, texture, length, and style
- Same facial hair (if any), moles, freckles, wrinkles, age, ethnicity
- Same ear shape, neck proportions, head size

Do NOT create a new person. Do NOT approximate. Do NOT idealize or beautify beyond what is in the references. The output must be IMMEDIATELY recognizable as the same individual — like a real photo taken on the same day.

CRITICAL — EXPRESSION & TEETH: Copy the exact expression from the reference photos. If NONE of the reference photos show the person smiling with visible teeth, you MUST NOT generate a smile showing teeth. This is mandatory — teeth pattern inconsistency breaks identity. Match the mouth position precisely: closed lips, slight smile, or open smile only if references show it.

REALISM: Natural skin with pores but do NOT over-sharpen or add excessive texture. Do NOT add wrinkles or blemishes not in references. Hair must have natural flyaways. Eyes must have natural catchlights.

STUDIO SETUP: ${studioStyle}
Always use a studio backdrop — never outdoor or nature.
${wardrobeLine}

No text, no watermarks, no overlays. Professional branding photo indistinguishable from a real DSLR photograph.`;

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

    // Do NOT deduct credits here — credits are deducted on download via confirm-portrait

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
