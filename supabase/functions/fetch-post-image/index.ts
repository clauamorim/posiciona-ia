// Edge function: fetch-post-image
// Busca imagens de fundo para um post.
// Modes:
//   - "single" (default): retorna 1 imagem (cache → Unsplash → IA opcional)
//   - "gallery": retorna até 12 imagens do Unsplash com metadata de cada fotógrafo
//
// Body: { theme, caption?, niche?, businessContext?, format?, allowAI?,
//         mode?, query?, page? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const UNSPLASH_URL = "https://api.unsplash.com/search/photos";
const UTM = "utm_source=posiciona&utm_medium=referral";

// =====================================================
// Tradução PT->EN simples para nichos e termos comuns
// =====================================================
const PT_EN_DICT: Record<string, string> = {
  // nichos
  "advogado": "lawyer office", "advogada": "lawyer office", "direito": "law justice", "juridico": "legal",
  "psicologo": "therapy mindfulness", "psicologa": "therapy mindfulness", "psicologia": "therapy mindfulness", "terapia": "therapy",
  "medico": "doctor medical", "medica": "doctor medical", "medicina": "medical clinic", "saude": "health wellness",
  "nutricionista": "healthy food nutrition", "nutricao": "nutrition food",
  "personal": "fitness training", "treinador": "fitness gym", "academia": "gym fitness", "fitness": "fitness gym",
  "dentista": "dentist clinic", "odontologia": "dental clinic",
  "arquiteto": "architecture interior", "arquiteta": "architecture interior", "arquitetura": "architecture",
  "designer": "design studio", "design": "design minimal",
  "marketing": "marketing business", "publicidade": "advertising",
  "consultor": "business consulting", "consultora": "business consulting", "consultoria": "business meeting",
  "coach": "coaching mentoring", "coaching": "coaching",
  "imobiliaria": "real estate house", "corretor": "real estate", "imoveis": "real estate",
  "contador": "accounting office", "contadora": "accounting", "contabilidade": "accounting",
  "professor": "teaching education", "professora": "teaching education", "educacao": "education",
  "fotografo": "photography studio", "fotografa": "photography",
  "esteticista": "beauty spa", "estetica": "beauty spa", "beleza": "beauty",
  "barbeiro": "barbershop", "cabeleireiro": "hair salon", "salao": "beauty salon",
  "veterinario": "veterinarian pets", "veterinaria": "veterinarian pets", "pet": "pets animals",
  "engenheiro": "engineering construction", "engenharia": "engineering",
  "tecnologia": "technology modern", "ti": "technology", "software": "technology software",
  "moda": "fashion style", "estilista": "fashion design",
  "gastronomia": "food restaurant", "chef": "restaurant kitchen", "restaurante": "restaurant",
  "confeitaria": "pastry bakery", "padaria": "bakery",
  "financas": "finance business", "investimento": "finance investing", "financeiro": "finance",
  // temas / abstratos comuns
  "transformacao": "growth journey", "mudanca": "change journey",
  "crescimento": "growth", "evolucao": "evolution",
  "sucesso": "success achievement", "conquista": "achievement",
  "lideranca": "leadership", "equipe": "team meeting",
  "produtividade": "productive workspace", "trabalho": "workspace",
  "resultado": "results business", "estrategia": "strategy planning",
  "autoridade": "authority confidence",
  "confianca": "confidence",
  "inspiracao": "inspiration calm",
  "motivacao": "motivation",
  "foco": "focus minimal",
  "calma": "calm peaceful", "tranquilidade": "peaceful nature",
  "natureza": "nature landscape",
  "casa": "home interior", "lar": "home",
  "familia": "family lifestyle",
  "relacionamento": "relationship couple",
  "amor": "love romantic",
};

// Termos sensíveis a evitar quando o nicho não é infantil
const SENSITIVE_TERMS = ["crianca", "criancas", "child", "children", "kid", "kids", "baby", "infantil", "bebe"];
const KID_FRIENDLY_NICHES = ["pediatra", "pediatria", "infantil", "creche", "escola", "professor", "professora"];

function deaccent(s: string): string {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function translateWord(word: string): string | null {
  const w = deaccent(word);
  if (PT_EN_DICT[w]) return PT_EN_DICT[w];
  return null;
}

async function hashString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.toLowerCase().trim());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constrói query de busca priorizando o NICHO do negócio (em inglês),
 * combinado com 1-2 substantivos do tema.
 */
