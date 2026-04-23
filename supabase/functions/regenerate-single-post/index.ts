import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function fetchReferencePdfs(): Promise<{ mime_type: string; data: string }[]> {
  try {
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: docs } = await supabaseAdmin
      .from("reference_documents")
      .select("file_path, file_size")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(5);
    if (!docs?.length) return [];

    const parts: { mime_type: string; data: string }[] = [];
    let totalSize = 0;
    const MAX_TOTAL = 8 * 1024 * 1024;

    for (const doc of docs) {
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
    const { format, theme, dayNumber, business, niche, existingPosts, storybrand, tone_of_voice } = await req.json();

    if (!format || !business) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingTitles = (existingPosts || []).map((p: any) => `- ${p.theme}: ${p.caption?.substring(0, 80)}`).join("\n");

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

    const systemPrompt = `Você é um especialista em conteúdo para Instagram, usando exclusivamente a metodologia StoryBrand. Gere UM ÚNICO post novo.

IMPORTANTE: Responda APENAS com um JSON válido, sem markdown, sem backticks.

REGRA DE LINGUAGEM (CRÍTICA):
O StoryBrand é uma camada ESTRATÉGICA INTERNA. NUNCA escreva os rótulos do framework dentro de "theme", "caption", "card_copy", "cta" ou "script". Os campos visíveis devem soar como copy de marketing real, não como template.

PROIBIDO escrever literalmente (em qualquer campo visível):
"Problema Externo", "Problema Interno", "Problema Filosófico", "O Plano", "Chamada à Ação", "Chamada para Ação", "O Sucesso", "O Fracasso", "O Guia", "O Herói", "Sucesso vs Fracasso", "StoryBrand", "Framework", "Etapa do Framework".

Não use prefixos como "Problema Externo: ...", "Plano: ...", "CTA: ...". Apenas escreva o conteúdo direto, em linguagem natural.

Exemplos:
- ERRADO: "Problema Externo: Desvendando o Emaranhado do Conflito"
- CERTO:  "Desvendando o Emaranhado do Conflito"
- ERRADO em cta: "Chamada à Ação: Agende sua sessão hoje"
- CERTO em cta: "Agende sua sessão hoje"

NUNCA prefixe os itens de "card_copy" com "Slide 1:", "Slide 2:", "Card 1:", "Página 1:", etc. Cada item do array JÁ É um slide; escreva apenas o conteúdo do slide, sem rótulo posicional.
ERRADO: ["Slide 1: Você também sente que o tempo voa?", "Slide 2: A solução está aqui"]
CERTO:  ["Você também sente que o tempo voa?", "A solução está aqui"]

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
- Use EXCLUSIVAMENTE a estratégia StoryBrand e o tom de voz da marca para guiar o conteúdo
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

    let post: any;
    try {
      const cleaned = rawContent.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      post = JSON.parse(cleaned);
    } catch {
      throw new Error("Failed to parse AI response as JSON");
    }

    return new Response(JSON.stringify({ post }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
