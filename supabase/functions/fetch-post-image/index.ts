// Edge function: fetch-post-image
// Busca uma imagem de fundo para um post.
// Estratégia: cache → Unsplash → (opcional) IA Gemini.
//
// Body: { theme: string, caption?: string, format?: "square"|"portrait", allowAI?: boolean }
// Retorna: { url: string, source: "cache"|"unsplash"|"ai", keywords: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const UNSPLASH_URL = "https://api.unsplash.com/search/photos";

async function hashString(input: string): Promise<string> {
  const data = new TextEncoder().encode(input.toLowerCase().trim());
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function extractKeywords(theme: string, caption?: string): Promise<string> {
  // Heurística simples: pega substantivos relevantes do tema.
  // Strip rótulos como "Slide 1:", "Capa:", "Conteúdo:" etc.
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

async function searchUnsplash(query: string, format: "square" | "portrait", apiKey: string): Promise<string | null> {
  try {
    const orientation = format === "portrait" ? "portrait" : "squarish";
    const url = `${UNSPLASH_URL}?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=5&content_filter=high`;
    const resp = await fetch(url, {
      headers: { "Authorization": `Client-ID ${apiKey}`, "Accept-Version": "v1" },
    });
    if (!resp.ok) {
      console.error("Unsplash error", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    if (!Array.isArray(data.results) || data.results.length === 0) return null;
    // Pega a primeira (mais relevante segundo Unsplash)
    const first = data.results[0];
    return first?.urls?.regular || first?.urls?.full || null;
  } catch (err) {
    console.error("Unsplash fetch error", err);
    return null;
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
    const { theme, caption, format = "square", allowAI = false } = await req.json();
    if (!theme || typeof theme !== "string") {
      return new Response(JSON.stringify({ error: "theme required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const keywords = await extractKeywords(theme, caption);
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
    const unsplashKey = Deno.env.get("UNSPLASH_ACCESS_KEY");
    if (unsplashKey) {
      const url = await searchUnsplash(keywords, format, unsplashKey);
      if (url) {
        await supabase.from("post_background_cache").insert({
          theme_hash: cacheKey, image_url: url, source: "unsplash", keywords,
        });
        return new Response(JSON.stringify({ url, source: "unsplash", keywords }), {
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
