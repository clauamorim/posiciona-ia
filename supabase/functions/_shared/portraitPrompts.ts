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

// Reforço aplicado a todos os prompts: garante cenário de estúdio.
const STUDIO_PREFIX = "professional photography studio, controlled studio lighting, ";
// Negative base — aplicado a TODOS os looks (sem termos específicos de mãos).
const STUDIO_NEGATIVE_BASE = ", outdoor, street, natural daylight, trees, buildings, sky, park, beach, low quality, blurry, deformed face, asymmetric eyes, extra arms, three hands, four hands, mutated hands, extra limbs, missing limbs, disfigured, malformed, duplicate, two heads, cloned face, bad anatomy, multiple people";
// Reforço de anatomia de mãos — aplicado APENAS aos looks que mostram mãos (claro/escuro).
const HANDS_NEGATIVE_REINFORCE = ", extra fingers, six fingers, seven fingers, four fingers, fused fingers, deformed fingers, disfigured fingers, misshapen hands, bent broken fingers, twisted fingers, clenched fists, stiff claw hands, symmetrical fist pose, hands floating awkwardly, tense rigid fingers";

// ============================================================================
// POOL DE POSES DE MÃOS — variedade fotogênica por família de arquétipo.
// Cada arquétipo é mapeado para uma família; cada família tem 5–6 poses
// naturais e compatíveis com o tom emocional do arquétipo.
// O sorteio é feito em generate-portrait (sem reposição por geração).
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

export const HAND_POSE_POOLS: Record<ArchetypeFamily, string[]> = {
  authority: [
    "arms confidently crossed over chest, relaxed shoulders",
    "one hand thoughtfully under chin, other arm relaxed",
    "one hand gently holding blazer lapel, other arm at side",
    "both hands relaxed at sides, natural posture",
    "one hand resting in trouser pocket, other arm naturally at side",
    "one hand lightly resting on hip, other arm relaxed",
  ],
  nurturing: [
    "hands softly clasped in front, relaxed posture",
    "one hand gently placed over heart, other arm at side",
    "both arms relaxed naturally at sides, open posture",
    "one hand softly holding the opposite wrist in front",
    "open palms gesture at waist level, welcoming posture",
    "hands lightly folded in front, soft natural pose",
  ],
  expressive: [
    "one hand lightly touching chin, other arm relaxed",
    "one hand running gently through hair, other arm at side",
    "natural mid-conversation hand gesture, expressive posture",
    "one hand casually in pocket, other gesturing softly",
    "one hand resting against cheek, thoughtful pose",
    "arms relaxed with one hand expressively raised at chest level",
  ],
  independent: [
    "both hands resting in trouser pockets, relaxed posture",
    "arms casually crossed, relaxed and confident",
    "one hand in pocket, other arm naturally at side",
    "one hand resting on hip, weight slightly shifted",
    "thumb hooked into trouser pocket, other arm relaxed",
    "arms loosely crossed at waist, casual pose",
  ],
};

export function getArchetypeFamily(archetype: string): ArchetypeFamily {
  return ARCHETYPE_FAMILY[archetype] ?? "nurturing";
}

