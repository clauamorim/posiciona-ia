// Edge function: fetch-post-image
// Busca imagens de fundo para um post.
// Modes:
//   - "single" (default): retorna 1 imagem (Unsplash → IA opcional). SEM cache, garante variedade.
//   - "gallery": retorna até 12 imagens do Unsplash com metadata de cada fotógrafo
//
// Body: { theme, caption?, body?, cta?, niche?, businessContext?,
//         format?: "card"|"reels"|"square"|"portrait", allowAI?,
//         mode?, query?, page?, nonce? }

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
  "cansaco": "rest calm", "cansada": "rest calm", "cansado": "rest calm",
  "descanso": "rest relaxation",
  "rotina": "daily routine lifestyle",
  "tempo": "time clock",
  "saudavel": "healthy lifestyle",
  "alimentacao": "healthy food",
  "exercicio": "exercise fitness",
  "meditacao": "meditation calm",
  "mente": "mindfulness",
  "corpo": "wellness body",
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

/**
 * Normaliza format vindo do cliente. Aceita tanto a nova nomenclatura
 * (card/reels) quanto a antiga (square/portrait).
 *  - card  / square   → 4:5  (1080×1350)
 *  - reels / portrait → 9:16 (1080×1920)
 */
function normalizeFormat(input?: string): "card" | "reels" {
  const f = (input || "").toLowerCase();
  if (f === "reels" || f === "portrait" || f === "9:16") return "reels";
  return "card";
}

/**
 * Extrai 2-4 substantivos relevantes de um texto longo (copy/legenda),
 * traduzindo para inglês quando possível.
 */
