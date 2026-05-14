// Edge function: fetch-post-image
// Busca imagens de fundo para um post via Pexels (banco de imagens) + IA opcional.
// Modes:
//   - "single" (default): retorna 1 imagem (Pexels → IA opcional). SEM cache, garante variedade.
//   - "gallery": retorna até 12 imagens do Pexels com metadata de cada fotógrafo
//
// Body: { theme, caption?, body?, cardCopy?, cta?, niche?, businessContext?,
//         format?: "card"|"reels"|"square"|"portrait", allowAI?,
//         mode?, query?, userQuery?, page?, nonce? }
//
// Diferença entre query e userQuery:
//   - userQuery: o que o usuário digitou no input (texto cru, geralmente PT) →
//     sempre passa pelo construtor inteligente, traduz e combina com contexto do post.
//   - query (legacy): se vier sem userQuery, é tratado como "já pronto" (passa direto).
//     Mantido para compat com chamadas antigas; novas chamadas devem preferir userQuery.

import { corsHeaders } from "../_shared/cors.ts";

const PEXELS_URL = "https://api.pexels.com/v1/search";

// =====================================================
// Tradução PT->EN para nichos e termos visuais comuns
// =====================================================
const PT_EN_DICT: Record<string, string> = {
  // nichos
  "advogado": "lawyer office", "advogada": "lawyer office", "direito": "law justice", "juridico": "legal",
  "psicologo": "therapy mindfulness", "psicologa": "therapy mindfulness", "psicologia": "therapy mindfulness", "terapia": "therapy",
  "medico": "doctor medical", "medica": "doctor medical", "medicina": "medical clinic", "saude": "health wellness",
  "nutricionista": "healthy food nutrition", "nutricao": "nutrition food",
  "personal": "fitness training", "treinador": "fitness gym", "academia": "gym fitness", "fitness": "fitness gym",
  "dentista": "dentist clinic", "odontologia": "dental clinic",
  "arquiteto": "architecture interior", "arquiteta": "architecture interior", "arquitetura": "architecture",
  "designer": "design studio", "design": "design minimal",
  "marketing": "marketing business", "publicidade": "advertising",
  "consultor": "business consulting", "consultora": "business consulting", "consultoria": "business meeting",
  "coach": "coaching mentoring", "coaching": "coaching",
  "imobiliaria": "real estate house", "corretor": "real estate", "imoveis": "real estate",
  "contador": "accounting office", "contadora": "accounting", "contabilidade": "accounting",
  "professor": "teaching education", "professora": "teaching education", "educacao": "education",
  "fotografo": "photography studio", "fotografa": "photography",
  "esteticista": "beauty spa", "estetica": "beauty spa", "beleza": "beauty",
  "barbeiro": "barbershop", "cabeleireiro": "hair salon", "salao": "beauty salon",
  "veterinario": "veterinarian pets", "veterinaria": "veterinarian pets", "pet": "pets animals",
  "engenheiro": "engineering construction", "engenharia": "engineering",
  "tecnologia": "technology modern", "ti": "technology", "software": "technology software",
  "moda": "fashion style", "estilista": "fashion design",
  "gastronomia": "food restaurant", "chef": "restaurant kitchen", "restaurante": "restaurant",
  "confeitaria": "pastry bakery", "padaria": "bakery",
  "financas": "finance business", "investimento": "finance investing", "financeiro": "finance",
  // temas / abstratos comuns
  "transformacao": "growth journey", "mudanca": "change journey",
  "crescimento": "growth", "evolucao": "evolution",
  "sucesso": "success achievement", "conquista": "achievement",
  "lideranca": "leadership", "equipe": "team meeting",
  "produtividade": "productive workspace", "trabalho": "workspace",
  "resultado": "results business", "estrategia": "strategy planning",
  "autoridade": "authority confidence",
  "confianca": "confidence",
  "inspiracao": "inspiration calm",
  "motivacao": "motivation",
  "foco": "focus minimal",
  "calma": "calm peaceful", "tranquilidade": "peaceful nature",
  "natureza": "nature landscape",
  "casa": "home interior", "lar": "home",
  "familia": "family lifestyle",
  "relacionamento": "relationship couple",
  "amor": "love romantic",
  "cansaco": "tired exhausted", "cansada": "tired exhausted", "cansado": "tired exhausted",
  "exausto": "exhausted overwhelm", "exausta": "exhausted overwhelm", "exaustao": "exhausted burnout",
  "burnout": "burnout exhausted", "estresse": "stressed overwhelmed", "ansiedade": "anxiety mindfulness",
  "descanso": "rest relaxation", "pausa": "pause break",
  "rotina": "daily routine lifestyle", "manha": "morning routine", "noite": "evening night",
  "tempo": "time clock", "agenda": "schedule planner", "calendario": "calendar planning",
  "saudavel": "healthy lifestyle",
  "alimentacao": "healthy food",
  "exercicio": "exercise fitness",
  "meditacao": "meditation calm",
  "mente": "mindfulness",
  "corpo": "wellness body",
  // objetos / cenários visuais concretos
  "celular": "smartphone hand", "telefone": "smartphone", "computador": "laptop workspace",
  "notebook": "laptop desk", "laptop": "laptop workspace",
  "mesa": "desk workspace", "escritorio": "office workspace", "escrivaninha": "desk",
  "reuniao": "business meeting", "encontro": "meeting people",
  "cafe": "coffee morning", "xicara": "coffee cup", "cha": "tea cup",
  "livro": "book reading", "livros": "books library", "leitura": "reading book",
  "agua": "water glass", "copo": "glass water",
  "janela": "window light", "luz": "natural light", "sol": "sunlight",
  "rua": "street city", "cidade": "city urban",
  "carro": "car driving", "viagem": "travel suitcase",
  "dinheiro": "money cash", "moeda": "coin currency", "cartao": "credit card",
  "presente": "gift present",
  "plano": "planning notebook", "planejamento": "planning notebook strategy",
  "anotar": "writing notebook", "caderno": "notebook writing", "lista": "checklist notebook",
  "ideia": "idea lightbulb", "criatividade": "creative workspace",
  "decisao": "decision crossroads", "escolha": "choice path",
  "duvida": "question doubt", "pergunta": "question mark",
  "medo": "fear anxious",
  "felicidade": "happy smile", "feliz": "happy joyful",
  "tristeza": "sad melancholy", "triste": "sad pensive",
  "raiva": "angry frustrated",
  "venda": "sales business", "vendas": "sales business growth", "cliente": "customer client",
  "negocio": "business professional", "empresa": "company office",
  "social": "social media phone", "instagram": "social media phone", "post": "social media content",
  "objetivo": "goal target", "meta": "target goal", "sonho": "dream aspiration",
  "habito": "daily habit routine", "habitos": "habits routine",
  "comunicacao": "communication conversation", "conversa": "conversation talking",
  "escuta": "listening conversation", "voz": "voice speaking",
  "casamento": "wedding marriage", "casal": "couple love",
  "filho": "child family", "filha": "child family", "filhos": "family children",
  "vida": "lifestyle living",
};

