// Paletas e grupos visuais por arquétipo junguiano.
// 12 arquétipos agrupados em 4 famílias com paleta harmônica.

export type ArchetypeGroup = "elegance" | "energy" | "warmth" | "lightness";

export interface ArchetypePalette {
  group: ArchetypeGroup;
  background: string;
  textPrimary: string;
  accent: string;
  secondary: string;
  critical: string;
}

const ELEGANCE: ArchetypePalette = {
  group: "elegance",
  background: "#F5F1E8",
  textPrimary: "#1A1A2E",
  accent: "#B8945A",
  secondary: "#3E4B5C",
  critical: "#7A1F2B",
};

const ENERGY: ArchetypePalette = {
  group: "energy",
  background: "#1A1A1A",   // carvão (não preto puro)
  textPrimary: "#F5F1E8",  // branco quente (não puro)
  accent: "#C8553D",       // burnt sienna — premium, ainda quente
  secondary: "#D4A373",    // warm tan
  critical: "#2C5F7F",     // deep teal
};

const WARMTH: ArchetypePalette = {
  group: "warmth",
  background: "#F2EBE0",   // creme quente
  textPrimary: "#3D2914",  // cocoa
  accent: "#A0522D",       // sienna — mais sofisticado
  secondary: "#BC8F62",    // warm bronze
  critical: "#5B7553",     // sage
};

const LIGHTNESS: ArchetypePalette = {
  group: "lightness",
  background: "#F8F8F5",   // off-white com toque
  textPrimary: "#2C3E50",
  accent: "#4A8B9C",       // deep teal — sofisticado
  secondary: "#C9A961",    // champagne gold
  critical: "#B85450",     // rose dusty
};

const ARCHETYPE_PALETTES: Record<string, ArchetypePalette> = {
  // Elegância
  "Sábio": ELEGANCE,
  "Sabio": ELEGANCE,
  "Governante": ELEGANCE,
  "Mago": ELEGANCE,
  "Amante": ELEGANCE,
  // Energia
  "Herói": ENERGY,
  "Heroi": ENERGY,
  "Explorador": ENERGY,
  "Rebelde": ENERGY,
  // Calor
  "Cuidador": WARMTH,
  "Criador": WARMTH,
  "Comum": WARMTH,
  "Cara-comum": WARMTH,
  "Pessoa Comum": WARMTH,
  // Leveza
  "Inocente": LIGHTNESS,
  "Bobo": LIGHTNESS,
  "Bobo-da-corte": LIGHTNESS,
  "Bobo da Corte": LIGHTNESS,
};

export function getArchetypePalette(name?: string | null): ArchetypePalette {
  if (!name) return ELEGANCE;
  return ARCHETYPE_PALETTES[name.trim()] ?? ELEGANCE;
}

export function getArchetypeGroup(name?: string | null): ArchetypeGroup {
  return getArchetypePalette(name).group;
}