export const ARCHETYPE_PROMPTS: Record<ArchetypeName, { prompt: string; negative: string }> = {
  "Governante": {
    prompt: "USR[id] [gender], powerful executive portrait, authoritative calm expression, hard directional lighting, dark textured studio background with subtle wall texture, [outfit], [hair], [makeup], strong posture, direct confident gaze, no smile, fine skin pores, sharp focus, photorealistic, shot on Sony A7, 85mm f/1.4, natural facial features, authentic face, individual hair strands",
    negative: "plain white background, flat black background, soft lighting, casual, smiling, plastic skin, smooth hair, symmetrical face, artificial face, overly perfect features",
  },
  "Sábio": {
    prompt: "USR[id] [gender], intellectual professional portrait, calm contemplative expression, soft Rembrandt lighting, warm dark textured studio background, subtle linen or concrete wall texture, [outfit], [hair], [makeup], slight tilt of head, thoughtful gaze, no smile, fine skin pores, sharp focus, photorealistic, shot on Sony A7, 85mm f/1.4, natural facial features, authentic face, individual hair strands",
    negative: "plain white background, flat black background, harsh lighting, casual, smiling, plastic skin, smooth hair, symmetrical face, artificial face, overly perfect features",
  },
  "Cuidador": {
    prompt: "USR[id] [gender], warm professional portrait, gentle approachable expression, soft diffused lighting, warm textured studio background, soft beige or warm grey wall texture, [outfit], [hair], [makeup], slight natural smile, open body language, fine skin pores, sharp focus, photorealistic, shot on Canon R5, 85mm f/1.8, natural facial features, authentic face, individual hair strands",
    negative: "plain white background, flat black background, harsh lighting, dark background, serious expression, plastic skin, symmetrical face, artificial face, overly perfect features",
  },
  "Criador": {
    prompt: "USR[id] [gender], creative professional portrait, expressive authentic expression, dramatic side lighting, artistic textured studio background, weathered plaster or mixed tones wall texture, [outfit], [hair], [makeup], artistic pose, intense gaze, fine skin pores, sharp focus, photorealistic, shot on Leica M, 50mm f/1.4, natural facial features, authentic face, individual hair strands",
    negative: "plain white background, flat black background, corporate look, flat lighting, stiff pose, plastic skin, symmetrical face, artificial face, overly perfect features",
  },
  "Herói": {
    prompt: "USR[id] [gender], dynamic professional portrait, determined strong expression, high contrast dramatic lighting, deep textured studio background, dark grey stone or concrete wall texture, [outfit], [hair], [makeup], forward-leaning posture, intense direct gaze, jaw set, fine skin pores, sharp focus, photorealistic, shot on Nikon Z9, 85mm f/1.4, natural facial features, authentic face, individual hair strands",
    negative: "plain white background, flat black background, soft lighting, casual, relaxed expression, plastic skin, symmetrical face, artificial face, overly perfect features",
  },
  "Explorador": {
    prompt: "USR[id] [gender], authentic professional portrait, free confident expression, natural warm lighting, medium textured studio background, warm earthy tones wall texture, [outfit], [hair], [makeup], relaxed posture, genuine gaze, subtle smile, fine skin pores, sharp focus, photorealistic, shot on Fujifilm X-T5, 35mm f/1.4, natural facial features, authentic face, individual hair strands",
    negative: "plain white background, flat black background, stiff corporate pose, dark dramatic background, plastic skin, symmetrical face, artificial face, overly perfect features",
  },
  "Inocente": {
    prompt: "USR[id] [gender], fresh professional portrait, genuine warm expression, soft bright lighting, light textured studio background, soft warm white or pale grey wall texture, [outfit], [hair], [makeup], open natural smile, relaxed shoulders, fine skin pores, sharp focus, photorealistic, shot on Canon R5, 85mm f/1.8, natural facial features, authentic face, individual hair strands",
    negative: "plain flat white background, flat black background, serious expression, dramatic lighting, plastic skin, symmetrical face, artificial face, overly perfect features",
  },
  "Cara-comum": {
    prompt: "USR[id] [gender], approachable professional portrait, genuine relatable expression, soft natural lighting, simple textured studio background, neutral mid-tone wall texture, [outfit], [hair], [makeup], natural relaxed posture, warm gaze, light smile, fine skin pores, sharp focus, photorealistic, shot on Sony A7, 50mm f/1.8, natural facial features, authentic face, individual hair strands",
    negative: "plain white background, flat black background, dramatic lighting, stiff corporate pose, plastic skin, symmetrical face, artificial face, overly perfect features",
  },
  "Mago": {
    prompt: "USR[id] [gender], visionary professional portrait, intense magnetic expression, dramatic chiaroscuro lighting, mysterious textured studio background, dark moody plaster or smoke-toned wall texture, [outfit], [hair], [makeup], slight forward lean, piercing gaze, no smile, fine skin pores, sharp focus, photorealistic, shot on Sony A7, 85mm f/1.4, natural facial features, authentic face, individual hair strands",
    negative: "plain white background, flat black background, flat lighting, casual expression, plastic skin, symmetrical face, artificial face, overly perfect features",
  },
  "Amante": {
    prompt: "USR[id] [gender], magnetic professional portrait, warm sophisticated expression, soft golden hour lighting, rich warm textured studio background, deep warm terracotta or burgundy wall texture, [outfit], [hair], [makeup], elegant posture, intense warm gaze, subtle smile, fine skin pores, sharp focus, photorealistic, shot on Leica M, 85mm f/1.2, natural facial features, authentic face, individual hair strands",
    negative: "plain white background, flat black background, harsh lighting, stiff pose, cold tones, plastic skin, symmetrical face, artificial face, overly perfect features",
  },
  "Rebelde": {
    prompt: "USR[id] [gender], disruptive professional portrait, bold unconventional expression, high contrast dramatic lighting, edgy textured studio background, raw concrete or industrial wall texture, [outfit], [hair], [makeup], strong asymmetric pose, direct challenging gaze, fine skin pores, sharp focus, photorealistic, shot on Leica M, 35mm f/1.4, natural facial features, authentic face, individual hair strands",
    negative: "plain white background, flat black background, corporate look, soft lighting, conventional pose, plastic skin, symmetrical face, artificial face, overly perfect features",
  },
  "Bobo-da-corte": {
    prompt: "USR[id] [gender], vibrant professional portrait, playful authentic expression, bright dynamic lighting, warm textured studio background, colorful warm-toned or eclectic wall texture, [outfit], [hair], [makeup], natural laugh or wide smile, energetic posture, fine skin pores, sharp focus, photorealistic, shot on Fujifilm X-T5, 50mm f/1.8, natural facial features, authentic face, individual hair strands",
    negative: "plain white background, flat black background, serious expression, stiff pose, plastic skin, symmetrical face, artificial face, overly perfect features",
  },
};

