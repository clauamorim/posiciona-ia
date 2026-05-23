// Calcula valores default de SertaoTokens a partir do arquétipo primário do
// usuário. Permite que o template "Sertão Profundo" seja usado por QUALQUER
// arquétipo, herdando cores e fontes coerentes com a marca dele em vez de
// ficar preso na paleta verde+ouro+areia do Governante.
//
// Estratégia:
//   - Cores: usa `getArchetypePalette()` (src/lib/archetypePalettes.ts), que
//     agrupa os 12 arquétipos em 4 famílias visuais (elegância/energia/
//     calor/leveza). Mapeia background → bg do template, textPrimary → ink,
//     accent → accent.
//   - Fontes: usa `getArchetypeTypography()` (src/lib/archetypeTypography.ts).
//     Hoje só sinalizamos qual fonte de corpo usar (enum lato/cormorant/
//     playfair); a tipografia de display do Sertão (Playfair + Cormorant)
//     fica fixa por design — o usuário pode ajustar depois.

import { getArchetypePalette } from "@/lib/archetypePalettes";
import { getArchetypeTypography } from "@/lib/archetypeTypography";
import type { SertaoTokens } from "./types";

/** Mapeia a familia tipográfica do arquétipo p/ o enum bodyFont do Sertão. */
function pickBodyFont(displayFont: string, bodyFont: string): SertaoTokens["bodyFont"] {
  const fam = (bodyFont || displayFont || "").toLowerCase();
  if (fam.includes("cormorant")) return "cormorant";
  if (fam.includes("playfair")) return "playfair";
  return "lato"; // default seguro pra sans-serif neutro
}

/**
 * Tokens iniciais do template Sertão derivados do arquétipo primário.
 * Quando o usuário ativa o template pela primeira vez no editor, esses
 * valores entram como base; ele pode override depois via o inspector.
 */
export function getArchetypeSertaoDefaults(primaryArchetype?: string | null): Partial<SertaoTokens> {
  const palette = getArchetypePalette(primaryArchetype);
  const typo = getArchetypeTypography(primaryArchetype);

  return {
    verdeBg: palette.background,
    areiaInk: palette.textPrimary,
    ouroAccent: palette.accent,
    bodyFont: pickBodyFont(typo.displayFont, typo.bodyFont),
    // Demais tokens (numberingStyle, showOrnaments, showSwipeHint,
    // sectionLabel, brandMark, eyebrowText) permanecem com seus
    // defaults definidos no SertaoCard / TemplateSertaoPanel.
  };
}