// Termos sensíveis a evitar quando o nicho não é infantil
const SENSITIVE_TERMS = ["crianca", "criancas", "child", "children", "kid", "kids", "baby", "infantil", "bebe"];
const KID_FRIENDLY_NICHES = ["pediatra", "pediatria", "infantil", "creche", "escola", "professor", "professora"];

function deaccent(s: string): string {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function translateWord(word: string): string | null {
  const w = deaccent(word);
  if (PT_EN_DICT[w]) return PT_EN_DICT[w];
  return null;
}

/**
 * Normaliza format vindo do cliente. Aceita tanto a nova nomenclatura
 * (card/reels) quanto a antiga (square/portrait).
 *  - card  / square   → 4:5  (1080×1350)
 *  - reels / portrait → 9:16 (1080×1920)
 */
function normalizeFormat(input?: string): "card" | "reels" {
  const f = (input || "").toLowerCase();
  if (f === "reels" || f === "portrait" || f === "9:16") return "reels";
  return "card";
}

/**
 * Extrai 2-4 substantivos relevantes de um texto longo (copy/legenda),
 * traduzindo para inglês quando possível.
 */
function extractKeywordsFromText(text: string, max = 4): string[] {
  const stop = new Set([
    "de","da","do","das","dos","o","a","os","as","e","ou","para","por","com","sem","em","no","na","nos","nas",
    "um","uma","uns","umas","que","como","mais","menos","muito","seu","sua","seus","suas","ser","ter","sobre",
    "the","of","and","or","for","with","to","in","on","an","is","are","be","this","that","you","your","we","our",
    "slide","capa","conteudo","conclusao","cta","post","dia","semana","tema","caption","legenda",
    "voce","seu","sua","gente","quando","onde","porque","mas","pode","vai","ainda","todo","toda","tudo","nada",
    "isso","aquilo","esse","essa","aquele","aquela","aqui","ali","entao","tambem","apenas","hoje","ontem","amanha",
    "ja","sim","nao","talvez","sempre","nunca","quem","qual","quais","quanto","quanta",
  ]);
  const tokens = deaccent(text || "")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !stop.has(w));

  const seen = new Set<string>();
  const out: string[] = [];
  // Primeiro: priorizar palavras que TÊM tradução (mais visualmente concretas)
  for (const w of tokens) {
    if (seen.has(w)) continue;
    const tr = translateWord(w);
    if (tr) {
      out.push(tr);
      seen.add(w);
      if (out.length >= max) return out;
    }
  }
  // Fallback: substantivos longos sem tradução
  for (const w of tokens) {
    if (seen.has(w)) continue;
    if (w.length < 6) continue;
    out.push(w);
    seen.add(w);
    if (out.length >= max) break;
  }
  return out;
}