// Mapeamento de fundo para os 3 looks (Neutro / Claro / Escuro)
export const BACKGROUND_VARIATIONS = [
  { key: "neutro", label: "Neutro", replacement: null }, // mantém o fundo do arquétipo
  { key: "claro", label: "Claro", replacement: "warm light textured studio background, soft warm tones" },
  { key: "escuro", label: "Escuro", replacement: "dark moody textured studio background, deep shadow tones" },
] as const;

/**
 * Framing por look. Estratégia mista para minimizar dedos deformados:
 *   - Look 0 (Neutro): close-up enquadrando peito/ombros — mãos FORA do frame.
 *     100% à prova de erro de mãos. Sempre teremos pelo menos 1 retrato perfeito.
 *   - Look 1 (Claro): waist-up com pose de mãos sorteada (mãos visíveis).
 *   - Look 2 (Escuro): waist-up com pose de mãos sorteada (mãos visíveis).
 */
export const FRAMING_VARIATIONS = [
  { key: "headshot", showsHands: false, instruction: "head and shoulders portrait, framed at chest level, hands not visible in frame" },
  { key: "waist-up", showsHands: true, instruction: "waist-up portrait, hands visible naturally in frame" },
  { key: "waist-up", showsHands: true, instruction: "waist-up portrait, hands visible naturally in frame" },
] as const;

// Regex para localizar a "frase de fundo" no prompt do arquétipo.
// Captura desde uma palavra-chave de iluminação/fundo até a vírgula imediatamente antes de "[outfit]".
// Exemplos cobertos:
//   "dark textured studio background with subtle wall texture, [outfit]"
//   "warm dark textured studio background, subtle linen or concrete wall texture, [outfit]"
//   "warm textured studio background, soft beige or warm grey wall texture, [outfit]"
const BACKGROUND_REGEX = /(?:warm |light |medium |deep |simple |mysterious |edgy |artistic |rich warm |[a-z\s]*?)?(?:dark |light |warm )?textured studio background[^,]*(?:,\s*[^,]*wall texture)?,\s*(?=\[outfit\])/i;

