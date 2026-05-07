/**
 * Rich text helpers for the post editor.
 * Whitelist: <strong>, <b>, <em>, <i>, <u>, <br>.
 * Tudo o resto vira texto plano.
 */

const ALLOWED_TAGS = new Set(["STRONG", "B", "EM", "I", "U", "BR"]);

/** Sanitiza HTML mantendo apenas as tags da whitelist (sem atributos). */
export function sanitizeRichText(html: string): string {
  if (!html || typeof html !== "string") return "";
  if (typeof document === "undefined") return html;

  const tpl = document.createElement("template");
  tpl.innerHTML = html;

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return escapeHtml(node.textContent || "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();
    const inner = Array.from(el.childNodes).map(walk).join("");

    if (!ALLOWED_TAGS.has(tag)) {
      // <div>, <p> etc. — preservam quebra implícita
      if (tag === "DIV" || tag === "P") return inner + (inner ? "<br>" : "");
      return inner;
    }
    if (tag === "BR") return "<br>";
    // Normaliza B → strong, I → em
    const norm = tag === "B" ? "strong" : tag === "I" ? "em" : tag.toLowerCase();
    return `<${norm}>${inner}</${norm}>`;
  };

  let out = Array.from(tpl.content.childNodes).map(walk).join("");
  // remove <br> trailing
  out = out.replace(/(<br\s*\/?>)+\s*$/i, "");
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Converte rich text para texto puro (para legenda/copiar). */
export function richTextToPlain(html: string): string {
  if (!html || typeof html !== "string") return "";
  if (!/<[a-z][^>]*>/i.test(html)) return html;
  if (typeof document === "undefined") {
    return html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
  }
  const tpl = document.createElement("template");
  tpl.innerHTML = html.replace(/<br\s*\/?>/gi, "\n");
  return tpl.content.textContent || "";
}

/** Detecta se uma string contém formatação rich text. */
export function isRichText(s: string): boolean {
  if (!s || typeof s !== "string") return false;
  return /<(strong|b|em|i|u|br)(\s|\/|>)/i.test(s);
}