function extractKeywordsFromText(text: string, max = 4): string[] {
  const stop = new Set([
    "de","da","do","das","dos","o","a","os","as","e","ou","para","por","com","sem","em","no","na","nos","nas",
    "um","uma","uns","umas","que","como","mais","menos","muito","seu","sua","seus","suas","ser","ter","sobre",
    "the","of","and","or","for","with","to","in","on","an","is","are","be","this","that","you","your","we","our",
    "slide","capa","conteudo","conclusao","cta","post","dia","semana","tema","caption","legenda",
    "voce","seu","sua","gente","quando","onde","porque","mas","pode","vai","ainda","todo","toda","tudo","nada",
  ]);
  const tokens = deaccent(text || "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stop.has(w));

  const seen = new Set<string>();
  const out: string[] = [];
  // Primeiro: priorizar palavras que TEM tradução (mais visualmente concretas)
  for (const w of tokens) {
    if (seen.has(w)) continue;
    const tr = translateWord(w);
    if (tr) {
      out.push(tr);
      seen.add(w);
      if (out.length >= max) return out;
    }
  }
  // Fallback: substantivos longos sem tradução
  for (const w of tokens) {
    if (seen.has(w)) continue;
    if (w.length < 6) continue;
    out.push(w);
    seen.add(w);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Constrói query de busca Unsplash:
 *   nicho (PT→EN) + 2-3 palavras-chave da copy/legenda (PT→EN) + (opcional) tema curto
 */
function buildSearchQuery(opts: {
  theme: string; caption?: string; body?: string;
  niche?: string; businessContext?: string;
}): string {
  // 1) Nicho
  let nicheEN = "";
  if (opts.niche) {
    const tokens = deaccent(opts.niche).replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      const tr = translateWord(t);
      if (tr) { nicheEN = tr; break; }
    }
    if (!nicheEN && tokens.length > 0) nicheEN = tokens.slice(0, 2).join(" ");
  }

  // 2) Copy/legenda — fonte rica de assunto visual concreto
  const richText = [opts.theme, opts.body, opts.caption].filter(Boolean).join(" ");
  const richKeywords = extractKeywordsFromText(richText, 3);

  // 3) Contexto de negócio (apenas como tie-breaker)
  let ctxEN = "";
  if (opts.businessContext) {
    const ctxTokens = deaccent(opts.businessContext).replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
    for (const t of ctxTokens) {
      const tr = translateWord(t);
      if (tr) { ctxEN = tr; break; }
    }
  }

  const parts = [nicheEN, richKeywords.join(" "), ctxEN].filter(Boolean);
  let query = parts.join(" ").trim();

  // Filtro de termos sensíveis se o nicho não for infantil
  const nicheIsKidFriendly = opts.niche && KID_FRIENDLY_NICHES.some((k) => deaccent(opts.niche!).includes(k));
  if (!nicheIsKidFriendly) {
    const tokens = query.split(/\s+/).filter((t) => !SENSITIVE_TERMS.includes(t));
    query = tokens.join(" ");
  }

  if (!query.trim()) query = "minimal abstract editorial";
  return query.slice(0, 90);
}

/**
 * Constrói uma descrição rica para o prompt da IA, incluindo nicho,
 * intenção do post (extraída do tema), assunto central da copy e legenda.
 */
function buildAIPromptSubject(opts: {
  theme: string; caption?: string; body?: string;
  niche?: string; businessContext?: string;
}): string {
  const nicheEN = opts.niche
    ? buildSearchQuery({ theme: "", niche: opts.niche })
    : "";
  const themeKeywords = extractKeywordsFromText(opts.theme || "", 3).join(" ");
  const bodyKeywords = extractKeywordsFromText(opts.body || opts.caption || "", 3).join(" ");
  const subject = [nicheEN, themeKeywords, bodyKeywords].filter(Boolean).join(", ");
  return subject.trim() || "minimal editorial scene";
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
  format: "card" | "reels",
  apiKey: string,
  perPage = 12,
  page = 1,
): Promise<UnsplashPhoto[]> {
  try {
    // Para card (4:5) e reels (9:16) usamos sempre orientation=portrait —
    // o Unsplash não distingue entre 4:5 e 9:16, então pegamos portrait
    // e ranqueamos por proximidade de aspect ratio depois.
    const orientation = "portrait";
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
    const list: UnsplashPhoto[] = data.results.map((p: any) => ({
      url: p?.urls?.regular || p?.urls?.full || "",
      unsplashUrl: `${p?.links?.html || ""}?${UTM}`,
      photographer: {
        name: p?.user?.name || "Unknown",
        profileUrl: `${p?.user?.links?.html || ""}?${UTM}`,
      },
      width: p?.width,
      height: p?.height,
    })).filter((x: UnsplashPhoto) => x.url && (x.width ?? 0) >= 1080);

    // Ranking: ordena por proximidade do aspect ratio alvo
    const targetRatio = format === "reels" ? 9 / 16 : 4 / 5; // largura/altura
    list.sort((a, b) => {
      const ra = (a.width || 1) / (a.height || 1);
      const rb = (b.width || 1) / (b.height || 1);
      return Math.abs(ra - targetRatio) - Math.abs(rb - targetRatio);
    });
    return list;
  } catch (err) {
    console.error("Unsplash fetch error", err);
    return [];
  }
}

async function generateWithAI(
  subject: string,
  format: "card" | "reels",
  nonce?: string,
): Promise<string | null> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return null;
  const aspect = format === "reels"
    ? "vertical 9:16 portrait orientation, framed for Instagram Reels cover (1080x1920)"
    : "vertical 4:5 portrait orientation, framed for Instagram feed card (1080x1350)";
  const seed = nonce || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const prompt = `Editorial photograph, premium magazine quality, soft natural lighting, shallow depth of field, ${aspect}.
Subject: ${subject}.
Variation seed: ${seed}. Choose a fresh angle, lighting and composition different from any previous render.
ABSOLUTELY NO TEXT, NO LETTERS, NO SIGNS, NO NEON, NO TYPOGRAPHY, NO WORDS, NO LOGOS, NO BRAND NAMES, NO WRITTEN CONTENT anywhere in the image.
NO TEXT. NO TEXT. NO TEXT.
Composition: clean, off-center subject leaving generous negative space at top AND bottom for text overlay later (safe area for headlines and captions). Soft palette, calm contrast. Style: minimal, calm, professional, contemporary photography. Avoid people's faces dominating the frame. Avoid children. No collage, no illustration — pure photography only.`;

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
      theme, caption, body: postBody, cta,
      niche, businessContext,
      format: rawFormat, allowAI = false,
      mode = "single", query: customQuery, page = 1,
      nonce,
    } = body;

    if (!theme && !customQuery) {
      return new Response(JSON.stringify({ error: "theme or query required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const format = normalizeFormat(rawFormat);

    const keywords = customQuery && customQuery.trim().length > 0
      ? customQuery.trim()
      : buildSearchQuery({ theme, caption, body: postBody, niche, businessContext });
    console.log("Search query:", keywords, "(niche:", niche, "format:", format, "mode:", mode, ")");

    const unsplashKey = Deno.env.get("UNSPLASH_ACCESS_KEY");

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
    if (allowAI) {
      const subject = buildAIPromptSubject({ theme, caption, body: postBody, niche, businessContext });
      console.log("AI prompt subject:", subject, "nonce:", nonce);
      const url = await generateWithAI(subject, format, nonce);
      if (url) {
        return new Response(JSON.stringify({ url, source: "ai", keywords }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "ai_generation_failed", keywords }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (unsplashKey) {
      const list = await searchUnsplashList(keywords, format, unsplashKey, 12, 1);
      if (list.length > 0) {
        // Top 6 já estão ranqueados por proximidade de aspect ratio + relevância.
        // Sorteia entre eles para variar entre chamadas.
        const topPool = list.slice(0, Math.min(6, list.length));
        const pick = topPool[Math.floor(Math.random() * topPool.length)];
        return new Response(JSON.stringify({
          url: pick.url, source: "unsplash", keywords,
          photographer: pick.photographer, unsplashUrl: pick.unsplashUrl,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
