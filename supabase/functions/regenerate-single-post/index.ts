// Regenera UM ÚNICO item da semana editorial:
// - target="feed": regenera o post de feed do dia (formato: carrossel|post|reels)
// - target="story": regenera o story do dia (3-5 frames)
// Compatível com o shape v6 (semana = { days: [{day, feed, story}] }).
// Se receber chamada legada (sem target), comporta-se como antes (regenera post inteiro).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractJsonFromLLM } from "../_shared/jsonExtract.ts";
import { EDITORIAL_GENERATOR_VERSION, isOutdatedVersion } from "../_shared/generatorVersion.ts";
import {
  sanitizePost,
  sanitizeStory,
  countFrameworkLeaks,
  countStoryLeaks,
} from "../_shared/editorialSanitize.ts";
import { callClaude, ClaudeError } from "../_shared/claudeClient.ts";
import {
  fetchPersonalQuestionnaire,
  renderPersonalContext,
  renderStorybrandBlock,
  renderToneBlock,
  renderEditorialFrameworks,
  renderVerifiableFactsBlock,
} from "../_shared/buildClaudeContext.ts";
import {
  EDITORIAL_PILLARS,
  renderPillarsBlock,
  isValidPillar,
  type PillarId,
} from "../_shared/editorialPillars.ts";
import { NARRATIVE_PRINCIPLES_BLOCK } from "../_shared/narrativePrinciples.ts";
import {
  detectProfession,
  getEthicalRulesBlock,
  renderMarketTrendsBlock,
  type MarketTrend,
} from "../_shared/professionRules.ts";

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

    const body = await req.json();
    const {
      target,                 // "feed" | "story" (novo) ou undefined (legado)
      format,                 // legado / feed
      theme,
      dayNumber,
      business,
      niche,
      existingPosts,
      siblingFeed,            // contexto do post de feed do mesmo dia (para target=story espelhar)
      storybrand,
      tone_of_voice,
      freeRegeneration,
      currentVersion,
      themeOverride,          // novo: tema sugerido por tendência de mercado (opcional)
      marketTrends,           // novo: tendências já salvas na semana (opcional)
      pillar,                 // novo: pilar do post original (mantém coerência da semana)
    } = body;

    if (!business) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lockedPillar: PillarId | null = isValidPillar(pillar) ? pillar : null;
    const pillarMeta = lockedPillar
      ? EDITORIAL_PILLARS.find((p) => p.id === lockedPillar) || null
      : null;
    const pillarContextBlock = pillarMeta
      ? `\n\n# PILAR DESTE POST (manter coerência com a semana)
Pilar fixo: ${pillarMeta.id} ("${pillarMeta.label}")
${pillarMeta.description}
REGRA: o JSON de saída DEVE conter "pillar": "${pillarMeta.id}". O conteúdo visível ao público NUNCA cita o nome do pilar.`
      : "";

    if (freeRegeneration && !isOutdatedVersion(currentVersion)) {
      return new Response(JSON.stringify({ error: "Este item já está atualizado." }), {
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
    const verifiableFactsBlock = renderVerifiableFactsBlock(business);
    const personal = userId ? await fetchPersonalQuestionnaire(userId) : null;
    const personalContext = renderPersonalContext(personal);

    // Detecta profissão regulamentada para injetar regras éticas (OAB / CFM)
    let professionCategory: ReturnType<typeof detectProfession> = "outro";
    if (userId) {
      try {
        const adminClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const { data: profileRow } = await adminClient
          .from("profiles")
          .select("profession, niche")
          .eq("user_id", userId)
          .maybeSingle();
        professionCategory = detectProfession(profileRow);
      } catch (_e) { /* ignora — fallback "outro" */ }
    }
    const ethicalBlock = getEthicalRulesBlock(professionCategory);
    const marketTrendsBlock = renderMarketTrendsBlock(
      Array.isArray(marketTrends) ? (marketTrends as MarketTrend[]) : [],
    );

    // Tema sugerido por tendência (override opcional)
    const themeOverrideBlock = (typeof themeOverride === "string" && themeOverride.trim().length > 0)
      ? `\n\n# TEMA OBRIGATÓRIO DESTE POST
Use este ângulo de tendência atual como tema: "${themeOverride.trim()}"
Comente com voz própria do criador (não copie). Mantenha posicionamento, ética e estilo da marca.`
      : "";

    // ====== Branch: regenerar STORY ======
    if (target === "story") {
      const mirrorBlock = siblingFeed
        ? `\n\n# POST DE FEED DO MESMO DIA (espelhar tema, NÃO copiar copy)
Tema: ${siblingFeed.theme || ""}
Formato: ${siblingFeed.format || ""}
Resumo: ${(siblingFeed.caption || "").slice(0, 200)}\n
O story DEVE abordar o mesmo tema do post acima, em formato Stories (bastidor, enquete, dúvida, mini-prova, depoimento). NÃO repita a copy do feed.`
        : `\n\nEste dia NÃO tem post no feed — o story é livre. Predominância: pessoal/cotidiano do criador.`;

      const storySystem = `Você é um especialista em copy para Instagram Stories.

Gere UM ÚNICO story para o dia ${dayNumber || 1} da semana.

⚠️ FORMATO DE SAÍDA: começa com "{" e termina com "}". SEM \`\`\`. Sem texto extra.

PROIBIDO escrever rótulos: "Problema Externo", "O Plano", "Chamada à Ação", "O Herói", "StoryBrand", "Framework", "Posicionamento", "Made to Stick", "Obviously Awesome".
NUNCA prefixe frames com "Frame 1:", "Story 1:".

ESTILO: linguagem direta, falada, primeira pessoa. 3 a 5 frames. Use formatos típicos de Stories (enquete, pergunta, slider, depoimento, bastidor).${mirrorBlock}

OUTPUT:
{
  "day": ${dayNumber || 1},
  "theme": "...",
  "frames": ["frame 1", "frame 2", "frame 3"],
  "is_personal": ${siblingFeed ? "false" : "true"},
  "mirrors_feed": ${siblingFeed ? "true" : "false"}
}

Português brasileiro.`;

      const storyUser = `# NEGÓCIO
Empresa: ${business.company_name || ""}
Serviços: ${business.services || ""}
Público: ${business.target_audience || ""}
Nicho: ${niche || ""}${verifiableFactsBlock}${storybrandContext}${toneContext}${personalContext}${marketTrendsBlock}${themeOverrideBlock}

# OUTROS TEMAS DA SEMANA (não repetir)
${existingTitles || "Nenhum"}

Gere o story do dia ${dayNumber || 1}.`;

      const enrichedStorySystem =
        NARRATIVE_PRINCIPLES_BLOCK + ethicalBlock + "\n\n" + storySystem + renderPillarsBlock() + renderEditorialFrameworks();

      let rawStory: string;
      try {
        rawStory = await callClaude({
          systemPrompt: enrichedStorySystem,
          userText: storyUser,
          max_tokens: 1500,
          timeoutMs: 60000,
        });
      } catch (e) {
        const ce = e as ClaudeError;
        return new Response(JSON.stringify({ error: ce.userMessage || "Não foi possível regenerar este story." }), {
          status: ce.status || 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const parsed = extractJsonFromLLM(rawStory);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return new Response(JSON.stringify({ error: "Não foi possível regenerar este story agora." }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let cleanedStory = sanitizeStory(parsed as Record<string, any>);
      let leaks = countStoryLeaks(cleanedStory);
      if (leaks > 0) {
        const stricter = enrichedStorySystem +
          `\n\n⚠️ ÚLTIMA TENTATIVA: a resposta anterior continha rótulos PROIBIDOS. REESCREVA tudo em copy direta.`;
        try {
          const retryRaw = await callClaude({ systemPrompt: stricter, userText: storyUser, max_tokens: 1500, timeoutMs: 50000 });
          const retryParsed = extractJsonFromLLM(retryRaw);
          if (retryParsed && typeof retryParsed === "object" && !Array.isArray(retryParsed)) {
            const retryClean = sanitizeStory(retryParsed as Record<string, any>);
            if (countStoryLeaks(retryClean) < leaks) {
              cleanedStory = retryClean;
              leaks = countStoryLeaks(retryClean);
            }
          }
        } catch (retryErr) {
          console.error("Stricter story retry failed:", retryErr);
        }
      }

      const stamped = {
        ...cleanedStory,
        day: Number(dayNumber || 1),
        mirrors_feed: !!siblingFeed,
        is_personal: cleanedStory.is_personal ?? !siblingFeed,
      };

      return new Response(JSON.stringify({ story: stamped, free: !!freeRegeneration, generator_version: EDITORIAL_GENERATOR_VERSION }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ====== Branch: regenerar FEED (default — também atende chamadas legadas) ======
    if (!format) {
      return new Response(JSON.stringify({ error: "format é obrigatório para regenerar feed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pillarOutputLine = lockedPillar
      ? `  "pillar": "${lockedPillar}",`
      : `  "pillar": "metodo" | "mito" | "mercado" | "caso" | "posicionamento" | "bastidor",`;
    const pillarRequiredRule = lockedPillar
      ? `- O campo "pillar" DEVE ser exatamente "${lockedPillar}" (mantém coerência com a semana).`
      : `- O campo "pillar" é obrigatório, com um dos 6 ids válidos.`;
    const personalRule = lockedPillar
      ? (lockedPillar === "bastidor"
        ? `- Como o pilar é "bastidor", marque is_personal=true e use vivência real do criador (do bloco CONTEXTO PESSOAL). Nunca invente fatos pessoais.`
        : `- Como o pilar NÃO é "bastidor", is_personal DEVE ser false. Não insira menções pessoais, vivências ou rotina do criador.`)
      : `- is_personal=true SOMENTE quando pillar="bastidor". Caso contrário, is_personal=false.`;

    const systemPrompt = `Você é um especialista em copy para Instagram. Aplique de forma OBRIGATÓRIA três frameworks (descritos ao final):
1) StoryBrand — clareza narrativa.
2) Obviously Awesome — posicionamento específico.
3) Made to Stick — princípios SUCCESs.

Gere UM ÚNICO post de feed novo, no formato pedido.

⚠️ FORMATO DE SAÍDA: começa com "{" e termina com "}". SEM \`\`\`. Sem texto extra. Sem vírgula final.

REGRA DE LINGUAGEM:
PROIBIDO escrever em campos visíveis: "Problema Externo", "Problema Interno", "Problema Filosófico", "O Plano", "Chamada à Ação", "Chamada para Ação", "O Sucesso", "O Fracasso", "O Guia", "O Herói", "StoryBrand", "Framework", "Posicionamento", "Categoria", "SUCCES", "Made to Stick", "Obviously Awesome".
NUNCA prefixe card_copy com "Slide 1:", "Card 1:".
Os ids de pilar (metodo, mito, mercado, caso, posicionamento, bastidor) também são INTERNOS — vão no campo "pillar" do JSON, NUNCA aparecem na copy visível.

🟥 SEPARAÇÃO OBRIGATÓRIA — CARD vs LEGENDA:
"caption" e "card_copy" NÃO PODEM ter o mesmo texto.
- "caption" = LEGENDA do Instagram. Longa, com storytelling, ~700-1500 chars.
- "card_copy" = TEXTO DA ARTE (dentro da imagem). CURTO, escaneável.
  • POST: card_copy = [1 string], máx ~22 palavras / 200 chars / 2 frases.
  • CARROSSEL: cada slide ~8 a 18 palavras / 140 chars / máx 2 frases. Mínimo 5 slides.
  • REELS: card_copy = [].
- NUNCA copie a legenda dentro de card_copy.

ESTRATÉGIA:
- Gancho concreto e específico do nicho na primeira frase. PROIBIDO "Você sabia que…", "5 dicas para…", "A importância de…", "Vamos falar sobre…".
- Posicionamento: deixe claro categoria, alternativa rejeitada, valor único.
- Carrossel: Slide 1=gancho curto (≤12 palavras), Slide 2=problema, meio=insight/prova (1 ideia por slide), último=CTA.
- CTA verbal e direto.

ESTRATÉGIA DE PROFUNDIDADE (camadas obrigatórias):
Cada post didático deve ter 3 camadas explícitas dentro da caption:
1. TESE — afirmação clara, contraintuitiva quando possível.
2. EVIDÊNCIA — dado, número, mini-case ou observação retirada LITERALMENTE do bloco FATOS VERIFICÁVEIS. Sem fato pertinente, formule como hipótese sinalizada ("é comum ver...", "imagine um cliente que...") — JAMAIS invente número/case.
3. APLICAÇÃO PRÁTICA — o que o leitor faz amanhã com isso.

HUMANIZAÇÃO: se o post for storytelling pessoal, use vivência REAL do criador (do bloco contexto pessoal). NUNCA invente fatos.

OUTPUT:
{
  "day": ${dayNumber || 1},
${pillarOutputLine}
  "theme": "...",
  "format": "${format}",
  "caption": "LEGENDA COMPLETA, longa (≠ card_copy)",
  "card_copy": ["texto curto do card (NÃO igual à caption)"],
  "cta": "...",
  "script": "...",
  "is_personal": false
}

Regras:
- Tema completamente diferente dos posts existentes
${pillarRequiredRule}
${personalRule}
- Carrossel: card_copy ≥ 5 slides curtos
- Post: card_copy = 1 item curto (≠ caption)
- Reels: card_copy = []
- script: apenas reels tem texto; post/carrossel = ""
- Português brasileiro.

CHECKLIST FINAL:
1. Campo "pillar" presente${lockedPillar ? ` e igual a "${lockedPillar}"` : ""}?
2. is_personal coerente com o pilar (true SOMENTE em "bastidor")?
3. Cada número, case, métrica ou exemplo concreto existe LITERALMENTE no bloco FATOS VERIFICÁVEIS? Se não, foi reescrito como pergunta/hipótese explícita?`;

    const userPrompt = `# NEGÓCIO
Empresa: ${business.company_name || ""}
Serviços: ${business.services || ""}
Público: ${business.target_audience || ""}
Nicho: ${niche || ""}${verifiableFactsBlock}${storybrandContext}${toneContext}${personalContext}${pillarContextBlock}${marketTrendsBlock}${themeOverrideBlock}

# POSTS JÁ EXISTENTES (NÃO REPETIR)
${existingTitles || "Nenhum"}

Gere 1 novo post de feed no formato "${format}".`;

    const enrichedSystemPrompt =
      NARRATIVE_PRINCIPLES_BLOCK + ethicalBlock + "\n\n" + systemPrompt + renderPillarsBlock() + renderEditorialFrameworks();

    let rawContent: string;
    try {
      rawContent = await callClaude({ systemPrompt: enrichedSystemPrompt, userText: userPrompt, max_tokens: 3000, timeoutMs: 90000 });
    } catch (e) {
      const ce = e as ClaudeError;
      return new Response(JSON.stringify({ error: ce.userMessage || "Não foi possível regenerar este post agora." }), {
        status: ce.status || 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        `\n\n⚠️ ÚLTIMA TENTATIVA: a resposta anterior continha rótulos PROIBIDOS. REESCREVA tudo em copy direta.`;
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

    const stampedPost = {
      ...cleaned,
      day: Number(dayNumber || (cleaned as any).day || 1),
      generator_version: EDITORIAL_GENERATOR_VERSION,
    };

    return new Response(JSON.stringify({ post: stampedPost, free: !!freeRegeneration }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("regenerate-single-post error:", error);
    const rawMessage = error instanceof Error ? error.message : "";
    const looksTechnical = /AI API error|fetch failed|JSON|TypeError|SyntaxError|Claude/i.test(rawMessage);
    const message = looksTechnical || !rawMessage
      ? "Não foi possível regenerar este item agora. Tente novamente em alguns segundos."
      : rawMessage;
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
