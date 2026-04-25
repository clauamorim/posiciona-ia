import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import {
  buildPortraitPrompt,
  mapGender,
  buildOutfitTextForLook,
  buildHairText,
  buildMakeupText,
  BACKGROUND_VARIATIONS,
  HAND_POSE_POOLS,
  getArchetypeFamily,
} from "../_shared/portraitPrompts.ts";

const FLUX_LORA_MODEL = "black-forest-labs/flux-dev-lora";
const UPSCALER_MODEL_VERSION = "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa";
const GENERATE_COST_CREDITS = 3;
const GUIDANCE_VARIATIONS = [3.0, 3.5, 4.0];

/** Fisher–Yates shuffle não destrutivo. */
function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function urlToDataUrl(imageUrl: string): Promise<{ ok: true; dataUrl: string } | { ok: false; reason: string }> {
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
  const mime = lower.includes(".webp")
    ? "image/webp"
    : lower.includes(".jpg") || lower.includes(".jpeg")
    ? "image/jpeg"
    : "image/png";
  return { ok: true, dataUrl: `data:${mime};base64,${b64}` };
}

/**
 * Upscale 2x via nightmareai/real-esrgan com face_enhance.
 * Recebe a URL hospedada da imagem do Flux e devolve a URL upscaled.
 * Resiliente: em caso de qualquer erro/timeout, retorna { ok: false } e o
 * caller mantém a imagem original 1MP.
 */
async function upscaleImage(params: {
  token: string;
  imageUrl: string;
}): Promise<{ ok: true; imageUrl: string } | { ok: false; reason: string }> {
  const { token, imageUrl } = params;
  const start = Date.now();
  try {
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=5",
      },
      body: JSON.stringify({
        version: UPSCALER_MODEL_VERSION.split(":")[1],
        input: { image: imageUrl, scale: 2, face_enhance: true },
      }),
    });
    if (!createRes.ok) {
      const txt = await createRes.text();
      return { ok: false, reason: `upscale-create-${createRes.status}:${txt.slice(0, 150)}` };
    }
    let prediction = await createRes.json();
    const id = prediction.id;
    if (!id) return { ok: false, reason: "upscale-no-id" };

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
      if (!pollRes.ok) return { ok: false, reason: `upscale-poll-${pollRes.status}` };
      prediction = await pollRes.json();
    }

    const latency = ((Date.now() - start) / 1000).toFixed(1);
    if (prediction.status !== "succeeded") {
      return { ok: false, reason: `upscale-status=${prediction.status} after ${latency}s` };
    }
    const output = prediction.output;
    const upUrl = Array.isArray(output) ? output[0] : output;
    if (!upUrl || typeof upUrl !== "string") return { ok: false, reason: "upscale-empty" };
    console.log(`[generate-portrait] upscale 2x succeeded latency=${latency}s`);
    return { ok: true, imageUrl: upUrl };
  } catch (e) {
    return { ok: false, reason: `upscale-exception:${e instanceof Error ? e.message : String(e)}` };
  }
}

