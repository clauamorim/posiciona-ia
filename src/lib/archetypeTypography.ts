// Configuração tipográfica por arquétipo para o editor de posts.
// Define peso, tamanho, line-height e letter-spacing ideais do título
// para cada arquétipo, além do peso máximo do corpo (para garantir
// contraste título/corpo).

export interface ArchetypeTypography {
  titleWeight: number;       // 100–900
  titleSizeMin: number;      // px (nunca < 42)
  titleSizeMax: number;      // px (default usado quando user não definiu)
  titleLineHeight: number;
  titleLetterSpacing: string;
  bodyWeight: 300 | 400;
}

const ELEGANCE: ArchetypeTypography = {
  titleWeight: 300,
  titleSizeMin: 52,
  titleSizeMax: 60,
  titleLineHeight: 1.1,
  titleLetterSpacing: "0.02em",
  bodyWeight: 300,
};

const ENERGY: ArchetypeTypography = {
  titleWeight: 600,
  titleSizeMin: 44,
  titleSizeMax: 48,
  titleLineHeight: 1.05,
  titleLetterSpacing: "-0.01em",
  bodyWeight: 400,
};

const DEFAULT_TYPO: ArchetypeTypography = {
  titleWeight: 400,
  titleSizeMin: 44,
  titleSizeMax: 44,
  titleLineHeight: 1.1,
  titleLetterSpacing: "0",
  bodyWeight: 400,
};

export const ARCHETYPE_TYPOGRAPHY: Record<string, ArchetypeTypography> = {
  // Elegância / Sabedoria
  "Sábio": ELEGANCE,
  "Governante": ELEGANCE,
  "Mago": ELEGANCE,
  "Amante": ELEGANCE,
  // Energia / Ação
  "Herói": ENERGY,
  "Explorador": ENERGY,
  "Rebelde": ENERGY,
  // Demais arquétipos caem no DEFAULT via getter
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
