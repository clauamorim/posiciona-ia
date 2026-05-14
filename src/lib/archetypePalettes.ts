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
  background: "#1C1C1C",
  textPrimary: "#FFFFFF",
  accent: "#FF4D2E",
  secondary: "#FFD23F",
  critical: "#0066FF",
};

const WARMTH: ArchetypePalette = {
  group: "warmth",
  background: "#FAF3E6",
  textPrimary: "#3D2914",
  accent: "#C0654A",
  secondary: "#E8B85C",
  critical: "#6B8E4E",
};

const LIGHTNESS: ArchetypePalette = {
  group: "lightness",
  background: "#FFFFFF",
  textPrimary: "#2C3E50",
  accent: "#5BB3D8",
  secondary: "#FFD166",
  critical: "#FF6B9D",
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