async function callFluxLora(params: {
  token: string;
  loraVersion: string;
  prompt: string;
  negative: string;
  guidanceScale: number;
}): Promise<{ ok: true; imageUrl: string } | { ok: false; reason: string }> {
  const { token, loraVersion, prompt, negative, guidanceScale } = params;
  const start = Date.now();
  try {
    const input: Record<string, unknown> = {
      prompt,
      lora_weights: loraVersion,
      lora_scale: 0.95,
      num_outputs: 1,
      aspect_ratio: "3:4",
      guidance_scale: guidanceScale,
      num_inference_steps: 40,
      output_format: "png",
      output_quality: 95,
      seed: Math.floor(Math.random() * 1000000),
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

    console.log(`[generate-portrait] flux-lora succeeded latency=${latency}s guidance=${guidanceScale}`);
    return { ok: true, imageUrl };
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
        .select("id, lora_weights_url, trigger_word, status, physical_traits")
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

    const hair = buildHairText(figurino);
    const makeup = buildMakeupText(figurino);

    // ===== MEMÓRIA CURTA + SORTEIO DE POSES DE MÃOS =====
    // 1. Busca a última geração do usuário para excluir as poses já usadas.
    // 2. Embaralha o pool da família do arquétipo.
    // 3. Filtra poses recentes (se ainda restarem ≥3 opções no pool).
    // 4. Pega 3 poses (sem reposição) — uma por look.
    const family = getArchetypeFamily(archetypeName);
    const fullPool = HAND_POSE_POOLS[family];

    const { data: lastGen } = await supabaseAdmin
      .from("portrait_generations")
      .select("used_hand_poses")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const recentlyUsed: string[] = Array.isArray((lastGen as any)?.used_hand_poses)
      ? (lastGen as any).used_hand_poses
      : [];

    const filteredPool = fullPool.filter((p) => !recentlyUsed.includes(p));
    const workingPool = filteredPool.length >= 3 ? filteredPool : fullPool;
    const shuffled = shuffle(workingPool);
    const selectedPoses = shuffled.slice(0, 3);

    console.log(
      `[generate-portrait] archetype=${archetypeName} family=${family} ` +
      `poolSize=${fullPool.length} recentlyUsed=${recentlyUsed.length} ` +
      `filteredSize=${filteredPool.length} selected=${JSON.stringify(selectedPoses)}`,
    );

    // 3 sequential calls — one por background; cada um usa um look + pose diferentes.
    // Replicate low-credit accounts (<$5) tem rate limit de 6/min com burst 1 → 11s entre chamadas.
    const INTER_CALL_DELAY_MS = 11000;
    const RETRY_DELAY_MS = 30000;
    const results: { background: string; portraitUrl: string | null; error?: string; promptUsed?: string; pose?: string }[] = [];
    for (let i = 0; i < BACKGROUND_VARIATIONS.length; i++) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, INTER_CALL_DELAY_MS));
      }
      // Variação de figurino: look 0 → Neutro, look 1 → Claro, look 2 → Escuro.
      const outfit = buildOutfitTextForLook(figurino, i);
      const handPose = selectedPoses[i] ?? null;
      const guidanceScale = GUIDANCE_VARIATIONS[i] ?? 3.5;
      const built = buildPortraitPrompt({
        archetype: archetypeName,
        userId: user.id,
        gender,
        outfit,
        hair,
        makeup,
        backgroundIndex: i as 0 | 1 | 2,
        physicalTraits: (training as any).physical_traits ?? null,
        handPose,
      });

      console.log(
        `[generate-portrait] call ${i + 1}/3 background=${built.backgroundKey} archetype=${archetypeName} ` +
        `outfit="${outfit}" pose="${handPose}" guidance=${guidanceScale} hasTraits=${!!(training as any).physical_traits}`,
      );
      console.log(`[generate-portrait] FULL PROMPT call ${i + 1}: ${built.prompt}`);
      console.log(`[generate-portrait] FULL NEGATIVE call ${i + 1}: ${built.negative}`);
      let r = await callFluxLora({
        token: REPLICATE_API_TOKEN,
        loraVersion: training.lora_weights_url,
        prompt: built.prompt,
        negative: built.negative,
        guidanceScale,
      });

      // Retry automático em caso de 429 (rate limit) — espera mais 30s e tenta uma vez
      if (!r.ok && r.reason.includes("429")) {
        console.warn(`[generate-portrait] background=${built.backgroundKey} got 429, waiting ${RETRY_DELAY_MS}ms and retrying once`);
        await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
        r = await callFluxLora({
          token: REPLICATE_API_TOKEN,
          loraVersion: training.lora_weights_url,
          prompt: built.prompt,
          negative: built.negative,
          guidanceScale,
        });
      }

      if (r.ok) {
        results.push({ background: built.backgroundKey, portraitUrl: r.imageUrl, promptUsed: built.prompt, pose: handPose ?? undefined });
      } else {
        console.error(`[generate-portrait] background=${built.backgroundKey} failed: ${r.reason}`);
        results.push({ background: built.backgroundKey, portraitUrl: null, error: r.reason, pose: handPose ?? undefined });
      }
    }

    const successful = results.filter((r) => r.portraitUrl);
    if (successful.length === 0) {
      return new Response(
        JSON.stringify({ error: "Falha ao gerar retratos. Tente novamente.", details: results.map((r) => r.error) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== UPSCALE 2x EM PARALELO (com fallback resiliente) =====
    // Se o upscale falhar para alguma imagem, mantém a original 1MP — não bloqueia entrega.
    const upscaledPortraits = await Promise.all(
      successful.map(async (r) => {
        const up = await upscaleImage({ token: REPLICATE_API_TOKEN, imageUrl: r.portraitUrl! });
        const finalUrl = up.ok ? up.imageUrl : r.portraitUrl!;
        if (!up.ok) {
          console.warn(`[generate-portrait] upscale fallback (original) for background=${r.background}: ${up.reason}`);
        }
        const dataUrlRes = await urlToDataUrl(finalUrl);
        if (!dataUrlRes.ok) {
          console.error(`[generate-portrait] failed to encode final image background=${r.background}: ${dataUrlRes.reason}`);
          // último fallback: tenta encodar a original
          const orig = await urlToDataUrl(r.portraitUrl!);
          return { ...r, dataUrl: orig.ok ? orig.dataUrl : null, upscaled: false };
        }
        return { ...r, dataUrl: dataUrlRes.dataUrl, upscaled: up.ok };
      }),
    );

    const finalPortraits = upscaledPortraits.filter((r) => r.dataUrl);
    if (finalPortraits.length === 0) {
      return new Response(
        JSON.stringify({ error: "Falha ao processar retratos finais. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Debit credits — charge for successful images only (max GENERATE_COST_CREDITS)
    const charge = Math.min(GENERATE_COST_CREDITS, finalPortraits.length);
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
      finalPortraits.map((r) => ({
        user_id: user.id,
        credit_type: "portrait",
        amount: -1,
        description: `Retrato gerado (LoRA ${training.trigger_word}, fundo ${r.background})`,
      })),
    );

    // Persiste poses usadas para a "memória curta" da próxima geração.
    const posesUsedThisRound = finalPortraits
      .map((r) => r.pose)
      .filter((p): p is string => !!p);

    await supabaseAdmin.from("portrait_generations").insert({
      user_id: user.id,
      portraits: finalPortraits.map((r) => r.dataUrl),
      style_index: 0,
      used_hand_poses: posesUsedThisRound,
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
