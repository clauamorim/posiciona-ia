// Prompts oficiais por arquétipo — NÃO MODIFICAR.
// Estes textos foram fornecidos pelo cliente e devem ser usados exatamente como estão.

export type ArchetypeName =
  | "Governante"
  | "Sábio"
  | "Cuidador"
  | "Criador"
  | "Herói"
  | "Explorador"
  | "Inocente"
  | "Cara-comum"
  | "Mago"
  | "Amante"
  | "Rebelde"
  | "Bobo-da-corte";

// FLUX.1 Krea [dev] entrega textura natural de pele NATIVAMENTE — não precisa
// de prompt longo brigando com o modelo. Suffix mínimo: lente + luz + DOF.
// Tudo que era "unretouched skin / visible pores / no airbrush / kodak portra"
// foi removido — Krea já cumpre isso por default. Prompt curto = menos
// interferência na semelhança facial entregue pelo LoRA.
const QUALITY_SUFFIX =
  "editorial portrait photograph, natural skin texture, soft daylight, shallow depth of field, 50mm lens";
// Negative enxuto: só o estrutural. Krea não responde bem a negative longo —
// preferimos confiar no modelo e bloquear apenas defeitos catastróficos.
const STUDIO_NEGATIVE_BASE =
  ", plastic skin, airbrushed, cgi, deformed, asymmetric eyes, distorted proportions, aged skin, deep wrinkles, sagging skin, elderly, much older than reference";
// Reforço de anatomia de mãos — aplicado APENAS aos looks que mostram mãos
// (atualmente nenhum, hands-out-of-frame em todos).
const HANDS_NEGATIVE_REINFORCE = ", extra fingers, deformed fingers, fused fingers, claw hands";

// ============================================================================
// POOL DE POSES — estratégia "MÃOS INVISÍVEIS".
// FLUX (e qualquer modelo de difusão) deforma dedos com frequência. Em vez de
// tentar gerar mãos perfeitas, ESCONDEMOS as mãos em 100% dos looks usando
// 4 categorias gestuais que mantêm variedade visual via braços, ombros e postura.
// Cada arquétipo é mapeado a uma família; cada família tem 4 categorias.
// ============================================================================

export type ArchetypeFamily = "authority" | "nurturing" | "expressive" | "independent";

export const ARCHETYPE_FAMILY: Record<string, ArchetypeFamily> = {
  "Governante": "authority",
  "Herói": "authority",
  "Mago": "authority",
  "Cuidador": "nurturing",
  "Inocente": "nurturing",
  "Cara-comum": "nurturing",
  "Criador": "expressive",
  "Amante": "expressive",
  "Bobo-da-corte": "expressive",
  "Sábio": "independent",
  "Explorador": "independent",
  "Rebelde": "independent",
};

/**
 * Categorias gestuais — 4 estratégias que escondem dedos:
 *   - behind_back: mãos atrás das costas (totalmente invisíveis)
 *   - deep_pocket: mãos enfiadas profundamente nos bolsos (só pulso visível)
 *   - cropped_out: braços relaxados, mãos abaixo da linha do enquadramento
 *   - holding_object: segurando objeto que cobre os dedos
 *
 * O sorteio em pickPosesForLooks garante que looks 1 e 2 venham de
 * categorias DIFERENTES — variedade sem nunca expor dedos.
 */
export type PoseCategory = "behind_back" | "deep_pocket" | "cropped_out" | "holding_object";

export const HAND_POSE_POOLS_BY_CATEGORY: Record<ArchetypeFamily, Record<PoseCategory, string[]>> = {
  authority: {
    behind_back: [
      "hands clasped behind back, shoulders open and squared, confident upright posture",
      "arms held behind back, wrists hidden, chest open, commanding stance",
    ],
    deep_pocket: [
      "both hands deep in trouser pockets, only wrists visible at the hem, relaxed authoritative stance",
      "one hand deep in trouser pocket with thumb hooked at the seam, other arm naturally lowered with hand cropped below frame",
    ],
    cropped_out: [
      "arms relaxed downward at sides, hands cropped below the frame, strong upright posture",
      "arms loosely crossed high at the chest with each hand tucked under the opposite upper arm, hands fully hidden",
    ],
    holding_object: [
      "arms folded holding a closed leather notebook flat against the chest, hands obscured by the notebook cover",
      "holding folded reading glasses in front of the chest with both hands wrapped around the frame, fingers hidden behind the glasses",
    ],
  },
  nurturing: {
    behind_back: [
      "hands gently clasped behind back, soft open shoulders, warm posture",
    ],
    deep_pocket: [
      "both hands tucked softly into cardigan pockets, only wrists visible, gentle stance",
      "one hand softly tucked into pocket with wrist barely visible, other arm relaxed downward and cropped below frame",
    ],
    cropped_out: [
      "arms relaxed naturally at sides, hands cropped below the frame, soft open posture",
      "arms loosely crossed at the waist with each hand tucked under the opposite forearm, hands fully hidden",
    ],
    holding_object: [
      "holding a closed hardcover book flat against the chest with both arms wrapped around it, fingers hidden behind the book",
      "holding a ceramic mug at chest level with both hands wrapped around the cup, fingers obscured by the mug",
    ],
  },
  expressive: {
    behind_back: [
      "one hand holding the opposite wrist behind the back, expressive open shoulders",
    ],
    deep_pocket: [
      "one hand casually tucked deep in pocket with only the wrist showing, other arm crossed over the torso with the hand hidden under the upper arm",
    ],
    cropped_out: [
      "arms relaxed downward in a flowing posture, hands cropped below the frame, expressive shoulder line",
      "arms gently crossed high with each hand tucked beneath the opposite upper arm, hands fully concealed",
    ],
    holding_object: [
      "holding a closed sketchbook flat against the chest with both arms, fingers hidden behind the cover",
      "holding a folded silk scarf against the torso with both hands wrapped around the fabric, fingers obscured by the scarf",
      "holding a closed pair of sunglasses against the chest with both hands cupping the frame, fingers concealed behind the glasses",
    ],
  },
  independent: {
    behind_back: [
      "hands clasped behind back, casual confident posture, relaxed shoulders",
    ],
    deep_pocket: [
      "both hands deep in jeans pockets with only the wrists exposed, relaxed independent stance",
      "one hand deep in trouser pocket, other arm relaxed downward with hand cropped below the frame",
    ],
    cropped_out: [
      "arms naturally at sides, hands cropped below the frame, casual upright stance",
      "arms loosely crossed over the chest with each hand tucked beneath the opposite upper arm, hands fully hidden",
    ],
    holding_object: [
      "holding a closed leather journal flat against the torso with both arms wrapped around it, fingers concealed behind the cover",
      "holding folded sunglasses against the chest with both hands cupping the frame, fingers hidden behind the glasses",
    ],
  },
};

