import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractJsonFromLLM } from "../_shared/jsonExtract.ts";
import { EDITORIAL_GENERATOR_VERSION, isOutdatedVersion } from "../_shared/generatorVersion.ts";
import { sanitizePost, countFrameworkLeaks } from "../_shared/editorialSanitize.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function normalizeDocName(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\.pdf$/i, "")
    .replace(/[\s_\-.]+/g, "");
}

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
    if (!filtered.length) return [];

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
    const { format, theme, dayNumber, business, niche, existingPosts, storybrand, tone_of_voice, freeRegeneration, currentVersion } = await req.json();

    if (!format || !business) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // When the client asks for a free regeneration, validate server-side
    // that the targeted post was generated with an outdated version.
    if (freeRegeneration && !isOutdatedVersion(currentVersion)) {
      return new Response(JSON.stringify({ error: "Este post já está atualizado." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apenas TEMAS dos posts existentes — nunca caption/script/card_copy,
    // para a IA não "ecoar" tom de voz nem reciclar copy dos posts vizinhos.
    const existingTitles = (existingPosts || [])
      .map((p: any) => p?.theme)
      .filter((t: any) => typeof t === "string" && t.trim().length > 0)
      .map((t: string) => `- ${t}`)
      .join("\n");

    // Build StoryBrand context
    let storybrandContext = "";
    if (storybrand) {
      storybrandContext = `\n\nESTRATÉGIA STORYBRAND DA MARCA (guia EXCLUSIVO do conteúdo):
- Herói (Cliente): ${storybrand.hero || ""}
- Guia (Marca): ${storybrand.guide || ""}
- Problema Externo: ${storybrand.external_problem || ""}
- Problema Interno: ${storybrand.internal_problem || ""}
- CTA: ${storybrand.cta || ""}
- Sucesso: ${storybrand.success || ""}
- Fracasso: ${storybrand.failure || ""}`;
    }

    let toneContext = "";
    if (tone_of_voice) {
      toneContext = `\n\nTOM DE VOZ: ${tone_of_voice.summary || ""}
- Palavras para USAR: ${(tone_of_voice.words_to_use || []).join(", ")}
- Palavras para EVITAR: ${(tone_of_voice.words_to_avoid || []).join(", ")}`;
    }

    const systemPrompt = `Você é um especialista em copy para Instagram. Aplique de forma OBRIGATÓRIA três referências (anexadas em PDF como contexto):
1) StoryBrand — clareza narrativa.
2) Obviously Awesome (April Dunford) — posicionamento específico do nicho.
3) Made to Stick — princípios SUCCES (Simples, Inesperado, Concreto, Crível, Emocional, Histórias).

Gere UM ÚNICO post novo, no formato pedido.

⚠️ CRÍTICO — FORMATO DE SAÍDA: Sua resposta DEVE começar com "{" e terminar com "}". NÃO use \`\`\` em hipótese alguma. NÃO escreva texto antes ou depois do JSON. Não use vírgula final antes de "}" ou "]".

REGRA DE LINGUAGEM (CRÍTICA):
StoryBrand, Obviously Awesome e Made to Stick são camadas ESTRATÉGICAS INTERNAS. NUNCA escreva os rótulos do framework dentro de "theme", "caption", "card_copy", "cta" ou "script".

PROIBIDO escrever literalmente: "Problema Externo", "Problema Interno", "Problema Filosófico", "O Plano", "Chamada à Ação", "Chamada para Ação", "O Sucesso", "O Fracasso", "O Guia", "O Herói", "StoryBrand", "Framework", "Posicionamento", "Categoria", "SUCCES", "Made to Stick", "Obviously Awesome".

NUNCA prefixe os itens de "card_copy" com "Slide 1:", "Card 1:", "Página 1:". Cada item JÁ É um slide.

ESTRATÉGIA DE COPY (OBRIGATÓRIA):
- Gancho específico do NICHO do cliente na primeira frase da caption e no slide 1 do carrossel — concreto, com número, cena ou contradição. PROIBIDO abrir com "Você sabia que…", "5 dicas para…", "A importância de…", "Vamos falar sobre…", "Já parou para pensar…".
- Posicionamento específico: deixe claro a categoria, o que a marca NÃO é e o valor único entregue ao cliente do nicho.
- Carrossel: Slide 1 = gancho concreto. Slide 2 = problema sentido. Slides do meio = insight ou prova. Último = CTA verbal e direto (não "saiba mais").
- CTA específico, com verbo de ação direto.

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
- "script": APENAS para "reels" e "stories" deve ter roteiro completo. Para "post" e "carrossel", DEVE ser string vazia ""
- "caption" é a legenda completa pronta para Instagram
- Responda em português brasileiro`;

    const userPrompt = `Negócio: ${business.company_name || ""}
Serviços: ${business.services || ""}
Público: ${business.target_audience || ""}
Nicho: ${niche || ""}
${storybrandContext}${toneContext}

Posts já existentes (NÃO repita nenhum deles):
${existingTitles || "Nenhum"}

Gere 1 novo post no formato "${format}" agora.`;

    // Fetch reference PDFs
    const pdfParts = await fetchReferencePdfs();

    const userContent: any = pdfParts.length > 0
      ? [
          ...pdfParts.map(p => ({ type: "file", file: { filename: "reference.pdf", file_data: `data:application/pdf;base64,${p.data}` } })),
          { type: "text", text: userPrompt },
        ]
      : userPrompt;

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
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    const post = extractJsonFromLLM(rawContent);
    if (!post || typeof post !== "object" || Array.isArray(post)) {
      console.error("Failed to parse AI response:", String(rawContent).substring(0, 500));
      return new Response(
        JSON.stringify({ error: "A IA retornou uma resposta inválida. Tente gerar novamente." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Backend sanitization
    let cleaned = sanitizePost(post as Record<string, unknown>);
    let leaks = countFrameworkLeaks(cleaned);

    // If still "framework-y", retry once with stricter prompt
    if (leaks > 0) {
      console.warn(`Single-post framework leaks (${leaks}). Retrying stricter.`);
      const stricter = systemPrompt +
        `\n\n⚠️ ÚLTIMA TENTATIVA: a resposta anterior continha rótulos PROIBIDOS. REESCREVA tudo em copy direta. ZERO rótulos estruturais visíveis.`;
      try {
        const retryResp = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: stricter },
              { role: "user", content: userContent },
            ],
            max_tokens: 3000,
          }),
        });
        if (retryResp.ok) {
          const retryData = await retryResp.json();
          const retryRaw = retryData.choices?.[0]?.message?.content || "";
          const retryParsed = extractJsonFromLLM(retryRaw);
          if (retryParsed && typeof retryParsed === "object" && !Array.isArray(retryParsed)) {
            const retryClean = sanitizePost(retryParsed as Record<string, unknown>);
            if (countFrameworkLeaks(retryClean) < leaks) {
              cleaned = retryClean;
              leaks = countFrameworkLeaks(retryClean);
            }
          }
        }
      } catch (retryErr) {
        console.error("Stricter single-post retry failed:", retryErr);
      }
    }

    // Stamp post with current generator version
    const stampedPost = { ...cleaned, generator_version: EDITORIAL_GENERATOR_VERSION };

    return new Response(JSON.stringify({ post: stampedPost, free: !!freeRegeneration }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