/** Traduz nicho para 1-2 palavras EN. */
function translateNiche(niche?: string): string {
  if (!niche) return "";
  const tokens = deaccent(niche).replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    const tr = translateWord(t);
    if (tr) return tr;
  }
  return tokens.slice(0, 2).join(" ");
}

/** Filtra termos sensíveis quando o nicho não é infantil. */
function filterSensitive(query: string, niche?: string): string {
  const nicheIsKidFriendly = niche && KID_FRIENDLY_NICHES.some((k) => deaccent(niche).includes(k));
  if (nicheIsKidFriendly) return query;
  const tokens = query.split(/\s+/).filter((t) => !SENSITIVE_TERMS.includes(t));
  return tokens.join(" ");
}

// =====================================================
// Banco de cenas editoriais por nicho profissional
// Cada cena: ambiente + iluminação + composição + postura.
// Usado quando o usuário NÃO digitou um userQuery — substitui
// keywords genéricas extraídas do texto do post por direção
// fotográfica concreta.
// =====================================================
const NICHE_SCENES: Record<string, string[]> = {
  lawyer: [
    "attorney at mahogany desk reviewing documents, dramatic side lighting, leather-bound books in background",
    "lawyer in tailored dark suit walking through neoclassical courthouse corridor, warm afternoon light",
    "close-up of hands signing contract beside a fountain pen and law books, shallow depth of field",
    "female attorney by tall office window, city skyline behind, soft directional light, contemplative posture",
  ],
  doctor: [
    "physician in white coat at modern clinic, confident posture, soft window light, stethoscope visible",
    "doctor reviewing chart at minimalist consultation desk, warm natural light, calm and authoritative",
    "hands of a physician examining medical imaging on a tablet, clean clinical environment, soft shadows",
  ],
  executive: [
    "executive in dark suit at glass desk, bokeh city view behind, golden hour light",
    "businesswoman in cream blazer leading strategy meeting in glass-walled boardroom, soft daylight",
    "close-up of wristwatch and laptop on dark walnut desk, espresso cup beside, moody editorial light",
  ],
  consultant: [
    "consultant standing at whiteboard sketching diagrams, sleeves rolled, focused expression, side daylight",
    "two professionals reviewing strategy document at minimalist meeting table, warm filtered light",
    "consultant at coworking space with laptop and notebook, neutral palette, soft window light",
  ],
  accountant: [
    "accountant at clean desk reviewing spreadsheets on dual monitors, calm task light, organized workspace",
    "close-up of calculator, ledger and cup of coffee on a wooden desk, morning light from the side",
    "professional in shirt and tie examining financial reports, glasses in hand, contemplative expression",
  ],
  therapist: [
    "therapist office with two armchairs, warm lamp light, plants and bookshelf, inviting calm atmosphere",
    "hands holding a notebook in a softly lit consultation room, neutral earthy palette",
    "psychologist in knit sweater listening attentively, soft daylight, blurred bookshelf background",
  ],
  architect: [
    "architect reviewing blueprints on a long wooden table, scale model nearby, daylight from skylight",
    "designer's desk with rolled drawings, T-square and brass lamp, minimal Scandinavian palette",
    "architect at construction site wearing white shirt and hard hat, golden hour, confident stance",
  ],
  coach: [
    "coach mid-conversation in airy studio with plants, soft daylight, warm and energetic posture",
    "notebook with handwritten goals beside steaming coffee on a linen tablecloth, morning light",
    "speaker on minimal stage addressing small audience, warm spotlight, editorial framing",
  ],
  marketing: [
    "creative team reviewing mood board on studio wall, natural light, energetic but composed",
    "designer at iMac with sketches pinned around the desk, warm afternoon light",
    "social media strategist with smartphone and notebook in modern cafe, soft window light",
  ],
  realtor: [
    "real-estate agent handing keys in front of bright contemporary house, golden hour",
    "professional touring buyers through sunlit modern living room with floor-to-ceiling windows",
    "close-up of architectural model and floor plan on concrete table, directional daylight",
  ],
  fitness: [
    "personal trainer in minimalist gym demonstrating posture, raking morning light, athletic but composed",
    "athlete tying running shoes on stadium track at sunrise, muted palette, editorial framing",
    "kettlebell and towel on polished concrete floor, dramatic side light, calm composition",
  ],
  nutrition: [
    "nutritionist plating colorful seasonal vegetables on a marble counter, soft daylight overhead",
    "close-up of fresh produce, olive oil and notebook on light wooden table, airy editorial style",
    "professional in linen apron writing meal plan beside bowl of fruit, warm window light",
  ],
  dentist: [
    "modern minimalist dental clinic with soft daylight, clean white tones, no patient in frame",
    "close-up of dental tools arranged on a clean tray, soft directional light",
  ],
  designer: [
    "graphic designer sketching in notebook beside laptop and color swatches, soft side light",
    "studio desk with minimal still life of design tools, neutral palette, gentle shadows",
  ],
  photographer: [
    "photographer holding camera by large window, soft directional light, contemplative posture",
    "still-life of vintage camera, prints and notebook on wooden table, editorial framing",
  ],
  veterinarian: [
    "veterinarian in scrubs petting calm dog at modern clinic, warm soft light",
    "close-up of stethoscope on wooden surface beside small plant, neutral palette, soft shadows",
  ],
  default: [
    // com pessoa
    "professional in neutral attire by tall window, soft directional light, calm confident posture, editorial framing",
    "hands typing on minimalist laptop at wooden desk, soft morning light, focused mood, shallow depth of field",
    "close-up of a confident professional in conversation, soft window light from the side, contemplative expression",
    "professional walking through modern corridor in tailored neutral attire, golden hour, motion blur background",
    // conceituais (sem pessoa em foco)
    "minimalist editorial workspace with open notebook, warm coffee and morning daylight from the side",
    "still-life of leather notebook, fountain pen and ceramic cup on linen surface, soft directional light",
    "abstract close-up of light rays through window blinds onto a wooden desk, editorial framing, calm mood",
    "stack of business documents and reading glasses on a clean desk, warm side lighting, contemplative atmosphere",
  ],
};

