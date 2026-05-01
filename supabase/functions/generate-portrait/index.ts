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

// Provider: Fal.ai async queue.
// Esta função apenas ENFILEIRA os 3 jobs Krea+LoRA na fila da Fal e devolve
// rapidamente (em ~3s). O front faz polling em `portrait-poll` que finaliza
// download, upload e cobrança quando todos os jobs concluírem (~3min depois).
const FAL_INFERENCE_PATH = "fal-ai/flux-krea-lora";

const GENERATE_COST_CREDITS = 3;
const DEFAULT_GUIDANCE = 3.0;
const NUM_INFERENCE_STEPS = 28;
const DEFAULT_LORA_SCALE = 1.05;

/** Submete um único job pra fila Fal e retorna o request_id. */
async function enqueueFalJob(params: {
  falKey: string;
  loraUrl: string;
  loraScale: number;
  prompt: string;
  guidanceScale: number;
}): Promise<{ ok: true; requestId: string } | { ok: false; reason: string }> {
  const { falKey, loraUrl, loraScale, prompt, guidanceScale } = params;
  try {
    const input: Record<string, unknown> = {
      prompt,
      loras: [{ path: loraUrl, scale: loraScale }],
      image_size: { width: 896, height: 1152 },
      num_inference_steps: NUM_INFERENCE_STEPS,
      guidance_scale: guidanceScale,
      num_images: 1,
      enable_safety_checker: true,
      output_format: "png",
      seed: Math.floor(Math.random() * 1_000_000),
    };

    const res = await fetch(`https://queue.fal.run/${FAL_INFERENCE_PATH}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, reason: `fal-enqueue-${res.status}:${txt.slice(0, 200)}` };
    }
    const data = await res.json();
    const requestId: string | undefined = data?.request_id;
    if (!requestId) return { ok: false, reason: "no-request-id" };
    return { ok: true, requestId };
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
    const _effectiveGender: "woman" | "man" | "none" = traitsGender ?? gender;

    const hair = buildHairText(figurino);
    const makeup = "";

    const { data: lastGen } = await supabaseAdmin
      .from("portrait_generations")
      .select("used_hand_poses, used_outfits")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const recentlyUsedPoses: string[] = Array.isArray((lastGen as any)?.used_hand_poses)
      ? (lastGen as any).used_hand_poses : [];
    const recentlyUsedOutfits: string[] = Array.isArray((lastGen as any)?.used_outfits)
      ? (lastGen as any).used_outfits : [];

    const family = getArchetypeFamily(archetypeName);
    const numPoses = Math.max(0, requestedCount - 1);
    const posesForLooks12 = pickPosesForLooks(family, recentlyUsedPoses, numPoses);
    const selectedPoses: (string | null)[] = [
      null,
      posesForLooks12[0]?.pose ?? null,
      posesForLooks12[1]?.pose ?? null,
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

    const outfitsMeta = outfitsForLooks.map((t) => lookupOutfitMeta(t) ?? { anchor: "?", color: "?" });
    console.log(
      `[generate-portrait] ENQUEUE provider=fal model=${FAL_INFERENCE_PATH} archetype=${archetypeName} family=${family} ` +
      `profession="${profession}" requestedCount=${requestedCount} outfitSource=${outfitSource} ` +
      `outfitsMeta=${JSON.stringify(outfitsMeta)}`,
    );

    // ===== ENFILEIRA OS 3 JOBS EM PARALELO =====
    const enqueueResults = await Promise.all(
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
        const r = await enqueueFalJob({
          falKey: FAL_KEY,
          loraUrl: training.lora_weights_url,
          loraScale: DEFAULT_LORA_SCALE,
          prompt: built.prompt,
          guidanceScale: DEFAULT_GUIDANCE,
        });
        return {
          background: built.backgroundKey,
          outfit,
          pose: handPose,
          prompt: built.prompt,
          ...r,
        };
      }),
    );

    const successfullyEnqueued = enqueueResults.filter((r) => r.ok) as Array<
      typeof enqueueResults[number] & { ok: true; requestId: string }
    >;
    if (successfullyEnqueued.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Falha ao enfileirar geração na Fal. Tente novamente.",
          details: enqueueResults.map((r) => (r.ok ? null : r.reason)),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const generationId = crypto.randomUUID();
    const promptsMeta = successfullyEnqueued.map((r) => ({
      background: r.background,
      outfit: r.outfit,
      pose: r.pose,
      prompt: r.prompt,
    }));

    const { error: insErr } = await supabaseAdmin.from("portrait_generations").insert({
      id: generationId,
      user_id: user.id,
      status: "processing",
      portraits: [],
      style_index: 0,
      used_hand_poses: successfullyEnqueued.map((r) => r.pose).filter((p): p is string => !!p),
      used_outfits: successfullyEnqueued.map((r) => r.outfit).filter((o): o is string => !!o),
      fal_request_ids: successfullyEnqueued.map((r) => r.requestId),
      prompts_meta: promptsMeta,
    });

    if (insErr) {
      console.error("[generate-portrait] insert generation failed", insErr);
      return new Response(
        JSON.stringify({ error: "Falha ao registrar geração." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[generate-portrait] enqueued generation=${generationId} jobs=${successfullyEnqueued.length}`);

    return new Response(
      JSON.stringify({
        generation_id: generationId,
        status: "processing",
        job_count: successfullyEnqueued.length,
        estimated_seconds: 200,
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
