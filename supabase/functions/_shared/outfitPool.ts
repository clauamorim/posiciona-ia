/**
 * Pool curado de figurinos por família-de-arquétipo × categoria-profissional.
 *
 * Objetivo: garantir variedade entre rodadas de geração sem que o usuário precise
 * descrever roupas. Cada item já vem em inglês, pronto para o Flux, com peças,
 * cores, tecidos e acessórios coerentes.
 *
 * O `generate-portrait` consulta `pickOutfits(family, category, recentlyUsed, 3)`,
 * que filtra os figurinos usados na última rodada (memória curta) e devolve 3
 * novos. Se o relatório do usuário ou um override manual estiverem presentes,
 * eles têm prioridade — o pool é só o fallback inteligente.
 */
import type { ArchetypeFamily } from "./portraitPrompts.ts";

export type ProfessionCategory =
  | "executive"
  | "creative"
  | "therapy"
  | "education"
  | "legal"
  | "beauty"
  | "tech"
  | "gastronomy"
  | "general";

/**
 * Mapeia uma string livre de profissão (PT) para uma categoria do pool.
 * Heurística por palavras-chave; tudo que não bate cai em "general".
 */
export function mapProfessionToCategory(profession?: string | null): ProfessionCategory {
  const p = (profession || "").toLowerCase();
  if (!p) return "general";
  if (/(advog|jur[ií]dic|direito|juiz|promotor|notari)/.test(p)) return "legal";
  if (/(executiv|gerent|diretor|ceo|cfo|empres[áa]ri|consult|administra|financ|contab|banc[áa]ri|investidor)/.test(p)) return "executive";
  if (/(designer|arquite|artista|fot[óo]grafa?o|fotograf|criador|publicit[áa]ri|marketer|estilist|cinema|audiovisual|moda)/.test(p)) return "creative";
  if (/(psic[óo]log|terape|coach|mentor|nutri|fisio|holistic|astrolog|tarot|reiki|yoga|medita)/.test(p)) return "therapy";
  if (/(professor|educad|pedagog|treinad|professora?|instrutor|palestrant|writer|escritor|jornalist)/.test(p)) return "education";
  if (/(esteti|beleza|cabelei|maquia|manicure|spa|skincare|beauty|estetic)/.test(p)) return "beauty";
  if (/(tech|tecnolog|engenh|desenvolved|developer|programad|software|dados|data|cyber|product\s*manager|pm)/.test(p)) return "tech";
  if (/(chef|gastronom|confeit|sommelie|nutricion.*aliment|culin[áa]ri|padar)/.test(p)) return "gastronomy";
  return "general";
}

/**
 * Pool central. Cada combinação família × categoria tem 8–10 figurinos.
 * Quando uma combinação específica não existe, cai no `general` da mesma família.
 */
type OutfitMatrix = Partial<Record<ArchetypeFamily, Partial<Record<ProfessionCategory, string[]>>>>;