// Mapeia nicho PT → chave do mapa de cenas.
function resolveNicheKey(niche?: string): keyof typeof NICHE_SCENES {
  if (!niche) return "default";
  const n = deaccent(niche);
  if (/(advog|jurid|direito)/.test(n)) return "lawyer";
  if (/(medic|saude|clinic)/.test(n)) return "doctor";
  if (/(executiv|ceo|empresari|gestor)/.test(n)) return "executive";
  if (/(consult)/.test(n)) return "consultant";
  if (/(contad|contabil)/.test(n)) return "accountant";
  if (/(psicolog|terapeut|terapia)/.test(n)) return "therapist";
  if (/(arquitet)/.test(n)) return "architect";
  if (/(coach|mentor)/.test(n)) return "coach";
  if (/(marketing|publicid|social media|midia)/.test(n)) return "marketing";
  if (/(corret|imobili|imovel|imoveis)/.test(n)) return "realtor";
  if (/(personal|fitness|treinad|academ)/.test(n)) return "fitness";
  if (/(nutri)/.test(n)) return "nutrition";
  if (/(dentist|odonto)/.test(n)) return "dentist";
  if (/(design|estilis|moda)/.test(n)) return "designer";
  if (/(fotograf)/.test(n)) return "photographer";
  if (/(veterin|pet)/.test(n)) return "veterinarian";
  if (/(marca pessoal|branding|posicionamento|marca|estrateg)/.test(n)) return "executive";
  if (/(personal trainer|coach de vida|carreira)/.test(n)) return "coach";
  if (/(mentor|mentoria)/.test(n)) return "consultant";
  return "default";
}