/** Pool plano legado — mantido para retrocompat caso algum chamador antigo use. */
export const HAND_POSE_POOLS: Record<ArchetypeFamily, string[]> = {
  authority: Object.values(HAND_POSE_POOLS_BY_CATEGORY.authority).flat(),
  nurturing: Object.values(HAND_POSE_POOLS_BY_CATEGORY.nurturing).flat(),
  expressive: Object.values(HAND_POSE_POOLS_BY_CATEGORY.expressive).flat(),
  independent: Object.values(HAND_POSE_POOLS_BY_CATEGORY.independent).flat(),
};

/**
 * Sorteia 2 poses de CATEGORIAS DIFERENTES, evitando categorias usadas
 * recentemente (memória curta). Devolve {pose, category}.
 */
function shuffleArr<T>(a: T[]): T[] {
  const c = a.slice();
  for (let i = c.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [c[i], c[j]] = [c[j], c[i]];
  }
  return c;
}

export function pickPosesForLooks(
  family: ArchetypeFamily,
  recentlyUsedPoses: string[],
  count = 2,
): { pose: string; category: PoseCategory }[] {
  const byCat = HAND_POSE_POOLS_BY_CATEGORY[family];
  const allCats = Object.keys(byCat) as PoseCategory[];
  // Filtra categorias que tenham ao menos 1 pose não usada recentemente
  const usedSet = new Set(recentlyUsedPoses);
  const catsWithFresh = allCats.filter((c) => byCat[c].some((p) => !usedSet.has(p)));
  const catsToUse = catsWithFresh.length >= count ? catsWithFresh : allCats;
  const chosenCats = shuffleArr(catsToUse).slice(0, count);
  return chosenCats.map((cat) => {
    const fresh = byCat[cat].filter((p) => !usedSet.has(p));
    const pool = fresh.length > 0 ? fresh : byCat[cat];
    const pose = shuffleArr(pool)[0];
    return { pose, category: cat };
  });
}

export function getArchetypeFamily(archetype: string): ArchetypeFamily {
  return ARCHETYPE_FAMILY[archetype] ?? "nurturing";
}

// Templates MÍNIMOS por arquétipo. Apenas a essência: expressão + iluminação + fundo.
// O builder monta: {trigger} {gender}, {essência}, {hair}, {outfit}, {QUALITY_SUFFIX}
// Fundo SEMPRE estúdio (seamless paper backdrop) em paleta neutra:
// apenas tons de cinza, marrom e preto. Sem cor saturada, sem cenário.
export const ARCHETYPE_PROMPTS: Record<ArchetypeName, { prompt: string; negative: string }> = {
  "Governante": {
    prompt: "authoritative calm expression, hard directional lighting, deep charcoal seamless paper studio backdrop with subtle paper texture, no smile",
    negative: "casual, smiling, soft lighting",
  },
  "Sábio": {
    prompt: "calm contemplative expression, soft Rembrandt lighting, dark grey seamless paper studio backdrop with subtle paper texture, no smile",
    negative: "casual, wide smile, harsh lighting",
  },
  "Cuidador": {
    prompt: "gentle approachable expression, soft diffused lighting, warm taupe seamless paper studio backdrop with subtle paper texture, slight natural smile",
    negative: "harsh lighting, cold expression",
  },
  "Criador": {
    prompt: "expressive authentic expression, dramatic side lighting, sepia brown seamless paper studio backdrop with subtle paper texture, intense gaze",
    negative: "corporate look, flat lighting, stiff pose",
  },
  "Herói": {
    prompt: "determined strong expression, high contrast dramatic lighting, black seamless paper studio backdrop with subtle paper texture, intense direct gaze",
    negative: "soft lighting, casual relaxed expression",
  },
  "Explorador": {
    prompt: "free confident expression, natural warm lighting, mocha brown seamless paper studio backdrop with subtle paper texture, subtle smile",
    negative: "stiff corporate pose",
  },
  "Inocente": {
    prompt: "genuine warm expression, soft bright lighting, light grey seamless paper studio backdrop with subtle paper texture, natural smile",
    negative: "serious heavy expression",
  },
  "Cara-comum": {
    prompt: "approachable relatable expression, soft natural lighting, medium grey seamless paper studio backdrop with subtle paper texture, light smile",
    negative: "dramatic lighting, intense expression",
  },
  "Mago": {
    prompt: "intense magnetic expression, dramatic chiaroscuro lighting, deep black seamless paper studio backdrop with subtle paper texture, no smile",
    negative: "flat lighting, casual cheerful expression",
  },
  "Amante": {
    prompt: "warm sophisticated expression, soft golden hour lighting, warm dark brown seamless paper studio backdrop with subtle paper texture, subtle smile",
    negative: "harsh cold lighting, washed out tones",
  },
  "Rebelde": {
    prompt: "bold unconventional expression, high contrast dramatic lighting, matte black seamless paper studio backdrop with subtle paper texture, direct challenging gaze",
    negative: "corporate look, soft polished lighting",
  },
  "Bobo-da-corte": {
    prompt: "playful authentic expression, bright dynamic lighting, warm grey seamless paper studio backdrop with subtle paper texture, natural smile",
    negative: "serious heavy expression",
  },
};