export const OUTFIT_POOLS: OutfitMatrix = {
  authority: {
    executive: [
      "tailored navy blazer over a crisp white silk shell, subtle pearl earrings",
      "charcoal pinstripe suit with a pale blue button-up shirt, minimal gold watch",
      "structured camel blazer over a cream cashmere top, gold hoop earrings",
      "deep burgundy double-breasted blazer over a black silk top, sleek hair tucked",
      "ivory tailored blazer with a black silk camisole, slim leather belt",
      "midnight blue pantsuit with a fitted ivory blouse, delicate gold chain",
      "graphite grey blazer over a charcoal turtleneck, minimalist silver earrings",
      "ink black tuxedo-style blazer with satin lapel, white silk shell",
      "warm taupe blazer over a soft champagne silk shirt, gold signet ring",
    ],
    legal: [
      "sharp black blazer over a crisp white shirt, minimalist gold studs",
      "charcoal three-piece suit with a pale grey shirt, silk pocket square",
      "deep navy blazer over an ivory blouse, slim leather belt",
      "structured graphite blazer with a high-neck cream blouse, simple gold cuff",
      "midnight blue suit with a white silk shell, mother-of-pearl earrings",
      "tailored black blazer over a soft grey turtleneck, sleek hair",
      "burgundy blazer over a white poplin shirt, slim leather watch",
    ],
    general: [
      "tailored navy blazer over a white silk shell",
      "charcoal blazer over a cream cashmere top",
      "structured camel coat over an ivory blouse",
      "deep burgundy blazer over a black silk top",
      "ivory blazer over a champagne silk camisole",
      "midnight blue blazer over a soft grey turtleneck",
      "graphite blazer over a charcoal blouse",
      "warm taupe blazer over a cream silk shirt",
    ],
  },
  nurturing: {
    therapy: [
      "soft cream knit cardigan over an ivory linen blouse, delicate gold necklace",
      "warm beige wrap dress in flowing fabric, minimalist wooden earrings",
      "dusty rose oversized linen shirt over a champagne camisole, soft hair waves",
      "sage green cashmere sweater with cream wide-leg trousers, gentle posture",
      "soft camel knit top over off-white linen pants, warm gold pendant",
      "warm terracotta knit cardigan over a cream silk top, natural hair texture",
      "muted sage linen blouse with high-waist beige trousers, simple stud earrings",
      "ivory cashmere turtleneck with warm taupe linen pants, delicate ring",
    ],
    education: [
      "soft sage cardigan over a white cotton blouse, simple silver necklace",
      "warm camel knit sweater with cream straight-leg trousers",
      "dusty rose blouse with high-waist beige trousers, gentle hair tied back",
      "ivory linen shirt with warm brown trousers, leather wristwatch",
      "muted lavender cashmere top with cream wide-leg pants",
      "soft beige wrap blouse with warm grey trousers, pearl studs",
    ],
    general: [
      "soft cream knit cardigan over an ivory blouse",
      "warm beige wrap dress in flowing linen",
      "dusty rose oversized linen shirt with cream camisole",
      "sage green cashmere sweater with cream trousers",
      "warm camel knit top with off-white linen pants",
      "ivory cashmere turtleneck with taupe linen pants",
      "soft terracotta cardigan over a cream silk top",
      "muted sage linen blouse with beige trousers",
    ],
  },
  expressive: {
    creative: [
      "oversized ivory linen shirt half-tucked into wide-leg black trousers, statement gold hoop earrings",
      "burnt orange silk midi dress with a slim leather belt, layered gold necklaces",
      "deep emerald velvet blazer over a black silk camisole, bold gold cuff bracelet",
      "mustard yellow oversized cashmere sweater with high-waist black trousers, sculptural earrings",
      "rust-coloured silk shirt with cream wide-leg trousers, stacked gold rings",
      "deep plum satin blouse with black tailored trousers, asymmetric gold earrings",
      "terracotta linen jumpsuit with a thin gold belt, hair softly waved",
      "ivory silk shirt tied at the waist over flowing dark trousers, statement earrings",
    ],
    beauty: [
      "soft champagne silk camisole under an ivory satin blazer, glossy hair",
      "deep rose silk slip dress with delicate gold layered necklaces",
      "blush pink satin blouse with cream tailored trousers",
      "warm terracotta silk wrap top with high-waist nude trousers",
      "ivory silk shirt with a thin gold belt and warm brown trousers",
      "soft mauve silk blouse with off-white wide-leg pants, gold studs",
    ],
    gastronomy: [
      "ivory silk button-up half-tucked into warm camel trousers, gold hoop earrings",
      "burnt orange silk shirt with high-waist cream trousers, leather watch",
      "deep burgundy silk blouse with black tailored pants, gold pendant",
      "soft cream cashmere top with warm tan wide-leg trousers",
    ],
    general: [
      "oversized ivory linen shirt with wide-leg black trousers, statement gold earrings",
      "burnt orange silk midi dress with slim leather belt",
      "deep emerald velvet blazer over a black silk camisole",
      "mustard cashmere sweater with high-waist black trousers",
      "rust silk shirt with cream wide-leg trousers, stacked rings",
      "deep plum satin blouse with black tailored trousers",
      "terracotta linen jumpsuit with thin gold belt",
      "ivory silk shirt with a thin belt over dark trousers",
    ],
  },
  independent: {
    tech: [
      "fitted black turtleneck with charcoal tailored trousers, minimalist silver watch",
      "graphite grey merino sweater with deep navy chinos, leather strap watch",
      "ivory cotton button-up under a charcoal cardigan, slim dark trousers",
      "deep forest green knit top with warm tan trousers, simple silver hoops",
      "soft black cashmere t-shirt with stone grey trousers, minimal jewelry",
      "off-white merino sweater with dark indigo straight-leg jeans, leather watch",
      "charcoal henley top with mid-grey trousers, subtle silver studs",
    ],
    general: [
      "fitted black turtleneck with charcoal tailored trousers",
      "graphite grey merino sweater with deep navy trousers",
      "ivory cotton button-up under a charcoal cardigan",
      "deep forest green knit top with warm tan trousers",
      "soft black cashmere t-shirt with stone grey trousers",
      "off-white merino sweater with dark indigo straight-leg trousers",
      "warm camel knit top with charcoal slim trousers",
      "deep olive merino sweater with cream tailored trousers",
    ],
  },
};

/** Embaralhamento Fisher–Yates não destrutivo. */
function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Sorteia `count` figurinos para uma combinação família × categoria.
 *
 * Estratégia:
 *   1. Resolve o pool: tenta família×categoria; se vazio, cai em família×general.
 *   2. Filtra os figurinos usados na última geração (recentlyUsed) — se sobrarem
 *      pelo menos `count` opções; senão volta ao pool completo.
 *   3. Embaralha e devolve `count` itens (sem reposição na rodada atual).
 */
export function pickOutfits(
  family: ArchetypeFamily,
  category: ProfessionCategory,
  recentlyUsed: string[],
  count = 3,
): string[] {
  const familyPools = OUTFIT_POOLS[family] ?? {};
  const fullPool = familyPools[category] ?? familyPools["general"] ?? [];
  if (fullPool.length === 0) return [];

  const used = new Set(recentlyUsed.filter((s) => typeof s === "string"));
  const filtered = fullPool.filter((o) => !used.has(o));
  const workingPool = filtered.length >= count ? filtered : fullPool;
  const shuffled = shuffle(workingPool);
  return shuffled.slice(0, count);
}
