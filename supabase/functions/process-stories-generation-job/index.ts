// process-stories-generation-job
//
// Worker de RECUPERAÇÃO: gera APENAS as 7 stories (Estágio B) de uma semana
// que ficou parcial — feed entregue, stories falharam por instabilidade do
// modelo. Recebe { week_index, report_id }, lê o feed já salvo e atualiza
// in-place a entrada em reports.editorial_weeks[week_index].
//
// NÃO desconta crédito (o ciclo já foi cobrado quando o feed foi entregue).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractJsonFromLLM } from "../_shared/jsonExtract.ts";
import { EDITORIAL_GENERATOR_VERSION } from "../_shared/generatorVersion.ts";
import { sanitizeStory } from "../_shared/editorialSanitize.ts";
import { callClaudeWithMeta } from "../_shared/claudeClient.ts";
import {
  fetchWorkspaceBrandType,
  fetchPersonalQuestionnaire,
  renderPersonalContext,
  fetchSalesNarrative,
  renderSalesNarrativeContext,
  renderStorybrandBlock,
  renderToneBlock,
  renderEditorialFrameworks,
  renderVerifiableFactsBlock,
} from "../_shared/buildClaudeContext.ts";
import { renderPillarsBlock } from "../_shared/editorialPillars.ts";
import { NARRATIVE_PRINCIPLES_BLOCK } from "../_shared/narrativePrinciples.ts";
import {
  detectProfession,
  getEthicalRulesBlock,
  renderMarketTrendsBlock,
  POSITIONING_GUARDRAIL_BLOCK,
  type MarketTrend,
} from "../_shared/professionRules.ts";
import {
  FEED_DAYS,
  buildStoriesSystemPrompt,
  extractPartialDayObjects,
  type StoryDay,
} from "../_shared/storiesPromptBuilder.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface FeedPostLite {
  day: number;
  format?: string;
  pillar?: string;
  theme?: string;
  is_personal?: boolean;
  caption?: string;
  card_copy?: string[];
  cta?: string;
  script?: string;
}

function extractFeedFromWeek(week: any): FeedPostLite[] {
  const days = Array.isArray(week?.days) ? week.days : [];
  const out: FeedPostLite[] = [];
  for (const d of days) {
    if (d && d.feed && typeof d.feed === "object") {
      out.push({ day: Number(d.feed.day || d.day), ...d.feed });
    }
  }
  return out;
}

