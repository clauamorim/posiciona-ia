// Edge function: fetch-post-image
// Busca imagens de fundo para um post.
// Modes:
//   - "single" (default): retorna 1 imagem (cache → Unsplash → IA opcional)
//   - "gallery": retorna até 12 imagens do Unsplash com metadata de cada fotógrafo
//
// Body: { theme: string, caption?: string, format?: "square"|"portrait", allowAI?: boolean,
//         mode?: "single"|"gallery", query?: string, page?: number }
// Retorna single: { url, source, keywords, photographer? }
// Retorna gallery: { results: [{ url, photographer: { name, profileUrl }, unsplashUrl }], keywords }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const UNSPLASH_URL = "https://api.unsplash.com/search/photos";
const UTM = "utm_source=posiciona&utm_medium=referral";

async function hashString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.toLowerCase().trim());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function extractKeywords(theme: string, caption?: string): Promise<string> {
  const cleaned = (theme || "")
    .replace(/^\s*(slide\s*\d+|capa|conteúdo|conclusão|cta)\s*[:\-–]\s*/gi, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .toLowerCase();
  const stop = new Set([
    "de","da","do","das","dos","o","a","os","as","e","ou","para","por","com","sem","em","no","na","nos","nas",
    "um","uma","uns","umas","que","como","mais","menos","muito","seu","sua","seus","suas","ser","ter","sobre",
    "the","of","and","or","for","with","to","in","on","an","is","are","be","this","that",
  ]);
  const words = cleaned.split(/\s+/).filter((w) => w.length >= 3 && !stop.has(w));
  const top = Array.from(new Set(words)).slice(0, 4);
  return top.length > 0 ? top.join(" ") : (theme || "abstract background").slice(0, 60);
}

interface UnsplashPhoto {
  url: string;
  unsplashUrl: string;
  photographer: { name: string; profileUrl: string };
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
    const url = `${UNSPLASH_URL}?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=${perPage}&page=${page}&content_filter=high`;
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
    })).filter((x: UnsplashPhoto) => x.url);
  } catch (err) {
    console.error("Unsplash fetch error", err);
    return [];
  }
}

async function generateWithAI(query: string, format: "square" | "portrait"): Promise<string | null> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return null;
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [
          {
            role: "user",
            content: `Generate a ${format === "portrait" ? "portrait (vertical)" : "square"} background image suitable for a social media post. Theme: ${query}. Style: editorial, premium, minimal, soft lighting, no text, no people unless implied. The image will be used as background — leave space for overlay text.`,
          },
        ],
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
      theme, caption, format = "square", allowAI = false,
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
      : await extractKeywords(theme, caption);
    const unsplashKey = Deno.env.get("UNSPLASH_ACCESS_KEY");

    // ===== GALLERY MODE =====
    if (mode === "gallery") {
      if (!unsplashKey) {
        return new Response(JSON.stringify({ error: "Unsplash not configured", results: [] }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const results = await searchUnsplashList(keywords, format, unsplashKey, 12, page);
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

    // 2) Unsplash
    if (unsplashKey) {
      const list = await searchUnsplashList(keywords, format, unsplashKey, 5, 1);
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
      const url = await generateWithAI(keywords, format);
      if (url) {
        await supabase.from("post_background_cache").insert({
          theme_hash: cacheKey, image_url: url, source: "ai", keywords,
        });
        return new Response(JSON.stringify({ url, source: "ai", keywords }), {
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
