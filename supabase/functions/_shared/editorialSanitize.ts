/**
 * Sanitização editorial backend — espelha (e fortalece) o `cleanText` do
 * frontend para garantir que rótulos estruturais de framework
 * (StoryBrand, Obviously Awesome, Made to Stick, posicionais como
 * "Slide 1:") nunca sejam persistidos no banco.
 *
 * Filosofia: o frontend continua aplicando uma camada de display de
 * segurança, mas o backend é a defesa principal.
 */

const stripMarkdown = (text: string): string => {
  if (!text) return "";
  let out = text;
  // bold/italic
  out = out.replace(/\*\*(.+?)\*\*/g, "$1");
  out = out.replace(/__(.+?)__/g, "$1");
  out = out.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "$1");
  out = out.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "$1");
  // headings + bullet markers
  out = out.replace(/^#{1,6}\s+/gm, "");
  out = out.replace(/^[-*•]\s+/gm, "");
  return out;
};

const fixPunctuation = (text: string): string => {
  if (!text) return "";
  let out = text;
  out = out.replace(/\.\,/g, ".");
  out = out.replace(/\,\./g, ".");
  out = out.replace(/\.{2,}/g, ".");
  out = out.replace(/\,{2,}/g, ",");
  out = out.replace(/\s+([.,;:!?])/g, "$1");
  out = out.replace(/\s{2,}/g, " ");
  out = out.replace(/([.,;:!?])(?=[A-Za-zÀ-ÿ])/g, "$1 ");
  return out.trim();
};

/**
 * Regex que casa um rótulo proibido NO INÍCIO da string, seguido por
 * dois-pontos / hífen / travessão. Cobre StoryBrand + posicionais.
 */
const FRAMEWORK_LABEL_RE = new RegExp(
  "^\\s*(?:" +
    // posicionais: Slide 1, Card 2, Página 3, Dia 4
    "(?:slide|card|p[áa]gina|dia)\\s*\\d+" +
    "|" +
    // rótulos de framework com artigo opcional "O "
    "(?:o\\s+)?(?:" +
      "problema\\s+externo|problema\\s+interno|problema\\s+filos[óo]fico|" +
      "(?:o\\s+)?plano|" +
      "cta|chamada\\s+(?:à|para)\\s+a[çc][ãa]o|" +
      "sucesso|fracasso|" +
      "her[óo]i|guia|" +
      "storybrand|made\\s+to\\s+stick|obviously\\s+awesome|" +
      "posicionamento|categoria|framework|etapa\\s+do\\s+framework" +
    ")" +
  ")\\s*[:\\-–—]\\s*",
  "i"
);

