// fetch-market-trends
// Busca 2-3 tendências/notícias recentes (últimos 14 dias) do nicho do usuário
// usando Claude com a tool nativa `web_search_20250305`. Cache persistido em
// market_trends_cache (TTL 24h) para sobreviver a cold starts. Falhas são
// silenciosas (retorna []).
//
// Input: { profession: string, niche: string }
// Output: { trends: MarketTrend[] }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { extractJsonFromLLM } from "../_shared/jsonExtract.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const TTL_HOURS = 24;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface MarketTrend {
  title: string;
  summary: string;
  source_url?: string;
  published_at?: string;
  angle_suggestion?: string;
}

function cacheKey(profession: string, niche: string): string {
  return `${profession.toLowerCase().trim()}::${niche.toLowerCase().trim()}`;
}

async function readCache(key: string): Promise<MarketTrend[] | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("market_trends_cache")
      .select("trends, expires_at")
      .eq("key", key)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !data) return null;
    return Array.isArray(data.trends) ? (data.trends as MarketTrend[]) : null;
  } catch (e: any) {
    console.warn("fetch-market-trends: cache read error", e?.message || e);
    return null;
  }
}

async function writeCache(key: string, trends: MarketTrend[]): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000).toISOString();
    const { error } = await supabaseAdmin
      .from("market_trends_cache")
      .upsert({ key, trends, expires_at: expiresAt, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) console.warn("fetch-market-trends: cache write error", error.message);
  } catch (e: any) {
    console.warn("fetch-market-trends: cache write exception", e?.message || e);
  }
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
    const cached = await readCache(key);
    if (cached) {
      return new Response(JSON.stringify({ trends: cached, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trends = await fetchTrends(profession, niche);
    // Só persiste se houver resultado, para não cravar array vazio por 24h em caso de falha pontual.
    if (trends.length > 0) {
      await writeCache(key, trends);
    }

    return new Response(JSON.stringify({ trends, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("fetch-market-trends error:", e);
    return new Response(JSON.stringify({ trends: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
