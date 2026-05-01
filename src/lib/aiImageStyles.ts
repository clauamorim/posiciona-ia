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
      "Ultra-minimal still-life photography or flat graphic composition on a pure off-white background (#FAFAF7). Single object or geometric shape, lots of negative space, one bold accent color (deep navy or muted terracotta). Zero clutter. Studio lighting, no shadows. Aesthetic: Apple-meets-Kinfolk minimalism, NOT lifestyle photography",
    previewGradient: "linear-gradient(135deg, #FAFAF7 0%, #F2F0EA 100%)",
    accent: "#0F172A",
  },
  {
    id: "editorial-luxury",
    label: "Editorial Luxo",
    blurb: "Estética sofisticada, fundo escuro, acentos dourados.",
    directive:
      "Dark moody luxury editorial scene. Deep black or charcoal background (#0E0B07), dramatic chiaroscuro lighting, warm gold and champagne accents (#C9A84C). Velvet, marble, polished brass textures. High contrast, deep shadows, cinematic. Vogue / Robb Report aesthetic. NOT bright, NOT minimal, NOT soft — must feel opulent and exclusive",
    previewGradient: "linear-gradient(135deg, #14110A 0%, #2A2317 100%)",
    accent: "#C9A84C",
  },
  {
    id: "vibrant-modern",
    label: "Moderno Vibrante",
    blurb: "Cores ousadas, composição dinâmica, gradientes contemporâneos.",
    directive:
      "High-saturation graphic poster aesthetic with bold gradient backgrounds (electric pink to violet to orange). Dynamic diagonal composition, abstract 3D shapes or risograph-style illustration, Gen-Z energy. Maximalist, loud, contemporary. Behance / Dribbble trending. NOT photographic, NOT subtle — must be visually loud and saturated",
    previewGradient: "linear-gradient(135deg, #FF5E62 0%, #FF9966 50%, #7C3AED 100%)",
    accent: "#FFFFFF",
  },
  {
    id: "human-warm",
    label: "Humano e Acolhedor",
    blurb: "Tons quentes, texturas orgânicas, sensação de proximidade.",
    directive:
      "Warm earthy lifestyle photography with terracotta, ochre, sand and cream palette. Natural fibers, linen, wood, ceramic textures. Golden-hour warm light, slight film grain. Hands, gestures, intimate close-ups suggesting human presence. Cozy, tactile, trust-building. Cereal Magazine / Madewell aesthetic. NOT cold, NOT minimal-white, NOT corporate",
    previewGradient: "linear-gradient(135deg, #E8C39E 0%, #C97B5A 100%)",
    accent: "#5C2E1A",
  },
  {
    id: "technical-authority",
    label: "Autoridade Técnica",
    blurb: "Visual analítico, paleta marinho/verde escuro, transmite expertise.",
    directive:
      "Structured analytical visual: deep navy and forest-green palette (#0B2447, #0F3D2E) with cyan or pale-blue technical accents. Architectural geometry, blueprint lines, grid systems, abstract data motifs (charts, isometric shapes). Cool sharp lighting, precise edges. Bloomberg / McKinsey aesthetic. NOT warm, NOT photographic-lifestyle — must convey expertise, rigor and credibility",
    previewGradient: "linear-gradient(135deg, #0B2447 0%, #19376D 60%, #0F3D2E 100%)",
    accent: "#7DD3FC",
  },
];

export const getAIStyleById = (id: AIStyleId | null | undefined): AIStyleOption | undefined =>
  AI_STYLE_OPTIONS.find((s) => s.id === id);