async function callStoriesWithRetry(
  systemPrompt: string,
  userText: string,
  log: (msg: string) => void,
): Promise<{ text: string; stopReason?: string; attempts: number }> {
  const MAX_ATTEMPTS = 3;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await callClaudeWithMeta({
        systemPrompt,
        userText,
        model: "claude-opus-4-7",
        max_tokens: 7000,
        timeoutMs: 150000,
        disableRetries: true,
      });
      return { text: res.text, stopReason: res.stopReason, attempts: attempt };
    } catch (err) {
      lastErr = err;
      log(`tentativa ${attempt}/${MAX_ATTEMPTS} falhou: ${(err as any)?.message || err}`);
      if (attempt < MAX_ATTEMPTS) {
        const backoff = 2000 * attempt; // 2s, 4s
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }
  throw lastErr;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Não autorizado" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => null);
    const reportId = typeof body?.report_id === "string" ? body.report_id : null;
    const weekIndex = typeof body?.week_index === "number" ? body.week_index : NaN;
    if (!reportId || !Number.isInteger(weekIndex) || weekIndex < 0) {
      return json({ error: "Parâmetros inválidos: report_id e week_index são obrigatórios." }, 400);
    }

    const { data: report, error: reportErr } = await admin
      .from("reports")
      .select("id, user_id, workspace_id, content, editorial_weeks, version")
      .eq("id", reportId)
      .single();
    if (reportErr || !report) return json({ error: "Relatório não encontrado." }, 404);
    if (report.user_id !== userId) return json({ error: "Acesso negado." }, 403);
    const workspaceId = report.workspace_id as string | undefined;

    const weeks: any[] = Array.isArray(report.editorial_weeks) ? report.editorial_weeks : [];
    const arrayPos = weeks.findIndex((w: any) =>
      (w?._week_index ?? w?.week_index) === weekIndex
    );
    if (arrayPos < 0) {
      return json({ error: `Semana com _week_index=${weekIndex} não encontrada.` }, 404);
    }
    const week = weeks[arrayPos];
    const isRecoverable = week._partial === true || week._stage_b_failed === true;
    if (!isRecoverable) {
      return json({ error: "Esta semana não está em estado recuperável" }, 400);
    }

    const feed = extractFeedFromWeek(week);
    if (feed.length === 0) {
      return json({ error: "Esta semana não tem feed salvo para gerar stories." }, 400);
    }

    // Stories pessoais de fim de semana de OUTRAS semanas — para anti-repetição
    // do cenário/figura/ritual (haras, varanda, biografia da avó, etc.).
    const previousPersonalStoryItems: string[] = [];
    for (const w of weeks) {
      const wkIdx = w?._week_index ?? w?.week_index;
      if (wkIdx === weekIndex) continue; // pula a semana atual
      const days = Array.isArray(w?.days) ? w.days : [];
      for (const d of days) {
        const story = d?.story;
        if (story && typeof story.theme === "string" && story.theme.trim() && !story.mirrors_feed) {
          const dayN = typeof d?.day === "number" ? d.day : null;
          const labelDia = dayN === 6 ? "sábado" : dayN === 7 ? "domingo" : dayN === 5 ? "sexta" : `dia${dayN ?? "?"}`;
          previousPersonalStoryItems.push(`[story-${labelDia}] ${story.theme.trim()}`);
        }
      }
    }
    const previousPersonalStoriesSummary = previousPersonalStoryItems.slice(-10).join("\n");

    console.log(`[stories-only] week=${weekIndex} user=${userId} status=start feed_days=${feed.length} prev_personal_stories=${previousPersonalStoryItems.length}`);

    // Reúne contexto necessário para o prompt do Estágio B — escopado pelo
    // PERFIL (workspace) do relatório, não pela conta inteira.
    let bqQuery = admin.from("business_questionnaires").select("*");
    bqQuery = workspaceId ? bqQuery.eq("workspace_id", workspaceId) : bqQuery.eq("user_id", userId);
    const [{ data: bq }, { data: profileRow }] = await Promise.all([
      bqQuery.order("version", { ascending: false }).limit(1).maybeSingle(),
      workspaceId
        ? admin.from("workspaces").select("profession, niche").eq("id", workspaceId).maybeSingle()
        : admin.from("profiles").select("profession, niche").eq("user_id", userId).maybeSingle(),
    ]);

    let storybrand: any = null;
    let toneOfVoice: any = null;
    try {
      const c = report.content;
      const parsed = typeof c === "string" ? JSON.parse(c) : c;
      if (parsed && typeof parsed === "object") {
        storybrand = parsed.storybrand || null;
        toneOfVoice = parsed.tone_of_voice || null;
      }
    } catch { /* ignora */ }

    const brandType = await fetchWorkspaceBrandType(userId, workspaceId);
    const personal = await fetchPersonalQuestionnaire(userId, workspaceId);
    const personalContext = renderPersonalContext(personal, brandType);
    const salesNarrative = await fetchSalesNarrative(userId, workspaceId);
    const salesNarrativeContext = renderSalesNarrativeContext(salesNarrative, brandType);
    const verifiableFactsBlock = renderVerifiableFactsBlock(bq);
    const storybrandContext = renderStorybrandBlock(storybrand);
    const toneContext = renderToneBlock(toneOfVoice);

    const professionCategory = detectProfession({
      profession: profileRow?.profession,
      niche: profileRow?.niche,
      business_description: [bq?.services, bq?.target_audience, bq?.company_name]
        .filter((v: any) => typeof v === "string" && v.trim())
        .join(" "),
    });
    const ethicalBlock = getEthicalRulesBlock(professionCategory);

    // Tendências de mercado (best-effort)
    let marketTrends: MarketTrend[] = [];
    try {
      const trendsRes = await admin.functions.invoke("fetch-market-trends", {
        body: {
          profession: profileRow?.profession || "",
          niche: profileRow?.niche || "",
        },
      });
      const td = trendsRes?.data as any;
      if (td && Array.isArray(td.trends)) marketTrends = td.trends as MarketTrend[];
    } catch (e) {
      console.warn(`[stories-only] week=${weekIndex} fetch-market-trends falhou:`, (e as any)?.message || e);
    }
    const marketTrendsBlock = renderMarketTrendsBlock(marketTrends);

    const feedSummary = feed
      .map((p) => `Dia ${p.day} (${p.format || "post"}${p.pillar ? `, pilar=${p.pillar}` : ""}${p.is_personal ? ", pessoal" : ""}): ${p.theme || ""}`)
      .join("\n");

    const systemPrompt =
      NARRATIVE_PRINCIPLES_BLOCK +
      POSITIONING_GUARDRAIL_BLOCK +
      ethicalBlock +
      "\n\n" +
      buildStoriesSystemPrompt(
        feedSummary,
        FEED_DAYS,
        undefined,
        previousPersonalStoriesSummary,
        brandType,
      ) +
      renderPillarsBlock() +
      renderEditorialFrameworks();

    const userText = `# NEGÓCIO
Empresa: ${bq?.company_name || "Não informado"}
Serviços: ${bq?.services || "Não informado"}
Público-alvo: ${bq?.target_audience || "Não informado"}
Nicho: ${profileRow?.niche || "Não informado"}${verifiableFactsBlock}${storybrandContext}${toneContext}${personalContext}${salesNarrativeContext}${marketTrendsBlock}

Gere agora os 7 stories da semana.`;

    let raw: string;
    let stopReason: string | undefined;
    let attempts = 0;
    try {
      const res = await callStoriesWithRetry(systemPrompt, userText, (m) =>
        console.warn(`[stories-only] week=${weekIndex} user=${userId} ${m}`),
      );
      raw = res.text;
      stopReason = res.stopReason;
      attempts = res.attempts;
    } catch (err: any) {
      console.error(`[stories-only] week=${weekIndex} user=${userId} status=failure attempts=3 err=${err?.message || err}`);
      return json({
        error: "A IA está instável agora. Tente novamente em alguns minutos.",
      }, 502);
    }

    let parsed: any = extractJsonFromLLM(raw);
    if (!Array.isArray(parsed) || parsed.length === 0 || stopReason === "max_tokens") {
      const partial = extractPartialDayObjects(raw);
      if (partial.length >= 4) {
        parsed = partial;
      } else if (Array.isArray(parsed) && parsed.length > 0) {
        // mantém o que veio
      } else {
        console.error(`[stories-only] week=${weekIndex} user=${userId} status=failure attempts=${attempts} reason=parse_empty stop=${stopReason}`);
        return json({
          error: "A IA respondeu de forma incompleta. Tente novamente em instantes.",
        }, 502);
      }
    }

    const byDay = new Map<number, StoryDay>();
    for (const s of parsed) {
      if (!s || typeof s !== "object") continue;
      const dayN = Number((s as any).day);
      if (dayN < 1 || dayN > 7) continue;
      const cleaned = sanitizeStory(s as Record<string, any>) as StoryDay;
      cleaned.day = dayN;
      cleaned.is_personal = Boolean((cleaned as any).is_personal);
      cleaned.mirrors_feed = FEED_DAYS.includes(dayN);
      if (!Array.isArray(cleaned.frames)) cleaned.frames = [];
      byDay.set(dayN, cleaned);
    }
    const storiesFinal: StoryDay[] = [1, 2, 3, 4, 5, 6, 7].map((d) => {
      const ex = byDay.get(d);
      if (ex) return ex;
      return {
        day: d,
        theme: "Story a definir",
        frames: [],
        is_personal: !FEED_DAYS.includes(d),
        mirrors_feed: FEED_DAYS.includes(d),
      };
    });

    // Atualiza a entrada da semana in-place
    const { data: freshReport } = await admin
      .from("reports")
      .select("editorial_weeks")
      .eq("id", reportId)
      .single();
    const freshWeeks: any[] = Array.isArray(freshReport?.editorial_weeks) ? freshReport!.editorial_weeks : [];
    const arrayPosFresh = freshWeeks.findIndex((w: any) =>
      (w?._week_index ?? w?.week_index) === weekIndex
    );
    if (arrayPosFresh < 0) {
      return json({ error: "Semana sumiu durante a geração. Recarregue a página." }, 409);
    }
    const target = freshWeeks[arrayPosFresh];

    const days = Array.isArray(target.days) ? target.days : [];
    const storyByDay = new Map(storiesFinal.map((s) => [s.day, s]));
    const updatedDays = [1, 2, 3, 4, 5, 6, 7].map((d, i) => {
      const existing = days[i] || { day: d, feed: null };
      return {
        ...existing,
        day: existing.day || d,
        story: storyByDay.get(d) ?? existing.story ?? {
          day: d,
          theme: "",
          frames: [],
          is_personal: !FEED_DAYS.includes(d),
          mirrors_feed: FEED_DAYS.includes(d),
        },
        generator_version: EDITORIAL_GENERATOR_VERSION,
      };
    });

    const updatedWeek: any = { ...target, days: updatedDays };
    delete updatedWeek._partial;
    delete updatedWeek._stage_b_failed;
    delete updatedWeek.error_message;

    const newWeeks = [...freshWeeks];
    newWeeks[arrayPosFresh] = updatedWeek;

    const { error: updateErr } = await admin
      .from("reports")
      .update({ editorial_weeks: newWeeks })
      .eq("id", reportId);
    if (updateErr) {
      console.error(`[stories-only] week=${weekIndex} user=${userId} status=failure attempts=${attempts} reason=db_update err=${updateErr.message}`);
      return json({ error: "Não foi possível salvar os stories. Tente novamente." }, 500);
    }

    console.log(`[stories-only] week=${weekIndex} user=${userId} status=success attempts=${attempts}`);

    return json({
      ok: true,
      week_index: weekIndex,
      stories: storiesFinal,
      attempts,
    }, 200);
  } catch (err: any) {
    console.error("process-stories-generation-job error:", err);
    return json({ error: err?.message || "Erro inesperado" }, 500);
  }
});
