import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { EDITORIAL_GENERATOR_VERSION, isOutdatedVersion } from "../_shared/generatorVersion.ts";
import { sanitizeWeek } from "../_shared/editorialSanitize.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function parseStoredReportContent(rawContent: unknown): Record<string, any> | null {
  if (!rawContent) return null;
  if (typeof rawContent === "object" && rawContent !== null && !Array.isArray(rawContent)) {
    return rawContent as Record<string, any>;
  }
  if (typeof rawContent !== "string") return null;

  try {
    const parsed = JSON.parse(rawContent);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, any>
      : null;
  } catch {
    return null;
  }
}

/** Normaliza nome de arquivo: lowercase, sem acentos, sem espaços/_/-/.pdf */
function normalizeDocName(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\.pdf$/i, "")
    .replace(/[\s_\-.]+/g, "");
}

/** Whitelist exata para análise de IG e geração editorial. */
const EDITORIAL_PDF_WHITELIST = ["storybrand", "madetostick", "obviouslyawesome"];

async function fetchReferencePdfs(): Promise<{ mime_type: string; data: string }[]> {
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: docs } = await supabaseAdmin
      .from("reference_documents")
      .select("file_path, file_size, name")
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (!docs?.length) return [];

    const filtered = docs.filter((d: any) => {
      const candidate = normalizeDocName(d.name || d.file_path?.split("/").pop() || "");
      return EDITORIAL_PDF_WHITELIST.some((w) => candidate.includes(w));
    });
    if (!filtered.length) {
      console.warn("No whitelisted PDFs (StoryBrand/MadeToStick/ObviouslyAwesome) found among active reference documents.");
      return [];
    }

    const parts: { mime_type: string; data: string }[] = [];
    let totalSize = 0;
    const MAX_TOTAL = 8 * 1024 * 1024;

    for (const doc of filtered) {
      if (totalSize + doc.file_size > MAX_TOTAL) break;
      const { data: fileData, error } = await supabaseAdmin.storage
        .from("reference-pdfs")
        .download(doc.file_path);
      if (error || !fileData) continue;
      const arrayBuf = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = "";
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, Math.min(i + CHUNK, bytes.length))));
      }
      const b64 = btoa(binary);
      parts.push({ mime_type: "application/pdf", data: b64 });
      totalSize += doc.file_size;
    }
    return parts;
  } catch (e) {
    console.error("Error fetching reference PDFs:", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { business, niche, previousWeeks, storybrand, tone_of_voice, weekNumber, freeRegeneration, replaceWeekIndex } = await req.json();

    // ===== Free regeneration path: sanitize the saved week without calling the AI =====
    if (freeRegeneration) {
      const { data: reportRow, error: reportError } = await supabase
        .from("reports")
        .select("editorial_weeks, content, version")
        .eq("user_id", user.id)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      if (reportError || !reportRow) {
        return new Response(JSON.stringify({ error: "Relatório não encontrado para atualização gratuita." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const parsedContent = parseStoredReportContent(reportRow.content);
      const structuredArr = Array.isArray(parsedContent?.editorial) ? parsedContent.editorial : [];
      const weeks: any[][] = Array.isArray(reportRow.editorial_weeks) ? reportRow.editorial_weeks : [];
      const allWeeks = [...(structuredArr.length > 0 ? [structuredArr] : []), ...weeks];
      const target = typeof replaceWeekIndex === "number" ? allWeeks[replaceWeekIndex] : null;

      if (!Array.isArray(target) || target.length === 0) {
        return new Response(JSON.stringify({ error: "Semana alvo não encontrada para regeneração gratuita." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isWeekOutdated = target.some((d: any) => isOutdatedVersion(d?.generator_version));
      if (!isWeekOutdated) {
        return new Response(JSON.stringify({ error: "Esta semana já está atualizada." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sanitizedOnly = sanitizeWeek(target as any[]).map((d: any) => ({
        ...d,
        generator_version: EDITORIAL_GENERATOR_VERSION,
      }));

      return new Response(JSON.stringify({ editorial: sanitizedOnly, generator_version: EDITORIAL_GENERATOR_VERSION, sanitized_only: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // ===== Paid path: enfileira um job assíncrono e retorna jobId em <2s =====
    // O processamento pesado (chamada Gemini + sanitização + retry) roda no
    // worker `process-content-generation-job` para não estourar o timeout
    // da Edge Function HTTP.

    const { data: balanceData } = await supabase
      .from("user_balances")
      .select("weekly_cycles")
      .eq("user_id", user.id)
      .single();

    if (!balanceData || balanceData.weekly_cycles < 1) {
      return new Response(JSON.stringify({ error: "Créditos de ciclos semanais insuficientes. Adquira mais créditos para continuar gerando conteúdo." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Localiza o relatório alvo (mais recente, completed)
    const { data: targetReport, error: targetReportErr } = await supabase
      .from("reports")
      .select("id, editorial_weeks")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("version", { ascending: false })
      .limit(1)
      .single();

    if (targetReportErr || !targetReport) {
      return new Response(JSON.stringify({ error: "Relatório não encontrado. Conclua o diagnóstico primeiro." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica se já existe job ativo para o mesmo relatório (evita duplicação)
    const { data: activeJobs } = await supabase
      .from("content_generation_jobs")
      .select("id, status, created_at")
      .eq("user_id", user.id)
      .eq("report_id", targetReport.id)
      .in("status", ["queued", "processing"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (activeJobs && activeJobs.length > 0) {
      const existing = activeJobs[0];
      // Se ainda é recente (<5min), reusa
      const createdAt = new Date(existing.created_at).getTime();
      if (Date.now() - createdAt < 5 * 60 * 1000) {
        return new Response(JSON.stringify({ jobId: existing.id, status: existing.status, reused: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Cria o job
    const currentWeeks: any[][] = Array.isArray(targetReport.editorial_weeks) ? targetReport.editorial_weeks : [];
    const { data: jobInsert, error: jobInsertErr } = await supabase
      .from("content_generation_jobs")
      .insert({
        user_id: user.id,
        report_id: targetReport.id,
        week_index: currentWeeks.length, // próxima posição
        status: "queued",
        progress_message: "Na fila…",
        payload: {
          business: business || null,
          niche: niche || "",
          previousWeeks: previousWeeks || [],
          storybrand: storybrand || null,
          tone_of_voice: tone_of_voice || null,
          weekNumber: weekNumber || (currentWeeks.length + 1),
        },
      })
      .select("id")
      .single();

    if (jobInsertErr || !jobInsert) {
      console.error("Falha ao criar job:", jobInsertErr);
      return new Response(JSON.stringify({ error: "Não foi possível enfileirar a geração. Tente novamente." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jobId = jobInsert.id;

    // Dispara o worker em background (fire-and-forget)
    const workerUrl = `${SUPABASE_URL}/functions/v1/process-content-generation-job`;
    const fireWorker = fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ jobId }),
    }).catch((e) => {
      console.error("Falha ao disparar worker:", e);
    });

    // @ts-ignore — EdgeRuntime existe no runtime Supabase
    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      // @ts-ignore
      EdgeRuntime.waitUntil(fireWorker);
    }

    return new Response(JSON.stringify({ jobId, status: "queued" }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-content-week error:", error);
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 500;
    const userMessage = typeof (error as any)?.userMessage === "string" && (error as any).userMessage.trim()
      ? (error as any).userMessage
      : null;
    const rawMessage = error instanceof Error ? error.message : "";
    // Não vaza mensagens técnicas tipo "AI API error: 500 - ..." para o usuário.
    const looksTechnical = /AI API error|fetch failed|JSON|TypeError|SyntaxError/i.test(rawMessage);
    const message = userMessage
      ?? (looksTechnical || !rawMessage
        ? "Não foi possível gerar a semana agora. Tente novamente em alguns segundos."
        : rawMessage);
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
