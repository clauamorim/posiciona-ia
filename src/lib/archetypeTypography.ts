// Configuração tipográfica por arquétipo para o editor de posts.
// Define peso, tamanho, line-height, letter-spacing e família de fontes
// (display + corpo) ideais para cada arquétipo, além do peso máximo do
// corpo (para garantir contraste título/corpo).

export interface ArchetypeTypography {
  titleWeight: number;       // 100–900
  titleSizeMin: number;      // px (nunca < 42)
  titleSizeMax: number;      // px (default usado quando user não definiu)
  titleLineHeight: number;
  titleLetterSpacing: string;
  bodyWeight: 300 | 400;
  displayFont: string;
  bodyFont: string;
}

const DEFAULT_TYPO: ArchetypeTypography = {
  titleWeight: 400,
  titleSizeMin: 44,
  titleSizeMax: 44,
  titleLineHeight: 1.1,
  titleLetterSpacing: "0",
  bodyWeight: 400,
  displayFont: "Cormorant Garamond",
  bodyFont: "Inter",
};

export const ARCHETYPE_TYPOGRAPHY: Record<string, ArchetypeTypography> = {
  "Herói":         { titleWeight: 600, titleSizeMin: 44, titleSizeMax: 48, titleLineHeight: 1.05, titleLetterSpacing: "-0.01em", bodyWeight: 400, displayFont: "Oswald",            bodyFont: "Montserrat" },
  "Explorador":    { titleWeight: 600, titleSizeMin: 44, titleSizeMax: 48, titleLineHeight: 1.05, titleLetterSpacing: "-0.01em", bodyWeight: 400, displayFont: "Fjalla One",        bodyFont: "Open Sans" },
  "Rebelde":       { titleWeight: 600, titleSizeMin: 44, titleSizeMax: 48, titleLineHeight: 1.05, titleLetterSpacing: "-0.01em", bodyWeight: 400, displayFont: "Permanent Marker",  bodyFont: "Barlow" },
  "Sábio":         { titleWeight: 300, titleSizeMin: 52, titleSizeMax: 60, titleLineHeight: 1.1,  titleLetterSpacing: "0.02em",  bodyWeight: 300, displayFont: "Merriweather",      bodyFont: "Source Serif Pro" },
  "Governante":    { titleWeight: 300, titleSizeMin: 52, titleSizeMax: 60, titleLineHeight: 1.1,  titleLetterSpacing: "0.02em",  bodyWeight: 300, displayFont: "Cormorant Garamond", bodyFont: "Raleway" },
  "Mago":          { titleWeight: 300, titleSizeMin: 52, titleSizeMax: 60, titleLineHeight: 1.1,  titleLetterSpacing: "0.02em",  bodyWeight: 300, displayFont: "Cinzel",            bodyFont: "Lora" },
  "Amante":        { titleWeight: 300, titleSizeMin: 52, titleSizeMax: 60, titleLineHeight: 1.1,  titleLetterSpacing: "0.02em",  bodyWeight: 300, displayFont: "Playfair Display",  bodyFont: "Lora" },
  "Criador":       { titleWeight: 400, titleSizeMin: 44, titleSizeMax: 44, titleLineHeight: 1.1,  titleLetterSpacing: "0",       bodyWeight: 400, displayFont: "Playfair Display",  bodyFont: "Inter" },
  "Cuidador":      { titleWeight: 400, titleSizeMin: 44, titleSizeMax: 44, titleLineHeight: 1.1,  titleLetterSpacing: "0",       bodyWeight: 400, displayFont: "Lora",              bodyFont: "Open Sans" },
  "Inocente":      { titleWeight: 400, titleSizeMin: 44, titleSizeMax: 44, titleLineHeight: 1.1,  titleLetterSpacing: "0",       bodyWeight: 400, displayFont: "Quicksand",         bodyFont: "Poppins" },
  "Cara-comum":    { titleWeight: 400, titleSizeMin: 44, titleSizeMax: 44, titleLineHeight: 1.1,  titleLetterSpacing: "0",       bodyWeight: 400, displayFont: "Roboto Slab",       bodyFont: "Roboto" },
  "Pessoa Comum":  { titleWeight: 400, titleSizeMin: 44, titleSizeMax: 44, titleLineHeight: 1.1,  titleLetterSpacing: "0",       bodyWeight: 400, displayFont: "Roboto Slab",       bodyFont: "Roboto" },
  "Bobo-da-corte": { titleWeight: 400, titleSizeMin: 44, titleSizeMax: 44, titleLineHeight: 1.1,  titleLetterSpacing: "0",       bodyWeight: 400, displayFont: "Fredoka One",       bodyFont: "Nunito" },
  "Bobo da Corte": { titleWeight: 400, titleSizeMin: 44, titleSizeMax: 44, titleLineHeight: 1.1,  titleLetterSpacing: "0",       bodyWeight: 400, displayFont: "Fredoka One",       bodyFont: "Nunito" },
};

export function getArchetypeTypography(name?: string | null): ArchetypeTypography {
  if (!name) return DEFAULT_TYPO;
  return ARCHETYPE_TYPOGRAPHY[name] ?? DEFAULT_TYPO;
}

/** Garante que peso de corpo nunca seja "bold". Aceita number ou string. */
export function clampBodyWeight(
  raw: string | number | undefined,
  max: 300 | 400,
): number | string {
  if (raw == null) return max;
  if (typeof raw === "string") {
    if (raw === "bold") return max;
    const n = Number(raw);
    if (!Number.isFinite(n)) return raw; // "normal", "lighter" etc
    return n > max ? max : n;
  }
  return raw > max ? max : raw;
}
