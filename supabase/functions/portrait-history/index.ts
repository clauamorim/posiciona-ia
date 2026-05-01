import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

// Lista os retratos gerados do usuário logado, com signed URLs frescas.
// Resolve as duas formas de armazenamento:
//   - Legado: string (data URL base64 ou path no bucket)
//   - Novo (Gemini): objeto { storage_path, url, background, outfit, pose }
//
// Usa service role para gerar signed URLs — evita problemas de policy quando
// o objeto foi gravado pelo backend (owner_id NULL).

const PORTRAIT_BUCKET = "portrait-outputs";
const SIGNED_URL_TTL = 60 * 60; // 1h

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

    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? "12") || 12, 50);

    const { data: rows, error } = await supabaseAdmin
      .from("portrait_generations")
      .select("id, created_at, portraits")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    type FlatItem = {
      url: string;
      created_at: string;
      parent_id: string;
      background?: string | null;
      outfit?: string | null;
      pose?: string | null;
    };

    const flat: FlatItem[] = [];

    for (const row of rows ?? []) {
      const items: any[] = Array.isArray(row.portraits) ? row.portraits : [];
      for (const item of items) {
        // Legado: string
        if (typeof item === "string") {
          if (!item) continue;
          if (item.startsWith("data:") || item.startsWith("http")) {
            flat.push({ url: item, created_at: row.created_at, parent_id: row.id });
          } else {
            const { data: signed } = await supabaseAdmin.storage
              .from(PORTRAIT_BUCKET)
              .createSignedUrl(item, SIGNED_URL_TTL);
            if (signed?.signedUrl) {
              flat.push({ url: signed.signedUrl, created_at: row.created_at, parent_id: row.id });
            }
          }
          continue;
        }
        // Novo: objeto
        if (item && typeof item === "object") {
          const path: string | undefined = item.storage_path;
          if (path) {
            const { data: signed } = await supabaseAdmin.storage
              .from(PORTRAIT_BUCKET)
              .createSignedUrl(path, SIGNED_URL_TTL);
            if (signed?.signedUrl) {
              flat.push({
                url: signed.signedUrl,
                created_at: row.created_at,
                parent_id: row.id,
                background: item.background ?? null,
                outfit: item.outfit ?? null,
                pose: item.pose ?? null,
              });
              continue;
            }
          }
          // fallback: usa a URL persistida (pode estar expirada, mas ainda vale tentar)
          if (item.url && typeof item.url === "string") {
            flat.push({
              url: item.url,
              created_at: row.created_at,
              parent_id: row.id,
              background: item.background ?? null,
              outfit: item.outfit ?? null,
              pose: item.pose ?? null,
            });
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ portraits: flat, count: flat.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[portrait-history] error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
