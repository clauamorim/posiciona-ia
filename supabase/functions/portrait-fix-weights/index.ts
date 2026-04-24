import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

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

    // Check admin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleData;

    // Find ready trainings with non-URL lora_weights_url
    let query = supabaseAdmin
      .from("portrait_trainings")
      .select("id, user_id, replicate_training_id, lora_weights_url")
      .eq("status", "ready");
    if (!isAdmin) query = query.eq("user_id", user.id);

    const { data: trainings, error: trainingsErr } = await query;
    if (trainingsErr) throw trainingsErr;

    const broken = (trainings ?? []).filter(
      (t) => t.lora_weights_url && !t.lora_weights_url.startsWith("https://") && t.replicate_training_id,
    );

    const results: Array<{ id: string; ok: boolean; weights?: string; error?: string }> = [];

    for (const t of broken) {
      try {
        const res = await fetch(`https://api.replicate.com/v1/trainings/${t.replicate_training_id}`, {
          headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
        });
        if (!res.ok) {
          results.push({ id: t.id, ok: false, error: `replicate-${res.status}` });
          continue;
        }
        const data = await res.json();
        const weights = data?.output?.weights;
        if (!weights || typeof weights !== "string" || !weights.startsWith("https://")) {
          results.push({ id: t.id, ok: false, error: "no-weights-url-in-output" });
          continue;
        }
        await supabaseAdmin
          .from("portrait_trainings")
          .update({ lora_weights_url: weights, updated_at: new Date().toISOString() })
          .eq("id", t.id);
        console.log(`[portrait-fix-weights] training=${t.id} fixed weights=${weights.slice(0, 80)}`);
        results.push({ id: t.id, ok: true, weights });
      } catch (e) {
        results.push({ id: t.id, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(
      JSON.stringify({
        scanned: trainings?.length ?? 0,
        broken: broken.length,
        fixed: results.filter((r) => r.ok).length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[portrait-fix-weights] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
