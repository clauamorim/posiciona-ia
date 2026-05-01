/**
 * Pool curado de figurinos por família-de-arquétipo × categoria-profissional.
 *
 * Objetivo: garantir variedade entre rodadas de geração sem que o usuário precise
 * descrever roupas. Cada item já vem em inglês, pronto para o Flux, com peças,
 * cores, tecidos e acessórios coerentes.
 *
 * Cada item agora carrega metadata leve (peça-âncora + cor) para que
 * `pickOutfits` consiga garantir DIVERSIDADE REAL dentro da mesma rodada de 3
 * fotos: nunca 3 blazers, nunca 3 marinhos. Esse era o motivo de retratos
 * "iguais" mesmo com o pool variado.
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

/** Categorias de "peça-âncora" usadas para garantir diversidade entre os 3 looks. */
export type OutfitAnchor =
  | "blazer"
  | "suit"
  | "dress"
  | "jumpsuit"
  | "cardigan"
  | "sweater"
  | "knit"
  | "silk-top"
  | "shirt"
  | "turtleneck"
  | "coat"
  | "other";

/** Cor dominante do look — usada para variar paleta entre os 3 retratos. */
export type OutfitColor =
  | "navy"
  | "black"
  | "charcoal"
  | "graphite"
  | "burgundy"
  | "plum"
  | "emerald"
  | "forest"
  | "sage"
  | "olive"
  | "camel"
  | "beige"
  | "ivory"
  | "cream"
  | "champagne"
  | "white"
  | "blush"
  | "rose"
  | "mauve"
  | "lavender"
  | "terracotta"
  | "rust"
  | "mustard"
  | "brown"
  | "grey"
  | "indigo"
  | "taupe"
  | "other";

export interface OutfitItem {
  text: string;
  anchor: OutfitAnchor;
  color: OutfitColor;
}

/**
 * Mapeia uma string livre de profissão (PT) para uma categoria do pool.
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

/** Helper conciso para construir um item do pool. */
const O = (text: string, anchor: OutfitAnchor, color: OutfitColor): OutfitItem => ({ text, anchor, color });

type OutfitMatrix = Partial<Record<ArchetypeFamily, Partial<Record<ProfessionCategory, OutfitItem[]>>>>;

