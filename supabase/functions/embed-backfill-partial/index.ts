// Backfill de embeddings para semanas parciais / com Stage B falho / sem embeddings.
// Idempotente via UNIQUE (user_id, report_id, week_index, day_index, post_kind).
// Admin-only ou auto-uso. POST { user_id?: string }.

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

    let body: any = {};
    try { body = await req.json(); } catch {}

    // Service-role bypass (admin/scripts) — decodifica claim do JWT.
    let isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;
    if (!isServiceRole) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1] || ""));
        if (payload?.role === "service_role") isServiceRole = true;
      } catch {}
    }
    let callerId: string | null = null;
    let isAdmin = false;

    if (!isServiceRole) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
      callerId = userData.user.id;
      const { data: roleRow } = await admin
        .from("user_roles").select("role")
        .eq("user_id", callerId).eq("role", "admin").maybeSingle();
      isAdmin = !!roleRow;
    }

    const targetUserId: string = body?.user_id || callerId || "";
    if (!targetUserId) return json({ error: "user_id required" }, 400);
    if (!isServiceRole && targetUserId !== callerId && !isAdmin) return json({ error: "forbidden" }, 403);

    const { data: reports, error: rErr } = await admin
      .from("reports").select("id, editorial_weeks")
      .eq("user_id", targetUserId);
    if (rErr) return json({ error: rErr.message }, 500);

    const { data: existing } = await admin
      .from("post_embeddings")
      .select("report_id, week_index, day_index")
      .eq("user_id", targetUserId).eq("post_kind", "feed");
    const seen = new Set((existing || []).map((e: any) => `${e.report_id}|${e.week_index}|${e.day_index}`));
    const beforeCount = (existing || []).length;

    type Cand = { reportId: string; weekIndex: number; day: number; post: any; reason: string };
    const cands: Cand[] = [];
    let weeksTouched = 0;
    const weekKeys = new Set<string>();

    for (const r of reports || []) {
      const weeks = Array.isArray(r.editorial_weeks) ? r.editorial_weeks : [];
      for (const w of weeks) {
        if (!w || typeof w !== "object") continue;
        const wi = Number((w as any)._week_index ?? (w as any).week_index ?? -1);
        if (wi < 0) continue;
        const isPartial = Boolean((w as any)._partial);
        const stageBFailed = Boolean((w as any)._stage_b_failed);
        const days = Array.isArray((w as any).days) ? (w as any).days : [];
        let weekHasMissing = false;
        for (const d of days) {
          const feed = d?.feed;
          if (!feed || (!feed.theme && !feed.caption)) continue;
          const dayN = Number(feed.day || d?.day);
          const key = `${r.id}|${wi}|${dayN}`;
          if (!seen.has(key)) {
            weekHasMissing = true;
            const reason = isPartial ? "partial" : stageBFailed ? "stage_b_failed" : "missing";
            cands.push({ reportId: r.id, weekIndex: wi, day: dayN, post: feed, reason });
          }
        }
        if (weekHasMissing || isPartial || stageBFailed) {
          const wkKey = `${r.id}|${wi}`;
          if (!weekKeys.has(wkKey)) { weekKeys.add(wkKey); weeksTouched++; }
        }
      }
    }

    if (cands.length === 0) {
      return json({
        ok: true, user_id: targetUserId,
        weeks_touched: 0, inserted: 0, before_count: beforeCount, after_count: beforeCount,
        message: "Nada a backfillar.",
      });
    }

    let inserted = 0;
    const errors: string[] = [];
    for (let i = 0; i < cands.length; i += 20) {
      const slice = cands.slice(i, i + 20);
      const texts = slice.map((c) => postToEmbedText(c.post));
      const vecs = await embedTextBatch(texts);
      const rows: any[] = [];
      for (let j = 0; j < slice.length; j++) {
        const v = vecs[j]; if (!v) continue;
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
        const { error } = await admin
          .from("post_embeddings")
          .upsert(rows, { onConflict: "user_id,report_id,week_index,day_index,post_kind" });
        if (error) errors.push(error.message);
        else inserted += rows.length;
      }
    }

    const { count: afterCount } = await admin
      .from("post_embeddings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", targetUserId).eq("post_kind", "feed");

    console.log(`[embed-backfill-partial] user=${targetUserId} weeks_touched=${weeksTouched} candidates=${cands.length} inserted=${inserted} before=${beforeCount} after=${afterCount ?? "?"}`);

    return json({
      ok: true, user_id: targetUserId,
      weeks_touched: weeksTouched, candidates: cands.length,
      inserted, before_count: beforeCount, after_count: afterCount ?? null,
      errors,
    });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