// Mapeamento de fundo para os 3 looks (Neutro / Claro / Escuro).
// Replacement curto, em linguagem natural, sem redundância.
// Mapeamento de fundo para os 3 looks (Neutro / Claro / Escuro).
// O regex captura "...background[...],"  — replacement já inclui a vírgula final.
export const BACKGROUND_VARIATIONS = [
  { key: "neutro", label: "Neutro", replacement: null }, // mantém o paper backdrop do arquétipo
  { key: "claro", label: "Claro", replacement: "light grey seamless paper studio backdrop with subtle paper texture," },
  { key: "escuro", label: "Escuro", replacement: "medium-dark charcoal grey seamless paper studio backdrop with subtle paper texture (NOT pure black, keep the backdrop a few stops above black so the face stays well-lit and clearly readable)," },
] as const;

/**
 * Framing por look. ESTRATÉGIA "MÃOS FORA DO FRAME EM 100%".
 * Look 0 (Neutro): instrução vazia → default natural do FLUX é close-up.
 * Looks 1/2 recebem instrução curta de bust/chest-up.
 */
export const FRAMING_VARIATIONS = [
  { key: "headshot", showsHands: false, instruction: "" },
  { key: "bust", showsHands: false, instruction: "bust crop" },
  { key: "chest-up", showsHands: false, instruction: "chest-up crop" },
] as const;

// Regex para localizar a frase de fundo nos templates mínimos.
// Os novos templates terminam com "...seamless paper studio backdrop with subtle paper texture, no smile" etc.
// Captura desde a primeira palavra-chave de cor (charcoal/grey/brown/black/etc) ou a expressão "seamless paper studio backdrop"
// até a primeira vírgula APÓS "paper texture".
// Estratégia simples: captura "<algo> seamless paper studio backdrop with subtle paper texture," — backdrop sempre termina assim.
const BACKGROUND_REGEX = /[a-z\s-]*seamless paper studio backdrop with subtle paper texture,/i;

export interface PhysicalTraits {
  gender: "woman" | "man";
  hair_color: string;
  hair_length: string;
  hair_style: string;
  skin_tone: string;
  eye_color: string;
  /** Faixa etária aparente. Opcional pra retrocompat com treinos antigos. */
  apparent_age_range?: "20s" | "30s" | "40s" | "50s" | "60s+";
  /** True quando há fios brancos visíveis mas o cabelo NÃO é totalmente grisalho. */
  hair_has_grey?: boolean;
}

const AGE_RANGE_TO_TOKEN: Record<NonNullable<PhysicalTraits["apparent_age_range"]>, string> = {
  "20s": "in her 20s",
  "30s": "in her 30s",
  "40s": "in her 40s",
  "50s": "in her 50s",
  "60s+": "in her 60s",
};

const AGE_RANGE_TO_TOKEN_MALE: Record<NonNullable<PhysicalTraits["apparent_age_range"]>, string> = {
  "20s": "in his 20s",
  "30s": "in his 30s",
  "40s": "in his 40s",
  "50s": "in his 50s",
  "60s+": "in his 60s",
};

export interface BuildPromptParams {
  archetype: ArchetypeName | string;
  userId: string;
  /** Trigger word REAL gerado no treino (USR + 12 hex). Se omitido, derivado do userId. */
  triggerWord?: string;
  gender: "woman" | "man" | "none";
  outfit: string;
  hair: string;  // só usado se gender === "woman" e não houver physicalTraits
  makeup: string; // só usado se gender === "woman"
  backgroundIndex: 0 | 1 | 2;
  physicalTraits?: PhysicalTraits | null;
  /** Pose de mãos sorteada do pool da família do arquétipo (em inglês). */
  handPose?: string | null;
}

