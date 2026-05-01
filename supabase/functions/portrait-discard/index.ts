import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

// Marca um retrato (índice dentro de uma generation) como descartado do histórico.
// Usa kept_indices: NULL = todos visíveis (default). Ao descartar, criamos a lista
// inicial com todos os índices presentes, removemos o pedido, e gravamos.
// Não apaga arquivo do storage — só oculta do histórico.

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

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const generationId: string | undefined = body?.generation_id;
    const indexRaw: unknown = body?.index;
    const index = typeof indexRaw === "number" ? indexRaw : Number(indexRaw);

    if (!generationId || !Number.isInteger(index) || index < 0) {
      return new Response(
        JSON.stringify({ error: "generation_id e index (inteiro >=0) são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: gen, error: getErr } = await supabaseAdmin
      .from("portrait_generations")
      .select("id, user_id, portraits, kept_indices")
      .eq("id", generationId)
      .maybeSingle();

    if (getErr || !gen) {
      return new Response(JSON.stringify({ error: "Geração não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (gen.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalCount = Array.isArray(gen.portraits) ? gen.portraits.length : 0;
    const allIndices = Array.from({ length: totalCount }, (_, i) => i);
    const current: number[] = Array.isArray(gen.kept_indices)
      ? gen.kept_indices.filter((i: any) => Number.isInteger(i))
      : allIndices;

    const next = current.filter((i) => i !== index);

    const { error: updErr } = await supabaseAdmin
      .from("portrait_generations")
      .update({ kept_indices: next })
      .eq("id", generationId);

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, kept_indices: next, hidden_generation: next.length === 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[portrait-discard] error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
