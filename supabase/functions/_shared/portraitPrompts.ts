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
// Reforço aplicado a todos os negatives: bloqueia vazamento de cenários externos das fotos de treino,
// anatomia incorreta (mãos extras, membros duplicados) e artefatos comuns do Flux.
const STUDIO_NEGATIVE = ", outdoor, street, natural daylight, trees, buildings, sky, park, beach, low quality, blurry, deformed face, extra fingers, asymmetric eyes, extra arms, extra hands, three hands, four hands, mutated hands, deformed hands, extra limbs, missing limbs, fused fingers, disfigured, malformed, duplicate, two heads, cloned face, bad anatomy, multiple people";

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

  let prompt = STUDIO_PREFIX + tpl.prompt;
  let negative = tpl.negative + STUDIO_NEGATIVE;

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
  if (params.physicalTraits) {
    const t = params.physicalTraits;
    const traitPhrase = `, with ${t.hair_length} ${t.hair_style} ${t.hair_color} hair, ${t.skin_tone} skin, ${t.eye_color} eyes`;
    // Insere após o primeiro USR<id> (que vem no início do template)
    prompt = prompt.replace(/(USR\S+)/, `$1${traitPhrase}`);
  }

  prompt = prompt.replace(/\[outfit\]/g, params.outfit || "");

  // Cabelo do figurino só é usado quando NÃO temos traços extraídos
  // (os traços têm prioridade — vêm das fotos reais da usuária)
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

export function buildOutfitText(figurino: any): string {
  if (!figurino || typeof figurino !== "object") return "";
  const pieces = Array.isArray(figurino.pecas_chave) ? figurino.pecas_chave.slice(0, 3).join(", ") : "";
  const colors = Array.isArray(figurino.cores_roupa) ? figurino.cores_roupa.slice(0, 2).join(" and ") : "";
  if (pieces && colors) return `${pieces} in ${colors}`;
  return pieces || colors || "";
}

/**
 * Variação de figurino por look: usa figurino.looks_completos[lookIndex] do relatório,
 * que já vem com 3 looks distintos (peças e ocasião). Garante que cada um dos 3
 * retratos tenha um figurino diferente, sempre dentro do que o relatório recomenda.
 *
 * Fallback: se o relatório não tiver looks_completos, usa buildOutfitText (peças-chave + cores).
 */
export function buildOutfitTextForLook(figurino: any, lookIndex: number): string {
  if (!figurino || typeof figurino !== "object") return "";
  const looks = Array.isArray(figurino.looks_completos) ? figurino.looks_completos : [];
  if (looks.length === 0) return buildOutfitText(figurino);

  // Round-robin para o caso de relatórios com menos de 3 looks
  const look = looks[lookIndex % looks.length];
  if (!look || !Array.isArray(look.pecas) || look.pecas.length === 0) {
    return buildOutfitText(figurino);
  }
  // Junta as peças (3-5) em uma única descrição. Mantém o português do relatório —
  // o restante do prompt em inglês ainda direciona estilo/iluminação corretamente,
  // e modelos Flux lidam bem com peças de roupa em PT.
  return look.pecas.slice(0, 5).join(", ");
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