// Hash determinístico simples para usar com seed.
function seedHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Sorteia uma cena editorial do nicho. Quando `seed` é informado,
 * a escolha é determinística (slide N do mesmo carrossel cai sempre
 * na mesma cena). Sem seed, sorteia aleatoriamente para gerar
 * variedade entre chamadas.
 */
function pickNicheScene(niche?: string, seed?: string): string {
  const key = resolveNicheKey(niche);
  const scenes = NICHE_SCENES[key] || NICHE_SCENES.default;
  if (!scenes.length) return "minimal editorial scene";
  const idx = seed
    ? seedHash(seed) % scenes.length
    : Math.floor(Math.random() * scenes.length);
  return scenes[idx];
}

/**
 * Constrói query de busca priorizando o "sentido real do post".
 * Ordem de prioridade na extração de keywords:
 *   1. cardCopy (frase visível do slide atual) — mais concreto
 *   2. theme (tema do dia)
 *   3. body (texto do post)
 *   4. caption (só o início, evita ruído)
 *
 * Quando o usuário digita algo no input (userQuery), traduz e prioriza essa
 * intenção, mas combina com nicho + cardCopy para manter contexto.
 */
function buildSearchQuery(opts: {
  theme?: string; caption?: string; body?: string; cardCopy?: string;
  niche?: string; businessContext?: string;
  userQuery?: string;
  /** Seed determinística para variar a cena escolhida por chamada/slide. */
  seed?: string;
}): string {
  const nicheEN = translateNiche(opts.niche);

  // Se o usuário digitou algo, ele lidera a intenção visual (comportamento original).
  if (opts.userQuery && opts.userQuery.trim()) {
    const userKeywords = extractKeywordsFromText(opts.userQuery, 4);
    const userPart = userKeywords.length > 0
      ? userKeywords.join(" ")
      : deaccent(opts.userQuery).replace(/[^a-z\s]/g, " ").trim();
    const ctxText = [opts.cardCopy, opts.theme].filter(Boolean).join(" ");
    const ctxKeywords = extractKeywordsFromText(ctxText, 2);
    const parts = [nicheEN, userPart, ctxKeywords.join(" ")].filter(Boolean);
    let q = parts.join(" ").trim();
    q = filterSensitive(q, opts.niche);
    if (!q.trim()) q = userPart || "minimal abstract editorial";
    return q.slice(0, 90);
  }

  // Sem userQuery: combina cena editorial do nicho + keywords da MENSAGEM do post.
  // Antes só usava nicho + cena (gerava imagens genéricas de escritório, mesmo
  // quando o post falava de tema específico). Agora a busca reflete o argumento.
  const scene = pickNicheScene(opts.niche, opts.seed);
  const sceneAnchor = scene.split(",")[0].trim();

  // Extrai 2 keywords da mensagem central (cardCopy > theme > body) — capta o tema.
  const messageSource = opts.cardCopy || opts.theme || opts.body || "";
  const messageKeywords = extractKeywordsFromText(messageSource, 2).join(" ");

  const parts = [nicheEN, sceneAnchor, messageKeywords].filter(Boolean);
  let query = parts.join(" ").trim();
  query = filterSensitive(query, opts.niche);
  if (!query.trim()) query = "minimal abstract editorial";
  return query.slice(0, 90);
}

