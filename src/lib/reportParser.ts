type ReportSectionKey =
  | "archetypes"
  | "visual_identity"
  | "tone_of_voice"
  | "storybrand"
  | "editorial"
  | "figurino"
  | "simbolos";

const REPORT_SECTION_KEYS: ReportSectionKey[] = [
  "archetypes",
  "visual_identity",
  "tone_of_voice",
  "storybrand",
  "editorial",
  "figurino",
  "simbolos",
];

const WRAPPER_KEYS = ["report", "content", "data", "analysis", "result", "payload"];

const isRecord = (value: unknown): value is Record<string, any> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const hasValue = (value: unknown) => {
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return value !== null && value !== undefined && value !== "";
};

const isReportLikeObject = (value: unknown) => (
  isRecord(value) && REPORT_SECTION_KEYS.some((key) => hasValue(value[key]))
);

const extractJsonCandidates = (input: string) => {
  const trimmed = input.trim();
  const candidates = new Set<string>();

  if (trimmed) candidates.add(trimmed);

  const fenced = trimmed.match(/```(?:json|javascript|js|typescript|ts)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]?.trim()) candidates.add(fenced[1].trim());

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    candidates.add(trimmed.slice(firstBrace, lastBrace + 1));
  }

  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    candidates.add(trimmed.slice(firstBracket, lastBracket + 1));
  }

  return [...candidates];
};

const unwrapReportLikeValue = (value: unknown, depth: number): unknown => {
  if (!isRecord(value)) return value;

  if (isReportLikeObject(value)) return value;

  for (const key of WRAPPER_KEYS) {
    if (!hasValue(value[key])) continue;
    const candidate = parseUnknown(value[key], depth + 1);
    if (isReportLikeObject(candidate) || typeof candidate === "string") {
      return candidate;
    }
  }

  return value;
};

const parseUnknown = (rawValue: unknown, depth = 0): unknown => {
  if (depth > 4 || rawValue === null || rawValue === undefined) return rawValue;

  if (typeof rawValue === "string") {
    for (const candidate of extractJsonCandidates(rawValue)) {
      try {
        return parseUnknown(JSON.parse(candidate), depth + 1);
      } catch {
        continue;
      }
    }

    return rawValue.trim();
  }

  if (Array.isArray(rawValue)) {
    return rawValue.map((item) => parseUnknown(item, depth + 1));
  }

  return unwrapReportLikeValue(rawValue, depth);
};

export const normalizeReportContent = (rawContent: unknown) => parseUnknown(rawContent);

export const getReportFallbackText = (rawContent: unknown) => {
  const parsedContent = normalizeReportContent(rawContent);

  if (typeof parsedContent === "string") return parsedContent;
  if (parsedContent === null || parsedContent === undefined) return "Nenhum conteúdo disponível.";

  try {
    return JSON.stringify(parsedContent, null, 2);
  } catch {
    return String(parsedContent);
  }
};

export function parseReportContent(rawContent: unknown) {
  const parsedContent = normalizeReportContent(rawContent);
  const contentObject = isRecord(parsedContent) ? parsedContent : null;

  const hasArchetypes = hasValue(contentObject?.archetypes);
  const hasVisualIdentity = hasValue(contentObject?.visual_identity);
  const hasToneOfVoice = hasValue(contentObject?.tone_of_voice);
  const hasStorybrand = hasValue(contentObject?.storybrand);
  const hasEditorial = hasValue(contentObject?.editorial);
  const hasFigurino = hasValue(contentObject?.figurino);
  const hasSimbolos = hasValue(contentObject?.simbolos);

  return {
    parsedContent,
    contentObject,
    isStructuredReport: Boolean(
      hasArchetypes ||
      hasVisualIdentity ||
      hasToneOfVoice ||
      hasStorybrand ||
      hasEditorial ||
      hasFigurino ||
      hasSimbolos
    ),
    hasArchetypes,
    hasVisualIdentity,
    hasToneOfVoice,
    hasStorybrand,
    hasEditorial,
    hasFigurino,
    hasSimbolos,
  };
}