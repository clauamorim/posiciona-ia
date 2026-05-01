import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import {
  buildPortraitPrompt,
  mapGender,
  buildOutfitTextForLook,
  buildHairText,
  pickPosesForLooks,
  getArchetypeFamily,
} from "../_shared/portraitPrompts.ts";
import { mapProfessionToCategory, pickOutfits, lookupOutfitMeta } from "../_shared/outfitPool.ts";

// Provider: Fal.ai
// Modelo de inferência: FLUX.1 Krea [dev] com suporte oficial a LoRA.
// Krea foi treinado por BFL especificamente para combater o "look de IA"
// (pele plástica, oversaturação). Dispensa LoRA secundária de realismo.
const FAL_INFERENCE_PATH = "fal-ai/flux-krea-lora";

const GENERATE_COST_CREDITS = 3;
// Defaults Krea: prompt curto, 1 LoRA, scale 1.0, guidance 3.0, 28 steps.
const DEFAULT_GUIDANCE = 3.0;
const NUM_INFERENCE_STEPS = 28;
const DEFAULT_LORA_SCALE = 1.0;
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

async function downloadImageBytes(
  imageUrl: string,
  maxAttempts = 4,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: string }> {
  let lastReason = "unknown";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const r = await fetch(imageUrl);
      if (!r.ok) {
        lastReason = `download-${r.status}`;
      } else {
        const ct = r.headers.get("content-type") ?? "";
        if (!ct.startsWith("image/")) {
          await r.body?.cancel();
          lastReason = `bad-content-type:${ct}`;
        } else {
          return { ok: true, bytes: new Uint8Array(await r.arrayBuffer()) };
        }
      }
    } catch (e) {
      lastReason = `download-exception:${e instanceof Error ? e.message : String(e)}`;
    }
    if (attempt < maxAttempts) {
      const delay = 500 * Math.pow(2, attempt - 1);
      console.warn(`[generate-portrait] download attempt ${attempt}/${maxAttempts} failed (${lastReason}), retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return { ok: false, reason: lastReason };
}

/**
 * Chama o endpoint síncrono da Fal (`https://fal.run/...`). Para Krea-LoRA isso
 * resolve em ~10-25s. Sem polling explícito — Fal segura a conexão até o resultado
 * (ou retorna 408 em timeout, que tratamos como falha pra retry).
 */
async function callFluxKreaLora(params: {
  falKey: string;
  loraUrl: string;
  loraScale: number;
  prompt: string;
  guidanceScale: number;
}): Promise<{ ok: true; imageUrl: string } | { ok: false; reason: string }> {
  const { falKey, loraUrl, loraScale, prompt, guidanceScale } = params;
  const start = Date.now();
  try {
    const input: Record<string, unknown> = {
      prompt,
      // Krea não usa negative prompt — modelo é treinado pra dispensar.
      // Mantém apenas o LoRA da identidade da cliente.
      loras: [{ path: loraUrl, scale: loraScale }],
      // 3:4 retrato, ~896x1184 (1MP). Krea aceita image_size enum + custom.
      image_size: { width: 896, height: 1152 },
      num_inference_steps: NUM_INFERENCE_STEPS,
      guidance_scale: guidanceScale,
      num_images: 1,
      enable_safety_checker: true,
      output_format: "png",
      seed: Math.floor(Math.random() * 1_000_000),
    };

    const res = await fetch(`https://fal.run/${FAL_INFERENCE_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, reason: `fal-${res.status}:${txt.slice(0, 200)}` };
    }

    const data = await res.json();
    // Fal retorna { images: [{ url, content_type, width, height }], seed, ... }
    const imageUrl: string | undefined = data?.images?.[0]?.url;
    if (!imageUrl) return { ok: false, reason: "empty-output" };

    const latency = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[generate-portrait] fal-krea-lora succeeded latency=${latency}s guidance=${guidanceScale} loraScale=${loraScale}`);
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

    const FAL_KEY = Deno.env.get("FAL_KEY");
    if (!FAL_KEY) {
      return new Response(JSON.stringify({ error: "FAL_KEY não configurado" }), {
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
        .select("id, lora_weights_url, trigger_word, status, physical_traits, selfies_count, lora_provider")
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

    if (totalCredits < 1) {
      return new Response(
        JSON.stringify({
          error: `Geração requer pelo menos 1 crédito de retrato. Você tem ${totalCredits}.`,
          needs_credits: true,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const requestedCount = Math.min(totalCredits, GENERATE_COST_CREDITS);

    const training = trainingRes.data as any;
    if (!training?.lora_weights_url) {
      return new Response(
        JSON.stringify({
          error: "Treine seu Estúdio Pessoal antes de gerar retratos.",
          needs_training: true,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== MIGRAÇÃO LEGACY =====
    // LoRAs treinadas no provider antigo (Replicate/flux-dev) não rodam no
    // endpoint Fal Krea. Bloqueia a geração e instrui o front a oferecer
    // retreino gratuito (canUseFree forçado em portrait-train com migrate_legacy).
    if (training.lora_provider !== "fal") {
      return new Response(
        JSON.stringify({
          error: "Seu Estúdio Pessoal foi treinado em uma versão anterior. Refaça o treino (gratuito) para gerar retratos no novo motor.",
          needs_legacy_migration: true,
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const archetypeName = archetypesRes.data?.archetype_name || "Cara-comum";
    const reportContent = reportRes.data?.content as Record<string, any> | null;
    const figurino = reportContent?.figurino || {};
    const gender = mapGender(profileRes.data?.gender);
    const profession = profileRes.data?.profession ?? "";

    const traitsGender = training.physical_traits?.gender as "woman" | "man" | undefined;
    const effectiveGender: "woman" | "man" | "none" = traitsGender ?? gender;

    const hair = buildHairText(figurino);
    // Krea entrega textura/maquiagem natural por default — sem reforço.
    const makeup = "";

    // ===== MEMÓRIA CURTA =====
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

    const family = getArchetypeFamily(archetypeName);
    const numPoses = Math.max(0, requestedCount - 1);
    const posesForLooks12 = pickPosesForLooks(family, recentlyUsedPoses, numPoses);
    const selectedPoses: (string | null)[] = [
      null,
      posesForLooks12[0]?.pose ?? null,
      posesForLooks12[1]?.pose ?? null,
    ];
    const selectedPoseCategories = [
      "headshot",
      posesForLooks12[0]?.category ?? "—",
      posesForLooks12[1]?.category ?? "—",
    ];

    const profCategory = mapProfessionToCategory(profession);
    let outfitsForLooks: string[] = [];
    let outfitSource = "report-figurino";
    {
      const fromPool = pickOutfits(family, profCategory, recentlyUsedOutfits, requestedCount);
      if (fromPool.length === requestedCount) {
        outfitsForLooks = fromPool;
        outfitSource = `pool:${family}/${profCategory}`;
      } else {
        outfitsForLooks = Array.from({ length: requestedCount }, (_, i) => buildOutfitTextForLook(figurino, i));
        outfitSource = "report-figurino-fallback";
      }
    }

    const selfiesCount = training.selfies_count ?? 0;
    const outfitsMeta = outfitsForLooks.map((t) => lookupOutfitMeta(t) ?? { anchor: "?", color: "?" });
    console.log(
      `[generate-portrait] provider=fal model=${FAL_INFERENCE_PATH} archetype=${archetypeName} family=${family} ` +
      `profession="${profession}" category=${profCategory} requestedCount=${requestedCount} outfitSource=${outfitSource} ` +
      `selfiesCount=${selfiesCount} loraScale=${DEFAULT_LORA_SCALE} guidance=${DEFAULT_GUIDANCE} steps=${NUM_INFERENCE_STEPS} ` +
      `outfitsMeta=${JSON.stringify(outfitsMeta)} outfits=${JSON.stringify(outfitsForLooks)} ` +
      `poses=${JSON.stringify(selectedPoses)} poseCats=${JSON.stringify(selectedPoseCategories)}`,
    );

    // ===== GERAÇÃO PARALELA =====
    // Fal aceita várias chamadas concorrentes sem rate-limit agressivo (diferente
    // do Replicate). Geramos os 3 em paralelo — corta latência de ~75s pra ~25s.
    const callResults = await Promise.all(
      Array.from({ length: requestedCount }, async (_, i) => {
        const outfit = outfitsForLooks[i] ?? "";
        const handPose = selectedPoses[i] ?? null;
        const built = buildPortraitPrompt({
          archetype: archetypeName,
          userId: user.id,
          triggerWord: training.trigger_word,
          gender,
          outfit,
          hair,
          makeup,
          backgroundIndex: i as 0 | 1 | 2,
          physicalTraits: training.physical_traits ?? null,
          handPose,
        });

        const promptTokens = built.prompt.split(",").length;
        console.log(
          `[generate-portrait] call ${i + 1}/${requestedCount} background=${built.backgroundKey} ` +
          `archetype=${archetypeName} trigger="${training.trigger_word}" trainingId=${training.id} ` +
          `promptTokens=${promptTokens} outfitMeta=${JSON.stringify(outfitsMeta[i] ?? null)}`,
        );
        console.log(`[generate-portrait] PROMPT[${i}]: ${built.prompt}`);

        const r = await callFluxKreaLora({
          falKey: FAL_KEY,
          loraUrl: training.lora_weights_url,
          loraScale: DEFAULT_LORA_SCALE,
          prompt: built.prompt,
          guidanceScale: DEFAULT_GUIDANCE,
        });

        if (r.ok) {
          return { background: built.backgroundKey, portraitUrl: r.imageUrl, pose: handPose ?? undefined, outfit, error: undefined };
        }
        console.error(`[generate-portrait] background=${built.backgroundKey} failed: ${r.reason}`);
        return { background: built.backgroundKey, portraitUrl: null as string | null, pose: handPose ?? undefined, outfit, error: r.reason };
      }),
    );

    const successful = callResults.filter((r) => r.portraitUrl) as Array<typeof callResults[number] & { portraitUrl: string }>;
    if (successful.length === 0) {
      return new Response(
        JSON.stringify({ error: "Falha ao gerar retratos. Tente novamente.", details: callResults.map((r) => r.error) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== DOWNLOAD + UPLOAD PARALELO =====
    const generationId = crypto.randomUUID();
    const pipelineResults = await Promise.allSettled(
      successful.map(async (r, i) => {
        try {
          const dl = await downloadImageBytes(r.portraitUrl);
          if (!dl.ok) {
            console.error(`[generate-portrait] failed to download background=${r.background}: ${dl.reason}`);
            return null;
          }
          const path = `${user.id}/${generationId}/${i}.png`;
          const upRes = await supabaseAdmin.storage
            .from(PORTRAIT_BUCKET)
            .upload(path, dl.bytes, { contentType: "image/png", upsert: true });
          if (upRes.error) {
            console.error(`[generate-portrait] storage upload failed background=${r.background}: ${upRes.error.message}`);
            return null;
          }
          console.log(`[generate-portrait] uploaded background=${r.background} path=${path} bytes=${dl.bytes.length}`);
          return { ...r, path };
        } catch (e) {
          console.error(`[generate-portrait] pipeline exception background=${r.background}:`, e);
          return null;
        }
      }),
    );

    const finalPortraits = pipelineResults
      .map((res) => (res.status === "fulfilled" ? res.value : null))
      .filter((p): p is NonNullable<typeof p> & { path: string } => p !== null);

    if (finalPortraits.length === 0) {
      return new Response(
        JSON.stringify({ error: "Falha ao processar retratos finais. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cobra apenas pelas imagens com sucesso.
    const charge = Math.min(requestedCount, finalPortraits.length);
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

    const posesUsedThisRound = finalPortraits.map((r) => r.pose).filter((p): p is string => !!p);
    const outfitsUsedThisRound = finalPortraits.map((r) => r.outfit).filter((o): o is string => !!o);

    await supabaseAdmin.from("portrait_generations").insert({
      id: generationId,
      user_id: user.id,
      portraits: finalPortraits.map((r) => r.path),
      style_index: 0,
      used_hand_poses: posesUsedThisRound,
      used_outfits: outfitsUsedThisRound,
    });

    const signedUrls = await Promise.all(
      finalPortraits.map(async (r) => {
        const { data } = await supabaseAdmin.storage
          .from(PORTRAIT_BUCKET)
          .createSignedUrl(r.path, 60 * 60);
        return data?.signedUrl ?? "";
      }),
    );

    return new Response(
      JSON.stringify({
        portraits: signedUrls,
        portrait_paths: finalPortraits.map((r) => r.path),
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
