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

const INSTANT_ID_MODEL = "zsxkib/instant-id";

async function generateWithInstantId(params: {
  selfieDataUrls: string[];
  prompt: string;
  token: string;
}): Promise<{ ok: true; dataUrl: string } | { ok: false; reason: string }> {
  const { selfieDataUrls, prompt, token } = params;
  const start = Date.now();
  try {
    // InstantID uses 1 strong reference image. Pick the largest selfie (proxy for most detailed).
    const sorted = [...selfieDataUrls]
      .map((s, i) => ({ s, size: s.length, i }))
      .sort((a, b) => b.size - a.size);
    const ref1 = sorted[0]?.s;

    const input: Record<string, unknown> = {
      image: ref1,
      prompt,
      negative_prompt: "(lowres, low quality, worst quality:1.2), (text:1.2), watermark, painting, drawing, illustration, glitch, deformed, mutated, cross-eyed, ugly, disfigured",
      width: 1024,
      height: 1024,
      num_inference_steps: 30,
      guidance_scale: 5,
      ip_adapter_scale: 0.8,
      controlnet_conditioning_scale: 0.8,
      num_outputs: 1,
      output_format: "jpg",
      output_quality: 95,
    };

    console.log(`[portrait] calling replicate model=${INSTANT_ID_MODEL} refs=1 (from ${sorted.length} selfies)`);

    // DIAG: validate which Replicate account this token belongs to
    try {
      const acctRes = await fetch("https://api.replicate.com/v1/account", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const acctText = await acctRes.text();
      console.log(`[portrait][diag] account-check status=${acctRes.status} body=${acctText.slice(0, 300)}`);
      // Token fingerprint (first 8 + last 4) so we can confirm WHICH token is loaded without leaking it
      const fp = `${token.slice(0, 8)}...${token.slice(-4)} len=${token.length}`;
      console.log(`[portrait][diag] token-fingerprint=${fp}`);
    } catch (e) {
      console.log(`[portrait][diag] account-check exception=${e instanceof Error ? e.message : String(e)}`);
    }

    const createRes = await fetch(`https://api.replicate.com/v1/models/${INSTANT_ID_MODEL}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=5",
      },
      body: JSON.stringify({ input }),
    });

    if (!createRes.ok) {
      const txt = await createRes.text();
      const reqId = createRes.headers.get("x-request-id") || createRes.headers.get("request-id") || "n/a";
      console.log(`[portrait][diag] replicate-create FAIL status=${createRes.status} request_id=${reqId} body=${txt.slice(0, 600)}`);
      return { ok: false, reason: `replicate-create-${createRes.status}:${txt.slice(0, 200)}` };
    }

    let prediction = await createRes.json();
    const id = prediction.id;
    if (!id) return { ok: false, reason: "no-prediction-id" };

    // Poll up to ~90s
    const maxAttempts = 60;
    let attempts = 0;
    while (
      prediction.status !== "succeeded" &&
      prediction.status !== "failed" &&
      prediction.status !== "canceled" &&
      attempts < maxAttempts
    ) {
      await new Promise((r) => setTimeout(r, 1500));
      attempts++;
      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!pollRes.ok) {
        return { ok: false, reason: `replicate-poll-${pollRes.status}` };
      }
      prediction = await pollRes.json();
    }

    const latency = ((Date.now() - start) / 1000).toFixed(1);

    if (prediction.status !== "succeeded") {
      return { ok: false, reason: `status=${prediction.status} after ${latency}s ${prediction.error ?? ""}` };
    }

    const output = prediction.output;
    const imageUrl = Array.isArray(output) ? output[0] : output;
    if (!imageUrl || typeof imageUrl !== "string") {
      return { ok: false, reason: "empty-output" };
    }

    // Download and convert to base64 data URL
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return { ok: false, reason: `download-${imgRes.status}` };
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    let binary = "";
    const chunk = 8192;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    const b64 = btoa(binary);
    console.log(`[portrait] provider=flux status=succeeded latency=${latency}s`);
    return { ok: true, dataUrl: `data:image/jpeg;base64,${b64}` };
  } catch (e) {
    return { ok: false, reason: `exception:${e instanceof Error ? e.message : String(e)}` };
  }
}

async function generateWithGemini(params: {
  selfies: string[];
  prompt: string;
  apiKey: string;
}): Promise<{ ok: true; dataUrl: string } | { ok: false; reason: string; status?: number }> {
  const { selfies, prompt, apiKey } = params;
  const referenceImages = selfies.map((s) => ({
    type: "image_url" as const,
    image_url: { url: s.startsWith("data:") ? s : `data:image/jpeg;base64,${s}` },
  }));

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
      const errText = await response.text();
      return { ok: false, status: response.status, reason: `gemini-${response.status}:${errText.slice(0, 200)}` };
    }

    const data = await response.json();
    const generatedImage = data.choices?.[0]?.message?.images?.[0]?.image_url?.url || "";
    if (!generatedImage) return { ok: false, reason: "gemini-empty" };
    return { ok: true, dataUrl: generatedImage };
  } catch (e) {
    return { ok: false, reason: `gemini-exception:${e instanceof Error ? e.message : String(e)}` };
  }
}

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
    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const styleIndex = Math.floor(Math.random() * STUDIO_STYLES.length);
    const studioStyle = STUDIO_STYLES[styleIndex];

    // Build wardrobe line (figurino vindo do relatório do usuário — preservado)
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

    const sharedPromptCore = `FACIAL FIDELITY IS THE #1 PRIORITY — above all other instructions.

Reproduce the EXACT SAME PERSON from the reference photo(s):
- Same face shape, nose, eyes, eyebrows, lips, jawline, skin tone
- Same hair color, texture, length, and style
- Same facial hair (if any), moles, freckles, wrinkles, age, ethnicity
- Same ear shape, neck proportions, head size

Do NOT create a new person. Do NOT idealize or beautify beyond the references. The output must be IMMEDIATELY recognizable as the same individual — like a real photo taken on the same day.

EXPRESSION & TEETH: Copy the expression from the reference. If the reference does NOT show teeth, do NOT generate a smile showing teeth.

REALISM: Natural skin with pores but do NOT over-sharpen. Do NOT add wrinkles or blemishes not in references. Hair must have natural flyaways. Eyes must have natural catchlights.

STUDIO SETUP: ${studioStyle}
Always use a studio backdrop — never outdoor or nature.
${wardrobeLine}

Photorealistic professional headshot, candid quality, 85mm f/1.8 lens, subtle depth of field, documentary photography style — NOT commercial stock photo style.

No text, no watermarks, no overlays.`;

    // Try Flux multi-image Kontext via Replicate first
    let finalImage: string | null = null;
    let provider: "flux" | "gemini" = "flux";
    let usedFallback = false;

    if (REPLICATE_API_TOKEN) {
      const selfieDataUrls = selfies.map((s: string) =>
        s.startsWith("data:") ? s : `data:image/jpeg;base64,${s}`
      );

      // Short, identity-first prompt — Flux Kontext responds better to concise instructions
      const fluxPrompt = `Professional studio headshot of the SAME PERSON shown in the reference images. Preserve their exact face: face shape, nose, eyes, eyebrows, lips, jawline, skin tone, hair color and style, age, ethnicity, and any distinguishing features (moles, freckles, facial hair). The output must be immediately recognizable as the same individual — do NOT generate a different person.

${studioStyle}${wardrobeLine}

Photorealistic, 85mm lens, natural skin texture with pores, natural catchlights in eyes, candid documentary quality. No text, no watermarks.`;

      const fluxResult = await generateWithFlux({
        selfieDataUrls,
        prompt: fluxPrompt,
        token: REPLICATE_API_TOKEN,
      });

      if (fluxResult.ok) {
        finalImage = fluxResult.dataUrl;
        provider = "flux";
      } else {
        console.log(`[portrait] flux failed reason=${fluxResult.reason} → falling back to gemini`);
        usedFallback = true;
      }
    } else {
      console.log("[portrait] REPLICATE_API_TOKEN missing → using gemini");
      usedFallback = true;
    }

    // Fallback to Gemini (or primary if no Replicate token)
    if (!finalImage) {
      const geminiPrompt = `CRITICAL INSTRUCTION: This is an IMAGE EDITING task, NOT image generation. You must transform the reference photos into a professional studio portrait while preserving the EXACT SAME PERSON.

${sharedPromptCore}

Study ALL reference photos with extreme attention to capture the person's identity from multiple angles.`;

      const geminiResult = await generateWithGemini({
        selfies,
        prompt: geminiPrompt,
        apiKey: LOVABLE_API_KEY,
      });

      if (!geminiResult.ok) {
        console.log(`[portrait] gemini failed reason=${geminiResult.reason}`);
        if (geminiResult.status === 429) {
          return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (geminiResult.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos insuficientes no gateway. Contate o suporte." }), {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Erro ao gerar retrato. Tente novamente." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      finalImage = geminiResult.dataUrl;
      provider = "gemini";
    }

    // Deduct 1 credit on successful generation (included first, then extra)
    if (included > 0) {
      await supabaseAdmin.from("user_balances").update({
        portrait_credits_included: included - 1,
      }).eq("user_id", user.id);
    } else {
      await supabaseAdmin.from("user_balances").update({
        portrait_credits_extra: extra - 1,
      }).eq("user_id", user.id);
    }

    // Log credit usage
    await supabaseAdmin.from("credit_logs").insert({
      user_id: user.id,
      credit_type: "portrait",
      amount: -1,
      description: `Retrato gerado (${provider}, estilo ${styleIndex + 1})`,
    });

    // Save to portrait history
    await supabaseAdmin.from("portrait_generations").insert({
      user_id: user.id,
      portraits: [finalImage],
      style_index: styleIndex,
    });

    return new Response(JSON.stringify({
      portrait: finalImage,
      style_index: styleIndex,
      provider,
      used_fallback: usedFallback,
    }), {
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
