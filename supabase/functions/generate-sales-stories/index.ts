// Gera uma sequência de stories de venda a partir de um dos 7 templates.
// Requer que o usuário tenha sales_narrative_questionnaires.is_complete = true.
// Consome 1 crédito do pool 'regeneration' (reaproveitado no MVP).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "../_shared/cors.ts";
import { callClaude, ClaudeError } from "../_shared/claudeClient.ts";
import { extractJsonFromLLM } from "../_shared/jsonExtract.ts";
import { verifyWorkspaceOwnership } from "../_shared/workspaceAuth.ts";
import { fetchWorkspaceBrandType } from "../_shared/buildClaudeContext.ts";
import {
  buildSalesStorySystemPrompt,
  SALES_SEQUENCE_TYPES,
  SEQUENCE_LENGTHS,
  buildSalesStoryUserPrompt,
  type SalesSequenceType,
  type SalesNarrative,
} from "../_shared/salesStoryPrompts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autenticado." }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado." }, 401);

    const body = await req.json().catch(() => null);
    const sequence_type = body?.sequence_type as SalesSequenceType;
    const offer_context = (body?.offer_context || "").toString().trim();
    const workspaceId = typeof body?.workspaceId === "string" ? body.workspaceId : null;

    if (!SALES_SEQUENCE_TYPES.includes(sequence_type)) {
      return json({ error: "Tipo de sequência inválido." }, 400);
    }
    if (offer_context.length < 3 || offer_context.length > 500) {
      return json({ error: "Descreva a oferta (3 a 500 caracteres)." }, 400);
    }

    // workspaceId vem do corpo (input do cliente) — esta função roda com
    // service role e ignora RLS, então a posse precisa ser checada em código.
    if (workspaceId && !(await verifyWorkspaceOwnership(user.id, workspaceId))) {
      return json({ error: "Sem acesso a este perfil." }, 403);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Verifica narrativa preenchida — por PERFIL (fallback por conta pra
    // chamador antigo, embora o frontend hoje sempre envie workspaceId).
    let narrativeQuery = admin.from("sales_narrative_questionnaires").select("*").eq("is_complete", true);
    narrativeQuery = workspaceId ? narrativeQuery.eq("workspace_id", workspaceId) : narrativeQuery.eq("user_id", user.id);
    const { data: narrative } = await narrativeQuery.maybeSingle();

    if (!narrative) {
      return json({
        error: "Preencha o questionário de história de venda antes de gerar stories.",
      }, 400);
    }

    // 2) Contexto adicional opcional — mesmo escopo por perfil.
    let businessQuery = admin.from("business_questionnaires").select("*");
    businessQuery = workspaceId ? businessQuery.eq("workspace_id", workspaceId) : businessQuery.eq("user_id", user.id);
    let personalQuery = admin.from("personal_questionnaires").select("*").eq("status", "submitted");
    personalQuery = workspaceId ? personalQuery.eq("workspace_id", workspaceId) : personalQuery.eq("user_id", user.id);
    const [{ data: business }, { data: personal }] = await Promise.all([
      businessQuery.order("version", { ascending: false }).limit(1).maybeSingle(),
      personalQuery.order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);

    // Tipo de marca do perfil ativo — reenquadra os 7 templates pra falar da
    // empresa em vez de um indivíduo quando institucional.
    const brandType = await fetchWorkspaceBrandType(user.id, workspaceId);

    // 3) Consome crédito (RPC usa auth.uid() do user client)
    const { error: creditErr } = await userClient.rpc("consume_credit", {
      p_credit_type: "regeneration",
      p_amount: -1,
      p_description: `Stories de venda: ${sequence_type}`,
    });
    if (creditErr) {
      const msg = creditErr.message || "";
      if (msg.toLowerCase().includes("insufficient")) {
        return json({
          error: "Créditos de ajuste insuficientes. Adquira mais créditos para gerar novas sequências.",
        }, 402);
      }
      console.error("consume_credit error:", creditErr);
      return json({ error: "Não foi possível reservar o crédito." }, 500);
    }

    // 4) Chama Claude
    const userText = buildSalesStoryUserPrompt({
      narrative: narrative as SalesNarrative,
      business,
      personal,
      sequence_type,
      offer_context,
      brandType,
    });

    let raw: string;
    try {
      raw = await callClaude({
        systemPrompt: buildSalesStorySystemPrompt(brandType),
        userText,
        max_tokens: 3000,
        timeoutMs: 90000,
      });
    } catch (e) {
      const userMsg = e instanceof ClaudeError && e.userMessage
        ? e.userMessage
        : "A IA está instável agora. Tente novamente em alguns minutos.";
      // Crédito já foi consumido. Como o RPC só aceita débito, não há
      // estorno automático no MVP — o usuário reentra na fila se a IA falhar.
      return json({ error: userMsg }, 502);
    }

    const parsed: any = extractJsonFromLLM(raw);
    const stories = Array.isArray(parsed?.stories) ? parsed.stories : null;
    if (!stories || stories.length === 0) {
      console.error("Sales stories: parse falhou. raw:", raw.slice(0, 400));
      return json({
        error: "A IA respondeu de forma incompleta. Tente novamente — você pode regenerar a partir do botão.",
      }, 502);
    }

    // Normaliza
    const expected = SEQUENCE_LENGTHS[sequence_type];
    const normalized = stories
      .map((s: any, i: number) => ({
        ordem: typeof s?.ordem === "number" ? s.ordem : i + 1,
        texto: typeof s?.texto === "string" ? s.texto.trim() : "",
        tipo: ["abertura", "desenvolvimento", "cta"].includes(s?.tipo) ? s.tipo : "desenvolvimento",
      }))
      .filter((s: any) => s.texto.length > 0)
      .slice(0, expected);

    if (normalized.length === 0) {
      return json({ error: "A IA não retornou textos válidos." }, 502);
    }

    // 5) Persiste
    const { data: inserted, error: insertErr } = await admin
      .from("sales_story_sequences")
      .insert({
        user_id: user.id,
        workspace_id: workspaceId,
        sequence_type,
        offer_context,
        stories: normalized,
      })
      .select("*")
      .single();

    if (insertErr) {
      console.error("Insert sequence error:", insertErr);
      return json({ error: "Não foi possível salvar a sequência." }, 500);
    }

    return json({ sequence: inserted }, 200);
  } catch (e) {
    console.error("generate-sales-stories error:", e);
    return json({ error: "Erro inesperado." }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
