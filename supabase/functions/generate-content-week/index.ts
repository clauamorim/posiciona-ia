import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractJsonFromLLM } from "../_shared/jsonExtract.ts";
import { EDITORIAL_GENERATOR_VERSION, isOutdatedVersion } from "../_shared/generatorVersion.ts";
import { sanitizeWeek, countWeekLeaks } from "../_shared/editorialSanitize.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
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

async function callGemini(systemPrompt: string, userContent: any): Promise<string> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 8000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    const err = new Error(`AI API error: ${response.status} - ${errText}`) as Error & {
      status?: number;
      userMessage?: string;
    };
    err.status = response.status;

    if (response.status === 402) {
      err.userMessage = "A geração de conteúdo está temporariamente indisponível. Tente novamente em alguns instantes.";
    } else if (response.status === 429) {
      err.userMessage = "Muitas solicitações ao mesmo tempo. Aguarde um pouco e tente novamente.";
    }

    throw err;
  }

  let data: any;
  try {
    data = await response.json();
  } catch (parseErr) {
    const err = new Error("Resposta vazia da IA") as Error & { status?: number; userMessage?: string };
    err.status = 502;
    err.userMessage = "A IA demorou para responder. Tente novamente em alguns segundos.";
    throw err;
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    const err = new Error("Conteúdo vazio da IA") as Error & { status?: number; userMessage?: string };
    err.status = 502;
    err.userMessage = "A IA demorou para responder. Tente novamente em alguns segundos.";
    throw err;
  }

  return content;
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

    // ===== Paid path: validate credits first; only deduct after successful generation =====
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

    // Build summary of previous content to avoid repetition
    const previousSummary = (previousWeeks || [])
      .flat()
      .map((d: any) => `Dia ${d.day}: ${d.theme} (${d.format})`)
      .join("\n");

    // Build StoryBrand context
    let storybrandContext = "";
    if (storybrand) {
      storybrandContext = `\n\nESTRATÉGIA STORYBRAND DA MARCA (use como base PRINCIPAL para criar conteúdo):
- Herói (Cliente): ${storybrand.hero || ""}
- Guia (Marca): ${storybrand.guide || ""}
- Problema Externo: ${storybrand.external_problem || ""}
- Problema Interno: ${storybrand.internal_problem || ""}
- Problema Filosófico: ${storybrand.philosophical_problem || ""}
- Plano: ${Array.isArray(storybrand.plan) ? storybrand.plan.join(", ") : storybrand.plan || ""}
- CTA: ${storybrand.cta || ""}
- Sucesso: ${storybrand.success || ""}
- Fracasso: ${storybrand.failure || ""}`;
    }

    // Build tone of voice context
    let toneContext = "";
    if (tone_of_voice) {
      toneContext = `\n\nTOM DE VOZ DA MARCA:
- Resumo: ${tone_of_voice.summary || ""}
- Estilo de comunicação: ${tone_of_voice.communication_style || ""}
- Palavras para USAR: ${(tone_of_voice.words_to_use || []).join(", ")}
- Palavras para EVITAR: ${(tone_of_voice.words_to_avoid || []).join(", ")}
- Emoções para evocar: ${(tone_of_voice.emotions_to_evoke || []).join(", ")}`;
    }

    const systemPrompt = `Você é um especialista em branding e copy para Instagram. Você domina e aplica de forma OBRIGATÓRIA três referências (anexadas em PDF como contexto):
1) StoryBrand (Donald Miller) — clareza narrativa.
2) Obviously Awesome (April Dunford) — posicionamento específico (categoria, alternativas rejeitadas, atributos únicos, valor diferenciado para um público específico).
3) Made to Stick (irmãos Heath) — princípios SUCCES (Simples, Inesperado, Concreto, Crível, Emocional, Histórias) para ganchos memoráveis.

Gere EXATAMENTE 7 novos dias de conteúdo editorial, SEM REPETIR temas, abordagens ou formatos dos conteúdos anteriores.

⚠️ CRÍTICO — FORMATO DE SAÍDA: Sua resposta DEVE começar com "[" e terminar com "]". NÃO use \`\`\` em hipótese alguma. NÃO escreva texto, comentário ou explicação antes ou depois do JSON. Não use vírgula final antes de "}" ou "]". Se você adicionar markdown fences ou texto fora do JSON, o sistema REJEITA a resposta.

IMPORTANTE: Responda APENAS com um JSON válido, sem markdown, sem backticks.

REGRA DE LINGUAGEM (CRÍTICA):
StoryBrand, Obviously Awesome e Made to Stick são camadas ESTRATÉGICAS INTERNAS. NUNCA escreva os rótulos dessas metodologias dentro de "theme", "caption", "card_copy", "cta" ou "script". Os campos visíveis devem soar como copy de marketing real, não como template de framework.

PROIBIDO escrever literalmente (em qualquer campo visível):
"Problema Externo", "Problema Interno", "Problema Filosófico", "O Plano", "Chamada à Ação", "Chamada para Ação", "O Sucesso", "O Fracasso", "O Guia", "O Herói", "Sucesso vs Fracasso", "StoryBrand", "Framework", "Etapa do Framework", "Posicionamento", "Categoria", "SUCCES", "Made to Stick", "Obviously Awesome".

Não use prefixos como "Problema Externo: ...", "Plano: ...", "CTA: ...". Apenas escreva o conteúdo direto, em linguagem natural.

NUNCA prefixe os itens de "card_copy" com "Slide 1:", "Slide 2:", "Card 1:", "Página 1:", etc. Cada item do array JÁ É um slide; escreva apenas o conteúdo do slide.

ESTRATÉGIA DE COPY (OBRIGATÓRIA — aplique em TODA caption, card_copy e script):

A) GANCHO ESPECÍFICO DO NICHO (Made to Stick — Inesperado + Concreto):
- A primeira frase de cada caption e o primeiro slide de cada carrossel DEVEM conter um detalhe concreto, número, cena, dado contraintuitivo ou pergunta inesperada — específicos para o NICHO do cliente, não genéricos para "marketing", "vida" ou "negócios".
- PROIBIDO abrir com aberturas genéricas: "Você sabia que…", "5 dicas para…", "A importância de…", "Vamos falar sobre…", "Hoje vou te contar…", "Já parou para pensar…", "Imagine que…", "Você já se perguntou…".

B) POSICIONAMENTO (Obviously Awesome):
- Pelo menos 1 vez por dia, o conteúdo deve evidenciar: a categoria em que a marca atua (com termos do nicho), o que ela NÃO é (alternativa rejeitada) e o valor único entregue ao cliente específico.
- Evite genéricos como "ajudo pessoas a se conectarem com sua melhor versão". Use linguagem do nicho real do cliente.

C) STORYBRAND como espinha dorsal interna:
- Cada dia explora INTERNAMENTE uma faceta (não cite a faceta no texto):
  - Dia 1: Herói (cliente) — desejo + identidade
  - Dia 2: Problema externo — obstáculo prático e visível do nicho
  - Dia 3: Problema interno — frustração emocional específica
  - Dia 4: Marca como guia — empatia + autoridade
  - Dia 5: Plano — passos claros para contratar/aplicar
  - Dia 6: CTA — convocação clara e direta
  - Dia 7: Sucesso vs Fracasso — futuro positivo concreto e custo de não agir

D) ESTRUTURA OBRIGATÓRIA DE CARROSSEL (mínimo 5 slides):
- Slide 1: GANCHO concreto e inesperado, específico do nicho.
- Slide 2: PROBLEMA SENTIDO — descreva uma cena/situação que o cliente do nicho reconhece imediatamente.
- Slides do meio: INSIGHT + PROVA (números, cases, frase de autoridade) ou PASSOS práticos.
- Último slide: CTA específico (não "saiba mais"; algo verbal e claro como "Comente PLANO e te envio o roteiro").

EXEMPLOS DE CALIBRAÇÃO:
- ERRADO (genérico): "Você sabia que ter uma boa imagem é importante para a sua carreira?"
- CERTO (específico para advocacia trabalhista): "8 em cada 10 audiências trabalhistas que perdi no início tinham o mesmo erro: o cliente entrava na sala vestido como se estivesse no churrasco."
- ERRADO (genérico) em CTA: "Saiba mais no link da bio."
- CERTO em CTA: "Comente AUDIÊNCIA e te mando o checklist de postura para o dia do julgamento."
- ERRADO (genérico) abertura de caption: "5 dicas para melhorar seu marketing digital."
- CERTO: "Cliente que não responde no WhatsApp em 3 minutos some. Esse é o tempo que você tem para parar de soar como mais um."

O JSON deve ser um array com 7 objetos:
[
  {
    "day": 1,
    "theme": "...",
    "format": "reels|carrossel|stories|post",
    "caption": "LEGENDA COMPLETA pronta para postar (com gancho específico do nicho na primeira linha)",
    "card_copy": ["texto do slide/card 1", "texto do slide/card 2"],
    "cta": "CTA específico, verbal e direto",
    "script": "ROTEIRO COMPLETO apenas para Reels/Stories, string vazia para post/carrossel"
  }
]

REFORÇO ANTI META-NARRATIVA (CRÍTICO):
Nunca descreva a estratégia em termos teóricos. NÃO escreva frases como "a marca atua como guia do herói", "o herói da história", "a jornada do herói", "plano de 3 passos", "fracasso iminente", "categoria de mercado". Escreva a copy final, como se o leitor nunca tivesse ouvido falar de framework.
- ERRADO: "Como guia, mostramos ao herói o plano para superar o problema interno."
- CERTO: "Em 3 etapas, sua agenda da semana sai do caos para um sistema previsível."

Regras estruturais:
- 7 dias obrigatórios
- Variar formatos ao longo da semana
- Para "post" e "carrossel", "script" DEVE ser ""
- "card_copy": carrossel ≥ 5 slides; post = 1 item; reels/stories = []
- Responda em português brasileiro`;

    const userPrompt = `
Negócio: ${business?.company_name || "Não informado"}
Serviços: ${business?.services || "Não informado"}
Público-alvo: ${business?.target_audience || "Não informado"}
Nicho: ${niche || "Não informado"}
${storybrandContext}${toneContext}

CONTEÚDOS JÁ PUBLICADOS (NÃO REPETIR):
${previousSummary || "Nenhum conteúdo anterior."}

Gere 7 novos dias de conteúdo em JSON.`;

    // Send reference PDFs in EVERY week so the model keeps StoryBrand,
    // Obviously Awesome and Made to Stick as active context across the cycle.
    const pdfParts = await fetchReferencePdfs();

    const userContent: any = pdfParts.length > 0
      ? [
          ...pdfParts.map(p => ({ type: "file", file: { filename: "reference.pdf", file_data: `data:application/pdf;base64,${p.data}` } })),
          { type: "text", text: userPrompt },
        ]
      : userPrompt;

    // Call Gemini with 1 retry on transport error
    let rawContent: string;
    try {
      rawContent = await callGemini(systemPrompt, userContent);
    } catch (firstError) {
      console.error("First Gemini attempt failed, retrying:", firstError);
      rawContent = await callGemini(systemPrompt, userContent);
    }

    let editorial = extractJsonFromLLM(rawContent);
    if (!Array.isArray(editorial) || editorial.length === 0) {
      console.error("Failed to parse AI response:", String(rawContent).substring(0, 500));
      return new Response(
        JSON.stringify({ error: "A IA retornou uma resposta inválida. Tente gerar novamente." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Backend sanitization — strip framework labels from theme/caption/cta/script/card_copy
    let sanitized = sanitizeWeek(editorial as any[]);
    let leaks = countWeekLeaks(sanitized);

    // If sanitized output still "looks like framework", retry once with a stricter system prompt
    if (leaks > 0) {
      console.warn(`Framework leaks detected (${leaks}). Retrying with stricter prompt.`);
      const stricterSystem = systemPrompt +
        `\n\n⚠️ ÚLTIMA TENTATIVA: a resposta anterior continha rótulos PROIBIDOS (ex.: "Problema Externo", "StoryBrand", "Framework"). REESCREVA tudo em copy direta de marketing. ZERO rótulos estruturais visíveis.`;
      try {
        const retryRaw = await callGemini(stricterSystem, userContent);
        const retryParsed = extractJsonFromLLM(retryRaw);
        if (Array.isArray(retryParsed) && retryParsed.length > 0) {
          const retrySanitized = sanitizeWeek(retryParsed as any[]);
          if (countWeekLeaks(retrySanitized) < leaks) {
            sanitized = retrySanitized;
            leaks = countWeekLeaks(retrySanitized);
          }
        }
      } catch (retryErr) {
        console.error("Stricter retry failed:", retryErr);
      }
    }

    // Stamp every day with the current generator version so we can later
    // detect outdated content and offer free regeneration.
    const stamped = sanitized.map((d: any) => ({
      ...d,
      generator_version: EDITORIAL_GENERATOR_VERSION,
    }));

    const { error: creditError } = await supabase
      .from("user_balances")
      .update({ weekly_cycles: balanceData.weekly_cycles - 1 })
      .eq("user_id", user.id)
      .eq("weekly_cycles", balanceData.weekly_cycles);

    if (creditError) {
      console.error("Credit deduction failed:", creditError);
      return new Response(JSON.stringify({ error: "Não foi possível reservar seu ciclo semanal. Tente novamente." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ editorial: stamped, generator_version: EDITORIAL_GENERATOR_VERSION }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-content-week error:", error);
    const status = typeof (error as any)?.status === "number" ? (error as any).status : 500;
    const message = typeof (error as any)?.userMessage === "string" && (error as any).userMessage.trim()
      ? (error as any).userMessage
      : error instanceof Error
        ? error.message
        : "Erro inesperado";
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
