// One-shot backfill de embeddings — bypass de auth, uso interno via curl.
// Delete-me após rodar. Recebe { user_id, secret } no body.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { embedTextBatch, postToEmbedText } from "../_shared/embeddings.ts";
import { detectNamedCases } from "../_shared/editorialDiversity.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED = "posiciona-embed-oneshot-2026-07";
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.secret !== SHARED) return json({ error: "forbidden" }, 403);
    const targetUserId: string = body?.user_id;
    if (!targetUserId) return json({ error: "user_id required" }, 400);

    const { data: reports, error: rErr } = await admin
      .from("reports").select("id, editorial_weeks").eq("user_id", targetUserId);
    if (rErr) return json({ error: rErr.message }, 500);

    const { data: existing } = await admin
      .from("post_embeddings").select("report_id, week_index, day_index")
      .eq("user_id", targetUserId).eq("post_kind", "feed");
    const seen = new Set((existing || []).map((e: any) => `${e.report_id}|${e.week_index}|${e.day_index}`));
    const beforeCount = (existing || []).length;

    type Cand = { reportId: string; weekIndex: number; day: number; post: any };
    const cands: Cand[] = [];
    const weekKeys = new Set<string>();
    for (const r of reports || []) {
      const weeks = Array.isArray(r.editorial_weeks) ? r.editorial_weeks : [];
      for (const w of weeks) {
        if (!w || typeof w !== "object") continue;
        const wi = Number((w as any)._week_index ?? (w as any).week_index ?? -1);
        if (wi < 0) continue;
        const days = Array.isArray((w as any).days) ? (w as any).days : [];
        for (const d of days) {
          const feed = d?.feed;
          if (!feed || (!feed.theme && !feed.caption)) continue;
          const dayN = Number(feed.day || d?.day);
          const key = `${r.id}|${wi}|${dayN}`;
          if (seen.has(key)) continue;
          cands.push({ reportId: r.id, weekIndex: wi, day: dayN, post: feed });
          weekKeys.add(`${r.id}|${wi}`);
        }
      }
    }

    if (cands.length === 0) {
      return json({ ok: true, weeks_touched: 0, inserted: 0, before_count: beforeCount, after_count: beforeCount });
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
          user_id: targetUserId, report_id: c.reportId,
          week_index: c.weekIndex, day_index: c.day,
          post_kind: "feed", text_used: texts[j],
          embedding: v, named_cases: named,
        });
      }
      if (rows.length > 0) {
        const { error } = await admin.from("post_embeddings")
          .upsert(rows, { onConflict: "user_id,report_id,week_index,day_index,post_kind" });
        if (error) errors.push(error.message); else inserted += rows.length;
      }
    }

    const { count: afterCount } = await admin
      .from("post_embeddings").select("*", { count: "exact", head: true })
      .eq("user_id", targetUserId).eq("post_kind", "feed");

    return json({ ok: true, weeks_touched: weekKeys.size, candidates: cands.length, inserted, before_count: beforeCount, after_count: afterCount ?? null, errors });
  } catch (e: any) {
    return json({ error: e?.message || String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
