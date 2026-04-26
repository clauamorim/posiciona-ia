/**
 * Catálogo de estilos visuais para geração de imagens por IA.
 * - `label`: texto em PT mostrado ao usuário.
 * - `directive`: texto em EN concatenado ao prompt do Gemini (invisível).
 */

export type AIStyleId =
  | "minimal"
  | "editorial-luxury"
  | "vibrant-modern"
  | "human-warm"
  | "technical-authority";

export interface AIStyleOption {
  id: AIStyleId;
  label: string;
  /** Resumo curto em PT para subtítulo do card (não vai pro prompt). */
  blurb: string;
  /** Texto enviado ao Gemini, em inglês. NUNCA mostrar ao usuário. */
  directive: string;
  /** Gradiente CSS para o mini-preview do card. */
  previewGradient: string;
  /** Cor de acento para o mini-preview. */
  accent: string;
}

export const AI_STYLE_OPTIONS: AIStyleOption[] = [
  {
    id: "minimal",
    label: "Minimalista",
    blurb: "Design clean, muito espaço em branco, único acento de cor.",
    directive:
      "Clean design, white background, single accent color, sans-serif typography, lots of white space, no clutter, corporate but approachable",
    previewGradient: "linear-gradient(135deg, #FAFAF7 0%, #F2F0EA 100%)",
    accent: "#0F172A",
  },
  {
    id: "editorial-luxury",
    label: "Editorial Luxo",
    blurb: "Estética sofisticada, fundo escuro, acentos dourados.",
    directive:
      "High-end editorial aesthetic, dark background, gold or cream accents, elegant serif typography, sophisticated and exclusive feel",
    previewGradient: "linear-gradient(135deg, #14110A 0%, #2A2317 100%)",
    accent: "#C9A84C",
  },
  {
    id: "vibrant-modern",
    label: "Moderno Vibrante",
    blurb: "Cores ousadas, composição dinâmica, gradientes contemporâneos.",
    directive:
      "Bold colors, dynamic composition, gradient accents, modern sans-serif, energetic and youthful, Instagram-native aesthetic",
    previewGradient: "linear-gradient(135deg, #FF5E62 0%, #FF9966 50%, #7C3AED 100%)",
    accent: "#FFFFFF",
  },
  {
    id: "human-warm",
    label: "Humano e Acolhedor",
    blurb: "Tons quentes, texturas orgânicas, sensação de proximidade.",
    directive:
      "Warm tones, organic textures, approachable design, rounded elements, friendly typography, trust-building aesthetic",
    previewGradient: "linear-gradient(135deg, #E8C39E 0%, #C97B5A 100%)",
    accent: "#5C2E1A",
  },
  {
    id: "technical-authority",
    label: "Autoridade Técnica",
    blurb: "Visual analítico, paleta marinho/verde escuro, transmite expertise.",
    directive:
      "Data-driven look, structured layout, navy or dark green palette, precise typography, conveys expertise and credibility",
    previewGradient: "linear-gradient(135deg, #0B2447 0%, #19376D 60%, #0F3D2E 100%)",
    accent: "#7DD3FC",
  },
];

export const getAIStyleById = (id: AIStyleId | null | undefined): AIStyleOption | undefined =>
  AI_STYLE_OPTIONS.find((s) => s.id === id);