/**
 * Constrói o subject/mensagem para o prompt da IA.
 * - Com userQuery: comportamento original (keywords do input + contexto).
 * - Sem userQuery: âncora vira a cena editorial do nicho + até 2 keywords
 *   do conteúdo do post como contexto emocional leve.
 */
function buildAIPromptSubject(opts: {
  theme?: string; caption?: string; body?: string; cardCopy?: string;
  niche?: string; businessContext?: string;
  userQuery?: string;
  seed?: string;
}): { subject: string; mainMessage: string } {
  const nicheEN = translateNiche(opts.niche);
  const mainMessage = (opts.cardCopy || opts.theme || "").trim().slice(0, 240);

  if (opts.userQuery && opts.userQuery.trim()) {
    // Comportamento original preservado.
    const primaryKeywords = extractKeywordsFromText(opts.userQuery, 4).join(" ");
    const secondarySource = opts.cardCopy || opts.theme || opts.body || opts.caption || "";
    const secondaryKeywords = extractKeywordsFromText(secondarySource, 3).join(" ");
    const subject = [nicheEN, primaryKeywords, secondaryKeywords]
      .filter(Boolean)
      .join(", ")
      .trim() || "minimal editorial scene";
    return { subject, mainMessage };
  }

  // Âncora editorial = cena fotográfica concreta do nicho.
  const scene = pickNicheScene(opts.niche, opts.seed);
  const ctxKeywords = extractKeywordsFromText(
    opts.cardCopy || opts.theme || opts.body || "",
    2,
  ).join(" ");
  const subject = [scene, ctxKeywords]
    .filter(Boolean)
    .join(", ")
    .trim() || "minimal editorial scene";
  return { subject, mainMessage };
}

interface PexelsPhoto {
  url: string;
  /** Página da foto no Pexels (referência opcional). */
  sourceUrl: string;
  photographer: { name: string; profileUrl: string };
  width?: number;
  height?: number;
}