export function buildPortraitPrompt(params: BuildPromptParams): {
  prompt: string;
  negative: string;
  backgroundKey: string;
} {
  const archetypeKey = (params.archetype in ARCHETYPE_PROMPTS
    ? params.archetype
    : "Cara-comum") as ArchetypeName;
  const tpl = ARCHETYPE_PROMPTS[archetypeKey];
  const bg = BACKGROUND_VARIATIONS[params.backgroundIndex];

  // Os traços extraídos do treino são a fonte primária de gênero — sobrescrevem o cadastro.
  const effectiveGender: "woman" | "man" | "none" =
    params.physicalTraits?.gender ?? params.gender;

  // Framing por look — controla se mãos aparecem no frame.
  const framing = FRAMING_VARIATIONS[params.backgroundIndex];

  // Trigger word REAL do treino (USR + 12 hex). Se não vier, deriva do userId.
  const triggerWord = params.triggerWord
    || `USR${params.userId.replace(/-/g, "").slice(0, 12)}`;

  // ===== TEMPLATE BASE: aplica fundo (claro/escuro) sobre a essência do arquétipo =====
  let archetypeEssence = tpl.prompt;
  if (bg.replacement) {
    if (BACKGROUND_REGEX.test(archetypeEssence)) {
      archetypeEssence = archetypeEssence.replace(BACKGROUND_REGEX, `${bg.replacement}`);
    } else {
      console.log(`[portrait-prompt] background regex did not match for archetype=${archetypeKey} — prepending`);
      archetypeEssence = `${bg.replacement} ${archetypeEssence}`;
    }
  }

  // ===== TRAITS MÍNIMOS: cabelo (cor + comprimento, com nuance de fios brancos) =====
  // Pele e olhos saem — o LoRA já sabe disso e tokens extras diluem atenção.
  let hairDescriptor = "";
  if (params.physicalTraits) {
    const t = params.physicalTraits;
    const baseColor = (t.hair_color || "").toLowerCase();
    const isAlreadyGrey = /grey|gray|white|silver/.test(baseColor);
    if (t.hair_has_grey && !isAlreadyGrey) {
      // Tem alguns fios brancos mas o cabelo NÃO é grisalho — descreve com nuance
      // pra evitar que o Flux generalize pra "senhora totalmente grisalha".
      hairDescriptor = `${t.hair_length} ${t.hair_color} hair with subtle grey strands`;
    } else {
      hairDescriptor = `${t.hair_length} ${t.hair_color} hair`;
    }
  } else if (effectiveGender === "woman" && params.hair) {
    hairDescriptor = params.hair;
  }

  // ===== OUTFIT em texto natural =====
  const outfitText = (params.outfit || "").trim();

  // ===== GÊNERO: token simples =====
  const genderToken = effectiveGender === "none" ? "person" : effectiveGender;

  // ===== ÂNCORA DE IDADE — Krea tende a envelhecer; sem âncora vai pra 50-60 =====
  // Default seguro: 30s (faixa neutra que o modelo respeita bem com LoRA).
  let ageToken = "";
  const ageRange = params.physicalTraits?.apparent_age_range;
  if (effectiveGender === "woman") {
    ageToken = ageRange ? AGE_RANGE_TO_TOKEN[ageRange] : "in her 30s";
  } else if (effectiveGender === "man") {
    ageToken = ageRange ? AGE_RANGE_TO_TOKEN_MALE[ageRange] : "in his 30s";
  }

  // ===== MONTAGEM FINAL — espelha estrutura do manual que funcionou =====
  // {trigger} {gender} {ageToken}, {framing?}, {archetype_essence}, {hair?}, {outfit?}, {QUALITY_SUFFIX}
  const headToken = ageToken
    ? `${triggerWord} ${genderToken} ${ageToken}`
    : `${triggerWord} ${genderToken}`;
  const parts: string[] = [headToken];
  if (framing.instruction) parts.push(framing.instruction);
  parts.push(archetypeEssence);
  if (hairDescriptor) parts.push(hairDescriptor);
  if (outfitText) parts.push(outfitText);
  parts.push(QUALITY_SUFFIX);

  let prompt = parts.join(", ");

  // ===== NEGATIVE =====
  let negative = tpl.negative + STUDIO_NEGATIVE_BASE + (framing.showsHands ? HANDS_NEGATIVE_REINFORCE : "");

  // Reforço de gênero no negative (técnica padrão Flux LoRA contra troca).
  if (effectiveGender === "woman") {
    negative += ", man, beard, mustache, masculine features";
  } else if (effectiveGender === "man") {
    negative += ", woman, feminine features, lipstick";
  }

  // Negative específico por outfit — impede o Flux de "voltar" ao blazer das selfies.
  const outfitLower = outfitText.toLowerCase();
  if (/\bdress\b|\bgown\b|\bslip dress\b/.test(outfitLower)) {
    negative += ", blazer, suit jacket, trousers, formal suit, turtleneck, tie";
  }
  if (/\bcardigan\b|\bknit\b|\bknitwear\b|\bsweater\b/.test(outfitLower)) {
    negative += ", blazer, suit jacket, tie";
  }
  if (/\bcoat\b|\btrench\b|\bovercoat\b/.test(outfitLower)) {
    negative += ", blazer underneath, formal suit";
  }
  if (/\bblazer\b|\bpantsuit\b|\bsuit\b/.test(outfitLower)) {
    negative += ", dress, t-shirt, hoodie, sportswear";
  }
  if (/\bathletic\b|\bsportswear\b|\blegging\b|\bgym\b|\bworkout\b|\bsports?\s*top\b|academia/.test(outfitLower)) {
    negative += ", formal wear, blazer, suit, tie";
  }
  if (/\bjumpsuit\b|macac/.test(outfitLower)) {
    negative += ", separate top and trousers, blazer";
  }
  if (/\bjeans\b|\bdenim\b/.test(outfitLower)) {
    negative += ", formal trousers, suit pants";
  }

  // Limpeza final.
  prompt = cleanupPrompt(prompt);

  return { prompt, negative, backgroundKey: bg.key };
}