export interface PhysicalTraits {
  gender: "woman" | "man";
  hair_color: string;
  hair_length: string;
  hair_style: string;
  skin_tone: string;
  eye_color: string;
}

export interface BuildPromptParams {
  archetype: ArchetypeName | string;
  userId: string;
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

  let prompt = STUDIO_PREFIX + tpl.prompt;
  // Negative base + reforço de mãos APENAS se este look mostra mãos.
  let negative = tpl.negative + STUDIO_NEGATIVE_BASE + (framing.showsHands ? HANDS_NEGATIVE_REINFORCE : "");

  // Reforço de gênero no negative para evitar troca (técnica conhecida em Flux LoRA)
  if (effectiveGender === "woman") {
    negative += ", man, beard, mustache, masculine features, male body";
  } else if (effectiveGender === "man") {
    negative += ", woman, feminine features, makeup, lipstick, female body";
  }

  // 1. Substituir frase de fundo se Claro/Escuro
  if (bg.replacement) {
    if (BACKGROUND_REGEX.test(prompt)) {
      prompt = prompt.replace(BACKGROUND_REGEX, `${bg.replacement}, `);
    } else {
      console.log(`[portrait-prompt] background regex did not match for archetype=${archetypeKey} — using fallback prepend`);
      prompt = `${bg.replacement}, ${prompt}`;
    }
  }

  // 1b. Injeta a instrução de framing logo no início (após STUDIO_PREFIX) com peso forte.
  // Para look 0 (headshot) isso garante que mãos não aparecem.
  prompt = prompt.replace(STUDIO_PREFIX, `${STUDIO_PREFIX}(${framing.instruction}:1.5), `);

  // 2. Substituir marcadores
  prompt = prompt.replace(/USR\[id\]/g, `USR${params.userId}`);

  // Reforço de gênero: duplica o token para ancorar Flux contra deriva
  if (effectiveGender === "none") {
    prompt = prompt.replace(/\[gender\]/g, "person");
  } else {
    prompt = prompt.replace(/\[gender\]/g, `${effectiveGender}, portrait of a ${effectiveGender}`);
  }

  // 3. Injeção de traços físicos extraídos das selfies — ancora cabelo, pele, olhos
  // contra deriva do LoRA. Inserido logo após o trigger USR<id>.
  let traitPhrase = "";
  if (params.physicalTraits) {
    const t = params.physicalTraits;
    traitPhrase = `, with ${t.hair_length} ${t.hair_style} ${t.hair_color} hair, ${t.skin_tone} skin, ${t.eye_color} eyes`;
  }

  // 3b. Injeção do OUTFIT logo após USR<id> + traços, com peso 1.4 (sintaxe Flux).
  const outfitText = (params.outfit || "").trim();
  const outfitPhrase = outfitText ? `, (wearing ${outfitText}:1.4)` : "";

  // 3b-bis. Injeção da POSE DE MÃOS — APENAS se este look mostra mãos.
  // Para o look 0 (headshot), não injetamos pose porque mãos não estão no frame.
  const handPoseText = framing.showsHands ? (params.handPose || "").trim() : "";
  const handPosePhrase = handPoseText ? `, (hands: ${handPoseText}:1.2)` : "";

  if (traitPhrase || outfitPhrase || handPosePhrase) {
    prompt = prompt.replace(/(USR\S+)/, `$1${traitPhrase}${outfitPhrase}${handPosePhrase}`);
  }

  // Esvazia o [outfit] do template original (já injetado acima com peso).
  prompt = prompt.replace(/\[outfit\]/g, "");

