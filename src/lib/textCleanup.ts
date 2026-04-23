/**
 * Text cleanup utilities for AI-generated content.
 * Removes raw markdown, fixes punctuation issues, and improves readability.
 */

/** Remove markdown bold/italic markers and return clean text */
export function cleanMarkdown(text: string): string {
  if (!text || typeof text !== "string") return text || "";
  
  let cleaned = text;
  
  // Remove bold markers: **text** or __text__
  cleaned = cleaned.replace(/\*\*(.+?)\*\*/g, "$1");
  cleaned = cleaned.replace(/__(.+?)__/g, "$1");
  
  // Remove italic markers: *text* or _text_
  cleaned = cleaned.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1");
  cleaned = cleaned.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "$1");
  
  // Remove heading markers: ### text
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");
  
  // Remove bullet markers at start of lines
  cleaned = cleaned.replace(/^[-*•]\s+/gm, "");
  
  return cleaned;
}

/**
 * Extract text AFTER the first closing bold block.
 * e.g. "**Título do slide** Conteúdo do slide" → "Conteúdo do slide"
 * If no bold block found, returns the text cleaned of markdown.
 */
export function extractAfterBold(text: string): string {
  if (!text || typeof text !== "string") return text || "";
  
  // Match **...** at the start (with optional whitespace before)
  const match = text.match(/^\s*\*\*[^*]+\*\*\s*(.*)/s);
  if (match && match[1] && match[1].trim().length > 0) {
    return cleanMarkdown(match[1].trim());
  }
  
  // No initial bold block — return cleaned text
  return cleanMarkdown(text);
}

/** Fix common punctuation issues in generated text */
export function fixPunctuation(text: string): string {
  if (!text || typeof text !== "string") return text || "";
  
  let fixed = text;
  
  // Fix double punctuation: ., .. ,, ;; :: etc.
  fixed = fixed.replace(/\.\,/g, ".");
  fixed = fixed.replace(/\,\./g, ".");
  fixed = fixed.replace(/\.{2,}/g, ".");
  fixed = fixed.replace(/\,{2,}/g, ",");
  fixed = fixed.replace(/\;{2,}/g, ";");
  fixed = fixed.replace(/\:{2,}/g, ":");
  
  // Fix space before punctuation
  fixed = fixed.replace(/\s+([.,;:!?])/g, "$1");
  
  // Fix multiple spaces
  fixed = fixed.replace(/\s{2,}/g, " ");
  
  // Fix space after punctuation (ensure one space)
  fixed = fixed.replace(/([.,;:!?])(?=[A-Za-zÀ-ÿ])/g, "$1 ");
  
  return fixed.trim();
}

/**
 * Strip framework labels and positional prefixes from the START of a string.
 * Removes things like:
 * - "Slide 1:", "Card 2 -", "Página 3 –"
 * - "Problema Externo:", "CTA:", "Plano:", "O Herói –", "Sucesso:"
 * Also strips wrapping quotes left over from the LLM (e.g. `"Texto"` → `Texto`).
 * Idempotent: runs the regex pass twice in case multiple labels were chained
 * (e.g. "Slide 1: Problema Externo: ...").
 */
const FRAMEWORK_LABEL_RE = new RegExp(
  "^\\s*(?:" +
    // Positional labels with number
    "(?:slide|card|p[áa]gina|dia)\\s*\\d+" +
    "|" +
    // Framework labels (with optional leading article "O ")
    "(?:o\\s+)?(?:" +
      "problema\\s+externo|problema\\s+interno|problema\\s+filos[óo]fico|" +
      "(?:o\\s+)?plano|" +
      "cta|chamada\\s+(?:à|para)\\s+a[çc][ãa]o|" +
      "sucesso|fracasso|" +
      "her[óo]i|guia" +
    ")" +
  ")\\s*[:\\-–—]\\s*",
  "i"
);

export function stripFrameworkLabels(text: string): string {
  if (!text || typeof text !== "string") return text || "";
  let out = text;
  // Run up to 2 passes to handle chained labels
  for (let i = 0; i < 2; i++) {
    const next = out.replace(FRAMEWORK_LABEL_RE, "");
    if (next === out) break;
    out = next;
  }
  // Strip wrapping quotes (straight or curly) if they envelop the whole string
  out = out.trim();
  const quotedMatch = out.match(/^["'“”‘’«»](.+)["'“”‘’«»]$/s);
  if (quotedMatch) out = quotedMatch[1].trim();
  return out;
}

/** Full cleanup pipeline */
export function cleanText(text: string): string {
  return fixPunctuation(stripFrameworkLabels(cleanMarkdown(text)));
}

/**
 * Parse markdown text into segments for React rendering.
 * Returns array of { text, bold, italic } objects.
 */
export type TextSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

export function parseMarkdownSegments(text: string): TextSegment[] {
  if (!text || typeof text !== "string") return [{ text: text || "" }];
  
  const segments: TextSegment[] = [];
  // Match **bold**, *italic*, and plain text
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|([^*]+))/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    if (match[2]) {
      segments.push({ text: fixPunctuation(match[2]), bold: true });
    } else if (match[3]) {
      segments.push({ text: fixPunctuation(match[3]), italic: true });
    } else if (match[4]) {
      segments.push({ text: fixPunctuation(match[4]) });
    }
  }
  
  return segments.length > 0 ? segments : [{ text: fixPunctuation(text) }];
}
