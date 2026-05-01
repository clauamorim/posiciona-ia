import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";

// Gerencia as selfies de referência da usuária (substitui o LoRA training).
// Operações:
//   GET    /portrait-references           → lista as referências ativas (com signed URLs pra preview)
//   POST   /portrait-references           → upload de uma nova selfie (body: { base64, filename })
//   DELETE /portrait-references?id=...    → desativa a referência

const PORTRAIT_BUCKET = "portrait-inputs";
const MAX_REFERENCES = 5;
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h

function decodeBase64Image(b64: string): { ok: true; bytes: Uint8Array; mime: string } | { ok: false; reason: string } {
  try {
    const m = b64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    let mime = "image/jpeg";
    let payload = b64;
    if (m) {
      mime = m[1];
      payload = m[2];
    }
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { ok: true, bytes, mime };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
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

    const url = new URL(req.url);

    // ===== LIST =====
    if (req.method === "GET") {
      const { data: refs, error } = await supabaseAdmin
        .from("portrait_references")
        .select("id, file_path, position, created_at")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("position", { ascending: true });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Signed URLs pra preview no front
      const items = await Promise.all(
        (refs || []).map(async (r) => {
          const { data: signed } = await supabaseAdmin.storage
            .from(PORTRAIT_BUCKET)
            .createSignedUrl(r.file_path, SIGNED_URL_TTL_SECONDS);
          return {
            id: r.id,
            file_path: r.file_path,
            position: r.position,
            created_at: r.created_at,
            preview_url: signed?.signedUrl ?? null,
          };
        }),
      );

      return new Response(
        JSON.stringify({ references: items, max: MAX_REFERENCES }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== UPLOAD =====
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const base64: string | undefined = body?.base64;
      if (!base64 || typeof base64 !== "string") {
        return new Response(JSON.stringify({ error: "base64 obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Conta atuais
      const { count: currentCount, error: countErr } = await supabaseAdmin
        .from("portrait_references")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true);

      if (countErr) {
        return new Response(JSON.stringify({ error: countErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if ((currentCount ?? 0) >= MAX_REFERENCES) {
        return new Response(
          JSON.stringify({ error: `Máximo de ${MAX_REFERENCES} referências. Remova alguma antes de adicionar nova.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const decoded = decodeBase64Image(base64);
      if (!decoded.ok) {
        return new Response(JSON.stringify({ error: `Imagem inválida: ${decoded.reason}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Limita ~6MB (pós-base64)
      if (decoded.bytes.length > 6 * 1024 * 1024) {
        return new Response(JSON.stringify({ error: "Imagem maior que 6MB. Reduza antes de enviar." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ext = decoded.mime === "image/png" ? "png" : decoded.mime === "image/webp" ? "webp" : "jpg";
      const position = currentCount ?? 0;
      const filePath = `${user.id}/ref_${Date.now()}_${position}.${ext}`;

      const { error: uploadErr } = await supabaseAdmin.storage
        .from(PORTRAIT_BUCKET)
        .upload(filePath, decoded.bytes, { contentType: decoded.mime, upsert: false });

      if (uploadErr) {
        console.error("[portrait-references] upload failed", uploadErr);
        return new Response(JSON.stringify({ error: `Falha ao salvar imagem: ${uploadErr.message}` }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("portrait_references")
        .insert({
          user_id: user.id,
          file_path: filePath,
          position,
          is_active: true,
        })
        .select("id, file_path, position, created_at")
        .single();

      if (insertErr) {
        await supabaseAdmin.storage.from(PORTRAIT_BUCKET).remove([filePath]);
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: signed } = await supabaseAdmin.storage
        .from(PORTRAIT_BUCKET)
        .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

      return new Response(
        JSON.stringify({ reference: { ...inserted, preview_url: signed?.signedUrl ?? null } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== DELETE =====
    if (req.method === "DELETE") {
      const id = url.searchParams.get("id");
      if (!id) {
        return new Response(JSON.stringify({ error: "id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: ref, error: fetchErr } = await supabaseAdmin
        .from("portrait_references")
        .select("id, file_path, user_id")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchErr || !ref) {
        return new Response(JSON.stringify({ error: "Referência não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Soft delete: marca inativo + remove do storage
      await supabaseAdmin
        .from("portrait_references")
        .update({ is_active: false })
        .eq("id", id);

      await supabaseAdmin.storage.from(PORTRAIT_BUCKET).remove([ref.file_path]);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Método não suportado" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[portrait-references] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