  // 3c. Negative específico do look — impede o Flux de "voltar" ao blazer padrão
  // das selfies de treino quando o look pede vestido/cardigan/coat.
  const outfitLower = outfitText.toLowerCase();
  if (/\bdress\b/.test(outfitLower)) {
    negative += ", blazer, suit jacket, trousers, pants, formal suit";
  }
  if (/\bcardigan\b|\bknit\b|\bknitwear\b/.test(outfitLower)) {
    negative += ", blazer, suit jacket, formal suit";
  }
  if (/\bcoat\b|\btrench\b|\bovercoat\b/.test(outfitLower)) {
    negative += ", blazer underneath, formal suit";
  }
  if (/\bblazer\b/.test(outfitLower)) {
    negative += ", dress, casual t-shirt, hoodie";
  }

  // Cabelo do figurino só é usado quando NÃO temos traços extraídos
  if (!params.physicalTraits && effectiveGender === "woman" && params.hair) {
    prompt = prompt.replace(/\[hair\]/g, params.hair);
  } else {
    prompt = prompt.replace(/\[hair\]/g, "");
  }

  if (effectiveGender === "woman" && params.makeup) {
    prompt = prompt.replace(/\[makeup\]/g, params.makeup);
  } else {
    prompt = prompt.replace(/\[makeup\]/g, "");
  }

  // 4. Limpeza
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
  [/vestido/gi, "dress"],
  // Casacos / outerwear
  [/sobretudo/gi, "overcoat"],
  [/trench\s*coat/gi, "trench coat"],
  [/casaco\s+longo/gi, "long coat"],
  [/casaco/gi, "coat"],
  [/jaqueta\s+de\s+couro/gi, "leather jacket"],
  [/jaqueta/gi, "jacket"],
  // Blazers
  [/blazer\s+(de\s+)?alfaiataria/gi, "tailored blazer"],
  [/blazer\s+estruturado/gi, "structured blazer"],
  [/blazer\s+oversized/gi, "oversized blazer"],
  [/blazer/gi, "blazer"],
  // Calças
  [/calça\s+(de\s+)?alfaiataria/gi, "tailored trousers"],
  [/calça\s+pantalona/gi, "wide-leg trousers"],
  [/calça\s+reta/gi, "straight-leg trousers"],
  [/calça\s+jeans/gi, "denim jeans"],
  [/calça/gi, "trousers"],
  // Saias
  [/saia\s+midi/gi, "midi skirt"],
  [/saia\s+lápis|saia\s+lapis/gi, "pencil skirt"],
  [/saia\s+longa/gi, "long skirt"],
  [/saia/gi, "skirt"],
  // Tops
  [/camisa\s+(de\s+)?seda/gi, "silk shirt"],
  [/blusa\s+(de\s+)?seda/gi, "silk blouse"],
  [/blusa\s+básica|blusa\s+basica/gi, "fitted top"],
  [/camiseta\s+básica|camiseta\s+basica/gi, "fitted t-shirt"],
  [/camiseta/gi, "t-shirt"],
  [/camisa/gi, "button-up shirt"],
  [/blusa/gi, "blouse"],
  [/cardigã|cardiga/gi, "cardigan"],
  [/tricô|trico/gi, "knitwear"],
  [/malha/gi, "knit top"],
  [/regata/gi, "tank top"],
  // Sapatos
  [/sapato\s+scarpin|scarpin/gi, "pointed-toe pumps"],
  [/salto\s+alto/gi, "high heels"],
  [/sandália|sandalia/gi, "sandals"],
  [/bota/gi, "boots"],
  [/mocassim/gi, "loafers"],
  [/tênis|tenis/gi, "sneakers"],
  // Acessórios
  [/cinto/gi, "belt"],
  [/lenço|lenco/gi, "scarf"],
  [/bolsa/gi, "bag"],
  // Cores
  [/bege/gi, "beige"],
  [/caramelo/gi, "caramel"],
  [/camelo/gi, "camel"],
  [/marinho/gi, "navy"],
  [/vinho/gi, "burgundy"],
  [/terracota/gi, "terracotta"],
  [/preto/gi, "black"],
  [/branco/gi, "white"],
  [/cinza/gi, "grey"],
  [/marrom/gi, "brown"],
];

function translateFashion(text: string): string {
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
