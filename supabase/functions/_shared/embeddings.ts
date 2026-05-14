// Embeddings helper — Gemini text-embedding-004 (768d, free tier)
// Guardrail-only: nunca lança; em caso de erro retorna null/[] e segue o pipeline.

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const EMBED_MODEL = "text-embedding-004";
const EMBED_BASE = `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}`;
const MAX_CHARS = 8000;

function truncate(text: string): string {
  const t = (text || "").trim();
  return t.length > MAX_CHARS ? t.slice(0, MAX_CHARS) : t;
}

export async function embedText(text: string): Promise<number[] | null> {
  if (!GEMINI_KEY) {
    console.warn("[embed] GEMINI_API_KEY ausente — pulando.");
    return null;
  }
  const content = truncate(text);
  if (!content) return null;
  try {
    const r = await fetch(`${EMBED_BASE}:embedContent?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text: content }] },
        taskType: "SEMANTIC_SIMILARITY",
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.warn(`[embed] http ${r.status}: ${body.slice(0, 200)}`);
      return null;
    }
    const j = await r.json();
    const v = j?.embedding?.values;
    return Array.isArray(v) ? (v as number[]) : null;
  } catch (e: any) {
    console.warn(`[embed] error: ${e?.message || e}`);
    return null;
  }
}

export async function embedTextBatch(texts: string[]): Promise<(number[] | null)[]> {
  if (!texts.length) return [];
  if (!GEMINI_KEY) {
    console.warn("[embed] GEMINI_API_KEY ausente — pulando batch.");
    return texts.map(() => null);
  }
  try {
    const r = await fetch(`${EMBED_BASE}:batchEmbedContents?key=${GEMINI_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((t) => ({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text: truncate(t) }] },
          taskType: "SEMANTIC_SIMILARITY",
        })),
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.warn(`[embed] batch http ${r.status}: ${body.slice(0, 200)} — fallback sequencial`);
      const out: (number[] | null)[] = [];
      for (const t of texts) out.push(await embedText(t));
      return out;
    }
    const j = await r.json();
    const arr = j?.embeddings;
    if (!Array.isArray(arr)) return texts.map(() => null);
    return arr.map((e: any) => (Array.isArray(e?.values) ? (e.values as number[]) : null));
  } catch (e: any) {
    console.warn(`[embed] batch error: ${e?.message || e} — fallback sequencial`);
    const out: (number[] | null)[] = [];
    for (const t of texts) out.push(await embedText(t));
    return out;
  }
}

// Texto canônico para embedding e para guardar como contexto do retry guiado.
// Concatena todos os campos relevantes — o backend exige ≥1000 chars de contexto
// para a LLM reconhecer o ângulo a evitar.
export function postToEmbedText(post: {
  theme?: string;
  caption?: string;
  card_copy?: string[];
  cta?: string;
  script?: string;
  title?: string;
  headline?: string;
  body?: string;
}): string {
  const parts: string[] = [];
  if (post.theme) parts.push(`Tema: ${post.theme}`);
  if ((post as any).title) parts.push(`Título: ${(post as any).title}`);
  if ((post as any).headline) parts.push(`Manchete: ${(post as any).headline}`);
  if (post.caption) parts.push(`Caption: ${post.caption}`);
  if (Array.isArray(post.card_copy) && post.card_copy.length > 0) {
    parts.push(`Cards: ${post.card_copy.join(" || ")}`);
  }
  if ((post as any).body) parts.push(`Corpo: ${(post as any).body}`);
  if (post.script) parts.push(`Script: ${post.script}`);
  if (post.cta) parts.push(`CTA: ${post.cta}`);
  return parts.join("\n").trim();
}
