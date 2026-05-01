// fetch-market-trends
// Busca 2-3 tendências/notícias recentes (últimos 14 dias) do nicho do usuário
// usando Claude com a tool nativa `web_search_20250305`. Cache em memória por
// (profession+niche) com TTL de 24h. Falhas são silenciosas (retorna []).
//
// Input: { profession: string, niche: string }
// Output: { trends: MarketTrend[] }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { extractJsonFromLLM } from "../_shared/jsonExtract.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface MarketTrend {
  title: string;
  summary: string;
  source_url?: string;
  published_at?: string;
  angle_suggestion?: string;
}

interface CacheEntry {
  trends: MarketTrend[];
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(profession: string, niche: string): string {
  return `${profession.toLowerCase().trim()}::${niche.toLowerCase().trim()}`;
}

async function fetchTrends(profession: string, niche: string): Promise<MarketTrend[]> {
  if (!ANTHROPIC_API_KEY) return [];

  const systemPrompt = `Você é um analista de tendências de mercado para criadores de conteúdo brasileiros. Sua tarefa: buscar na web 2 a 3 tendências, notícias ou debates RECENTES (últimos 14 dias) que sejam relevantes para um profissional do nicho informado e que possam virar tema de post no Instagram.

REGRAS:
- Priorize fontes brasileiras e em português.
- Priorize notícias datadas dos últimos 14 dias.
- Evite tendências genéricas demais ("IA está crescendo"). Busque movimentos concretos, decisões, casos, mudanças regulatórias, debates atuais no nicho.
- Para cada tendência, escreva um RESUMO curto (1-2 frases) e um ÂNGULO SUGERIDO (1 frase) de como o profissional poderia abordar isso em um post — sempre com voz própria, sem copiar a notícia.

⚠️ FORMATO DE SAÍDA: array JSON começando com "[" e terminando com "]". SEM \`\`\`. Sem texto fora do JSON. Sem vírgula final.

OUTPUT:
[
  {
    "title": "Título curto da tendência",
    "summary": "Resumo de 1-2 frases sobre o que está acontecendo.",
    "source_url": "https://...",
    "published_at": "YYYY-MM-DD",
    "angle_suggestion": "Como o profissional pode abordar em 1 post."
  }
]

Retorne entre 2 e 3 itens. Se não encontrar nada relevante e recente, retorne [].`;

  const userText = `Profissão: ${profession}
Nicho: ${niche}

Busque tendências e notícias recentes (últimos 14 dias) relevantes para esse profissional e devolva o array JSON.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: systemPrompt,
        tools: [
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 3,
          },
        ],
        messages: [{ role: "user", content: userText }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.warn(`fetch-market-trends: Claude ${response.status} - ${errText.substring(0, 300)}`);
      return [];
    }

    const data = await response.json();
    const blocks = Array.isArray(data?.content) ? data.content : [];
    const text = blocks
      .filter((b: any) => b?.type === "text" && typeof b.text === "string")
      .map((b: any) => b.text)
      .join("");

    if (!text.trim()) return [];

    const parsed = extractJsonFromLLM(text);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((t: any) => t && typeof t === "object" && typeof t.title === "string")
      .slice(0, 3)
      .map((t: any) => ({
        title: String(t.title || "").trim(),
        summary: String(t.summary || "").trim(),
        source_url: typeof t.source_url === "string" ? t.source_url : undefined,
        published_at: typeof t.published_at === "string" ? t.published_at : undefined,
        angle_suggestion: typeof t.angle_suggestion === "string" ? t.angle_suggestion : undefined,
      }))
      .filter((t: MarketTrend) => t.title.length > 0);
  } catch (e: any) {
    console.warn("fetch-market-trends: erro", e?.message || e);
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const profession = String(body?.profession || "").trim();
    const niche = String(body?.niche || "").trim();

    if (!profession && !niche) {
      return new Response(JSON.stringify({ trends: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = cacheKey(profession, niche);
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      return new Response(JSON.stringify({ trends: cached.trends, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trends = await fetchTrends(profession, niche);
    cache.set(key, { trends, expiresAt: now + TTL_MS });

    return new Response(JSON.stringify({ trends, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("fetch-market-trends error:", e);
    // Falha silenciosa: retorna array vazio para não quebrar geração.
    return new Response(JSON.stringify({ trends: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
