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
// Encurtado pra liberar orçamento de atenção do Flux.
const STUDIO_PREFIX = "professional editorial portrait, ";
// Sufixo de qualidade — aplicado UMA VEZ no fim de todo prompt. Mantém densidade
// fotográfica sem inflar cada template do arquétipo.
const QUALITY_SUFFIX = "fine skin pores, natural skin texture, photorealistic, shot on Sony A7, 85mm f/1.4, shallow depth of field";
// Negative base ENXUTO — só o essencial. Tokens demais competem pela atenção do
// modelo e pioram qualidade visual. Mantemos só o que evita problemas reais.
const STUDIO_NEGATIVE_BASE = ", plastic skin, beauty filter, smoothed skin, airbrushed, deformed hands, extra fingers, deformed face, asymmetric eyes, multiple people, watermark, low quality, blurry";
// Reforço de anatomia de mãos — aplicado APENAS aos looks que mostram mãos
// (atualmente nenhum, já que estamos em modo hands-out-of-frame).
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

// Templates ENXUTOS por arquétipo. Mantemos só a essência: expressão, iluminação,
// fundo. Os tokens de qualidade (pele, câmera, lente) vão no QUALITY_SUFFIX único.
// Estrutura: USR[id] [gender], {essência}, [outfit], [hair], [makeup]
export const ARCHETYPE_PROMPTS: Record<ArchetypeName, { prompt: string; negative: string }> = {
  "Governante": {
    prompt: "USR[id] [gender], authoritative calm expression, hard directional lighting, dark textured studio background, [outfit], [hair], [makeup], strong upright posture, direct confident gaze, no smile",
    negative: "casual, smiling, soft lighting, flat white background",
  },
  "Sábio": {
    prompt: "USR[id] [gender], calm contemplative expression, soft Rembrandt lighting, deep dark background, [outfit], [hair], [makeup], slight head tilt, thoughtful gaze, no smile",
    negative: "casual, wide smile, harsh lighting, bright background",
  },
  "Cuidador": {
    prompt: "USR[id] [gender], gentle approachable expression, soft diffused lighting, warm beige background, [outfit], [hair], [makeup], slight natural smile, open relaxed posture",
    negative: "harsh lighting, dark moody background, serious cold expression",
  },
  "Criador": {
    prompt: "USR[id] [gender], expressive authentic expression, dramatic side lighting, weathered artistic background, [outfit], [hair], [makeup], natural creative pose, intense gaze",
    negative: "corporate look, flat lighting, stiff symmetrical pose",
  },
  "Herói": {
    prompt: "USR[id] [gender], determined strong expression, high contrast dramatic lighting, dark stone background, [outfit], [hair], [makeup], forward-leaning posture, intense direct gaze, jaw set",
    negative: "soft lighting, casual relaxed expression, washed out background",
  },
  "Explorador": {
    prompt: "USR[id] [gender], free confident expression, natural warm lighting, earthy textured background, [outfit], [hair], [makeup], relaxed posture, genuine gaze, subtle smile",
    negative: "stiff corporate pose, dark moody background, flat lighting",
  },
  "Inocente": {
    prompt: "USR[id] [gender], genuine warm expression, soft bright lighting, light pale background, [outfit], [hair], [makeup], open natural smile, relaxed shoulders",
    negative: "serious heavy expression, dramatic shadows, dark background",
  },
  "Cara-comum": {
    prompt: "USR[id] [gender], approachable relatable expression, soft natural lighting, neutral mid-tone background, [outfit], [hair], [makeup], natural relaxed posture, warm gaze, light smile",
    negative: "dramatic lighting, stiff corporate pose, intense expression",
  },
  "Mago": {
    prompt: "USR[id] [gender], intense magnetic expression, dramatic chiaroscuro lighting, mysterious dark background, [outfit], [hair], [makeup], slight forward lean, piercing gaze, no smile",
    negative: "flat lighting, casual cheerful expression, bright airy background",
  },
  "Amante": {
    prompt: "USR[id] [gender], warm sophisticated expression, soft golden hour lighting, deep warm terracotta background, [outfit], [hair], [makeup], elegant posture, intense warm gaze, subtle smile",
    negative: "harsh cold lighting, stiff pose, washed out tones",
  },
  "Rebelde": {
    prompt: "USR[id] [gender], bold unconventional expression, high contrast dramatic lighting, raw industrial background, [outfit], [hair], [makeup], asymmetric pose, direct challenging gaze",
    negative: "corporate look, soft polished lighting, conventional symmetrical pose",
  },
  "Bobo-da-corte": {
    prompt: "USR[id] [gender], playful authentic expression, bright dynamic lighting, warm colorful background, [outfit], [hair], [makeup], natural laugh or wide smile, energetic posture",
    negative: "serious heavy expression, stiff corporate pose, dark moody background",
  },
};

// Mapeamento de fundo para os 3 looks (Neutro / Claro / Escuro).
// Replacement curto, em linguagem natural, sem redundância.
export const BACKGROUND_VARIATIONS = [
  { key: "neutro", label: "Neutro", replacement: null }, // mantém o fundo do arquétipo
  { key: "claro", label: "Claro", replacement: "warm light background, soft warm tones" },
  { key: "escuro", label: "Escuro", replacement: "dark moody background, deep shadow tones" },
] as const;

