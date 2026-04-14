import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    // Fetch user's StoryBrand + archetypes
    const [reportRes, archRes] = await Promise.all([
      supabase.from("reports").select("content").eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(1).single(),
      supabase.from("user_top_archetypes").select("*").eq("user_id", userId).order("rank").limit(3),
    ]);

    const storyBrand = (reportRes.data?.content as any)?.storybrand || null;
    const visualIdentity = (reportRes.data?.content as any)?.visual_identity || null;
    const archetypes = archRes.data || [];

    // Build AI prompt
    const systemPrompt = `Você é um especialista em branding e marketing digital. Analise o perfil do Instagram com base na screenshot fornecida e nos dados do StoryBrand e arquétipos do usuário. Retorne análise prática e acionável.`;

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
2. Bio
3. CTA (Call to Action)
4. Destaques
5. Posts Fixados
6. Aparência do Feed
7. Foto de Perfil
8. Estilo e Figurino – Analise as roupas, acessórios, maquiagem e estilo pessoal visíveis nas fotos do perfil e do feed. Avalie se o estilo visual pessoal está coerente com os arquétipos de marca. Sugira ajustes de figurino, paleta de cores das roupas, tipo de acessórios e maquiagem que reforcem o posicionamento.
9. Cenário e Ambientação – Analise os cenários e backgrounds das fotos. Avalie se comunicam a mensagem certa e sugira ambientações mais alinhadas à identidade de marca.
    `.trim();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch reference PDFs
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

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
              },
              required: ["analysis"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "instagram_analysis" } },
      }),
    });

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
    return new Response(JSON.stringify({ analysis: parsed.analysis }), {
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