const stripQuotes = (text: string): string => {
  const m = text.match(/^["'“”‘’«»](.+)["'“”‘’«»]$/s);
  return m ? m[1].trim() : text;
};

/**
 * Remove rótulos estruturais do início da string.
 * Aplica até 3 passes para tratar rótulos encadeados (ex.: "Slide 1: Herói: ...").
 */
export function stripFrameworkLabels(text: string): string {
  if (!text || typeof text !== "string") return text || "";
  let out = text;
  for (let i = 0; i < 3; i++) {
    const next = out.replace(FRAMEWORK_LABEL_RE, "");
    if (next === out) break;
    out = next;
  }
  out = stripQuotes(out.trim());
  return out;
}

/** Pipeline completo de limpeza para um campo textual. */
export function cleanEditorialText(text: unknown): string {
  if (typeof text !== "string") return "";
  return fixPunctuation(stripFrameworkLabels(stripMarkdown(text)));
}

/**
 * Limites de copy visual para o card. Card é arte: curto, escaneável.
 * Legenda completa fica em `caption`.
 */
const SLIDE_MAX_CHARS = 180;
const SLIDE_MAX_SENTENCES = 2;
const SINGLE_MAX_CHARS = 220;
const SINGLE_MAX_SENTENCES = 2;

function splitSentencesPT(text: string): string[] {
  return (text || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÚÇ"'(¿¡])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

function takeShortBackend(text: string, maxChars: number, maxSentences: number): string {
  const cleaned = (text || "").trim();
  if (!cleaned) return "";
  if (cleaned.length <= maxChars) return cleaned;
  const sents = splitSentencesPT(cleaned);
  let out = "";
  let used = 0;
  for (const s of sents) {
    if (used >= maxSentences) break;
    const candidate = out ? `${out} ${s}` : s;
    if (candidate.length > maxChars && out) break;
    out = candidate;
    used++;
    if (out.length >= maxChars) break;
  }
  if (!out) out = sents[0] || cleaned;
  if (out.length > maxChars) {
    const slice = out.slice(0, maxChars);
    const lastSpace = slice.lastIndexOf(" ");
    out = (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim();
    if (!/[.!?…]$/.test(out)) out = out.replace(/[,;:\-—–]+$/, "") + "…";
  }
  return out;
}

function normalizeForEcho(s: string, takeWords = 12): string {
  const lower = (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return lower.split(" ").filter(Boolean).slice(0, takeWords).join(" ");
}

function isCaptionEcho(card: string, caption: string): boolean {
  if (!card || !caption) return false;
  const a = normalizeForEcho(card, 10);
  const b = normalizeForEcho(caption, 10);
  if (!a || !b) return false;
  if (a === b) return true;
  const aw = a.split(" ");
  const bw = b.split(" ");
  let same = 0;
  for (let i = 0; i < Math.min(aw.length, bw.length); i++) {
    if (aw[i] === bw[i]) same++;
    else break;
  }
  return same >= 8;
}

/**
 * Normaliza `card_copy` para texto de arte: compacta itens longos e
 * remove eco direto da legenda. Mantém o número de slides para carrossel.
 */
function normalizeCardCopy(items: string[], caption: string, format: string): string[] {
  if (!Array.isArray(items) || items.length === 0) return items;
  const isCarousel = (format || "").toLowerCase() === "carrossel";
  const maxChars = isCarousel ? SLIDE_MAX_CHARS : SINGLE_MAX_CHARS;
  const maxSents = isCarousel ? SLIDE_MAX_SENTENCES : SINGLE_MAX_SENTENCES;
  return items.map((raw) => {
    const cleaned = cleanEditorialText(raw);
    if (!cleaned) return "";
    let short = takeShortBackend(cleaned, maxChars, maxSents);
    if (isCaptionEcho(short, caption)) {
      const first = splitSentencesPT(short)[0] || short;
      short = takeShortBackend(first, maxChars, 1);
    }
    return short;
  }).filter((s) => s.length > 0);
}

/**
 * Aplica `cleanEditorialText` em todos os campos visíveis de um post,
 * incluindo cada item de `card_copy`. Mantém demais propriedades intactas.
 * Também compacta `card_copy` para evitar eco da legenda no card visual.
 */
export function sanitizePost<T extends Record<string, any>>(post: T): T {
  if (!post || typeof post !== "object") return post;
  const cleaned: any = { ...post };
  for (const key of ["theme", "caption", "cta", "script"] as const) {
    if (typeof cleaned[key] === "string") {
      cleaned[key] = cleanEditorialText(cleaned[key]);
    }
  }
  if (Array.isArray(cleaned.card_copy)) {
    cleaned.card_copy = normalizeCardCopy(
      cleaned.card_copy,
      typeof cleaned.caption === "string" ? cleaned.caption : "",
      typeof cleaned.format === "string" ? cleaned.format : "",
    );
  }
  return cleaned as T;
}

/**
 * Sanitiza um story (theme + frames[]).
 */
export function sanitizeStory<T extends Record<string, any>>(story: T): T {
  if (!story || typeof story !== "object") return story;
  const cleaned: any = { ...story };
  if (typeof cleaned.theme === "string") {
    cleaned.theme = cleanEditorialText(cleaned.theme);
  }
  if (Array.isArray(cleaned.frames)) {
    cleaned.frames = cleaned.frames
      .map((item: unknown) => cleanEditorialText(item))
      .filter((s: string) => s.length > 0);
  }
  return cleaned as T;
}

/**
 * Sanitiza um dia v6 com `feed` (post|null) e `story`.
 */
export function sanitizeDay<T extends Record<string, any>>(day: T): T {
  if (!day || typeof day !== "object") return day;
  const cleaned: any = { ...day };
  if (cleaned.feed && typeof cleaned.feed === "object") {
    cleaned.feed = sanitizePost(cleaned.feed);
  }
  if (cleaned.story && typeof cleaned.story === "object") {
    cleaned.story = sanitizeStory(cleaned.story);
  }
  return cleaned as T;
}

/** Sanitiza um array de posts (semana inteira no shape v5). */
export function sanitizeWeek<T extends Record<string, any>>(week: T[]): T[] {
  if (!Array.isArray(week)) return week;
  return week.map((p) => sanitizePost(p));
}

/** Sanitiza uma semana v6 ({ days: Day[] }) recursivamente. */
export function sanitizeWeekV6<T extends Record<string, any>>(week: T): T {
  if (!week || typeof week !== "object") return week;
  const cleaned: any = { ...week };
  if (Array.isArray(cleaned.days)) {
    cleaned.days = cleaned.days.map((d: any) => sanitizeDay(d));
  }
  return cleaned as T;
}


/**
 * Termos cuja presença como palavra isolada (após sanitização) indica
 * que a IA ainda devolveu conteúdo "com cara de framework" e precisa
 * ser rejeitado / regenerado.
 *
 * Importante: a lista usa boundary `\b` para evitar falso positivo em
 * palavras legítimas como "guia prático", "plano de aula" etc. dentro
 * de uma frase corrida. O que pegamos é o uso de TÍTULO/RÓTULO.
 */
const SUSPICIOUS_PATTERNS: RegExp[] = [
  // Rótulos compostos típicos do StoryBrand
  /\bproblema\s+(externo|interno|filos[óo]fico)\b/i,
  /\bchamada\s+(à|para)\s+a[çc][ãa]o\b/i,
  /\bsucesso\s+vs\.?\s+fracasso\b/i,
  // Nomes literais dos frameworks
  /\bstorybrand\b/i,
  /\bmade\s+to\s+stick\b/i,
  /\bobviously\s+awesome\b/i,
  /\bsucces\b/i,
  // Meta-linguagem de framework
  /\betapa\s+do\s+framework\b/i,
  /\bframework\b/i,
  // Meta-narrativa StoryBrand embutida no meio da copy
  /\b(o\s+)?her[óo]i\b/i,
  /\bguia\s+(da|do)\s+her[óo]i\b/i,
  /\bjornada\s+do\s+her[óo]i\b/i,
  /\b(a\s+)?marca\s+(como|atuando\s+como|no\s+papel\s+de)\s+guia\b/i,
  /\bplano\s+de\s+(3|tr[êe]s)\s+passos\b/i,
  /\bfracasso\s+(iminente|potencial|inevit[áa]vel)\b/i,
  /\bcategoria\s+(de\s+mercado|cognitiva)\b/i,
  /\bprinc[íi]pios?\s+succes\b/i,
];

/**
 * Heurística: a célula textual tem "cara de framework"?
 * Usada para detectar se é necessário um segundo passe ou rejeição.
 * Detecta tanto rótulos no início quanto meta-narrativa embutida no meio do texto.
 */
export function looksLikeFramework(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  return SUSPICIOUS_PATTERNS.some((re) => re.test(text));
}

/** Alias semântico para detecção de meta-narrativa em qualquer posição. */
export function containsFrameworkPhrases(text: string): boolean {
  return looksLikeFramework(text);
}

/** Conta quantos campos sanitizados ainda parecem "de framework". */
export function countFrameworkLeaks(post: Record<string, any>): number {
  let count = 0;
  for (const key of ["theme", "caption", "cta", "script"]) {
    if (looksLikeFramework(post?.[key] || "")) count++;
  }
  if (Array.isArray(post?.card_copy)) {
    for (const item of post.card_copy) {
      if (looksLikeFramework(item || "")) count++;
    }
  }
  return count;
}

/** Soma vazamentos em todos os posts da semana (shape v5). */
export function countWeekLeaks(week: Record<string, any>[]): number {
  if (!Array.isArray(week)) return 0;
  return week.reduce((sum, p) => sum + countFrameworkLeaks(p), 0);
}

/** Conta vazamentos no story (theme + frames[]). */
export function countStoryLeaks(story: Record<string, any> | null | undefined): number {
  if (!story || typeof story !== "object") return 0;
  let count = 0;
  if (looksLikeFramework(story.theme || "")) count++;
  if (Array.isArray(story.frames)) {
    for (const f of story.frames) if (looksLikeFramework(f || "")) count++;
  }
  return count;
}

/** Conta vazamentos em um dia v6 (feed + story). */
export function countDayLeaks(day: Record<string, any> | null | undefined): number {
  if (!day || typeof day !== "object") return 0;
  const feedLeaks = day.feed && typeof day.feed === "object" ? countFrameworkLeaks(day.feed) : 0;
  return feedLeaks + countStoryLeaks(day.story);
}

/** Soma vazamentos numa semana v6 ({ days: Day[] }). */
export function countWeekV6Leaks(week: Record<string, any> | null | undefined): number {
  if (!week || !Array.isArray((week as any).days)) return 0;
  return (week as any).days.reduce((sum: number, d: any) => sum + countDayLeaks(d), 0);
}

