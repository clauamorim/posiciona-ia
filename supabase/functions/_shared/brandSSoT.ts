// Brand Single Source of Truth helpers.
// Persiste e carrega símbolos + paleta do relatório do usuário, e renderiza
// um bloco de prompt para forçar análise de IG e outros geradores a usarem
// a SSoT em vez de inventar paleta/símbolos.

export interface SSoTSymbol {
  symbol_name: string;
  emoji: string | null;
  meaning: string | null;
  application: string | null;
  archetype_role: string;
  priority: number;
}

export interface SSoTColor {
  color_name: string;
  hex: string;
  usage: string | null;
  role: string;
  priority: number;
}

export interface SSoTWardrobe {
  resumo?: string;
  cores_roupa?: string[];
  pecas_chave?: string[];
  evitar?: string[];
}

export interface BrandSSoT {
  symbols: SSoTSymbol[];
  palette: SSoTColor[];
  wardrobe: SSoTWardrobe | null;
  wordsToUse: string[];
  wordsToAvoid: string[];
}

const ROLE_BY_INDEX = ["primary", "secondary", "neutral_light", "accent", "neutral_dark"];

export async function persistBrandSSoT(
  admin: any,
  params: {
    userId: string;
    reportId: string;
    reportVersion: number;
    reportContent: any;
  },
): Promise<void> {
  const { userId, reportId, reportVersion, reportContent } = params;
  const palette = Array.isArray(reportContent?.visual_identity?.palette)
    ? reportContent.visual_identity.palette
    : [];
  const simbolos = reportContent?.simbolos || {};

  // Limpa SSoT antigo do usuário (única "versão atual" — versões anteriores
  // são consultáveis via reports.content se necessário).
  await admin.from("user_brand_palette").delete().eq("user_id", userId);
  await admin.from("user_archetype_symbols").delete().eq("user_id", userId);

  // Paleta
  const paletteRows = palette
    .filter((c: any) => c && typeof c.hex === "string" && typeof c.name === "string")
    .slice(0, 5)
    .map((c: any, i: number) => ({
      user_id: userId,
      report_id: reportId,
      report_version: reportVersion,
      color_name: String(c.name).trim(),
      hex: String(c.hex).trim(),
      usage: typeof c.usage === "string" ? c.usage : null,
      role: ROLE_BY_INDEX[i] || "accent",
      priority: i,
    }));
  if (paletteRows.length) {
    const { error } = await admin.from("user_brand_palette").insert(paletteRows);
    if (error) console.error("[brandSSoT] persist palette failed:", error.message);
  }

  // Símbolos (3 por arquétipo; primary, secondary, tertiary)
  const symbolRows: any[] = [];
  for (const role of ["primary", "secondary", "tertiary"]) {
    const arr = Array.isArray(simbolos?.[role]) ? simbolos[role] : [];
    arr.slice(0, 3).forEach((s: any, i: number) => {
      if (!s || typeof s !== "object") return;
      const name = typeof s.nome === "string" ? s.nome.trim() : "";
      if (!name) return;
      symbolRows.push({
        user_id: userId,
        report_id: reportId,
        report_version: reportVersion,
        symbol_name: name,
        emoji: typeof s.simbolo === "string" ? s.simbolo : null,
        meaning: typeof s.significado === "string" ? s.significado : null,
        application: typeof s.aplicacao === "string" ? s.aplicacao : null,
        archetype_role: role,
        priority: i,
      });
    });
  }
  if (symbolRows.length) {
    const { error } = await admin.from("user_archetype_symbols").insert(symbolRows);
    if (error) console.error("[brandSSoT] persist symbols failed:", error.message);
  }

  console.log(`[brandSSoT] persisted user=${userId} colors=${paletteRows.length} symbols=${symbolRows.length}`);
}

