// Embeddings helper — Gemini gemini-embedding-001 com outputDimensionality=768
// (text-embedding-004 foi descontinuado e retorna 404).
// Guardrail-only: nunca lança; em caso de erro retorna null/[] e segue o pipeline.

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIMS = 768;
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
        outputDimensionality: EMBED_DIMS,
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

// gemini-embedding-001 NÃO suporta batchEmbedContents — sequencial com leve throttle.
export async function embedTextBatch(texts: string[]): Promise<(number[] | null)[]> {
  const out: (number[] | null)[] = [];
  for (let i = 0; i < texts.length; i++) {
    out.push(await embedText(texts[i]));
    if (i < texts.length - 1) await new Promise((r) => setTimeout(r, 250));
  }
  return out;
}

// Texto canônico para embedding e para guardar como contexto do retry guiado.
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