function buildSearchQuery(opts: {
  theme: string; caption?: string; niche?: string; businessContext?: string;
}): string {
  const stop = new Set([
    "de","da","do","das","dos","o","a","os","as","e","ou","para","por","com","sem","em","no","na","nos","nas",
    "um","uma","uns","umas","que","como","mais","menos","muito","seu","sua","seus","suas","ser","ter","sobre",
    "the","of","and","or","for","with","to","in","on","an","is","are","be","this","that",
    "slide","capa","conteudo","conclusao","cta","post","dia",
  ]);

  // 1) Traduz nicho (parte mais importante)
  let nicheEN = "";
  if (opts.niche) {
    const nicheClean = deaccent(opts.niche).replace(/[^a-z\s]/g, " ");
    const tokens = nicheClean.split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      const tr = translateWord(t);
      if (tr) { nicheEN = tr; break; }
    }
    // Fallback: usa o nicho original se nada traduziu
    if (!nicheEN && tokens.length > 0) nicheEN = tokens.slice(0, 2).join(" ");
  }

  // 2) Tema -> 1-2 palavras-chave traduzidas
  const themeClean = deaccent(opts.theme || "")
    .replace(/^(slide\s*\d+|capa|conteudo|conclusao|cta)\s*[:\-–]\s*/gi, "")
    .replace(/[^a-z\s]/g, " ");
  const themeWords = themeClean.split(/\s+/).filter(w => w.length >= 4 && !stop.has(w));

  const themeEN: string[] = [];
  for (const w of themeWords) {
    const tr = translateWord(w);
    if (tr) { themeEN.push(tr); if (themeEN.length >= 2) break; }
  }

  // 3) Contexto adicional do negócio (já em PT, traduz se possível)
  let ctxEN = "";
  if (opts.businessContext) {
    const ctxTokens = deaccent(opts.businessContext).replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
    for (const t of ctxTokens) {
      const tr = translateWord(t);
      if (tr) { ctxEN = tr; break; }
    }
  }

  // Composição final: prioriza nicho > tema > contexto
  const parts = [nicheEN, themeEN.join(" "), ctxEN].filter(Boolean);
  let query = parts.join(" ").trim();

  // Filtro de termos sensíveis se o nicho não for infantil
  const nicheIsKidFriendly = opts.niche && KID_FRIENDLY_NICHES.some(k => deaccent(opts.niche!).includes(k));
  if (!nicheIsKidFriendly) {
    const tokens = query.split(/\s+/).filter(t => !SENSITIVE_TERMS.includes(t));
    query = tokens.join(" ");
  }

  // Fallback genérico se ficou vazio
  if (!query.trim()) query = "minimal abstract editorial";

  return query.slice(0, 80);
}

/** Tradução do tema PT para uso em prompt IA (frase descritiva). */
function translateThemeForAI(theme: string, niche?: string): string {
  // Para a IA, evitar passar a frase emocional em português literal.
  // Em vez disso, gerar uma descrição em inglês baseada no nicho.
  const nicheEN = niche ? buildSearchQuery({ theme: "", niche }) : "";
  const themeKeywords = buildSearchQuery({ theme, niche: undefined });
  return `${nicheEN} ${themeKeywords}`.trim() || "minimal editorial scene";
}

interface UnsplashPhoto {
  url: string;
  unsplashUrl: string;
  photographer: { name: string; profileUrl: string };
  width?: number;
  height?: number;
}

async function searchUnsplashList(
  query: string,
  format: "square" | "portrait",
  apiKey: string,
  perPage = 12,
  page = 1,
): Promise<UnsplashPhoto[]> {
  try {
    const orientation = format === "portrait" ? "portrait" : "squarish";
    const url = `${UNSPLASH_URL}?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=${perPage}&page=${page}&content_filter=high&order_by=relevant`;
    const resp = await fetch(url, {
      headers: { "Authorization": `Client-ID ${apiKey}`, "Accept-Version": "v1" },
    });
    if (!resp.ok) {
      console.error("Unsplash error", resp.status, await resp.text());
      return [];
    }
    const data = await resp.json();
    if (!Array.isArray(data.results)) return [];
    return data.results.map((p: any) => ({
      url: p?.urls?.regular || p?.urls?.full || "",
      unsplashUrl: `${p?.links?.html || ""}?${UTM}`,
      photographer: {
        name: p?.user?.name || "Unknown",
        profileUrl: `${p?.user?.links?.html || ""}?${UTM}`,
      },
      width: p?.width,
      height: p?.height,
    })).filter((x: UnsplashPhoto) => x.url && (x.width ?? 0) >= 1080);
  } catch (err) {
    console.error("Unsplash fetch error", err);
    return [];
  }
}