function cleanupPrompt(s: string): string {
  return s
    .replace(/,\s*,/g, ",")     // ", ," → ","
    .replace(/,\s*,/g, ",")     // segunda passada para ", , ,"
    .replace(/\s{2,}/g, " ")    // espaços duplos
    .replace(/,\s*\n/g, "\n")   // vírgula órfã antes de quebra
    .replace(/^\s*,\s*/g, "")   // vírgula no início
    .replace(/,\s*$/g, "")      // vírgula no fim
    .trim();
}

export function mapGender(g?: string | null): "woman" | "man" | "none" {
  if (g === "Feminino") return "woman";
  if (g === "Masculino") return "man";
  return "none";
}

// Dicionário PT→EN focado em peças de moda dos relatórios. Aplicado por substring
// case-insensitive. O que não bater no dicionário é mantido — o Flux ainda tenta
// interpretar, e termos universais (trench coat, blazer, cardigan) já vêm em inglês.
const PT_EN_FASHION: Array<[RegExp, string]> = [
  // Vestidos (mais específico antes de mais genérico)
  [/vestido\s+tubinho\s+midi/gi, "midi sheath dress"],
  [/vestido\s+tubinho/gi, "sheath dress"],
  [/vestido\s+midi/gi, "midi dress"],
  [/vestido\s+longo/gi, "long dress"],
  [/vestido\s+envelope/gi, "wrap dress"],
  [/vestido\s+camisa/gi, "shirt dress"],
  [/vestido\s+slip/gi, "slip dress"],
  [/vestido/gi, "dress"],
  [/macacão|macacao/gi, "jumpsuit"],
  // Atletwear / academia
  [/roupa\s+de\s+academia|roupa\s+de\s+gin[áa]stica|look\s+fitness|gym\s+wear/gi, "athletic wear sportswear"],
  [/legging/gi, "leggings"],
  [/top\s+esportivo|top\s+fitness|sports\s+top/gi, "sports top"],
  [/moletom/gi, "sweatshirt"],
  [/regata\s+esportiva/gi, "athletic tank top"],
  // Casacos / outerwear
  [/sobretudo/gi, "overcoat"],
  [/trench\s*coat/gi, "trench coat"],
  [/casaco\s+longo/gi, "long coat"],
  [/casaco/gi, "coat"],
  [/jaqueta\s+de\s+couro/gi, "leather jacket"],
  [/jaqueta/gi, "jacket"],
  // Blazers / ternos
  [/blazer\s+(de\s+)?alfaiataria/gi, "tailored blazer"],
  [/blazer\s+estruturado/gi, "structured blazer"],
  [/blazer\s+oversized/gi, "oversized blazer"],
  [/blazer\s+transpassad[oa]/gi, "double-breasted blazer"],
  [/blazer/gi, "blazer"],
  [/terninho/gi, "pantsuit"],
  [/terno\s+de\s+3\s+pe[çc]as|terno\s+de\s+tr[êe]s\s+pe[çc]as/gi, "three-piece suit"],
  [/terno/gi, "suit"],
  // Calças
  [/cal[çc]a\s+(de\s+)?alfaiataria/gi, "tailored trousers"],
  [/cal[çc]a\s+pantalona/gi, "wide-leg trousers"],
  [/cal[çc]a\s+reta/gi, "straight-leg trousers"],
  [/cal[çc]a\s+jeans/gi, "denim jeans"],
  [/cal[çc]a\s+chino/gi, "chinos"],
  [/cal[çc]a\s+cintura\s+alta|cintura\s+alta/gi, "high-waist trousers"],
  [/cal[çc]a/gi, "trousers"],
  [/jeans/gi, "denim jeans"],
  // Saias
  [/saia\s+midi/gi, "midi skirt"],
  [/saia\s+l[áa]pis/gi, "pencil skirt"],
  [/saia\s+longa/gi, "long skirt"],
  [/saia/gi, "skirt"],
  // Tops
  [/camisa\s+(de\s+)?seda/gi, "silk shirt"],
  [/blusa\s+(de\s+)?seda/gi, "silk blouse"],
  [/top\s+(de\s+)?seda/gi, "silk top"],
  [/camisa\s+(de\s+)?linho/gi, "linen shirt"],
  [/blusa\s+(de\s+)?linho/gi, "linen blouse"],
  [/camisa\s+(de\s+)?algod[ãa]o/gi, "cotton shirt"],
  [/blusa\s+(de\s+)?algod[ãa]o/gi, "cotton blouse"],
  [/blusa\s+b[áa]sica/gi, "fitted top"],
  [/camiseta\s+b[áa]sica/gi, "fitted t-shirt"],
  [/camiseta/gi, "t-shirt"],
  [/camisa\s+social/gi, "button-up shirt"],
  [/camisa/gi, "button-up shirt"],
  [/blusa\s+transpassad[oa]/gi, "wrap top"],
  [/blusa/gi, "blouse"],
  [/cardig[ãa]/gi, "cardigan"],
  [/tric[ôo]/gi, "knitwear"],
  [/malha/gi, "knit top"],
  [/su[ée]ter\s+(de\s+)?cashmere/gi, "cashmere sweater"],
  [/su[ée]ter/gi, "sweater"],
  [/cashmere/gi, "cashmere"],
  [/gola\s+alta/gi, "turtleneck"],
  [/regata/gi, "tank top"],
  // Detalhes
  [/decote\s+v|decote\s+em\s+v/gi, "v-neck"],
  [/decote\s+u/gi, "scoop neck"],
  [/decote\s+quadrado/gi, "square neckline"],
  [/decote/gi, "neckline"],
  [/al[çc]a\s+fina|al[çc]as\s+finas/gi, "thin straps"],
  [/al[çc]a\s+larga|al[çc]as\s+largas/gi, "wide straps"],
  [/al[çc]a/gi, "strap"],
  [/sem\s+mangas|sem\s+manga/gi, "sleeveless"],
  [/manga\s+curta/gi, "short sleeves"],
  [/manga\s+longa/gi, "long sleeves"],
  [/manga\s+3\/4|manga\s+tr[êe]s\s+quartos/gi, "three-quarter sleeves"],
  // Tecidos
  [/seda/gi, "silk"],
  [/cetim/gi, "satin"],
  [/veludo/gi, "velvet"],
  [/linho/gi, "linen"],
  [/algod[ãa]o/gi, "cotton"],
  [/couro/gi, "leather"],
  [/jeans|denim/gi, "denim"],
  // Sapatos
  [/sapato\s+scarpin|scarpin/gi, "pointed-toe pumps"],
  [/salto\s+alto|salto/gi, "high heels"],
  [/sand[áa]lia/gi, "sandals"],
  [/bota/gi, "boots"],
  [/mocassim/gi, "loafers"],
  [/t[êe]nis/gi, "sneakers"],
  // Acessórios
  [/cinto\s+fino/gi, "thin belt"],
  [/cinto\s+(de\s+)?couro/gi, "leather belt"],
  [/cinto/gi, "belt"],
  [/len[çc]o/gi, "scarf"],
  [/bolsa/gi, "bag"],
  [/colar\s+dourado/gi, "gold necklace"],
  [/colar/gi, "necklace"],
  [/brincos\s+dourados/gi, "gold earrings"],
  [/brincos\s+de\s+p[ée]rola/gi, "pearl earrings"],
  [/brincos\s+statement/gi, "statement earrings"],
  [/brincos/gi, "earrings"],
  [/argolas?\s+dourad[oa]s/gi, "gold hoop earrings"],
  [/an[ée]is/gi, "rings"],
  [/an[ée]l/gi, "ring"],
  [/rel[óo]gio/gi, "watch"],
  // Cores
  [/bege/gi, "beige"],
  [/caramelo/gi, "caramel"],
  [/camelo/gi, "camel"],
  [/marinho|azul\s+marinho/gi, "navy"],
  [/vinho|bord[ôo]/gi, "burgundy"],
  [/terracota/gi, "terracotta"],
  [/ferrugem/gi, "rust"],
  [/laranja\s+queimado/gi, "burnt orange"],
  [/mostarda/gi, "mustard"],
  [/esmeralda/gi, "emerald"],
  [/verde\s+oliva|oliva/gi, "olive"],
  [/verde\s+s[áa]lvia|s[áa]lvia/gi, "sage green"],
  [/verde/gi, "green"],
  [/lavanda/gi, "lavender"],
  [/malva/gi, "mauve"],
  [/rosa\s+blush/gi, "blush pink"],
  [/rosa\s+antigo/gi, "dusty rose"],
  [/rosa/gi, "pink"],
  [/champanhe|champagne/gi, "champagne"],
  [/marfim/gi, "ivory"],
  [/creme/gi, "cream"],
  [/off[\s-]?white/gi, "off-white"],
  [/nude/gi, "nude"],
  [/grafite/gi, "charcoal"],
  [/preto/gi, "black"],
  [/branco/gi, "white"],
  [/cinza/gi, "grey"],
  [/marrom/gi, "brown"],
  [/dourado|ouro/gi, "gold"],
  [/prata|prateado/gi, "silver"],
];

