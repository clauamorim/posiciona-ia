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
const GENERATE_COST_CREDITS = 3;
// Guidance calibrado pra espelhar o que funcionou no Replicate UI manual (2.5).
// Variamos sutilmente entre os 3 looks pra dar variedade sem fugir muito do ponto-doce.
const GUIDANCE_VARIATIONS = [2.5, 2.7, 2.9];
const PORTRAIT_BUCKET = "portrait-outputs";
// Referência (logs apenas). FLUX LoRA usa aspect_ratio + megapixels — width/height
// no input são ignorados silenciosamente e o modelo cai pra 1024x1024.
const PORTRAIT_WIDTH = 896;
const PORTRAIT_HEIGHT = 1152;

/**
 * Calibra a força do LoRA conforme o tamanho do dataset de selfies.
 * Calibrado pra valores próximos do default do Replicate UI (~0.8), que produziu
 * textura de pele e expressões mais naturais. Scales >0.9 começam a "endurecer"
 * o resultado e suavizar pele em excesso.
 */
function pickLoraScale(selfiesCount: number): number {
  if (selfiesCount <= 12) return 0.80;
  if (selfiesCount <= 20) return 0.85;
  return 0.88;
}

/** Fisher–Yates shuffle não destrutivo. */
function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Faz download bruto da URL e devolve um Uint8Array (PNG).
 * Replicate's CDN às vezes retorna HTML 503 transitório — fazemos retry com backoff
 * e validamos content-type para não tratar HTML como bytes de imagem.
 */
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
          // Replicate CDN devolveu HTML/erro em vez do PNG — descarta e tenta de novo.
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
      const delay = 500 * Math.pow(2, attempt - 1); // 500, 1000, 2000ms
      console.warn(`[generate-portrait] download attempt ${attempt}/${maxAttempts} failed (${lastReason}), retrying in ${delay}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return { ok: false, reason: lastReason };
}

// (helper bytesToDataUrl e upscaleImage removidos — não usamos mais Clarity Upscaler.
// Trocamos resolução alta por fidelidade facial máxima: o LoRA gera direto em 896x1152
// e os bytes vão direto ao Storage privado, sem etapa intermediária.)

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
      // FLUX LoRA: usar aspect_ratio + megapixels. width/height no input são
      // ignorados silenciosamente e o modelo cai pra 1024x1024 quadrado.
      // 3:4 com 1MP ≈ 896x1152 (resolução vertical premium nativa).
      aspect_ratio: "3:4",
      megapixels: "1",
      guidance_scale: guidanceScale,
      num_inference_steps: 35,
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
        .select("gender, profession")
        .eq("user_id", user.id)
        .single(),
      supabaseAdmin
        .from("portrait_trainings")
        .select("id, lora_weights_url, trigger_word, status, physical_traits, selfies_count")
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

    // Quantos retratos serão gerados nesta rodada (1, 2 ou 3 dependendo do saldo).
    const requestedCount = Math.min(totalCredits, GENERATE_COST_CREDITS);

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
    // Look 0 (close-up) não usa pose. Pega poses para os looks 1+ (até requestedCount-1 poses).
    const numPoses = Math.max(0, requestedCount - 1);
    const posesForLooks12 = pickPosesForLooks(family, recentlyUsedPoses, numPoses);
    // Array indexado por look: [null, pose1?, pose2?]
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

    // ===== FIGURINOS — pool curado por profissão > buildOutfitTextForLook(figurino) =====
    const profCategory = mapProfessionToCategory(profession);
    let outfitsForLooks: string[] = [];
    let outfitSource = "report-figurino";

    {
      // Pool curado da profissão. Se vazio (ex: family sem matriz), volta ao figurino do relatório.
      const fromPool = pickOutfits(family, profCategory, recentlyUsedOutfits, requestedCount);
      if (fromPool.length === requestedCount) {
        outfitsForLooks = fromPool;
        outfitSource = `pool:${family}/${profCategory}`;
      } else {
        // Fallback: figurino do relatório (comportamento anterior).
        outfitsForLooks = Array.from({ length: requestedCount }, (_, i) => buildOutfitTextForLook(figurino, i));
        outfitSource = "report-figurino-fallback";
      }
    }

    const selfiesCount = (training as any).selfies_count ?? 0;
    const loraScale = pickLoraScale(selfiesCount);

    console.log(
      `[generate-portrait] archetype=${archetypeName} family=${family} profession="${profession}" ` +
      `category=${profCategory} requestedCount=${requestedCount} outfitSource=${outfitSource} ` +
      `selfiesCount=${selfiesCount} loraScale=${loraScale} ` +
      `outfits=${JSON.stringify(outfitsForLooks)} poses=${JSON.stringify(selectedPoses)} ` +
      `poseCats=${JSON.stringify(selectedPoseCategories)}`,
    );

    // Geração sequencial — Replicate low-credit accounts (<$5) tem rate limit 6/min.
    const INTER_CALL_DELAY_MS = 11000;
    const RETRY_DELAY_MS = 30000;
    const results: { background: string; portraitUrl: string | null; error?: string; pose?: string; outfit?: string }[] = [];
    for (let i = 0; i < requestedCount; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, INTER_CALL_DELAY_MS));
      const outfit = outfitsForLooks[i] ?? "";
      const handPose = selectedPoses[i] ?? null;
      const guidanceScale = GUIDANCE_VARIATIONS[i] ?? 3.0;
      const built = buildPortraitPrompt({
        archetype: archetypeName,
        userId: user.id,
        triggerWord: training.trigger_word, // ← trigger REAL do treino (USR + 12 hex)
        gender,
        outfit,
        hair,
        makeup,
        backgroundIndex: i as 0 | 1 | 2,
        physicalTraits: (training as any).physical_traits ?? null,
        handPose,
      });

      // loraScale calculado acima conforme tamanho do dataset (pickLoraScale).
      // ESTRATÉGIA ATUAL: hands-out-of-frame em 100% dos looks + prompt enxuto
      // estilo Replicate UI manual (steps 35, guidance ~2.5, sem weights numéricos).
      console.log(
        `[generate-portrait] call ${i + 1}/${requestedCount} background=${built.backgroundKey} archetype=${archetypeName} ` +
        `trigger="${training.trigger_word}" trainingId=${training.id} ` +
        `framing=hands-out-of-frame dims=${PORTRAIT_WIDTH}x${PORTRAIT_HEIGHT}(3:4@1MP) ` +
        `outfit="${outfit}" guidance=${guidanceScale} loraScale=${loraScale} steps=35 ` +
        `selfiesCount=${selfiesCount} hasTraits=${!!(training as any).physical_traits}`,
      );
      console.log(`[generate-portrait] PROMPT[${i}]: ${built.prompt.slice(0, 500)}`);
      console.log(`[generate-portrait] NEGATIVE[${i}]: ${built.negative.slice(0, 300)}`);
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

    // ===== DOWNLOAD + UPLOAD PARALELO (sem upscaler) =====
    // Os 3 retratos vão direto do Replicate ao Storage privado em paralelo.
    // Resolução nativa do FLUX = 896x1152, mantida sem reescalonamento.
    const generationId = crypto.randomUUID();

    const pipelineResults = await Promise.allSettled(
      successful.map(async (r, i) => {
        try {
          const dl = await downloadImageBytes(r.portraitUrl!);
          if (!dl.ok) {
            console.error(`[generate-portrait] failed to download background=${r.background}: ${dl.reason}`);
            return null;
          }
          const bytes = dl.bytes;

          const path = `${user.id}/${generationId}/${i}.png`;
          const upRes = await supabaseAdmin.storage
            .from(PORTRAIT_BUCKET)
            .upload(path, bytes, { contentType: "image/png", upsert: true });
          if (upRes.error) {
            console.error(`[generate-portrait] storage upload failed background=${r.background}: ${upRes.error.message}`);
            return null;
          }
          console.log(`[generate-portrait] uploaded background=${r.background} path=${path} bytes=${bytes.length}`);
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


    // Debit credits — cobra apenas pelas imagens com sucesso (max requestedCount).
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

    // Gera URLs assinadas (1h) para o front exibir os retratos imediatamente,
    // sem precisar fazer um segundo round-trip ao Storage.
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
        portraits: signedUrls, // URLs assinadas — leves e válidas por 1h
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
