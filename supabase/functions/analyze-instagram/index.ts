import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const BIO_MIN = 130;
const BIO_MAX = 145;
const BIO_HARD_LIMIT = 150;

async function fetchReferencePdfs(): Promise<{ mime_type: string; data: string }[]> {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
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
      const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
      parts.push({ mime_type: "application/pdf", data: b64 });
      totalSize += doc.file_size;
    }
    return parts;
  } catch (e) {
    console.error("Error fetching reference PDFs:", e);
    return [];
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type BioOption = { text: string; char_count: number; rationale?: string };

function smartTruncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:!?-]+$/, "");
  return base + "…";
}

function normalizeBios(bios: any[]): BioOption[] {
  if (!Array.isArray(bios)) return [];
  return bios
    .filter((b) => b && typeof b.text === "string")
    .map((b) => ({
      text: b.text.trim(),
      char_count: b.text.trim().length,
      rationale: typeof b.rationale === "string" ? b.rationale : undefined,
    }));
}

function bioPolicyText(): string {
  return `Para o aspecto Bio do Instagram, gere EXATAMENTE 3 opções no campo bio_options. CADA bio DEVE ter entre ${BIO_MIN} e ${BIO_MAX} caracteres (incluindo espaços, emojis e pontuação). NUNCA ultrapasse ${BIO_HARD_LIMIT} caracteres — o Instagram corta em 150. Conte os caracteres antes de retornar e preencha char_count exato. Bios concisas, claras, com posicionamento forte. Nada de frases vagas ou enchimento.`;
}

async function callAi(messages: any[], LOVABLE_API_KEY: string) {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages,
      tools: [{
        type: "function",
        function: {
          name: "instagram_analysis",
          description: "Retorna a análise do perfil do Instagram",
          parameters: {
            type: "object",
            properties: {
              analysis: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    aspect: { type: "string", description: "Nome do aspecto analisado" },
                    current: { type: "string", description: "Situação atual detectada" },
                    suggestion: { type: "string", description: "Sugestão de melhoria baseada em StoryBrand e arquétipos" },
                  },
                  required: ["aspect", "current", "suggestion"],
                },
              },
              bio_options: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                description: `3 opções de bio. Cada uma entre ${BIO_MIN} e ${BIO_MAX} chars, máx ${BIO_HARD_LIMIT}.`,
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string", description: `Bio entre ${BIO_MIN}-${BIO_MAX} chars, NUNCA mais de ${BIO_HARD_LIMIT}` },
                    char_count: { type: "integer", description: "Contagem exata de caracteres do campo text" },
                    rationale: { type: "string", description: "Por que essa bio funciona (curto)" },
                  },
                  required: ["text", "char_count"],
                },
              },
            },
            required: ["analysis", "bio_options"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "instagram_analysis" } },
    }),
  });
  return res;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    const { username, screenshot } = await req.json();
    if (!screenshot) {
      return new Response(JSON.stringify({ error: "screenshot is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [reportRes, archRes] = await Promise.all([
      supabase.from("reports").select("content").eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(1).single(),
      supabase.from("user_top_archetypes").select("*").eq("user_id", userId).order("rank").limit(3),
    ]);

    const storyBrand = (reportRes.data?.content as any)?.storybrand || null;
    const visualIdentity = (reportRes.data?.content as any)?.visual_identity || null;
    const archetypes = archRes.data || [];

    const systemPrompt = `Você é um especialista em branding e marketing digital. Analise o perfil do Instagram com base na screenshot fornecida e nos dados do StoryBrand e arquétipos do usuário. Retorne análise prática e acionável.\n\n${bioPolicyText()}`;

    const userPrompt = `
## Screenshot do Perfil do Instagram${username ? ` (@${username})` : ""}
A imagem anexada é um print do perfil do Instagram do usuário.

## StoryBrand do Usuário
${storyBrand ? JSON.stringify(storyBrand, null, 2) : "Não disponível"}

## Top 3 Arquétipos
${archetypes.map((a: any) => `${a.rank}. ${a.archetype_name} (${a.score}pts)`).join("\n")}

## Identidade Visual
${visualIdentity ? JSON.stringify(visualIdentity, null, 2) : "Não disponível"}

Analise os seguintes aspectos e forneça sugestões baseadas no StoryBrand e arquétipos:
1. Nome do Perfil
2. Bio (em "suggestion" dê uma orientação geral; as 3 opções concretas vão em bio_options)
3. CTA (Call to Action)
4. Destaques
5. Posts Fixados
6. Aparência do Feed
7. Foto de Perfil
8. Estilo e Figurino – roupas, acessórios, maquiagem, estilo pessoal
9. Cenário e Ambientação – backgrounds das fotos

REGRA CRÍTICA SOBRE BIO:
${bioPolicyText()}
    `.trim();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfParts = await fetchReferencePdfs();

    const userContentParts: any[] = [
      ...pdfParts.map(p => ({ type: "file", file: { filename: "reference.pdf", file_data: `data:application/pdf;base64,${p.data}` } })),
      { type: "image_url", image_url: { url: screenshot.startsWith("data:") ? screenshot : `data:image/png;base64,${screenshot}` } },
      { type: "text", text: userPrompt },
    ];

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContentParts },
    ];

    const aiRes = await callAi(messages, LOVABLE_API_KEY);

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Erro na análise com IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Resposta da IA inválida" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    let bios: BioOption[] = normalizeBios(parsed.bio_options || []);

    // Retry up to 2x if any bio exceeds the hard limit
    let attempts = 0;
    while (attempts < 2 && (bios.length < 3 || bios.some((b) => b.text.length > BIO_HARD_LIMIT))) {
      attempts++;
      const tooLong = bios.filter((b) => b.text.length > BIO_HARD_LIMIT).map((b) => `- "${b.text}" (${b.text.length} chars)`).join("\n");
      const retryMessages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContentParts },
        { role: "assistant", content: JSON.stringify({ bio_options: bios }) },
        { role: "user", content: `As bios abaixo ESTOURARAM o limite de ${BIO_HARD_LIMIT} caracteres:\n${tooLong}\n\nReescreva as 3 bios garantindo que cada uma tenha entre ${BIO_MIN}-${BIO_MAX} caracteres (NUNCA mais de ${BIO_HARD_LIMIT}). Conte caractere por caractere antes de responder. Mantenha o resto da análise igual.` },
      ];
      const retryRes = await callAi(retryMessages, LOVABLE_API_KEY);
      if (!retryRes.ok) break;
      const retryData = await retryRes.json();
      const retryTool = retryData.choices?.[0]?.message?.tool_calls?.[0];
      if (!retryTool?.function?.arguments) break;
      try {
        const retryParsed = JSON.parse(retryTool.function.arguments);
        const newBios = normalizeBios(retryParsed.bio_options || []);
        if (newBios.length >= 3) bios = newBios;
      } catch {
        break;
      }
    }

    // Final fallback: smart-truncate any remaining over-limit bios
    bios = bios.slice(0, 3).map((b) => {
      if (b.text.length > BIO_HARD_LIMIT) {
        const truncated = smartTruncate(b.text, BIO_HARD_LIMIT);
        return { text: truncated, char_count: truncated.length, rationale: b.rationale };
      }
      return { ...b, char_count: b.text.length };
    });

    // Pad to 3 if AI returned fewer
    while (bios.length < 3) {
      bios.push({ text: "", char_count: 0 });
    }

    return new Response(JSON.stringify({ analysis: parsed.analysis, bio_options: bios }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("analyze-instagram error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
