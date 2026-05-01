import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

// Polling de geração assíncrona de retratos. Verifica status dos jobs Fal,
// quando todos completos: baixa, sobe no Storage, cobra créditos e marca ready.
const FAL_INFERENCE_PATH = "fal-ai/flux-krea-lora";
const PORTRAIT_BUCKET = "portrait-outputs";

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
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
    }
  }
  return { ok: false, reason: lastReason };
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
      return new Response(JSON.stringify({ error: "FAL_KEY ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const generationId: string | undefined = body.generation_id;
    if (!generationId) {
      return new Response(JSON.stringify({ error: "generation_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: gen, error: genErr } = await supabaseAdmin
      .from("portrait_generations")
      .select("id, user_id, status, fal_request_ids, prompts_meta, portraits")
      .eq("id", generationId)
      .single();

    if (genErr || !gen) {
      return new Response(JSON.stringify({ error: "Geração não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (gen.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Já finalizada — devolver URLs assinadas.
    if (gen.status === "ready" || gen.status === "failed") {
      const paths: string[] = Array.isArray(gen.portraits) ? gen.portraits as string[] : [];
      const signed = await Promise.all(
        paths.map(async (p) => {
          const { data } = await supabaseAdmin.storage.from(PORTRAIT_BUCKET).createSignedUrl(p, 60 * 60);
          return data?.signedUrl ?? "";
        }),
      );
      const meta = (gen.prompts_meta ?? []) as Array<{ background: string; outfit: string }>;
      return new Response(
        JSON.stringify({
          status: gen.status,
          portraits: signed,
          backgrounds: meta.map((m) => m.background),
          outfits: meta.map((m) => m.outfit ?? ""),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const requestIds: string[] = Array.isArray(gen.fal_request_ids) ? gen.fal_request_ids as string[] : [];
    if (requestIds.length === 0) {
      return new Response(JSON.stringify({ error: "Geração sem request_ids" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Checa status de todos em paralelo.
    const statuses = await Promise.all(
      requestIds.map(async (rid) => {
        const r = await fetch(
          `https://queue.fal.run/${FAL_INFERENCE_PATH}/requests/${rid}/status`,
          { headers: { Authorization: `Key ${FAL_KEY}` } },
        );
        if (!r.ok) {
          await r.text().catch(() => "");
          return { rid, status: "ERROR" };
        }
        const j = await r.json();
        return { rid, status: String(j?.status ?? "").toUpperCase() };
      }),
    );

    const completed = statuses.filter((s) => s.status === "COMPLETED" || s.status === "OK").length;
    const failed = statuses.filter((s) => s.status === "ERROR" || s.status === "FAILED").length;
    const total = statuses.length;

    console.log(`[portrait-poll] generation=${generationId} completed=${completed}/${total} failed=${failed}`);

    // Ainda processando.
    if (completed + failed < total) {
      return new Response(
        JSON.stringify({ status: "processing", progress: completed, total }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Todos terminaram. Busca resultados dos que completaram.
    const fetchResults = await Promise.all(
      statuses.map(async (s) => {
        if (s.status !== "COMPLETED" && s.status !== "OK") return { rid: s.rid, imageUrl: null as string | null };
        const r = await fetch(
          `https://queue.fal.run/${FAL_INFERENCE_PATH}/requests/${s.rid}`,
          { headers: { Authorization: `Key ${FAL_KEY}` } },
        );
        if (!r.ok) {
          await r.text().catch(() => "");
          return { rid: s.rid, imageUrl: null };
        }
        const j = await r.json();
        const url: string | undefined = j?.images?.[0]?.url;
        return { rid: s.rid, imageUrl: url ?? null };
      }),
    );

    const meta = (gen.prompts_meta ?? []) as Array<{ background: string; outfit: string; pose: string | null }>;

    // Download + upload paralelo.
    const pipeline = await Promise.all(
      fetchResults.map(async (fr, i) => {
        if (!fr.imageUrl) return null;
        const dl = await downloadImageBytes(fr.imageUrl);
        if (!dl.ok) {
          console.error(`[portrait-poll] download failed idx=${i}: ${dl.reason}`);
          return null;
        }
        const path = `${user.id}/${generationId}/${i}.png`;
        const upRes = await supabaseAdmin.storage
          .from(PORTRAIT_BUCKET)
          .upload(path, dl.bytes, { contentType: "image/png", upsert: true });
        if (upRes.error) {
          console.error(`[portrait-poll] upload failed idx=${i}: ${upRes.error.message}`);
          return null;
        }
        return { path, background: meta[i]?.background ?? "neutro", outfit: meta[i]?.outfit ?? "", pose: meta[i]?.pose ?? null };
      }),
    );

    const finalPortraits = pipeline.filter((p): p is NonNullable<typeof p> => p !== null);

    if (finalPortraits.length === 0) {
      await supabaseAdmin
        .from("portrait_generations")
        .update({
          status: "failed",
          error_message: "all-jobs-failed-or-no-images",
          completed_at: new Date().toISOString(),
        })
        .eq("id", generationId);
      return new Response(
        JSON.stringify({ status: "failed", error: "Nenhum retrato pôde ser processado." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Cobra créditos só pelos que tiveram sucesso.
    const { data: balanceRow } = await supabaseAdmin
      .from("user_balances")
      .select("portrait_credits_included, portrait_credits_extra")
      .eq("user_id", user.id)
      .single();
    const included = balanceRow?.portrait_credits_included ?? 0;
    const extra = balanceRow?.portrait_credits_extra ?? 0;
    const charge = finalPortraits.length;
    const fromIncluded = Math.min(included, charge);
    const fromExtra = charge - fromIncluded;

    await supabaseAdmin
      .from("user_balances")
      .update({
        portrait_credits_included: included - fromIncluded,
        portrait_credits_extra: Math.max(0, extra - fromExtra),
      })
      .eq("user_id", user.id);

    // Trigger word só pra log
    const { data: trainingRow } = await supabaseAdmin
      .from("portrait_trainings")
      .select("trigger_word")
      .eq("user_id", user.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const triggerWord = (trainingRow as any)?.trigger_word ?? "lora";

    await supabaseAdmin.from("credit_logs").insert(
      finalPortraits.map((r) => ({
        user_id: user.id,
        credit_type: "portrait",
        amount: -1,
        description: `Retrato gerado (LoRA ${triggerWord}, fundo ${r.background})`,
      })),
    );

    await supabaseAdmin
      .from("portrait_generations")
      .update({
        status: "ready",
        portraits: finalPortraits.map((r) => r.path),
        completed_at: new Date().toISOString(),
      })
      .eq("id", generationId);

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
        status: "ready",
        portraits: signedUrls,
        backgrounds: finalPortraits.map((r) => r.background),
        outfits: finalPortraits.map((r) => r.outfit),
        charged_credits: charge,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[portrait-poll] error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