export async function loadBrandSSoT(
  admin: any,
  userId: string,
): Promise<BrandSSoT> {
  const empty: BrandSSoT = {
    symbols: [],
    palette: [],
    wardrobe: null,
    wordsToUse: [],
    wordsToAvoid: [],
  };

  const [palRes, symRes, repRes] = await Promise.all([
    admin
      .from("user_brand_palette")
      .select("color_name, hex, usage, role, priority")
      .eq("user_id", userId)
      .order("priority", { ascending: true }),
    admin
      .from("user_archetype_symbols")
      .select("symbol_name, emoji, meaning, application, archetype_role, priority")
      .eq("user_id", userId)
      .order("archetype_role", { ascending: true })
      .order("priority", { ascending: true }),
    admin
      .from("reports")
      .select("content")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const content = (repRes.data as any)?.content || null;
  const tone = content?.tone_of_voice || {};
  const figurino = content?.figurino || {};

  return {
    symbols: (symRes.data as any[]) || [],
    palette: (palRes.data as any[]) || [],
    wardrobe: content
      ? {
          resumo: typeof figurino.resumo === "string" ? figurino.resumo : "",
          cores_roupa: Array.isArray(figurino.cores_roupa) ? figurino.cores_roupa : [],
          pecas_chave: Array.isArray(figurino.pecas_chave) ? figurino.pecas_chave : [],
          evitar: Array.isArray(figurino.evitar) ? figurino.evitar : [],
        }
      : null,
    wordsToUse: Array.isArray(tone?.words_to_use) ? tone.words_to_use : [],
    wordsToAvoid: Array.isArray(tone?.words_to_avoid) ? tone.words_to_avoid : [],
  };
}

/** Renderiza bloco de prompt instruindo a LLM a USAR a SSoT como única
 *  fonte de paleta/símbolos/figurino — sem inventar. */
export function renderBrandSSoTBlock(ssot: BrandSSoT): string {
  if (!ssot.palette.length && !ssot.symbols.length && !ssot.wardrobe) return "";

  const paletteLines = ssot.palette
    .map((c) => `- ${c.color_name} (${c.hex})${c.usage ? ` — ${c.usage}` : ""}`)
    .join("\n");

  const symbolsLines = ssot.symbols
    .map((s) => `- ${s.symbol_name}${s.emoji ? ` ${s.emoji}` : ""}${s.application ? ` — ${s.application}` : ""}`)
    .join("\n");

  const wardrobePieces = ssot.wardrobe?.pecas_chave?.slice(0, 5).join("; ") || "";
  const wardrobeColors = ssot.wardrobe?.cores_roupa?.slice(0, 4).join("; ") || "";
  const wardrobeAvoid = ssot.wardrobe?.evitar?.slice(0, 3).join("; ") || "";

  return `\n\n# IDENTIDADE DA MARCA — FONTE ÚNICA DE VERDADE (USE OBRIGATORIAMENTE)
Esta marca JÁ tem identidade definida no relatório estratégico. Use EXATAMENTE estes elementos — não invente paleta, símbolos ou figurino.

${ssot.palette.length ? `## Paleta autorizada (cite estas cores nominalmente quando recomendar)
${paletteLines}` : ""}

${ssot.symbols.length ? `## Símbolos da marca (use como ícones de destaques e elementos decorativos)
${symbolsLines}` : ""}

${ssot.wardrobe && (wardrobePieces || wardrobeColors) ? `## Figurino estratégico
${wardrobePieces ? `Peças: ${wardrobePieces}` : ""}
${wardrobeColors ? `Cores de roupa: ${wardrobeColors}` : ""}
${wardrobeAvoid ? `Evitar: ${wardrobeAvoid}` : ""}` : ""}

${ssot.wordsToUse.length ? `## Palavras a USAR no tom de voz: ${ssot.wordsToUse.slice(0, 8).join(", ")}` : ""}
${ssot.wordsToAvoid.length ? `## Palavras a EVITAR (NUNCA escrever): ${ssot.wordsToAvoid.slice(0, 12).join(", ")}` : ""}

REGRAS:
- Sugestões de destaques DEVEM citar os símbolos acima como ícones recomendados.
- Sugestões de paleta DEVEM citar as cores acima pelo nome (não inventar "Verde Aventura" se não estiver na lista).
- Sugestões de figurino DEVEM citar peças e cores da lista de figurino.
- Bios e CTAs DEVEM respeitar palavras a usar/evitar — NUNCA escreva uma palavra da lista de evitar.
`.replace(/\n{3,}/g, "\n\n");
}