async function searchPexelsList(
  query: string,
  format: "card" | "reels",
  apiKey: string,
  perPage = 12,
  page = 1,
): Promise<PexelsPhoto[]> {
  try {
    // Para card (4:5) e reels (9:16) usamos sempre orientation=portrait —
    // o Pexels não distingue entre 4:5 e 9:16, então pegamos portrait
    // e ranqueamos por proximidade de aspect ratio depois.
    const orientation = "portrait";
    const url = `${PEXELS_URL}?query=${encodeURIComponent(query)}&orientation=${orientation}&per_page=${perPage}&page=${page}`;
    const resp = await fetch(url, {
      headers: { "Authorization": apiKey },
    });
    if (!resp.ok) {
      console.error("Pexels error", resp.status, await resp.text());
      return [];
    }
    const data = await resp.json();
    if (!Array.isArray(data.photos)) return [];
    const list: PexelsPhoto[] = data.photos.map((p: any) => ({
      url: p?.src?.large2x || p?.src?.large || p?.src?.original || "",
      sourceUrl: p?.url || "",
      photographer: {
        name: p?.photographer || "Unknown",
        profileUrl: p?.photographer_url || "",
      },
      width: p?.width,
      height: p?.height,
    })).filter((x: PexelsPhoto) => x.url && (x.width ?? 0) >= 1080);

    // Ranking: ordena por proximidade do aspect ratio alvo
    const targetRatio = format === "reels" ? 9 / 16 : 4 / 5; // largura/altura
    list.sort((a, b) => {
      const ra = (a.width || 1) / (a.height || 1);
      const rb = (b.width || 1) / (b.height || 1);
      return Math.abs(ra - targetRatio) - Math.abs(rb - targetRatio);
    });
    return list;
  } catch (err) {
    console.error("Pexels fetch error", err);
    return [];
  }
}

