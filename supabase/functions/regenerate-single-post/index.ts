// Regenera um único post da semana editorial usando Claude.
// 2026-04-25-v5: migrado de Gemini para Claude Sonnet 4.5 + injeção
// obrigatória do contexto pessoal do criador.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractJsonFromLLM } from "../_shared/jsonExtract.ts";
import { EDITORIAL_GENERATOR_VERSION, isOutdatedVersion } from "../_shared/generatorVersion.ts";
import { sanitizePost, countFrameworkLeaks } from "../_shared/editorialSanitize.ts";
import { callClaude, ClaudeError } from "../_shared/claudeClient.ts";
import {
  fetchPersonalQuestionnaire,
  renderPersonalContext,
  renderStorybrandBlock,
  renderToneBlock,
  renderEditorialFrameworks,
} from "../_shared/buildClaudeContext.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      userId = user?.id || null;
    }

    const { format, theme, dayNumber, business, niche, existingPosts, storybrand, tone_of_voice, freeRegeneration, currentVersion } = await req.json();

    if (!format || !business) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (freeRegeneration && !isOutdatedVersion(currentVersion)) {
      return new Response(JSON.stringify({ error: "Este post já está atualizado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingTitles = (existingPosts || [])
      .map((p: any) => p?.theme)
      .filter((t: any) => typeof t === "string" && t.trim().length > 0)
      .map((t: string) => `- ${t}`)
      .join("\n");

    const storybrandContext = renderStorybrandBlock(storybrand);
    const toneContext = renderToneBlock(tone_of_voice);
    const personal = userId ? await fetchPersonalQuestionnaire(userId) : null;
    const personalContext = renderPersonalContext(personal);

    const systemPrompt = `Você é um especialista em copy para Instagram. Aplique de forma OBRIGATÓRIA três frameworks (descritos em detalhe ao final deste prompt):
1) StoryBrand — clareza narrativa.
2) Obviously Awesome (April Dunford) — posicionamento específico do nicho.
3) Made to Stick — princípios SUCCESs (Simples, Inesperado, Concreto, Crível, Emocional, Histórias).

Gere UM ÚNICO post novo, no formato pedido.

⚠️ CRÍTICO — FORMATO DE SAÍDA: Sua resposta DEVE começar com "{" e terminar com "}". NÃO use \`\`\` em hipótese alguma. NÃO escreva texto antes ou depois do JSON. Não use vírgula final antes de "}" ou "]".

REGRA DE LINGUAGEM (CRÍTICA):
StoryBrand, Obviously Awesome e Made to Stick são camadas ESTRATÉGICAS INTERNAS. NUNCA escreva os rótulos do framework dentro de "theme", "caption", "card_copy", "cta" ou "script".

PROIBIDO escrever literalmente: "Problema Externo", "Problema Interno", "Problema Filosófico", "O Plano", "Chamada à Ação", "Chamada para Ação", "O Sucesso", "O Fracasso", "O Guia", "O Herói", "StoryBrand", "Framework", "Posicionamento", "Categoria", "SUCCES", "Made to Stick", "Obviously Awesome".

NUNCA prefixe os itens de "card_copy" com "Slide 1:", "Card 1:", "Página 1:". Cada item JÁ É um slide.

ESTRATÉGIA DE COPY (OBRIGATÓRIA):
- Gancho específico do NICHO do cliente na primeira frase da caption e no slide 1 do carrossel — concreto, com número, cena ou contradição. PROIBIDO abrir com "Você sabia que…", "5 dicas para…", "A importância de…", "Vamos falar sobre…", "Já parou para pensar…".
- Posicionamento específico: deixe claro a categoria, o que a marca NÃO é e o valor único.
- Carrossel: Slide 1 = gancho concreto. Slide 2 = problema sentido. Slides do meio = insight ou prova. Último = CTA verbal e direto.
- CTA específico, com verbo de ação direto.

HUMANIZAÇÃO (quando há contexto pessoal do criador):
- Se este post for do tipo "storytelling pessoal", teça um paralelo entre uma vivência real do criador (do bloco de contexto pessoal) e a dor do cliente-alvo. Modelo: "do tatame ao tribunal".
- Caso contrário, use detalhes pessoais como tempero sutil (vocabulário, exemplos, cenas).
- NUNCA invente fatos pessoais.

EXEMPLOS:
- ERRADO: "Problema Externo: Desvendando o Conflito"
- CERTO:  "Desvendando o Emaranhado do Conflito"
- ERRADO em cta: "Chamada à Ação: Agende sua sessão hoje"
- CERTO em cta: "Comente SESSÃO e te mando os horários disponíveis"
- ERRADO em card_copy: ["Slide 1: Você também sente que o tempo voa?"]
- CERTO: ["3 minutos. É o tempo médio que um cliente leva para decidir se você é amador ou referência."]

O JSON deve seguir EXATAMENTE esta estrutura:
{
  "day": ${dayNumber || 1},
  "theme": "...",
  "format": "${format}",
  "caption": "...",
  "card_copy": ["..."],
  "cta": "...",
  "script": "..."
}

Regras:
- O tema e conteúdo devem ser COMPLETAMENTE DIFERENTES dos posts existentes listados abaixo
- Para "carrossel": card_copy deve ter mínimo 5 slides
- Para "post": card_copy deve ter 1 item com texto visual
- Para "reels"/"stories": card_copy pode ser []
- "script": APENAS para "reels" e "stories" deve ter roteiro completo. Para "post" e "carrossel", DEVE ser ""
- "caption" é a legenda completa pronta para Instagram
- Responda em português brasileiro`;

    const userPrompt = `# NEGÓCIO
Empresa: ${business.company_name || ""}
Serviços: ${business.services || ""}
Público: ${business.target_audience || ""}
Nicho: ${niche || ""}${storybrandContext}${toneContext}${personalContext}

# POSTS JÁ EXISTENTES (NÃO REPETIR)
${existingTitles || "Nenhum"}

Gere 1 novo post no formato "${format}" agora.`;

    // Frameworks como texto denso (substitui PDFs para respeitar rate limit do Claude).
    const enrichedSystemPrompt = systemPrompt + renderEditorialFrameworks();

    let rawContent: string;
    try {
      rawContent = await callClaude({ systemPrompt: enrichedSystemPrompt, userText: userPrompt, max_tokens: 3000, timeoutMs: 90000 });
    } catch (e) {
      const ce = e as ClaudeError;
      const status = ce.status || 502;
      const message = ce.userMessage || "Não foi possível regenerar este post agora. Tente novamente em alguns segundos.";
      return new Response(JSON.stringify({ error: message }), {
        status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const post = extractJsonFromLLM(rawContent);
    if (!post || typeof post !== "object" || Array.isArray(post)) {
      console.error("Falha ao interpretar a resposta da IA:", String(rawContent).substring(0, 500));
      return new Response(
        JSON.stringify({ error: "Não foi possível regenerar este post agora. Tente novamente em alguns segundos." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let cleaned = sanitizePost(post as Record<string, unknown>);
    let leaks = countFrameworkLeaks(cleaned);

    if (leaks > 0) {
      console.warn(`Single-post framework leaks (${leaks}). Retrying stricter.`);
      const stricter = enrichedSystemPrompt +
        `\n\n⚠️ ÚLTIMA TENTATIVA: a resposta anterior continha rótulos PROIBIDOS. REESCREVA tudo em copy direta. ZERO rótulos estruturais visíveis.`;
      try {
        const retryRaw = await callClaude({ systemPrompt: stricter, userText: userPrompt, max_tokens: 3000, timeoutMs: 60000 });
        const retryParsed = extractJsonFromLLM(retryRaw);
        if (retryParsed && typeof retryParsed === "object" && !Array.isArray(retryParsed)) {
          const retryClean = sanitizePost(retryParsed as Record<string, unknown>);
          if (countFrameworkLeaks(retryClean) < leaks) {
            cleaned = retryClean;
            leaks = countFrameworkLeaks(retryClean);
          }
        }
      } catch (retryErr) {
        console.error("Stricter single-post retry failed:", retryErr);
      }
    }

    const stampedPost = { ...cleaned, generator_version: EDITORIAL_GENERATOR_VERSION };

    return new Response(JSON.stringify({ post: stampedPost, free: !!freeRegeneration }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("regenerate-single-post error:", error);
    const rawMessage = error instanceof Error ? error.message : "";
    const looksTechnical = /AI API error|fetch failed|JSON|TypeError|SyntaxError|Claude/i.test(rawMessage);
    const message = looksTechnical || !rawMessage
      ? "Não foi possível regenerar este post agora. Tente novamente em alguns segundos."
      : rawMessage;
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
