// Backfill one-shot — para cada user (ou um user específico), preenche em
// reports.editorial_weeks[i]._dedup_metrics os campos novos do Dedup v3
// (thesis_summaries, audience_qualification_scores, extracted_brands_by_day,
// extracted_frameworks_by_day, extracted_opening_forms_by_day) usando Gemini
// Flash Lite, para semanas geradas ANTES do v3.
//
// Uso (admin / service-role):
//   POST /functions/v1/dedup-backfill-thesis
//   body: { "user_id"?: string, "dry_run"?: boolean }
//
// Idempotente: pula semanas que já têm `_dedup_metrics.thesis_summaries` E
// `extracted_brands_by_day` definidos.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractJsonFromLLM } from "../_shared/jsonExtract.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const FEED_DAYS = [1, 3, 5, 7];

type ExtractedDay = {
  day: number;
  brands: string[];
  frameworks: string[];
  opening_forms: string[];
  thesis_summary: string;
  audience_qualification_score: number;
};

function postText(p: any): string {
  if (!p) return "";
  const parts: string[] = [];
  if (p.theme) parts.push(`Tema: ${p.theme}`);
  if (p.caption) parts.push(`Caption: ${p.caption}`);
  if (Array.isArray(p.card_copy) && p.card_copy.length > 0) {
    parts.push(`Cards: ${p.card_copy.join(" || ")}`);
  }
  if (p.script) parts.push(`Script: ${p.script}`);
  if (p.cta) parts.push(`CTA: ${p.cta}`);
  return parts.join("\n").trim();
}