export function translateFashion(text: string): string {
  let out = text;
  for (const [re, en] of PT_EN_FASHION) {
    out = out.replace(re, en);
  }
  return out;
}

export function buildOutfitText(figurino: any): string {
  if (!figurino || typeof figurino !== "object") return "";
  const pieces = Array.isArray(figurino.pecas_chave) ? figurino.pecas_chave.slice(0, 3).join(", ") : "";
  const colors = Array.isArray(figurino.cores_roupa) ? figurino.cores_roupa.slice(0, 2).join(" and ") : "";
  const raw = pieces && colors ? `${pieces} in ${colors}` : (pieces || colors || "");
  return translateFashion(raw);
}

/**
 * Variação de figurino por look: usa figurino.looks_completos[lookIndex] do relatório.
 * Retorna a string já traduzida PT→EN, com no máximo 3 "headline pieces" (top/bottom/outer)
 * para não diluir a atenção do Flux. Cada chamada (Neutro/Claro/Escuro) usa um look diferente.
 */
export function buildOutfitTextForLook(figurino: any, lookIndex: number): string {
  if (!figurino || typeof figurino !== "object") return "";
  const looks = Array.isArray(figurino.looks_completos) ? figurino.looks_completos : [];

  // Modificadores sintéticos para forçar variação quando o relatório tem < 3 looks distintos.
  const SYNTHETIC_MODIFIERS = [
    "smart casual styling, neutral palette",
    "elegant refined styling, lighter palette",
    "structured tailored styling, darker palette",
  ];

  if (looks.length === 0) {
    const base = buildOutfitText(figurino);
    return base ? `${base}, ${SYNTHETIC_MODIFIERS[lookIndex % 3]}` : SYNTHETIC_MODIFIERS[lookIndex % 3];
  }

  const look = looks[lookIndex % looks.length];
  if (!look || !Array.isArray(look.pecas) || look.pecas.length === 0) {
    const base = buildOutfitText(figurino);
    return base ? `${base}, ${SYNTHETIC_MODIFIERS[lookIndex % 3]}` : SYNTHETIC_MODIFIERS[lookIndex % 3];
  }

  // Pega só 3 peças headline (top + bottom + outer/shoes) — acessórios pequenos diluem.
  const headline = look.pecas.slice(0, 3).map((p: string) => translateFashion(String(p))).join(", ");
  let outfit = headline;

  if (looks.length < 3) {
    outfit += `, ${SYNTHETIC_MODIFIERS[lookIndex % 3]}`;
  }
  return outfit;
}