export const OUTFIT_POOLS: OutfitMatrix = {
  authority: {
    executive: [
      O("tailored navy blazer over a crisp white silk shell, subtle pearl earrings", "blazer", "navy"),
      O("charcoal pinstripe suit with a pale blue button-up shirt, minimal gold watch", "suit", "charcoal"),
      O("structured camel blazer over a cream cashmere top, gold hoop earrings", "blazer", "camel"),
      O("deep burgundy double-breasted blazer over a black silk top, sleek hair tucked", "blazer", "burgundy"),
      O("ivory tailored blazer with a black silk camisole, slim leather belt", "blazer", "ivory"),
      O("midnight blue pantsuit with a fitted ivory blouse, delicate gold chain", "suit", "navy"),
      O("graphite grey blazer over a charcoal turtleneck, minimalist silver earrings", "blazer", "graphite"),
      O("ink black tuxedo-style blazer with satin lapel, white silk shell", "blazer", "black"),
      O("warm taupe blazer over a soft champagne silk shirt, gold signet ring", "blazer", "taupe"),
      O("emerald green silk blouse tucked into high-waist black trousers, gold cuff", "silk-top", "emerald"),
      O("burgundy silk midi sheath dress with thin gold belt, pearl studs", "dress", "burgundy"),
      O("cream cashmere turtleneck with charcoal tailored trousers, leather watch", "turtleneck", "cream"),
    ],
    legal: [
      O("sharp black blazer over a crisp white shirt, minimalist gold studs", "blazer", "black"),
      O("charcoal three-piece suit with a pale grey shirt, silk pocket square", "suit", "charcoal"),
      O("deep navy blazer over an ivory blouse, slim leather belt", "blazer", "navy"),
      O("structured graphite blazer with a high-neck cream blouse, simple gold cuff", "blazer", "graphite"),
      O("midnight blue suit with a white silk shell, mother-of-pearl earrings", "suit", "navy"),
      O("burgundy blazer over a white poplin shirt, slim leather watch", "blazer", "burgundy"),
      O("emerald silk blouse with charcoal tailored trousers, delicate gold chain", "silk-top", "emerald"),
      O("ivory silk midi sheath dress with thin black belt, pearl studs", "dress", "ivory"),
      O("camel cashmere turtleneck with deep navy tailored trousers, leather watch", "turtleneck", "camel"),
      O("warm beige tweed blazer over a white silk shell, gold hoop earrings", "blazer", "beige"),
    ],
    general: [
      O("tailored navy blazer over a white silk shell", "blazer", "navy"),
      O("charcoal blazer over a cream cashmere top", "blazer", "charcoal"),
      O("structured camel coat over an ivory blouse", "coat", "camel"),
      O("deep burgundy blazer over a black silk top", "blazer", "burgundy"),
      O("ivory blazer over a champagne silk camisole", "blazer", "ivory"),
      O("midnight blue blazer over a soft grey turtleneck", "blazer", "navy"),
      O("graphite blazer over a charcoal blouse", "blazer", "graphite"),
      O("warm taupe blazer over a cream silk shirt", "blazer", "taupe"),
      O("emerald silk blouse with black tailored trousers", "silk-top", "emerald"),
      O("burgundy silk midi sheath dress with thin gold belt", "dress", "burgundy"),
      O("cream cashmere turtleneck with charcoal trousers", "turtleneck", "cream"),
    ],
  },
  nurturing: {
    therapy: [
      O("soft cream knit cardigan over an ivory linen blouse, delicate gold necklace", "cardigan", "cream"),
      O("warm beige wrap dress in flowing fabric, minimalist wooden earrings", "dress", "beige"),
      O("dusty rose oversized linen shirt over a champagne camisole, soft hair waves", "shirt", "rose"),
      O("sage green cashmere sweater with cream wide-leg trousers, gentle posture", "sweater", "sage"),
      O("soft camel knit top over off-white linen pants, warm gold pendant", "knit", "camel"),
      O("warm terracotta knit cardigan over a cream silk top, natural hair texture", "cardigan", "terracotta"),
      O("muted sage linen blouse with high-waist beige trousers, simple stud earrings", "shirt", "sage"),
      O("ivory cashmere turtleneck with warm taupe linen pants, delicate ring", "turtleneck", "ivory"),
      O("lavender silk blouse with cream wide-leg trousers, soft hair waves", "silk-top", "lavender"),
      O("warm brown linen jumpsuit with thin tan belt, natural posture", "jumpsuit", "brown"),
    ],
    education: [
      O("soft sage cardigan over a white cotton blouse, simple silver necklace", "cardigan", "sage"),
      O("warm camel knit sweater with cream straight-leg trousers", "sweater", "camel"),
      O("dusty rose blouse with high-waist beige trousers, gentle hair tied back", "shirt", "rose"),
      O("ivory linen shirt with warm brown trousers, leather wristwatch", "shirt", "ivory"),
      O("muted lavender cashmere top with cream wide-leg pants", "knit", "lavender"),
      O("soft beige wrap blouse with warm grey trousers, pearl studs", "shirt", "beige"),
      O("emerald silk blouse with warm brown trousers, gold hoop earrings", "silk-top", "emerald"),
      O("warm terracotta wrap dress with thin leather belt", "dress", "terracotta"),
    ],
    general: [
      O("soft cream knit cardigan over an ivory blouse", "cardigan", "cream"),
      O("warm beige wrap dress in flowing linen", "dress", "beige"),
      O("dusty rose oversized linen shirt with cream camisole", "shirt", "rose"),
      O("sage green cashmere sweater with cream trousers", "sweater", "sage"),
      O("warm camel knit top with off-white linen pants", "knit", "camel"),
      O("ivory cashmere turtleneck with taupe linen pants", "turtleneck", "ivory"),
      O("soft terracotta cardigan over a cream silk top", "cardigan", "terracotta"),
      O("muted sage linen blouse with beige trousers", "shirt", "sage"),
      O("lavender silk blouse with cream trousers", "silk-top", "lavender"),
      O("warm brown linen jumpsuit with tan belt", "jumpsuit", "brown"),
    ],
  },
  expressive: {
    creative: [
      O("oversized ivory linen shirt half-tucked into wide-leg black trousers, statement gold hoop earrings", "shirt", "ivory"),
      O("burnt orange silk midi dress with a slim leather belt, layered gold necklaces", "dress", "rust"),
      O("deep emerald velvet blazer over a black silk camisole, bold gold cuff bracelet", "blazer", "emerald"),
      O("mustard yellow oversized cashmere sweater with high-waist black trousers, sculptural earrings", "sweater", "mustard"),
      O("rust-coloured silk shirt with cream wide-leg trousers, stacked gold rings", "silk-top", "rust"),
      O("deep plum satin blouse with black tailored trousers, asymmetric gold earrings", "silk-top", "plum"),
      O("terracotta linen jumpsuit with a thin gold belt, hair softly waved", "jumpsuit", "terracotta"),
      O("cream cashmere turtleneck under a deep burgundy long coat, statement earrings", "turtleneck", "cream"),
      O("warm camel knit cardigan over an ivory silk slip dress, gold hoops", "cardigan", "camel"),
    ],
    beauty: [
      O("soft champagne silk camisole under an ivory satin blazer, glossy hair", "blazer", "champagne"),
      O("deep rose silk slip dress with delicate gold layered necklaces", "dress", "rose"),
      O("blush pink satin blouse with cream tailored trousers", "silk-top", "blush"),
      O("warm terracotta silk wrap top with high-waist nude trousers", "silk-top", "terracotta"),
      O("ivory silk shirt with a thin gold belt and warm brown trousers", "shirt", "ivory"),
      O("soft mauve silk blouse with off-white wide-leg pants, gold studs", "silk-top", "mauve"),
      O("camel knit cardigan over a champagne silk camisole, gold hoops", "cardigan", "camel"),
      O("deep emerald silk midi dress with thin gold belt", "dress", "emerald"),
    ],
    gastronomy: [
      O("ivory silk button-up half-tucked into warm camel trousers, gold hoop earrings", "shirt", "ivory"),
      O("burnt orange silk shirt with high-waist cream trousers, leather watch", "silk-top", "rust"),
      O("deep burgundy silk blouse with black tailored pants, gold pendant", "silk-top", "burgundy"),
      O("soft cream cashmere top with warm tan wide-leg trousers", "knit", "cream"),
      O("emerald silk wrap dress with thin leather belt", "dress", "emerald"),
      O("camel cardigan over a white silk camisole, gold hoops", "cardigan", "camel"),
    ],
    general: [
      O("oversized ivory linen shirt with wide-leg black trousers, statement gold earrings", "shirt", "ivory"),
      O("burnt orange silk midi dress with slim leather belt", "dress", "rust"),
      O("deep emerald velvet blazer over a black silk camisole", "blazer", "emerald"),
      O("mustard cashmere sweater with high-waist black trousers", "sweater", "mustard"),
      O("rust silk shirt with cream wide-leg trousers, stacked rings", "silk-top", "rust"),
      O("deep plum satin blouse with black tailored trousers", "silk-top", "plum"),
      O("terracotta linen jumpsuit with thin gold belt", "jumpsuit", "terracotta"),
      O("cream cashmere turtleneck under a burgundy long coat", "turtleneck", "cream"),
      O("warm camel knit cardigan over an ivory silk slip dress", "cardigan", "camel"),
    ],
  },
  independent: {
    tech: [
      O("fitted black turtleneck with charcoal tailored trousers, minimalist silver watch", "turtleneck", "black"),
      O("graphite grey merino sweater with deep navy chinos, leather strap watch", "sweater", "graphite"),
      O("ivory cotton button-up under a charcoal cardigan, slim dark trousers", "cardigan", "charcoal"),
      O("deep forest green knit top with warm tan trousers, simple silver hoops", "knit", "forest"),
      O("soft black cashmere t-shirt with stone grey trousers, minimal jewelry", "knit", "black"),
      O("off-white merino sweater with dark indigo straight-leg jeans, leather watch", "sweater", "ivory"),
      O("camel cashmere turtleneck with charcoal trousers, leather strap watch", "turtleneck", "camel"),
      O("deep burgundy henley top with mid-grey trousers, subtle silver studs", "knit", "burgundy"),
      O("ivory linen shirt half-tucked into warm tan trousers, leather watch", "shirt", "ivory"),
    ],
    general: [
      O("fitted black turtleneck with charcoal tailored trousers", "turtleneck", "black"),
      O("graphite grey merino sweater with deep navy trousers", "sweater", "graphite"),
      O("ivory cotton button-up under a charcoal cardigan", "cardigan", "charcoal"),
      O("deep forest green knit top with warm tan trousers", "knit", "forest"),
      O("soft black cashmere t-shirt with stone grey trousers", "knit", "black"),
      O("off-white merino sweater with dark indigo straight-leg trousers", "sweater", "ivory"),
      O("warm camel knit top with charcoal slim trousers", "knit", "camel"),
      O("deep olive merino sweater with cream tailored trousers", "sweater", "olive"),
      O("burgundy henley top with mid-grey trousers", "knit", "burgundy"),
      O("ivory linen shirt with warm tan trousers", "shirt", "ivory"),
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

/** Resolve o pool efetivo: combinação família×categoria + general da família. */
function resolvePool(family: ArchetypeFamily, category: ProfessionCategory): OutfitItem[] {
  const familyPools = OUTFIT_POOLS[family] ?? {};
  const primary = familyPools[category] ?? [];
  const general = familyPools["general"] ?? [];
  // Junta primary + general sem duplicar pelo texto.
  const seen = new Set<string>();
  const merged: OutfitItem[] = [];
  for (const item of [...primary, ...general]) {
    if (seen.has(item.text)) continue;
    seen.add(item.text);
    merged.push(item);
  }
  return merged;
}

/**
 * Sorteia `count` figurinos com DIVERSIDADE GARANTIDA dentro da rodada:
 *   - Peças-âncora distintas (nunca 3 blazers).
 *   - Cores distintas (nunca 3 marinhos).
 *   - Evita figurinos da rodada anterior (memória curta) quando possível.
 *
 * Algoritmo: tenta múltiplas amostragens aleatórias e devolve a primeira
 * combinação válida. Se não achar, relaxa restrições nesta ordem:
 *   1. permite repetir cor (mantém âncora distinta)
 *   2. permite repetir âncora também (último recurso)
 *
 * Devolve apenas as strings de texto (compatível com a API anterior).
 */
export function pickOutfits(
  family: ArchetypeFamily,
  category: ProfessionCategory,
  recentlyUsed: string[],
  count = 3,
): string[] {
  const pool = resolvePool(family, category);
  if (pool.length === 0) return [];
  if (pool.length <= count) return pool.slice(0, count).map((o) => o.text);

  const recentSet = new Set(recentlyUsed.filter((s) => typeof s === "string"));

  const tryPick = (opts: { distinctAnchor: boolean; distinctColor: boolean; avoidRecent: boolean }): string[] | null => {
    const ATTEMPTS = 40;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const shuffled = shuffle(pool);
      const picked: OutfitItem[] = [];
      const usedAnchors = new Set<OutfitAnchor>();
      const usedColors = new Set<OutfitColor>();
      for (const item of shuffled) {
        if (picked.length >= count) break;
        if (opts.avoidRecent && recentSet.has(item.text)) continue;
        if (opts.distinctAnchor && usedAnchors.has(item.anchor)) continue;
        if (opts.distinctColor && usedColors.has(item.color)) continue;
        picked.push(item);
        usedAnchors.add(item.anchor);
        usedColors.add(item.color);
      }
      if (picked.length === count) return picked.map((o) => o.text);
    }
    return null;
  };

  return (
    tryPick({ distinctAnchor: true, distinctColor: true, avoidRecent: true }) ??
    tryPick({ distinctAnchor: true, distinctColor: true, avoidRecent: false }) ??
    tryPick({ distinctAnchor: true, distinctColor: false, avoidRecent: false }) ??
    tryPick({ distinctAnchor: false, distinctColor: false, avoidRecent: false }) ??
    shuffle(pool).slice(0, count).map((o) => o.text)
  );
}

/**
 * Devolve metadata (âncora + cor) de um texto de outfit, varrendo todos os pools.
 * Usado para logs de auditoria.
 */
export function lookupOutfitMeta(text: string): { anchor: OutfitAnchor; color: OutfitColor } | null {
  for (const family of Object.values(OUTFIT_POOLS)) {
    if (!family) continue;
    for (const items of Object.values(family)) {
      if (!items) continue;
      const found = items.find((i) => i.text === text);
      if (found) return { anchor: found.anchor, color: found.color };
    }
  }
  return null;
}
