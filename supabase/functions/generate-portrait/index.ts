import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import {
  buildGeminiPortraitPrompt,
  mapGender,
  buildOutfitTextForLook,
  pickPosesForLooks,
  getArchetypeFamily,
} from "../_shared/portraitPrompts.ts";
import { mapProfessionToCategory, pickOutfits, lookupOutfitMeta } from "../_shared/outfitPool.ts";

// Motor: Nano Banana Pro (google/gemini-3-pro-image-preview) via Lovable AI Gateway.
// Recebe as selfies de referência da usuária em cada chamada — sem treino, sem LoRA.
// Cobra 1 crédito por imagem efetivamente entregue (até 3 por geração).

const PRIMARY_MODEL = "google/gemini-3-pro-image-preview";
const FALLBACK_MODEL = "google/gemini-3.1-flash-image-preview";
const PORTRAIT_BUCKET = "portrait-outputs";
const REFERENCE_BUCKET = "portrait-inputs";
const MAX_PORTRAITS = 3;
const MIN_REFERENCES = 3;

interface GeneratedImage {
  storage_path: string;
  background: string;
  outfit: string;
  pose: string | null;
  prompt: string;
  model: string;
}

async function downloadReferenceAsDataUrl(
  supabaseAdmin: any,
  filePath: string,
): Promise<{ ok: true; dataUrl: string } | { ok: false; reason: string }> {
  try {
    const { data, error } = await supabaseAdmin.storage.from(REFERENCE_BUCKET).download(filePath);
    if (error || !data) return { ok: false, reason: error?.message ?? "no-data" };
    const buf = new Uint8Array(await data.arrayBuffer());
    // base64 em chunks pra evitar stack overflow
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < buf.length; i += CHUNK) {
      bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
    }
    const b64 = btoa(bin);
    const mime = data.type || "image/jpeg";
    return { ok: true, dataUrl: `data:${mime};base64,${b64}` };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

type AgeRange = "20s" | "30s" | "40s" | "50s" | "60s+";

async function detectApparentAgeRange(apiKey: string, referenceDataUrl: string): Promise<AgeRange> {
  const DEFAULT: AgeRange = "40s";
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Look at this photo and estimate the apparent age range of the person. Reply with ONLY one of these values: "20s", "30s", "40s", "50s", "60s+". Nothing else.`,
              },
              { type: "image_url", image_url: { url: referenceDataUrl } },
            ],
          },
        ],
      }),
    });
    if (!resp.ok) {
      console.log(`[generate-portrait] age detect non-ok status=${resp.status}, defaulting to ${DEFAULT}`);
      return DEFAULT;
    }
    const data = await resp.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = String(raw).toLowerCase().replace(/["'.\s]/g, "");
    const match = cleaned.match(/(20s|30s|40s|50s|60\+|60s\+)/);
    if (!match) {
      console.log(`[generate-portrait] age detect unrecognized="${raw}", defaulting to ${DEFAULT}`);
      return DEFAULT;
    }
    const v = match[1].replace("60+", "60s+").replace("60s+", "60s+");
    const valid: AgeRange[] = ["20s", "30s", "40s", "50s", "60s+"];
    return (valid.includes(v as AgeRange) ? (v as AgeRange) : DEFAULT);
  } catch (e) {
    console.log(`[generate-portrait] age detect error: ${e instanceof Error ? e.message : String(e)}, defaulting to ${DEFAULT}`);
    return DEFAULT;
  }
}

async function generateOnePortrait(params: {
  apiKey: string;
  prompt: string;
  referenceDataUrls: string[];
  model: string;
}): Promise<{ ok: true; pngBytes: Uint8Array } | { ok: false; status: number; reason: string }> {
  const { apiKey, prompt, referenceDataUrls, model } = params;

  const userContent: any[] = [];
  for (const url of referenceDataUrls) {
    userContent.push({ type: "image_url", image_url: { url } });
  }
  userContent.push({ type: "text", text: prompt });

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: userContent }],
        modalities: ["image", "text"],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, status: resp.status, reason: text.slice(0, 300) };
    }

    const data = await resp.json();
    const imageUrl: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) {
      return { ok: false, status: 500, reason: "no-image-in-response" };
    }

    // Decodifica data URL base64 → bytes
    const m = imageUrl.match(/^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/);
    if (!m) return { ok: false, status: 500, reason: "bad-image-url-format" };
    const b64 = m[1];
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { ok: true, pngBytes: bytes };
  } catch (e) {
    return { ok: false, status: 500, reason: e instanceof Error ? e.message : String(e) };
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY não configurado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [balanceRes, profileRes, referencesRes, archetypesRes, reportRes] = await Promise.all([
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
        .from("portrait_references")
        .select("id, file_path, position")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("position", { ascending: true }),
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

    const references = referencesRes.data ?? [];
    if (references.length < MIN_REFERENCES) {
      return new Response(
        JSON.stringify({
          error: `Envie pelo menos ${MIN_REFERENCES} selfies de referência antes de gerar retratos.`,
          needs_references: true,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const requestedCount = Math.min(totalCredits, MAX_PORTRAITS);

    const archetypeName = archetypesRes.data?.archetype_name || "Cara-comum";
    const reportContent = reportRes.data?.content as Record<string, any> | null;
    const figurino = reportContent?.figurino || {};
    const gender = mapGender(profileRes.data?.gender);
    const profession = profileRes.data?.profession ?? "";

    // Baixa selfies como data URLs (paralelo).
    // IMPORTANTE: limitamos a 5 referências para evitar que o Gemini "média"
    // os rostos. A primeira selfie é a âncora de identidade (ground truth);
    // as demais servem só para fornecer ângulos auxiliares. Mais que isso
    // dilui a semelhança facial.
    const MAX_REFERENCES_TO_SEND = 3;
    const refsToUse = references.slice(0, MAX_REFERENCES_TO_SEND);
    const refDownloads = await Promise.all(
      refsToUse.map((r) => downloadReferenceAsDataUrl(supabaseAdmin, r.file_path)),
    );
    const referenceDataUrls = refDownloads
      .filter((d): d is { ok: true; dataUrl: string } => d.ok)
      .map((d) => d.dataUrl);

    if (referenceDataUrls.length < MIN_REFERENCES) {
      return new Response(
        JSON.stringify({
          error: "Falha ao carregar suas referências. Tente reenviar as selfies.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Variedade: pega últimas poses/outfits usadas
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
    {
      const fromPool = pickOutfits(family, profCategory, recentlyUsedOutfits, requestedCount);
      if (fromPool.length === requestedCount) {
        outfitsForLooks = fromPool;
      } else {
        outfitsForLooks = Array.from({ length: requestedCount }, (_, i) => buildOutfitTextForLook(figurino, i));
      }
    }

    console.log(
      `[generate-portrait] START provider=gemini model=${PRIMARY_MODEL} archetype=${archetypeName} ` +
      `requestedCount=${requestedCount} references=${referenceDataUrls.length}`,
    );

    // Detecta faixa etária aparente da PRIMEIRA referência (uma única chamada).
    // Default seguro: "40s" se a chamada falhar ou retornar inesperado.
    const apparentAgeRange = await detectApparentAgeRange(LOVABLE_API_KEY, referenceDataUrls[0]);
    console.log(`[generate-portrait] apparentAgeRange=${apparentAgeRange}`);

    // Gera as N imagens sequencialmente (evita rate-limit e melhora consistência)
    const results: Array<{
      index: number;
      background: string;
      outfit: string;
      pose: string | null;
      prompt: string;
      model: string;
      result: Awaited<ReturnType<typeof generateOnePortrait>>;
    }> = [];
    for (let i = 0; i < requestedCount; i++) {
      const outfit = outfitsForLooks[i] ?? "";
      const handPose = selectedPoses[i] ?? null;
      const built = buildGeminiPortraitPrompt({
        archetype: archetypeName,
        outfit,
        backgroundIndex: i as 0 | 1 | 2,
        handPose,
        gender,
        apparentAgeRange,
      });

      let r = await generateOnePortrait({
        apiKey: LOVABLE_API_KEY,
        prompt: built.prompt,
        referenceDataUrls,
        model: PRIMARY_MODEL,
      });
      let usedModel = PRIMARY_MODEL;
      if (!r.ok && (r as any).status !== 402 && (r as any).status !== 429) {
        console.log(`[generate-portrait] primary failed (status=${(r as any).status}), trying fallback`);
        const fb = await generateOnePortrait({
          apiKey: LOVABLE_API_KEY,
          prompt: built.prompt,
          referenceDataUrls,
          model: FALLBACK_MODEL,
        });
        if (fb.ok) { r = fb; usedModel = FALLBACK_MODEL; }
      }

      results.push({
        index: i,
        background: built.backgroundKey,
        outfit,
        pose: handPose,
        prompt: built.prompt,
        model: usedModel,
        result: r,
      });

      if (!r.ok && ((r as any).status === 402 || (r as any).status === 429)) break;
    }

    // Verifica payment/rate-limit globais
    const paymentError = results.find((x) => !x.result.ok && (x.result as any).status === 402);
    if (paymentError) {
      return new Response(
        JSON.stringify({
          error: "Créditos do gateway de IA insuficientes. Adicione fundos em Workspace > Usage.",
          needs_credits: true,
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const rateLimitError = results.find((x) => !x.result.ok && (x.result as any).status === 429);
    if (rateLimitError) {
      return new Response(
        JSON.stringify({
          error: "Muitas gerações em pouco tempo. Aguarde 1 minuto e tente novamente.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const successes = results.filter((x) => x.result.ok);
    if (successes.length === 0) {
      const reasons = results.map((x) => (x.result.ok ? null : (x.result as any).reason)).filter(Boolean);
      console.error(`[generate-portrait] ALL FAILED: ${reasons.join(" | ")}`);
      return new Response(
        JSON.stringify({
          error: "Falha ao gerar retratos. Tente novamente em alguns minutos.",
          details: reasons,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Sobe imagens no bucket
    const generationId = crypto.randomUUID();
    const uploaded: GeneratedImage[] = [];
    for (const s of successes) {
      const r = s.result as { ok: true; pngBytes: Uint8Array };
      const path = `${user.id}/${generationId}/${s.index}_${s.background}.png`;
      const { error: upErr } = await supabaseAdmin.storage
        .from(PORTRAIT_BUCKET)
        .upload(path, r.pngBytes, { contentType: "image/png", upsert: false });
      if (upErr) {
        console.error(`[generate-portrait] upload failed for ${path}: ${upErr.message}`);
        continue;
      }
      uploaded.push({
        storage_path: path,
        background: s.background,
        outfit: s.outfit,
        pose: s.pose,
        prompt: s.prompt,
        model: s.model,
      });
    }

    if (uploaded.length === 0) {
      return new Response(
        JSON.stringify({ error: "Falha ao salvar retratos gerados." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cobra créditos: included primeiro, depois extra
    const charged = uploaded.length;
    const useIncluded = Math.min(included, charged);
    const useExtra = charged - useIncluded;
    await supabaseAdmin
      .from("user_balances")
      .update({
        portrait_credits_included: included - useIncluded,
        portrait_credits_extra: extra - useExtra,
      })
      .eq("user_id", user.id);

    await supabaseAdmin.from("credit_logs").insert({
      user_id: user.id,
      credit_type: "portrait",
      amount: -charged,
      description: `Geração de ${charged} retrato(s) — Nano Banana Pro`,
    });

    // Signed URLs pra retornar ao front
    const portraitsWithUrls = await Promise.all(
      uploaded.map(async (u) => {
        const { data: signed } = await supabaseAdmin.storage
          .from(PORTRAIT_BUCKET)
          .createSignedUrl(u.storage_path, 60 * 60 * 24 * 7); // 7d
        return {
          storage_path: u.storage_path,
          url: signed?.signedUrl ?? null,
          background: u.background,
          outfit: u.outfit,
          pose: u.pose,
        };
      }),
    );

    const { error: insErr } = await supabaseAdmin.from("portrait_generations").insert({
      id: generationId,
      user_id: user.id,
      status: "ready",
      portraits: portraitsWithUrls,
      style_index: 0,
      used_hand_poses: uploaded.map((u) => u.pose).filter((p): p is string => !!p),
      used_outfits: uploaded.map((u) => u.outfit).filter((o): o is string => !!o),
      fal_request_ids: [],
      prompts_meta: uploaded.map((u) => ({
        background: u.background,
        outfit: u.outfit,
        pose: u.pose,
        prompt: u.prompt,
        model: u.model,
      })),
      engine: "gemini",
      completed_at: new Date().toISOString(),
    });

    if (insErr) {
      console.error("[generate-portrait] insert generation failed", insErr);
    }

    console.log(`[generate-portrait] DONE generation=${generationId} delivered=${uploaded.length}/${requestedCount}`);

    return new Response(
      JSON.stringify({
        generation_id: generationId,
        status: "ready",
        portraits: portraitsWithUrls,
        delivered: uploaded.length,
        requested: requestedCount,
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
