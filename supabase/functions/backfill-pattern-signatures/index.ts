// Backfill manual de pattern signatures pras últimas 8 semanas de um usuário.
// Sem rota pública — só callable pelo admin via curl com service-role key.
//
// Uso:
//   curl -X POST https://<PROJECT>.supabase.co/functions/v1/backfill-pattern-signatures \
//     -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
//     -H "Content-Type: application/json" \
//     -d '{"user_email": "claudiacomput@hotmail.com"}'
//
// Ou pelo user_id:
//   -d '{"user_id": "<uuid>"}'
//
// Custo: ~8 chamadas Haiku × $0.01 = $0.08 por usuário.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractSignaturesForWeek } from "../_shared/patternSignature.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Exige service-role key no Authorization. Não tem auth de usuário comum.
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token !== SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let userId: string | null = body?.user_id || null;
  if (!userId && body?.user_email) {
    const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const match = users?.users?.find((u) => u.email?.toLowerCase() === String(body.user_email).toLowerCase());
    if (!match) {
      return new Response(JSON.stringify({ error: "User not found by email" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = match.id;
  }
  if (!userId) {
    return new Response(JSON.stringify({ error: "Provide user_id or user_email" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Busca relatório alvo (mais recente, completed) e suas editorial_weeks
  const { data: report, error: repErr } = await admin
    .from("reports")
    .select("id, editorial_weeks")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (repErr || !report) {
    return new Response(JSON.stringify({ error: "Report not found", details: repErr?.message }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const weeks: any[] = Array.isArray(report.editorial_weeks) ? [...report.editorial_weeks] : [];
  if (weeks.length === 0) {
    return new Response(JSON.stringify({ message: "Nenhuma semana para backfill", processed: 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Pega últimas 8
  const startIdx = Math.max(0, weeks.length - 8);
  const summary: Array<{ weekIndex: number; status: string; signatures?: number; error?: string }> = [];

  for (let i = startIdx; i < weeks.length; i++) {
    const week = weeks[i];
    const wkIdx = (week as any)?._week_index ?? (week as any)?.week_index ?? i;
    const meta = (week as any)?._dedup_metrics || {};

    if (Array.isArray(meta._pattern_signatures) && meta._pattern_signatures.length > 0) {
      summary.push({ weekIndex: wkIdx, status: "skipped_already_has_signatures", signatures: meta._pattern_signatures.length });
      continue;
    }

    // Coleta posts do feed da semana — suporta shapes v5 (array plano) e v6 ({ days: [...] })
    const posts: Array<{ day: number; theme?: string; caption?: string; card_copy?: string[]; script?: string }> = [];
    if (Array.isArray(week)) {
      for (const p of week) {
        if (p && typeof p.day === "number") {
          posts.push({ day: p.day, theme: p.theme, caption: p.caption, card_copy: p.card_copy, script: p.script });
        }
      }
    } else if (week && Array.isArray((week as any).days)) {
      for (const d of (week as any).days) {
        const feed = d?.feed;
        if (feed && typeof d.day === "number") {
          posts.push({ day: d.day, theme: feed.theme, caption: feed.caption, card_copy: feed.card_copy, script: feed.script });
        }
      }
    }

    if (posts.length === 0) {
      summary.push({ weekIndex: wkIdx, status: "skipped_no_posts" });
      continue;
    }

    try {
      const sigs = await extractSignaturesForWeek(posts);
      const updatedMeta = { ...meta, _pattern_signatures: sigs };
      const updatedWeek = {
        ...week,
        _dedup_metrics: updatedMeta,
      };
      weeks[i] = updatedWeek;
      summary.push({ weekIndex: wkIdx, status: "ok", signatures: sigs.length });
    } catch (e: any) {
      summary.push({ weekIndex: wkIdx, status: "failed", error: e?.message || String(e) });
    }

    // Pequena pausa pra não estourar rate limit do Claude
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Persiste de volta no relatório
  const { error: upErr } = await admin
    .from("reports")
    .update({ editorial_weeks: weeks })
    .eq("id", report.id);

  if (upErr) {
    return new Response(JSON.stringify({ error: "Failed to persist", details: upErr.message, summary }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    user_id: userId,
    report_id: report.id,
    total_weeks: weeks.length,
    processed_range: [startIdx, weeks.length - 1],
    summary,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
