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

/** Full cleanup pipeline */
export function cleanText(text: string): string {
  return fixPunctuation(cleanMarkdown(text));
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
