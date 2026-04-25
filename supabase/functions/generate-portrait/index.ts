import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import {
  buildPortraitPrompt,
  mapGender,
  buildOutfitTextForLook,
  buildHairText,
  buildMakeupText,
  translateFashion,
  BACKGROUND_VARIATIONS,
  pickPosesForLooks,
  getArchetypeFamily,
} from "../_shared/portraitPrompts.ts";
import { mapProfessionToCategory, pickOutfits } from "../_shared/outfitPool.ts";

const FLUX_LORA_MODEL = "black-forest-labs/flux-dev-lora";
// Clarity Upscaler — qualidade significativamente superior ao Real-ESRGAN em rostos.
const CLARITY_UPSCALER_VERSION = "dfad41707589d68ecdccd1dfa600d55a208f9310748e44bfe35b4a6291453d5e";
const GENERATE_COST_CREDITS = 3;
const GUIDANCE_VARIATIONS = [3.0, 3.5, 4.0];
const GUIDANCE_VARIATIONS_OVERRIDE = [4.0, 4.5, 4.5];
const PORTRAIT_BUCKET = "portrait-outputs";

/** Fisher–Yates shuffle não destrutivo. */
function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Faz download bruto da URL e devolve um Uint8Array (PNG). */
async function downloadImageBytes(imageUrl: string): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: string }> {
  try {
    const r = await fetch(imageUrl);
    if (!r.ok) return { ok: false, reason: `download-${r.status}` };
    return { ok: true, bytes: new Uint8Array(await r.arrayBuffer()) };
  } catch (e) {
    return { ok: false, reason: `download-exception:${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Converte Uint8Array em data URL base64 (para resposta imediata ao frontend). */
function bytesToDataUrl(bytes: Uint8Array, mime = "image/png"): string {
  let binary = "";
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

/**
 * Upscale via philz1337x/clarity-upscaler — superior em rostos.
 * Resiliente: em caso de qualquer erro/timeout, devolve { ok: false } e o
 * caller mantém a imagem original.
 */
async function upscaleImage(params: {
  token: string;
  imageUrl: string;
}): Promise<{ ok: true; imageUrl: string } | { ok: false; reason: string }> {
  const { token, imageUrl } = params;
  const start = Date.now();
  console.log(`[upscale] start image=${imageUrl.slice(0, 80)}`);
  try {
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait=5",
      },
      body: JSON.stringify({
        version: CLARITY_UPSCALER_VERSION,
        input: {
          image: imageUrl,
          scale_factor: 2,
          dynamic: 6,
          creativity: 0.35,
          resemblance: 0.6,
          output_format: "png",
        },
      }),
    });
    console.log(`[upscale] create-status=${createRes.status}`);
    if (!createRes.ok) {
      const txt = await createRes.text();
      return { ok: false, reason: `upscale-create-${createRes.status}:${txt.slice(0, 150)}` };
    }
    let prediction = await createRes.json();
    const id = prediction.id;
    if (!id) return { ok: false, reason: "upscale-no-id" };

    const maxAttempts = 60; // ~90s
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
      if (attempts % 10 === 0) console.log(`[upscale] poll attempt=${attempts} status=${prediction.status}`);
    }

    const latency = ((Date.now() - start) / 1000).toFixed(1);
    if (prediction.status !== "succeeded") {
      return { ok: false, reason: `upscale-status=${prediction.status} after ${latency}s` };
    }
    const output = prediction.output;
    const upUrl = Array.isArray(output) ? output[0] : output;
    if (!upUrl || typeof upUrl !== "string") return { ok: false, reason: "upscale-empty" };
    console.log(`[upscale] success latency=${latency}s`);
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
  loraScale?: number;
}): Promise<{ ok: true; imageUrl: string } | { ok: false; reason: string }> {
  const { token, loraVersion, prompt, negative, guidanceScale, loraScale = 0.95 } = params;
  const start = Date.now();
  try {
    const input: Record<string, unknown> = {
      prompt,
      lora_weights: loraVersion,
      lora_scale: loraScale,
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

    // Lê overrides opcionais do body — ignora qualquer outro campo.
    let outfitOverrides: string[] = [];
    try {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body?.outfit_overrides)) {
        outfitOverrides = body.outfit_overrides
          .filter((s: unknown) => typeof s === "string")
          .map((s: string) => s.trim())
          .slice(0, 3);
      }
    } catch {
      // body opcional
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
        .select("gender, profession")
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
    const profession = profileRes.data?.profession ?? "";

    const hair = buildHairText(figurino);
    const makeup = buildMakeupText(figurino);

    // ===== MEMÓRIA CURTA: lê última geração =====
    const { data: lastGen } = await supabaseAdmin
      .from("portrait_generations")
      .select("used_hand_poses, used_outfits")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const recentlyUsedPoses: string[] = Array.isArray((lastGen as any)?.used_hand_poses)
      ? (lastGen as any).used_hand_poses
      : [];
    const recentlyUsedOutfits: string[] = Array.isArray((lastGen as any)?.used_outfits)
      ? (lastGen as any).used_outfits
      : [];

    // ===== POSES DE MÃOS por CATEGORIA gestual =====
    // Look 0 (close-up) não usa pose. Looks 1 e 2 vêm de categorias DIFERENTES,
    // evitando o problema de "duas poses parecidas" na mesma rodada.
    const family = getArchetypeFamily(archetypeName);
    const posesForLooks12 = pickPosesForLooks(family, recentlyUsedPoses, 2);
    // Array indexado por look: [null, pose1, pose2]
    const selectedPoses: (string | null)[] = [null, posesForLooks12[0]?.pose ?? null, posesForLooks12[1]?.pose ?? null];
    const selectedPoseCategories = ["headshot", posesForLooks12[0]?.category ?? "—", posesForLooks12[1]?.category ?? "—"];

    // ===== FIGURINOS — prioridade: overrides > pool curado por profissão > buildOutfitTextForLook(figurino) =====
    const profCategory = mapProfessionToCategory(profession);
    let outfitsForLooks: string[] = [];
    let outfitSource = "report-figurino";

    if (outfitOverrides.length === 3) {
      // Usuário descreveu os 3 looks — traduz PT→EN e usa como está.
      outfitsForLooks = outfitOverrides.map((s) => translateFashion(s));
      outfitSource = "user-override";
    } else {
      // Tenta o pool curado da profissão. Se vazio (ex: family sem matriz), volta ao figurino do relatório.
      const fromPool = pickOutfits(family, profCategory, recentlyUsedOutfits, 3);
      if (fromPool.length === 3) {
        outfitsForLooks = fromPool;
        outfitSource = `pool:${family}/${profCategory}`;
      } else {
        // Fallback: figurino do relatório (comportamento anterior).
        outfitsForLooks = [0, 1, 2].map((i) => buildOutfitTextForLook(figurino, i));
        outfitSource = "report-figurino-fallback";
      }
    }

    console.log(
      `[generate-portrait] archetype=${archetypeName} family=${family} profession="${profession}" ` +
      `category=${profCategory} outfitSource=${outfitSource} outfits=${JSON.stringify(outfitsForLooks)} ` +
      `poses=${JSON.stringify(selectedPoses)} poseCats=${JSON.stringify(selectedPoseCategories)}`,
    );

    const isUserOverride = outfitSource === "user-override";

    // 3 sequential calls — Replicate low-credit accounts (<$5) tem rate limit 6/min.
    const INTER_CALL_DELAY_MS = 11000;
    const RETRY_DELAY_MS = 30000;
    const results: { background: string; portraitUrl: string | null; error?: string; pose?: string; outfit?: string }[] = [];
    for (let i = 0; i < BACKGROUND_VARIATIONS.length; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, INTER_CALL_DELAY_MS));
      const outfit = outfitsForLooks[i] ?? "";
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
        isUserOverride,
      });

      // Quando há override do usuário, reduz lora_scale para diminuir o viés do
      // LoRA em business attire — abrindo espaço pro outfit pedido prevalecer.
      const loraScale = isUserOverride ? 0.80 : 0.95;

      console.log(
        `[generate-portrait] call ${i + 1}/3 background=${built.backgroundKey} archetype=${archetypeName} ` +
        `outfit="${outfit}" pose="${i === 0 ? "(headshot, no hands)" : handPose}" ` +
        `poseCat=${selectedPoseCategories[i]} guidance=${guidanceScale} loraScale=${loraScale} ` +
        `override=${isUserOverride} hasTraits=${!!(training as any).physical_traits}`,
      );
      let r = await callFluxLora({
        token: REPLICATE_API_TOKEN,
        loraVersion: training.lora_weights_url,
        prompt: built.prompt,
        negative: built.negative,
        guidanceScale,
        loraScale,
      });

      if (!r.ok && r.reason.includes("429")) {
        console.warn(`[generate-portrait] background=${built.backgroundKey} got 429, waiting ${RETRY_DELAY_MS}ms`);
        await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
        r = await callFluxLora({
          token: REPLICATE_API_TOKEN,
          loraVersion: training.lora_weights_url,
          prompt: built.prompt,
          negative: built.negative,
          guidanceScale,
          loraScale,
        });
      }

      if (r.ok) {
        results.push({ background: built.backgroundKey, portraitUrl: r.imageUrl, pose: handPose ?? undefined, outfit });
      } else {
        console.error(`[generate-portrait] background=${built.backgroundKey} failed: ${r.reason}`);
        results.push({ background: built.backgroundKey, portraitUrl: null, error: r.reason, pose: handPose ?? undefined, outfit });
      }
    }

    const successful = results.filter((r) => r.portraitUrl);
    if (successful.length === 0) {
      return new Response(
        JSON.stringify({ error: "Falha ao gerar retratos. Tente novamente.", details: results.map((r) => r.error) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== UPSCALE 2x SEQUENCIAL + UPLOAD AO STORAGE =====
    // Sequencial (não paralelo) para evitar 429 do Replicate em contas low-credit.
    // Delay de 11s entre upscales + retry com 30s em caso de 429.
    const generationId = crypto.randomUUID();
    const UPSCALE_INTER_DELAY_MS = 11000;
    const UPSCALE_RETRY_DELAY_MS = 30000;

    const finalPortraits: Array<{
      background: string;
      portraitUrl: string | null;
      error?: string;
      pose?: string;
      outfit?: string;
      path: string;
      dataUrl: string;
      upscaled: boolean;
    }> = [];

    for (let i = 0; i < successful.length; i++) {
      if (i > 0) await new Promise((res) => setTimeout(res, UPSCALE_INTER_DELAY_MS));
      const r = successful[i];

      // 1. Upscale (com 1 retry em caso de 429)
      let up = await upscaleImage({ token: REPLICATE_API_TOKEN, imageUrl: r.portraitUrl! });
      if (!up.ok && up.reason.includes("429")) {
        console.warn(`[upscale] background=${r.background} got 429, waiting ${UPSCALE_RETRY_DELAY_MS}ms`);
        await new Promise((res) => setTimeout(res, UPSCALE_RETRY_DELAY_MS));
        up = await upscaleImage({ token: REPLICATE_API_TOKEN, imageUrl: r.portraitUrl! });
      }
      const finalUrl = up.ok ? up.imageUrl : r.portraitUrl!;
      if (!up.ok) {
        console.warn(`[upscale] fallback (original 1MP) for background=${r.background}: ${up.reason}`);
      }

      // 2. Download dos bytes finais (com fallback para original)
      let dl = await downloadImageBytes(finalUrl);
      if (!dl.ok) {
        const orig = await downloadImageBytes(r.portraitUrl!);
        if (!orig.ok) {
          console.error(`[generate-portrait] failed to download both upscaled and original for background=${r.background}`);
          continue;
        }
        dl = orig;
      }
      const bytes = (dl as { ok: true; bytes: Uint8Array }).bytes;

      // 3. Upload ao Storage privado
      const path = `${user.id}/${generationId}/${i}.png`;
      const upRes = await supabaseAdmin.storage
        .from(PORTRAIT_BUCKET)
        .upload(path, bytes, { contentType: "image/png", upsert: true });
      if (upRes.error) {
        console.error(`[generate-portrait] storage upload failed background=${r.background}: ${upRes.error.message}`);
        continue;
      }
      console.log(`[generate-portrait] uploaded background=${r.background} path=${path} bytes=${bytes.length} upscaled=${up.ok}`);

      finalPortraits.push({
        ...r,
        path,
        dataUrl: bytesToDataUrl(bytes),
        upscaled: up.ok,
      });
    }

    if (finalPortraits.length === 0) {
      return new Response(
        JSON.stringify({ error: "Falha ao processar retratos finais. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Debit credits — cobra apenas pelas imagens com sucesso (max GENERATE_COST_CREDITS)
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

    // Persiste paths + memória curta para próxima rodada.
    const posesUsedThisRound = finalPortraits.map((r) => r.pose).filter((p): p is string => !!p);
    const outfitsUsedThisRound = finalPortraits.map((r) => r.outfit).filter((o): o is string => !!o);

    await supabaseAdmin.from("portrait_generations").insert({
      id: generationId,
      user_id: user.id,
      portraits: finalPortraits.map((r) => r.path), // ← agora salva PATHS, não data URLs
      style_index: 0,
      used_hand_poses: posesUsedThisRound,
      used_outfits: outfitsUsedThisRound,
    });

    return new Response(
      JSON.stringify({
        portraits: finalPortraits.map((r) => r.dataUrl), // resposta imediata para o front
        backgrounds: finalPortraits.map((r) => r.background),
        outfits: finalPortraits.map((r) => r.outfit ?? ""),
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