async function generateWithAI(themeEN: string, format: "square" | "portrait"): Promise<string | null> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return null;
  const aspect = format === "portrait" ? "vertical 9:16 portrait orientation" : "square 1:1 orientation";
  const prompt = `Editorial photograph, premium magazine quality, soft natural lighting, shallow depth of field, ${aspect}.
Subject: ${themeEN}.
ABSOLUTELY NO TEXT, NO LETTERS, NO SIGNS, NO NEON, NO TYPOGRAPHY, NO WORDS, NO LOGOS, NO BRAND NAMES, NO WRITTEN CONTENT anywhere in the image.
NO TEXT. NO TEXT. NO TEXT.
Composition: clean, centered subject with negative space at top and bottom for text overlay later. Soft palette. Style: minimal, calm, professional, contemporary photography. Avoid people's faces dominating the frame. Avoid children. No collage, no illustration — pure photography only.`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!resp.ok) {
      console.error("AI gen failed", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    const imgUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    return imgUrl || null;
  } catch (err) {
    console.error("AI gen error", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      theme, caption, niche, businessContext,
      format = "square", allowAI = false,
      mode = "single", query: customQuery, page = 1,
    } = body;

    if (!theme && !customQuery) {
      return new Response(JSON.stringify({ error: "theme or query required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const keywords = customQuery && customQuery.trim().length > 0
      ? customQuery.trim()
      : buildSearchQuery({ theme, caption, niche, businessContext });
    console.log("Search query:", keywords, "(niche:", niche, ")");

    const unsplashKey = Deno.env.get("UNSPLASH_ACCESS_KEY");

    // Validação explícita: se não há chave configurada, log + 503 (em vez de cair silenciosamente para o gradiente)
    if (!unsplashKey && (mode === "gallery" || (!allowAI && mode !== "single"))) {
      console.error("UNSPLASH_ACCESS_KEY missing — image search unavailable");
      return new Response(JSON.stringify({
        error: "Banco de imagens indisponível. Tente novamente mais tarde.",
        results: [],
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== GALLERY MODE =====
    if (mode === "gallery") {
      const results = await searchUnsplashList(keywords, format, unsplashKey!, 12, page);
      return new Response(JSON.stringify({ results, keywords, page }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== SINGLE MODE =====
    const cacheKey = await hashString(`${keywords}::${format}`);

    // 1) Cache lookup
    const { data: cached } = await supabase
      .from("post_background_cache")
      .select("image_url, source")
      .eq("theme_hash", cacheKey)
      .maybeSingle();
    if (cached?.image_url) {
      return new Response(JSON.stringify({ url: cached.image_url, source: "cache", keywords }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Unsplash — busca lista de 10 e escolhe a 1ª que passa nos filtros
    if (unsplashKey) {
      const list = await searchUnsplashList(keywords, format, unsplashKey, 10, 1);
      if (list.length > 0) {
        const first = list[0];
        await supabase.from("post_background_cache").insert({
          theme_hash: cacheKey, image_url: first.url, source: "unsplash", keywords,
        });
        return new Response(JSON.stringify({
          url: first.url, source: "unsplash", keywords,
          photographer: first.photographer, unsplashUrl: first.unsplashUrl,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3) AI fallback (only if allowed)
    if (allowAI) {
      const themeEN = translateThemeForAI(theme, niche);
      console.log("AI prompt subject:", themeEN);
      const url = await generateWithAI(themeEN, format);
      if (url) {
        await supabase.from("post_background_cache").insert({
          theme_hash: cacheKey, image_url: url, source: "ai", keywords,
        });
        return new Response(JSON.stringify({ url, source: "ai", keywords }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "ai_generation_failed", keywords }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "no image found", keywords, allowAI }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fetch-post-image error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