async function generateWithAI(
  subject: string,
  mainMessage: string,
  format: "card" | "reels",
  nonce?: string,
  aiStyleDirective?: string,
): Promise<string | null> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) return null;
  const aspect = format === "reels"
    ? "vertical 9:16 portrait orientation, framed for Instagram Reels cover (1080x1920)"
    : "vertical 4:5 portrait orientation, framed for Instagram feed card (1080x1350)";
  const seed = nonce || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const messageBlock = mainMessage
    ? `\nMain message of the post (translate the FEELING, not the text — image must NOT contain any words): "${mainMessage}".`
    : "";
  const hasStyle = !!(aiStyleDirective && aiStyleDirective.trim());

  // Quando o usuário escolhe um estilo, ele DOMINA a estética (substitui os
  // adjetivos do prompt-base). Sem estilo, mantemos o tom editorial padrão.
  const aestheticBlock = hasStyle
    ? `PRIMARY AESTHETIC (must dominate the entire image — override any default look):
${aiStyleDirective!.trim()}.
Commit fully to this aesthetic: color palette, lighting mood, composition style, medium (photo / illustration / graphic / 3D / collage as implied by the aesthetic) must all reflect it. Do NOT default to soft natural-light editorial photography unless the aesthetic explicitly asks for it.`
    : `Editorial photograph, premium magazine quality, soft natural lighting, shallow depth of field, soft palette, calm contrast. Style: minimal, calm, professional, contemporary photography. Pure photography — no collage, no illustration.`;

  const prompt = `${aestheticBlock}
Format: ${aspect}.
Visual subject (what the image must depict): ${subject}.${messageBlock}
The scene must visually illustrate the meaning above through concrete objects, environments, gestures or graphic motifs that fit the aesthetic — not generic stock imagery.
Variation seed: ${seed}. Choose a fresh angle, lighting and composition different from any previous render.
ABSOLUTELY NO TEXT, NO LETTERS, NO SIGNS, NO NEON, NO TYPOGRAPHY, NO WORDS, NO LOGOS, NO BRAND NAMES, NO WRITTEN CONTENT anywhere in the image.
NO TEXT. NO TEXT. NO TEXT.
Composition: clean, off-center subject leaving generous negative space at top AND bottom for text overlay later (safe area for headlines and captions). Avoid people's faces dominating the frame. Avoid children.`;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });
    if (!resp.ok) {
      console.error("AI gen failed", resp.status, await resp.text());
      return null;
    }
    const data = await resp.json();
    const imgUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    return imgUrl || null;
  } catch (err) {
    console.error("AI gen error", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      theme, caption, body: postBody, cardCopy, cta,
      niche, businessContext,
      format: rawFormat, allowAI = false,
      mode = "single", query: customQuery, userQuery, page = 1,
      aiStyleDirective,
      nonce,
    } = body;

    if (!theme && !customQuery && !userQuery && !cardCopy) {
      return new Response(JSON.stringify({ error: "theme, cardCopy, query or userQuery required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const format = normalizeFormat(rawFormat);

    // Hierarquia de construção de keywords:
    //  1. userQuery (input do usuário) → buildSearchQuery prioriza, mas combina com contexto
    //  2. customQuery legacy sem userQuery → tratado como input do usuário também
    //     (chamadas antigas continuam funcionando, mas agora passam pela tradução)
    //  3. Sem nada → constrói só do contexto (cardCopy + theme + body + caption)
    const effectiveUserQuery = (userQuery && userQuery.trim())
      ? userQuery
      : (customQuery && customQuery.trim() ? customQuery : undefined);

    const keywords = buildSearchQuery({
      theme, caption, body: postBody, cardCopy,
      niche, businessContext,
      userQuery: effectiveUserQuery,
      seed: nonce,
    });
    console.log("Search query:", keywords, "(niche:", niche, "format:", format, "mode:", mode, "userQuery:", effectiveUserQuery || "—", "cardCopy:", (cardCopy || "").slice(0, 60), ")");

    const pexelsKey = Deno.env.get("PEXELS_API_KEY");

    if (!pexelsKey && (mode === "gallery" || (!allowAI && mode !== "single"))) {
      console.error("PEXELS_API_KEY missing — image search unavailable");
      return new Response(JSON.stringify({
        error: "Banco de imagens indisponível. Tente novamente mais tarde.",
        results: [],
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== GALLERY MODE =====
    if (mode === "gallery") {
      const results = await searchPexelsList(keywords, format, pexelsKey!, 12, page);
      return new Response(JSON.stringify({ results, keywords, page }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== SINGLE MODE =====
    if (allowAI) {
      const { subject, mainMessage } = buildAIPromptSubject({
        theme, caption, body: postBody, cardCopy,
        niche, businessContext,
        userQuery: effectiveUserQuery,
        seed: nonce,
      });
      console.log("AI prompt subject:", subject, "| message:", mainMessage.slice(0, 80), "| style:", (aiStyleDirective || "—").slice(0, 80), "| nonce:", nonce);
      const url = await generateWithAI(subject, mainMessage, format, nonce, aiStyleDirective);
      if (url) {
        return new Response(JSON.stringify({ url, source: "ai", keywords }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "ai_generation_failed", keywords }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (pexelsKey) {
      // Quando há nonce (ex.: slide-by-slide em carrossel), variamos página e
      // seleção determinística pelo hash do nonce — assim cada slide cai em
      // uma imagem diferente em vez de colidir nos top 6.
      const nonceHash = nonce ? seedHash(nonce) : 0;
      const pexelsPage = nonce ? (Math.abs(nonceHash) % 3) + 1 : 1;
      const list = await searchPexelsList(keywords, format, pexelsKey, 24, pexelsPage);
      if (list.length > 0) {
        const topPool = list.slice(0, Math.min(12, list.length));
        const pick = nonce
          ? topPool[Math.abs(nonceHash) % topPool.length]
          : topPool[Math.floor(Math.random() * topPool.length)];
        return new Response(JSON.stringify({
          url: pick.url, source: "pexels", keywords,
          photographer: pick.photographer, sourceUrl: pick.sourceUrl,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "no image found", keywords, allowAI }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fetch-post-image error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
