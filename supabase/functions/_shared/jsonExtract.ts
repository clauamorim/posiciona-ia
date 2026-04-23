/**
 * Robust JSON extraction utilities for LLM responses.
 *
 * LLMs occasionally wrap their JSON responses in markdown fences, prepend
 * commentary, or emit malformed JSON (trailing commas, mismatched brackets).
 * These helpers try multiple recovery strategies before giving up.
 */

const stripTrailingCommas = (text: string) =>
  text.replace(/,(\s*[}\]])/g, "$1");

const tryParse = (text: string): unknown | null => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    try {
      return JSON.parse(stripTrailingCommas(text));
    } catch {
      return null;
    }
  }
};

const repairAndParse = (text: string): unknown | null => {
  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;

  for (const char of text) {
    if (escape) { escape = false; continue; }
    if (char === "\\") { escape = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (char === "{") braces++;
    else if (char === "}") braces--;
    else if (char === "[") brackets++;
    else if (char === "]") brackets--;
  }

  let repaired = text;
  while (brackets > 0) { repaired += "]"; brackets--; }
  while (braces > 0) { repaired += "}"; braces--; }
  return tryParse(repaired);
};

/**
 * Extract a JSON value (object or array) from raw LLM output.
 * Returns null if no recovery strategy succeeds.
 */
export function extractJsonFromLLM(rawContent: string): unknown | null {
  if (!rawContent || typeof rawContent !== "string") return null;
  const trimmed = rawContent.trim();
  if (!trimmed) return null;

  // 1. Direct parse
  const direct = tryParse(trimmed);
  if (direct !== null) return direct;

  // 2. Markdown fence
  const fenceMatch = trimmed.match(/```(?:json|javascript|js|typescript|ts)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    const fenced = tryParse(fenceMatch[1].trim());
    if (fenced !== null) return fenced;
    const repaired = repairAndParse(fenceMatch[1].trim());
    if (repaired !== null) return repaired;
  }

  // 3. First { to last }
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = trimmed.slice(firstBrace, lastBrace + 1);
    const sliced = tryParse(slice);
    if (sliced !== null) return sliced;
    const repaired = repairAndParse(slice);
    if (repaired !== null) return repaired;
  }

  // 4. First [ to last ]
  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    const slice = trimmed.slice(firstBracket, lastBracket + 1);
    const sliced = tryParse(slice);
    if (sliced !== null) return sliced;
    const repaired = repairAndParse(slice);
    if (repaired !== null) return repaired;
  }

  // 5. Last attempt: full repair
  return repairAndParse(trimmed);
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Validate that the extracted report has at least one of the expected sections.
 */
export function isValidReport(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const keys = ["archetypes", "storybrand", "visual_identity", "tone_of_voice", "editorial"];
  return keys.some((k) => value[k] !== undefined && value[k] !== null);
}