/**
 * Framing por look. ESTRATÉGIA "MÃOS FORA DO FRAME EM 100%".
 * Linguagem natural curta, sem pesos numéricos (Flux respeita melhor).
 *   - Look 0 (Neutro): close-up cabeça e ombros, frontal.
 *   - Look 1 (Claro): busto editorial peito e ombros, ombros levemente angulados.
 *   - Look 2 (Escuro): retrato chest-up, ombros sutilmente girados.
 * Em todos os 3 looks, `showsHands = false`.
 */
export const FRAMING_VARIATIONS = [
  { key: "headshot", showsHands: false, instruction: "tight head and shoulders crop, hands out of frame" },
  { key: "bust", showsHands: false, instruction: "mid-chest editorial bust crop, hands out of frame" },
  { key: "chest-up", showsHands: false, instruction: "chest-up editorial portrait, shoulders subtly turned, hands out of frame" },
] as const;

// Regex para localizar a "frase de fundo" nos novos templates enxutos.
// Captura desde palavra-chave de fundo (com ou sem cor/tom prefixado) até a
// vírgula antes de "[outfit]".
// Exemplos cobertos:
//   "dark textured studio background, [outfit]"
//   "deep dark background, [outfit]"
//   "warm beige background, [outfit]"
//   "earthy textured background, [outfit]"
const BACKGROUND_REGEX = /[a-z\s-]*background[^,]*,\s*(?=\[outfit\])/i;

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

  // Trigger word REAL do treino (USR + 12 hex). Se não vier, deriva do userId
  // (mesma fórmula usada em portrait-train para retrocompat).
  const triggerWord = params.triggerWord
    || `USR${params.userId.replace(/-/g, "").slice(0, 12)}`;

  // Trigger word DUPLICADO no início absoluto — Flux dá mais peso aos primeiros
  // tokens. Duas menções logo de cara forçam atenção máxima ao LoRA, garantindo
  // que o rosto gerado seja reconhecível como o da pessoa treinada.
  let prompt = `${triggerWord}, portrait of ${triggerWord}, ` + STUDIO_PREFIX + tpl.prompt;
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

  // 1b. Injeta a instrução de framing após o STUDIO_PREFIX (que vem após o trigger).
  prompt = prompt.replace(STUDIO_PREFIX, `${STUDIO_PREFIX}(${framing.instruction}:1.5), `);

  // 2. Substitui o placeholder USR[id] do template pelo trigger real (caso ainda apareça).
  prompt = prompt.replace(/USR\[id\]/g, triggerWord);

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

  // 3b. Injeção do OUTFIT logo após USR<id> + traços, com peso BAIXÍSSIMO.
  // Pesos altos competem com o LoRA pelo orçamento de atenção e degradam
  // anatomia/proporção do corpo. Mantemos peso quase neutro (1.05).
  const outfitText = (params.outfit || "").trim();
  const outfitWeight = 1.05;
  const outfitPhrase = outfitText ? `, (wearing ${outfitText}:${outfitWeight})` : "";

  // 3b-bis. Pose de mãos: IGNORADA. Todos os looks agora são "hands out of frame".
  // Mantemos a variável só pra logs no chamador, mas não injetamos no prompt.
  const handPosePhrase = "";

  // 3b-ter. Reforço explícito de identidade — ancora o Flux ao LoRA e
  // preserva texturas naturais de pele e cabelo. Crítico contra "rosto genérico".
  const identityPhrase = ", preserve exact facial features, same person, identical face to reference, recognizable individual, distinctive facial structure, real person photograph, authentic skin pores, natural skin texture, unretouched skin, fine hair strands, individual hair fibers";

  prompt = prompt.replace(/(USR\S+)/, `$1${identityPhrase}${traitPhrase}${outfitPhrase}${handPosePhrase}`);

  // Esvazia o [outfit] do template original (já injetado acima com peso).
  prompt = prompt.replace(/\[outfit\]/g, "");

  // 3c. Negative específico do look — impede o Flux de "voltar" ao blazer padrão
  // das selfies de treino quando o look pede vestido/cardigan/coat etc.
  const outfitLower = outfitText.toLowerCase();
  if (/\bdress\b|\bgown\b|\bslip dress\b/.test(outfitLower)) {
    negative += ", blazer, suit jacket, business suit, trousers, pants, formal suit, turtleneck, long sleeves, formal shirt, tie";
  }
  if (/\bcardigan\b|\bknit\b|\bknitwear\b|\bsweater\b/.test(outfitLower)) {
    negative += ", blazer, suit jacket, formal suit, tie";
  }
  if (/\bcoat\b|\btrench\b|\bovercoat\b/.test(outfitLower)) {
    negative += ", blazer underneath, formal suit";
  }
  if (/\bblazer\b|\bpantsuit\b|\bsuit\b/.test(outfitLower)) {
    negative += ", dress, casual t-shirt, hoodie, sportswear";
  }
  if (/\bathletic\b|\bsportswear\b|\blegging\b|\bgym\b|\bworkout\b|\bsports?\s*top\b|academia/.test(outfitLower)) {
    negative += ", formal wear, blazer, suit, dress shirt, tie, business attire";
  }
  if (/\bjumpsuit\b|macac/.test(outfitLower)) {
    negative += ", separate top and trousers, blazer";
  }
  if (/\bjeans\b|\bdenim\b/.test(outfitLower)) {
    negative += ", formal trousers, suit pants";
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
