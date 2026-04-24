import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import {
  buildPortraitPrompt,
  mapGender,
  buildOutfitText,
  buildHairText,
  buildMakeupText,
  BACKGROUND_VARIATIONS,
} from "../_shared/portraitPrompts.ts";

const FLUX_LORA_MODEL = "black-forest-labs/flux-dev-lora";
const GENERATE_COST_CREDITS = 3;

async function callFluxLora(params: {
  token: string;
  loraVersion: string;
  prompt: string;
  negative: string;
}): Promise<{ ok: true; dataUrl: string } | { ok: false; reason: string }> {
  const { token, loraVersion, prompt, negative } = params;
  const start = Date.now();
  try {
    const input: Record<string, unknown> = {
      prompt,
      // black-forest-labs/flux-dev-lora supports `lora_weights` (HF/Replicate model ref or .tar URL)
      lora_weights: loraVersion,
      lora_scale: 1.0,
      num_outputs: 1,
      aspect_ratio: "3:4",
      guidance_scale: 2.5,
      num_inference_steps: 35,
      output_format: "png",
      output_quality: 95,
      seed: Math.floor(Math.random() * 1000000),
      // Some hosted versions accept negative_prompt; harmless if ignored
      negative_prompt: negative,
    };

    const createRes = await fetch(
      `https://api.replicate.com/v1/models/${FLUX_LORA_MODEL}/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Prefer: "wait=5",
        },
        body: JSON.stringify({ input }),
      },
    );

    if (!createRes.ok) {
      const txt = await createRes.text();
      return { ok: false, reason: `create-${createRes.status}:${txt.slice(0, 200)}` };
    }

    let prediction = await createRes.json();
    const id = prediction.id;
    if (!id) return { ok: false, reason: "no-prediction-id" };

    const maxAttempts = 80;
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
      if (!pollRes.ok) return { ok: false, reason: `poll-${pollRes.status}` };
      prediction = await pollRes.json();
    }

    const latency = ((Date.now() - start) / 1000).toFixed(1);
    if (prediction.status !== "succeeded") {
      return { ok: false, reason: `status=${prediction.status} after ${latency}s ${prediction.error ?? ""}` };
    }

    const output = prediction.output;
    const imageUrl = Array.isArray(output) ? output[0] : output;
    if (!imageUrl || typeof imageUrl !== "string") return { ok: false, reason: "empty-output" };

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return { ok: false, reason: `download-${imgRes.status}` };
    const buf = new Uint8Array(await imgRes.arrayBuffer());
    let binary = "";
    const chunk = 8192;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    const b64 = btoa(binary);
    const lower = imageUrl.toLowerCase();
    const mime = lower.includes(".webp") ? "image/webp" : lower.includes(".jpg") || lower.includes(".jpeg") ? "image/jpeg" : "image/png";
    console.log(`[generate-portrait] flux-lora succeeded latency=${latency}s`);
    return { ok: true, dataUrl: `data:${mime};base64,${b64}` };
  } catch (e) {
    return { ok: false, reason: `exception:${e instanceof Error ? e.message : String(e)}` };
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
      { global: { headers: { Authorization: authHeader } } },
    );
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN");
    if (!REPLICATE_API_TOKEN) {
      return new Response(JSON.stringify({ error: "REPLICATE_API_TOKEN não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [balanceRes, profileRes, trainingRes, archetypesRes, reportRes] = await Promise.all([
      supabaseAdmin
        .from("user_balances")
        .select("portrait_credits_included, portrait_credits_extra")
        .eq("user_id", user.id)
        .single(),
      supabaseAdmin
        .from("profiles")
        .select("gender")
        .eq("user_id", user.id)
        .single(),
      supabaseAdmin
        .from("portrait_trainings")
        .select("id, lora_weights_url, trigger_word, status")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("user_top_archetypes")
        .select("archetype_name, rank")
        .eq("user_id", user.id)
        .eq("rank", 1)
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from("reports")
        .select("content")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const included = balanceRes.data?.portrait_credits_included ?? 0;
    const extra = balanceRes.data?.portrait_credits_extra ?? 0;
    const totalCredits = included + extra;

    if (totalCredits < GENERATE_COST_CREDITS) {
      return new Response(
        JSON.stringify({
          error: `Geração requer ${GENERATE_COST_CREDITS} créditos de retrato. Você tem ${totalCredits}.`,
          needs_credits: true,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const training = trainingRes.data;
    if (!training?.lora_weights_url) {
      return new Response(
        JSON.stringify({
          error: "Treine seu Estúdio Pessoal antes de gerar retratos.",
          needs_training: true,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const archetypeName = archetypesRes.data?.archetype_name || "Cara-comum";
    const reportContent = reportRes.data?.content as Record<string, any> | null;
    const figurino = reportContent?.figurino || {};
    const gender = mapGender(profileRes.data?.gender);

    const outfit = buildOutfitText(figurino);
    const hair = buildHairText(figurino);
    const makeup = buildMakeupText(figurino);

    // 3 sequential calls — one per background
    const results: { background: string; portrait: string | null; error?: string; promptUsed?: string }[] = [];
    for (let i = 0; i < BACKGROUND_VARIATIONS.length; i++) {
      if (i > 0) {
        // Space out calls to avoid Replicate 429 (low-credit accounts: 6/min, burst 1)
        await new Promise((r) => setTimeout(r, 1200));
      }
      const built = buildPortraitPrompt({
        archetype: archetypeName,
        userId: user.id,
        gender,
        outfit,
        hair,
        makeup,
        backgroundIndex: i as 0 | 1 | 2,
      });

      console.log(`[generate-portrait] call ${i + 1}/3 background=${built.backgroundKey} archetype=${archetypeName}`);
      const r = await callFluxLora({
        token: REPLICATE_API_TOKEN,
        loraVersion: training.lora_weights_url,
        prompt: built.prompt,
        negative: built.negative,
      });

      if (r.ok) {
        results.push({ background: built.backgroundKey, portrait: r.dataUrl, promptUsed: built.prompt });
      } else {
        console.error(`[generate-portrait] background=${built.backgroundKey} failed: ${r.reason}`);
        results.push({ background: built.backgroundKey, portrait: null, error: r.reason });
      }
    }

    const successful = results.filter((r) => r.portrait);
    if (successful.length === 0) {
      return new Response(
        JSON.stringify({ error: "Falha ao gerar retratos. Tente novamente.", details: results.map((r) => r.error) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Debit credits — charge for successful images only (max GENERATE_COST_CREDITS)
    const charge = Math.min(GENERATE_COST_CREDITS, successful.length);
    const fromIncluded = Math.min(included, charge);
    const fromExtra = charge - fromIncluded;
    await supabaseAdmin
      .from("user_balances")
      .update({
        portrait_credits_included: included - fromIncluded,
        portrait_credits_extra: extra - fromExtra,
      })
      .eq("user_id", user.id);

    await supabaseAdmin.from("credit_logs").insert(
      successful.map((r) => ({
        user_id: user.id,
        credit_type: "portrait",
        amount: -1,
        description: `Retrato gerado (LoRA ${training.trigger_word}, fundo ${r.background})`,
      })),
    );

    await supabaseAdmin.from("portrait_generations").insert({
      user_id: user.id,
      portraits: successful.map((r) => r.portrait),
      style_index: 0,
    });

    return new Response(
      JSON.stringify({
        portraits: successful.map((r) => r.portrait),
        backgrounds: successful.map((r) => r.background),
        training_id: training.id,
        charged_credits: charge,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[generate-portrait] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