export function buildHairText(figurino: any): string {
  if (!figurino || typeof figurino !== "object") return "";
  if (typeof figurino.penteado === "string") return figurino.penteado;
  if (typeof figurino.cabelo === "string") return figurino.cabelo;
  return "";
}

export function buildMakeupText(figurino: any): string {
  if (!figurino || typeof figurino !== "object") return "";
  if (typeof figurino.maquiagem === "string") return figurino.maquiagem;
  return "";
}

// ============================================================================
// NANO BANANA PRO BUILDER
// Construtor de prompt otimizado para google/gemini-3-pro-image-preview com
// referências visuais (selfies). Diferente do Flux+LoRA, o Gemini recebe as
// selfies como image_url e preserva identidade nativamente — não precisamos de
// trigger word, LoRA, ou prompt longo. O foco é descrever a CENA (arquétipo,
// figurino, fundo, pose) e instruir EXPLICITAMENTE a preservar idade, etnia,
// cabelo e textura natural de pele.
// ============================================================================

export interface GeminiPromptParams {
  archetype: ArchetypeName | string;
  outfit: string;
  backgroundIndex: 0 | 1 | 2;
  handPose?: string | null;
  /** Gênero opcional só pra refinar pronome no texto. */
  gender?: "woman" | "man" | "none";
  /** Faixa etária aparente detectada via Gemini Vision. Default seguro: "40s". */
  apparentAgeRange?: "20s" | "30s" | "40s" | "50s" | "60s+";
}

