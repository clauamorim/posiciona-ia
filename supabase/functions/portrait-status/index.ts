import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

// Polling endpoint para o fluxo Gemini de retratos. Recebe { generation_id }
// e devolve status atual + signed URLs frescas quando "ready".
const PORTRAIT_BUCKET = "portrait-outputs";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const generationId: string | undefined = body.generation_id;
    if (!generationId) {
      return new Response(JSON.stringify({ error: "generation_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: gen, error: genErr } = await supabaseAdmin
      .from("portrait_generations")
      .select("id, user_id, status, portraits, error_message, completed_at, created_at")
      .eq("id", generationId)
      .single();

    if (genErr || !gen) {
      return new Response(JSON.stringify({ error: "Geração não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (gen.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (gen.status !== "ready") {
      return new Response(
        JSON.stringify({
          status: gen.status,
          error_message: gen.error_message ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Reassina URLs (as salvas podem ter expirado).
    const portraits = Array.isArray(gen.portraits) ? (gen.portraits as any[]) : [];
    const withFreshUrls = await Promise.all(
      portraits.map(async (p) => {
        if (!p?.storage_path) return p;
        const { data: signed } = await supabaseAdmin.storage
          .from(PORTRAIT_BUCKET)
          .createSignedUrl(p.storage_path, 60 * 60 * 24 * 7);
        return { ...p, url: signed?.signedUrl ?? p.url ?? null };
      }),
    );

    return new Response(
      JSON.stringify({
        status: "ready",
        generation_id: gen.id,
        portraits: withFreshUrls,
        delivered: withFreshUrls.length,
        completed_at: gen.completed_at,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[portrait-status] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
