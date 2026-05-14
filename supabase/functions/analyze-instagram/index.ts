import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { detectProfession, getEthicalRulesBlock, POSITIONING_GUARDRAIL_BLOCK } from "../_shared/professionRules.ts";
import { validatePostCompliance } from "../_shared/complianceValidator.ts";
import { loadBrandSSoT, renderBrandSSoTBlock } from "../_shared/brandSSoT.ts";

const BIO_MIN = 130;
const BIO_MAX = 145;
const BIO_HARD_LIMIT = 150;
const CTA_HARD_LIMIT = 40;

function normalizeDocName(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\.pdf$/i, "")
    .replace(/[\s_\-.]+/g, "");
}

const ANALYSIS_PDF_WHITELIST = ["storybrand", "madetostick", "obviouslyawesome"];

async function fetchReferencePdfs(): Promise<{ mime_type: string; data: string }[]> {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: docs } = await supabaseAdmin
      .from("reference_documents")
      .select("file_path, file_size, name")
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (!docs?.length) return [];

    const filtered = docs.filter((d: any) => {
      const candidate = normalizeDocName(d.name || d.file_path?.split("/").pop() || "");
      return ANALYSIS_PDF_WHITELIST.some((w) => candidate.includes(w));
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
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
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

function ctaPolicyText(): string {
  return `Para CTAs (campo cta_options), entregue 5 a 8 sugestões PRONTAS para colar — copy final, NUNCA orientação abstrata. Cada CTA com até ${CTA_HARD_LIMIT} caracteres, terminando com seta "→" ou emoji direcional (ex: "👉", "📩", "🔗"). Linguagem sóbria, sem promessa de resultado. Nada de "agende sua consulta hoje" se a profissão for regulamentada.`;
}

const FRAMEWORK_LEAK_BLOCK = `# PROIBIÇÃO ABSOLUTA — VAZAMENTO DE FRAMEWORK INTERNO

PROIBIDO escrever nas justificativas, sugestões, bios ou CTAs visíveis ao usuário:
- Nomes de arquétipos junguianos ("Explorador", "Mago", "Rebelde", "Sábio", "Herói", "Cuidador", "Criador", "Governante", "Amante", "Bobo", "Inocente", "Comum")
- Nomes de frameworks ("StoryBrand", "Obviously Awesome", "SUCCES", "Made to Stick", "April Dunford", "Donald Miller", "Heath")
- Rótulos de framework ("Problema Externo", "Problema Interno", "O Plano", "O Herói", "O Guia", "Posicionamento", "Categoria de mercado", "Alternativas rejeitadas")

O arquétipo e o framework PODEM informar a recomendação internamente, mas NUNCA aparecer como argumento textual entregue ao usuário.

❌ ERRADO: "Esta bio alinha com o arquétipo Explorador (descoberta de território)."
✅ CERTO: "Esta bio comunica a postura de quem conduz a uma transformação concreta."

❌ ERRADO: "Aplicando o framework StoryBrand, posicione-se como guia."
✅ CERTO: "Posicione-se como quem orienta o cliente em um caminho claro."`;

const VISUAL_PRESCRIPTION_BLOCK = `# PROIBIÇÃO — PRESCRIÇÃO DE PALETAS/ELEMENTOS INVENTADOS

NUNCA prescrever cores, paletas ou elementos visuais inventados como se fossem identidade oficial do usuário.

❌ ERRADO: "Use Verde Aventura, Azul Oceano, bússolas e mapas antigos."
❌ ERRADO: "Sua paleta deve ser laranja queimado e bege."
✅ CERTO: "Tons profundos e quentes que comuniquem autoridade."
✅ CERTO: "Elementos gráficos discretos que reforcem a postura de guia."

Se houver paleta REAL registrada no perfil do usuário (campo "Identidade Visual" abaixo), você PODE citar essas cores específicas. Caso contrário, recomende DIREÇÃO (não cores nomeadas).`;

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
                    aspect: { type: "string" },
                    current: { type: "string" },
                    suggestion: { type: "string" },
                  },
                  required: ["aspect", "current", "suggestion"],
                },
              },
              bio_options: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string", description: `Bio entre ${BIO_MIN}-${BIO_MAX} chars, NUNCA mais de ${BIO_HARD_LIMIT}` },
                    char_count: { type: "integer" },
                    rationale: { type: "string", description: "Por que funciona — sem citar arquétipo ou framework" },
                  },
                  required: ["text", "char_count"],
                },
              },
              cta_options: {
                type: "array",
                minItems: 5,
                maxItems: 8,
                description: `5 a 8 CTAs PRONTOS, copy final, máx ${CTA_HARD_LIMIT} chars cada, com seta/emoji direcional`,
                items: { type: "string" },
              },
            },
            required: ["analysis", "bio_options", "cta_options"],
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

    const [reportRes, archRes, profileRes, bizRes] = await Promise.all([
      supabase.from("reports").select("content").eq("user_id", userId).eq("status", "completed").order("created_at", { ascending: false }).limit(1).single(),
      supabase.from("user_top_archetypes").select("*").eq("user_id", userId).order("rank").limit(3),
      supabase.from("profiles").select("profession, niche, main_goal").eq("user_id", userId).maybeSingle(),
      supabase.from("business_questionnaires").select("services, target_audience").eq("user_id", userId).order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const storyBrand = (reportRes.data?.content as any)?.storybrand || null;
    const visualIdentity = (reportRes.data?.content as any)?.visual_identity || null;
    const archetypes = archRes.data || [];
    const profile = profileRes.data || {};
    const business = bizRes.data || {};

    // Detectar profissão regulamentada — alimenta tanto guardrail no prompt quanto validador pós-geração
    const professionCategory = detectProfession({
      profession: (profile as any).profession,
      niche: (profile as any).niche,
      business_description: Array.isArray((business as any).services)
        ? (business as any).services.join(" ")
        : (business as any).services || null,
    });
    const ethicalBlock = getEthicalRulesBlock(professionCategory);

    const audienceText = (() => {
      const ta = (business as any).target_audience;
      if (Array.isArray(ta) && ta.length) return ta.join("; ");
      if (typeof ta === "string" && ta.trim()) return ta;
      return "(não cadastrado — use termos genéricos como 'profissionais que vendem expertise', NÃO invente nicho específico)";
    })();

    const nicheText = (profile as any).niche || "(não cadastrado — não restrinja a nichos específicos sem dado)";

    const systemPrompt = `Você é um especialista em branding e marketing digital para Instagram. Analise o perfil com base na screenshot e nos dados estratégicos do usuário.

Use as três referências anexadas em PDF (clareza narrativa, posicionamento específico, ganchos memoráveis) APENAS como base de raciocínio interno. NUNCA cite os nomes dos livros/métodos/autores no texto entregue.

${FRAMEWORK_LEAK_BLOCK}

${VISUAL_PRESCRIPTION_BLOCK}
${POSITIONING_GUARDRAIL_BLOCK}
${ethicalBlock}

# REGRAS DE NICHO E PÚBLICO
- O nicho cadastrado é: ${nicheText}
- O público cadastrado é: ${audienceText}
- Se nicho/público forem amplos ou ausentes, NÃO invente recortes específicos ("advogados e médicos") — use termos do próprio cadastro ou termos genéricos como "profissionais liberais", "especialistas que vendem expertise".

${bioPolicyText()}

${ctaPolicyText()}`;

    const userPrompt = `
## Screenshot do Perfil do Instagram${username ? ` (@${username})` : ""}
A imagem anexada é um print do perfil do Instagram do usuário.

## StoryBrand do Usuário (uso interno — NÃO citar nomes de framework no output)
${storyBrand ? JSON.stringify(storyBrand, null, 2) : "Não disponível"}

## Top 3 Arquétipos (uso interno — NÃO citar nomes de arquétipo no output)
${archetypes.map((a: any) => `${a.rank}. ${a.archetype_name} (${a.score}pts)`).join("\n")}

## Identidade Visual REGISTRADA (única paleta autorizada para citar)
${visualIdentity ? JSON.stringify(visualIdentity, null, 2) : "Nenhuma paleta registrada — recomende apenas DIREÇÃO visual, não cores nomeadas."}

## Cadastro do Usuário
- Profissão: ${(profile as any).profession || "não informado"}
- Nicho: ${nicheText}
- Público-alvo: ${audienceText}

Analise os seguintes aspectos e forneça sugestões alinhadas ao posicionamento estratégico (cobrar pelo valor, atrair clientes premium, autoridade, melhor margem):
1. Nome do Perfil
2. Bio (em "suggestion" dê orientação geral; as 3 opções concretas vão em bio_options)
3. CTA — em "suggestion" dê orientação curta; as 5-8 opções concretas PRONTAS vão em cta_options
4. Destaques
5. Posts Fixados
6. Aparência do Feed
7. Foto de Perfil
8. Estilo e Figurino
9. Cenário e Ambientação
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
    let ctas: string[] = Array.isArray(parsed.cta_options)
      ? parsed.cta_options.filter((c: any) => typeof c === "string" && c.trim()).map((c: string) => c.trim())
      : [];

    // Retry up to 2x if any bio exceeds the hard limit
    let attempts = 0;
    while (attempts < 2 && (bios.length < 3 || bios.some((b) => b.text.length > BIO_HARD_LIMIT))) {
      attempts++;
      const tooLong = bios.filter((b) => b.text.length > BIO_HARD_LIMIT).map((b) => `- "${b.text}" (${b.text.length} chars)`).join("\n");
      const retryMessages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContentParts },
        { role: "assistant", content: JSON.stringify({ bio_options: bios }) },
        { role: "user", content: `As bios abaixo ESTOURARAM ${BIO_HARD_LIMIT} chars:\n${tooLong}\n\nReescreva as 3 garantindo ${BIO_MIN}-${BIO_MAX} chars (NUNCA mais de ${BIO_HARD_LIMIT}). Mantenha o resto.` },
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
      } catch { break; }
    }

    bios = bios.slice(0, 3).map((b) => {
      if (b.text.length > BIO_HARD_LIMIT) {
        const truncated = smartTruncate(b.text, BIO_HARD_LIMIT);
        return { text: truncated, char_count: truncated.length, rationale: b.rationale };
      }
      return { ...b, char_count: b.text.length };
    });
    while (bios.length < 3) bios.push({ text: "", char_count: 0 });

    // Compliance: descartar bios/CTAs com violação `high` para profissão regulamentada
    if (professionCategory !== "outro") {
      bios = bios.filter((b) => {
        if (!b.text) return true;
        const v = validatePostCompliance({ headline: b.text }, professionCategory);
        const high = v.filter((x) => x.severity === "high");
        if (high.length) console.warn("[analyze-instagram] bio descartada por compliance:", high.map((h) => h.rule));
        return high.length === 0;
      });
      while (bios.length < 3) bios.push({ text: "", char_count: 0 });

      ctas = ctas.filter((c) => {
        const v = validatePostCompliance({ cta: c }, professionCategory);
        const high = v.filter((x) => x.severity === "high");
        if (high.length) console.warn("[analyze-instagram] CTA descartado por compliance:", c, high.map((h) => h.rule));
        return high.length === 0;
      });
    }

    // Trim CTAs to hard limit (graceful)
    ctas = ctas.map((c) => c.length > CTA_HARD_LIMIT ? smartTruncate(c, CTA_HARD_LIMIT) : c).slice(0, 8);

    // Mesclar cta_options no campo "suggestion" do aspecto CTA (frontend atual lê só aspect/current/suggestion)
    const analysis = Array.isArray(parsed.analysis) ? parsed.analysis : [];
    for (const item of analysis) {
      if (typeof item?.aspect === "string" && /\bcta\b/i.test(item.aspect) && ctas.length) {
        const list = ctas.map((c) => `• ${c}`).join("\n");
        item.suggestion = `${item.suggestion || ""}\n\nOpções prontas para colar:\n${list}`.trim();
      }
    }

    return new Response(JSON.stringify({ analysis, bio_options: bios, cta_options: ctas }), {
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