export function buildGeminiPortraitPrompt(params: GeminiPromptParams): {
  prompt: string;
  backgroundKey: string;
} {
  const archetypeKey = (params.archetype in ARCHETYPE_PROMPTS
    ? params.archetype
    : "Cara-comum") as ArchetypeName;
  const tpl = ARCHETYPE_PROMPTS[archetypeKey];
  // Para Gemini com referências, SEMPRE fundo neutro — fundos coloridos dos
  // arquétipos (warm taupe, sepia brown, etc.) foram projetados para FLUX+LoRA
  // e causam deriva de identidade no Gemini.
  const GEMINI_BACKGROUNDS = [
    { key: "neutro", replacement: "medium warm grey seamless paper studio backdrop with subtle paper texture," },
    { key: "claro", replacement: "light grey seamless paper studio backdrop with subtle paper texture," },
    { key: "escuro", replacement: "medium-dark charcoal grey seamless paper studio backdrop with subtle paper texture (NOT pure black, keep the backdrop a few stops above black so the face stays well-lit and clearly readable)," },
  ] as const;
  const bg = GEMINI_BACKGROUNDS[params.backgroundIndex];
  const framing = FRAMING_VARIATIONS[params.backgroundIndex];

  // Aplica fundo claro/escuro sobre a essência do arquétipo (mesma lógica do Krea).
  let archetypeEssence = tpl.prompt;
  if (bg.replacement) {
    if (BACKGROUND_REGEX.test(archetypeEssence)) {
      archetypeEssence = archetypeEssence.replace(BACKGROUND_REGEX, `${bg.replacement}`);
    } else {
      archetypeEssence = `${bg.replacement} ${archetypeEssence}`;
    }
  }

  const subject = params.gender === "man" ? "the man" : params.gender === "woman" ? "the woman" : "the person";
  const possessive = params.gender === "man" ? "his" : "her";

  const sceneParts: string[] = [
    `DOCUMENTARY PORTRAIT PHOTOGRAPH. Shot on Kodak Portra 400 35mm film by a documentary photographer. This is a press archive portrait — NOT a commercial beauty headshot, NOT a cosmetic ad, NOT stock photography. Film grain and natural skin imperfections are required for authenticity. NOT a 3D render, NOT CGI, NOT digital painting, NOT AI-stylized, NOT a beauty filter.`,
  ];

  if (params.apparentAgeRange) {
    sceneParts.push(
      `Subject is ${subject} apparently in their ${params.apparentAgeRange}. The output MUST match this exact apparent age — do not regress age, do not age up.`,
    );
  }

  sceneParts.push(
    // ===== STUDIO BACKDROP LOCK — fundo SEMPRE estúdio neutro =====
    `### STUDIO BACKDROP LOCK ###`,
    `Background MUST be a clean professional photo studio with a seamless paper backdrop only. Subtle paper texture and a soft light gradient are allowed. Color palette is STRICTLY neutral: shades of grey, brown and black only. ABSOLUTELY NO saturated colors, NO props, NO furniture, NO walls, NO windows, NO plants, NO studio equipment in frame. Just ${subject} in front of a clean neutral textured paper backdrop.`,

    // ===== SCENE =====
    `Scene direction: ${archetypeEssence}.`,
  );

  if (params.outfit) {
    sceneParts.push(`Wardrobe: ${params.outfit}.`);
  }
  if (params.handPose) {
    sceneParts.push(`Pose: ${params.handPose}.`);
  }
  if (framing.instruction) {
    sceneParts.push(`Framing: ${framing.instruction}, vertical 4:5 aspect ratio.`);
  } else {
    sceneParts.push(`Framing: editorial close-up headshot, vertical 4:5 aspect ratio.`);
  }
  sceneParts.push(
    `Lighting: one window-style softbox at 45°, natural falloff with visible shadow under the jaw and nose that is NOT fully filled — shadows give face depth and realism. Single catchlight in each eye consistent with one real light source. Subtle rim light separating hair from background. Avoid the flat, perfectly even "beauty ad" lighting that makes portraits look artificial.`,
  );
  if (params.backgroundIndex === 2) {
    // Fundo escuro: o modelo tende a subexpor o rosto e perder traços. Forçamos
    // exposição correta da pele e separação clara do fundo via rim light.
    sceneParts.push(
      `CRITICAL EXPOSURE FOR DARK BACKDROP: the face MUST be fully and evenly lit at correct skin exposure — never underexposed, never in shadow, never silhouetted against the dark backdrop. Use a strong key softbox at 45° plus a soft fill to keep ALL facial features (eyes, nose bridge, mouth, jawline, skin texture, freckles, moles) sharply visible and clearly readable. Add a defined rim/hair light to separate ${possessive} head and shoulders from the dark backdrop. Skin tone, micro-detail and identity must be IDENTICAL to the references — the dark backdrop must NEVER cause loss of facial detail or feature drift.`,
    );
  }
  sceneParts.push(
    `Technical: 85mm f/1.4 lens, shallow but realistic depth of field, accurate color science, fine 35mm film grain, sharp micro-detail on hair strands, eyelashes, eyebrows and skin pores, magazine cover quality.`,
  );

  // ===== IDENTITY LOCK — no FINAL, posição de maior peso de atenção no Gemini =====
  // No Gemini, instruções no fim do prompt dominam as do começo. Manter o lock
  // de identidade aqui é o que mais preserva os traços fisionômicos.
  sceneParts.push(
    `### CRITICAL IDENTITY LOCK — THIS OVERRIDES EVERYTHING ABOVE ###`,
    `This is a PHOTOGRAPHIC REPRODUCTION, not a portrait painting. The goal is forensic accuracy to the reference, not aesthetic improvement. Any deviation from the reference — smoother skin, younger appearance, more symmetrical features, brighter eyes, thinner face — is a failure, not an enhancement.`,
    `The FIRST reference image is the PRIMARY identity reference (ground truth). Any other reference images are auxiliary angles only — use them to understand 3D head structure, NEVER to average, blend, or beautify features.`,
    `Reproduce ${possessive} face with FORENSIC precision matching the first reference: distance between the eyes, natural facial asymmetries, eyelid shape and position, eye shape, tilt and color, eyebrow shape and thickness, exact nose length, width, bridge, tip and nostril shape, mouth width and curvature at rest, upper and lower lip shape and thickness, philtrum, forehead height and hairline, cheekbone structure, jaw angle, chin shape and projection, ear shape, neck proportions.`,
    `Skin — preserve EVERY freckle, mole, beauty mark, scar, blemish, pore texture, micro-tonal variation and faint asymmetry visible in the references. Natural human skin under a magazine loupe. Do NOT smooth, do NOT airbrush, do NOT beautify, do NOT apply ANY filter. Preserve visible skin pores, natural micro-texture variation, fine expression lines around the eyes and mouth, subtle uneven skin tone and natural skin grain exactly as photographed in the references. A macro loupe on the final image should reveal the same skin texture as the reference photo — not smoother, not cleaner, not more uniform.`,
    `Hair — preserve EXACTLY the hair color, length, density, parting and natural texture (including grey strands and roots) from the references. Render INDIVIDUAL strands along the hairline, temples and nape with natural flyaways and irregular shine. Eyelashes and eyebrows must show individual hairs.`,
    `Age — match the EXACT apparent age in the references. Preserve eye creases, fine lines, neck texture and expression lines. Do NOT regress age, do NOT make ${subject} look younger, do NOT smooth wrinkles. Ethnicity, natural skin tone and eye color — copied EXACTLY from the references.`,
    `ABSOLUTE PROHIBITIONS: do NOT average features across references. Do NOT idealize, prettify, symmetrize or "improve" the face. Do NOT generate a lookalike, an Instagram-model face, a generic AI face, or any face that is not a precise photographic reproduction of the first reference. If the output would not be recognized as the SAME PERSON in the first reference by a close friend, the result is WRONG.`,
  );

  sceneParts.push(
    `AVOID: generic AI face, idealized face, beautified face, plastic skin, waxy skin, doll-like skin, beauty filter, age regression, younger-looking face, perfectly symmetrical face, different person, lookalike; CGI render, cartoon, illustration, digital painting, AI-stylized look; helmet hair, wig-like hair, plastic hair; colorful background, saturated background, any non-neutral backdrop color; visible studio equipment, softbox in frame, props, furniture, plants, windows, architectural elements, outdoor scenery.`,
  );

  const prompt = sceneParts.join(" ");
  return { prompt, backgroundKey: bg.key };
}
