// Backfill manual de embeddings dos posts feed dos últimos 28 dias.
// Admin-only. POST { user_id?: string }  — se omitido, usa o usuário autenticado.
// Idempotente: pula (week_index, day_index, report_id) já presentes.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { embedTextBatch, postToEmbedText } from "../_shared/embeddings.ts";
import { detectNamedCases } from "../_shared/editorialDiversity.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const callerId = userData.user.id;

    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!roleData;

    let body: any = {};
    try { body = await req.json(); } catch {}
    const targetUserId: string = body?.user_id || callerId;
    if (targetUserId !== callerId && !isAdmin) {
      return json({ error: "forbidden" }, 403);
    }

    // Carrega reports do usuário
    const { data: reports, error: rErr } = await admin
      .from("reports")
      .select("id, editorial_weeks, created_at")
      .eq("user_id", targetUserId);
    if (rErr) return json({ error: rErr.message }, 500);

    // Já existentes (idempotência)
    const { data: existing } = await admin
      .from("post_embeddings")
      .select("report_id, week_index, day_index")
      .eq("user_id", targetUserId)
      .eq("post_kind", "feed");
    const seen = new Set(
      (existing || []).map((e: any) => `${e.report_id}|${e.week_index}|${e.day_index}`),
    );

    // Coleta candidatos
    type Cand = { reportId: string; weekIndex: number; day: number; post: any };
    const cands: Cand[] = [];
    const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
    for (const r of reports || []) {
      const weeks = Array.isArray(r.editorial_weeks) ? r.editorial_weeks : [];
      for (let wi = 0; wi < weeks.length; wi++) {
        const w: any = weeks[wi];
        const days = Array.isArray(w?.days) ? w.days : [];
        for (const d of days) {
          const feed = d?.feed;
          if (!feed || (!feed.theme && !feed.caption)) continue;
          const key = `${r.id}|${wi}|${Number(feed.day || d?.day)}`;
          if (seen.has(key)) continue;
          // janela de 28d: usa created_at do report como proxy
          const ts = r.created_at ? new Date(r.created_at).getTime() : Date.now();
          if (ts < cutoff) continue;
          cands.push({ reportId: r.id, weekIndex: wi, day: Number(feed.day || d?.day), post: feed });
        }
      }
    }

    if (cands.length === 0) {
      return json({ ok: true, user_id: targetUserId, inserted: 0, skipped: seen.size, message: "nada a backfillar" });
    }

    // Processa em batches de 20 para respeitar quota e tamanho do payload
    let inserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < cands.length; i += 20) {
      const slice = cands.slice(i, i + 20);
      const texts = slice.map((c) => postToEmbedText(c.post));
      const vecs = await embedTextBatch(texts);
      const rows: any[] = [];
      for (let j = 0; j < slice.length; j++) {
        const v = vecs[j];
        if (!v) continue;
        const c = slice[j];
        const named = detectNamedCases(
          `${c.post.theme || ""} ${(c.post as any).title || ""} ${c.post.caption || ""} ${(c.post.card_copy || []).join(" ")} ${c.post.cta || ""}`,
        );
        rows.push({
          user_id: targetUserId,
          report_id: c.reportId,
          week_index: c.weekIndex,
          day_index: c.day,
          post_kind: "feed",
          text_used: texts[j],
          embedding: v,
          named_cases: named,
        });
      }
      if (rows.length > 0) {
        const { error: insErr } = await admin.from("post_embeddings").insert(rows);
        if (insErr) errors.push(insErr.message);
        else inserted += rows.length;
      }
    }

    return json({
      ok: true,
      user_id: targetUserId,
      candidates: cands.length,
      inserted,
      skipped_existing: seen.size,
      errors,
    });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