async function extractWeek(weekDays: any[]): Promise<ExtractedDay[]> {
  const feedPosts = weekDays
    .map((d: any) => d?.feed)
    .filter((p: any) => p && FEED_DAYS.includes(Number(p.day)) && (p.theme || p.caption));
  if (feedPosts.length === 0) return [];

  const userBlock = feedPosts
    .map((p: any) => `## Dia ${p.day}\n${postText(p).slice(0, 900)}`)
    .join("\n\n");

  const system =
    "Você extrai padrões repetitivos de posts de redes sociais em português. " +
    "Para CADA dia listado, identifique: " +
    "(1) brands — marcas/produtos/autores/livros citados nominalmente OU por descrição inequívoca. " +
    "NORMALIZAÇÃO: 'Strunk & White', 'Elements of Style' → 'Strunk & White'. " +
    "Use o nome canônico mais reconhecido. " +
    "(2) frameworks — estruturas numéricas/metodológicas (ex.: 'método de 4 cortes' → 'método de N elementos'). " +
    "(3) opening_forms — fôrmas narrativas de abertura recorrentes. " +
    "Trate 'A [crença/regra/ideia/conselho] de X está Y' como UMA fôrma única. " +
    "(4) thesis_summary — UMA frase em pt-BR no formato '[sujeito] [verbo] [consequência]'. " +
    "(5) audience_qualification_score — 0.0 a 1.0 indicando se é sobre 'quem é meu cliente ideal vs quem não é'. " +
    "Retorne APENAS um JSON array, sem markdown: " +
    '[{"day": N, "brands": [], "frameworks": [], "opening_forms": [], "thesis_summary": "...", "audience_qualification_score": 0.0}].';

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: system },
        { role: "user", content: userBlock },
      ],
    }),
  });
  if (!resp.ok) {
    throw new Error(`gateway ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  }
  const j = await resp.json();
  const raw = String(j?.choices?.[0]?.message?.content || "");
  const parsed = extractJsonFromLLM(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((t: any) => t && Number.isFinite(Number(t.day)))
    .map((t: any) => ({
      day: Number(t.day),
      brands: Array.isArray(t.brands) ? t.brands.map(String) : [],
      frameworks: Array.isArray(t.frameworks) ? t.frameworks.map(String) : [],
      opening_forms: Array.isArray(t.opening_forms) ? t.opening_forms.map(String) : [],
      thesis_summary: typeof t.thesis_summary === "string" ? t.thesis_summary : "",
      audience_qualification_score: Math.max(
        0,
        Math.min(1, Number(t.audience_qualification_score) || 0),
      ),
    }));
}

async function backfillUser(userId: string, dryRun: boolean) {
  const { data: report, error } = await admin
    .from("reports")
    .select("id, version, editorial_weeks")
    .eq("user_id", userId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !report) return { user_id: userId, weeks_processed: 0, skipped: 0, error: error?.message || "no_report" };

  const weeks: any[] = Array.isArray(report.editorial_weeks) ? report.editorial_weeks : [];
  let processed = 0;
  let skipped = 0;
  const updated = [...weeks];

  for (let i = 0; i < updated.length; i++) {
    const w = updated[i];
    if (!w || typeof w !== "object") { skipped++; continue; }
    const dm = w._dedup_metrics || {};
    const hasThesis = dm.thesis_summaries && Object.keys(dm.thesis_summaries).length > 0;
    const hasBrands = dm.extracted_brands_by_day && Object.keys(dm.extracted_brands_by_day).length > 0;
    if (hasThesis && hasBrands) { skipped++; continue; }
    if (!Array.isArray(w.days)) { skipped++; continue; }

    try {
      const targets = await extractWeek(w.days);
      if (targets.length === 0) { skipped++; continue; }
      const thesis_summaries: Record<number, string> = { ...(dm.thesis_summaries || {}) };
      const audience_qualification_scores: Record<number, number> = {
        ...(dm.audience_qualification_scores || {}),
      };
      const extracted_brands_by_day: Record<number, string[]> = {
        ...(dm.extracted_brands_by_day || {}),
      };
      const extracted_frameworks_by_day: Record<number, string[]> = {
        ...(dm.extracted_frameworks_by_day || {}),
      };
      const extracted_opening_forms_by_day: Record<number, string[]> = {
        ...(dm.extracted_opening_forms_by_day || {}),
      };
      for (const t of targets) {
        if (t.thesis_summary) thesis_summaries[t.day] = t.thesis_summary;
        audience_qualification_scores[t.day] = t.audience_qualification_score;
        extracted_brands_by_day[t.day] = t.brands;
        extracted_frameworks_by_day[t.day] = t.frameworks;
        extracted_opening_forms_by_day[t.day] = t.opening_forms;
      }
      updated[i] = {
        ...w,
        _dedup_metrics: {
          ...dm,
          thesis_summaries,
          audience_qualification_scores,
          extracted_brands_by_day,
          extracted_frameworks_by_day,
          extracted_opening_forms_by_day,
          backfilled: true,
          backfill_ts: new Date().toISOString(),
        },
      };
      processed++;
      // throttle leve
      await new Promise((r) => setTimeout(r, 300));
    } catch (e: any) {
      console.warn(`[backfill] user=${userId} week_idx=${w._week_index ?? i} error:`, e?.message || e);
      skipped++;
    }
  }

  if (processed > 0 && !dryRun) {
    await admin.from("reports").update({ editorial_weeks: updated }).eq("id", report.id);
  }

  return { user_id: userId, report_id: report.id, weeks_processed: processed, skipped, dry_run: dryRun };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;
    const singleUser = typeof body?.user_id === "string" ? body.user_id : null;

    const targets: string[] = [];
    if (singleUser) {
      targets.push(singleUser);
    } else {
      const { data } = await admin
        .from("reports")
        .select("user_id")
        .eq("status", "completed");
      const seen = new Set<string>();
      for (const r of data || []) {
        if (r.user_id && !seen.has(r.user_id)) {
          seen.add(r.user_id);
          targets.push(r.user_id);
        }
      }
    }

    const results: any[] = [];
    let totalProcessed = 0;
    for (const u of targets) {
      const r = await backfillUser(u, dryRun);
      results.push(r);
      totalProcessed += r.weeks_processed || 0;
      console.log(`[dedup-backfill] user=${u} weeks_processed=${r.weeks_processed} skipped=${r.skipped}`);
    }

    const costEstimate = totalProcessed * 0.0008; // Flash Lite ~$0.0008/call
    console.log(`[dedup-backfill] total_users=${targets.length} total_weeks=${totalProcessed} cost_estimate=$${costEstimate.toFixed(4)}`);

    return new Response(
      JSON.stringify({ users: targets.length, total_weeks_processed: totalProcessed, cost_estimate_usd: costEstimate, dry_run: dryRun, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("dedup-backfill-thesis error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
