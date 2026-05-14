// Validador de coerência interna do relatório.
// Detecta contradição entre "tone_of_voice.words_to_avoid" e o resto do
// relatório (arquétipos, símbolos, figurino, StoryBrand, editorial, CTAs).
//
// Devolve uma lista de violações para alimentar um retry guiado UMA vez.
// Nunca bloqueia entrega.

const ALWAYS_FORBIDDEN = [
  "segredo",
  "fórmula mágica",
  "formula magica",
  "fácil",
  "facil",
  "rápido",
  "rapido",
  "viral",
  "antes e depois",
  "antes/depois",
  "fórmula que poucos conhecem",
  "formula que poucos conhecem",
  "agende seu diagnóstico pelo whatsapp",
  "agende pelo whatsapp",
];

export interface CoherenceViolation {
  word: string;
  section: string;
  snippet: string;
  source: "words_to_avoid" | "always_forbidden";
}

function flatten(value: any): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(flatten).join(" \n ");
  if (typeof value === "object") {
    return Object.values(value).map(flatten).join(" \n ");
  }
  return String(value);
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findSnippet(haystack: string, needleNorm: string): string {
  const normHay = normalize(haystack);
  const idx = normHay.indexOf(needleNorm);
  if (idx < 0) return "";
  const start = Math.max(0, idx - 30);
  const end = Math.min(haystack.length, idx + needleNorm.length + 30);
  return haystack.slice(start, end).replace(/\s+/g, " ").trim();
}

const SECTIONS_TO_SCAN: { key: string; label: string }[] = [
  { key: "archetypes", label: "archetypes" },
  { key: "simbolos", label: "simbolos" },
  { key: "figurino", label: "figurino" },
  { key: "storybrand", label: "storybrand" },
  { key: "editorial", label: "editorial" },
  { key: "visual_identity", label: "visual_identity" },
];

export function validateReportCoherence(report: any): CoherenceViolation[] {
  if (!report || typeof report !== "object") return [];
  const violations: CoherenceViolation[] = [];

  const userAvoid: string[] = Array.isArray(report?.tone_of_voice?.words_to_avoid)
    ? report.tone_of_voice.words_to_avoid.filter((w: any) => typeof w === "string" && w.trim().length >= 3)
    : [];

  const allBanned = Array.from(
    new Set([
      ...userAvoid.map((w) => ({ raw: w, source: "words_to_avoid" as const })),
      ...ALWAYS_FORBIDDEN.map((w) => ({ raw: w, source: "always_forbidden" as const })),
    ].map((b) => JSON.stringify(b))),
  ).map((s) => JSON.parse(s) as { raw: string; source: "words_to_avoid" | "always_forbidden" });

  for (const section of SECTIONS_TO_SCAN) {
    const sectionText = flatten(report[section.key]);
    if (!sectionText) continue;
    const sectionNorm = normalize(sectionText);
    for (const banned of allBanned) {
      const needleNorm = normalize(banned.raw);
      if (needleNorm.length < 3) continue;
      // Word boundary heurística: requer que comece em borda
      const re = new RegExp(`(^|[^a-z0-9])${escapeRegex(needleNorm)}([^a-z0-9]|$)`, "i");
      if (re.test(sectionNorm)) {
        violations.push({
          word: banned.raw,
          section: section.label,
          snippet: findSnippet(sectionText, needleNorm),
          source: banned.source,
        });
      }
    }
  }
  return violations;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function renderCoherenceRetryInstructions(violations: CoherenceViolation[]): string {
  if (!violations.length) return "";
  const lines = violations
    .slice(0, 12)
    .map(
      (v) =>
        `- Em "${v.section}": remova/reescreva o uso de "${v.word}" (${v.source === "always_forbidden" ? "regra global" : "palavra que o próprio tom de voz pediu para evitar"}). Trecho: "${v.snippet || "(não localizado, varra a seção)"}"`,
    )
    .join("\n");
  return `\n\n⚠️ COERÊNCIA INTERNA — REVISE O RELATÓRIO
O relatório anterior caiu em contradição: usou palavras que o próprio tom de voz lista como "evitar" — ou palavras GLOBALMENTE proibidas (segredo, fórmula mágica, antes e depois, fácil, rápido, viral, "agende pelo WhatsApp"). Reescreva APENAS as seções abaixo, mantendo a estrutura JSON intacta. Substituições preferidas:
- "antes e depois" → "trilha de transformação contada pelo método" (sem expor cliente)
- "fórmula que poucos conhecem" / "segredo" / "fórmula mágica" → "metodologia construída ao longo dos anos"
- "agende pelo WhatsApp" / "agende seu diagnóstico" → "salve este post", "guarde esta informação", "indique para um colega"

Violações detectadas:
${lines}

Devolva o JSON COMPLETO do relatório corrigido (mesma estrutura).`;
}
