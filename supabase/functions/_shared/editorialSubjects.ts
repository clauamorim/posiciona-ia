// Eixo de ASSUNTO (território temático) — anti-repetição de TEMA entre semanas.
//
// Complementa as travas que já existiam, que cuidam todas da FORMA do post:
//   - rotação de PILAR (editorialPillars.ts) — intenção do post
//   - diversidade de FÓRMULA/CONCEITO (editorialDiversity.ts) — molde de título
//   - moldes estruturais (patternSignature.ts) — molde narrativo
// Nenhuma delas impede que o MESMO assunto volte sob outra forma. Este módulo
// adiciona o eixo que faltava: o ASSUNTO concreto do nicho.
//
// Mecânica (espelha getPillarRotationHint + renderRotationBlock):
//   1) cada post de feed carrega um `subject_tag` curto (kebab-case);
//   2) os 4 posts da semana usam 4 assuntos DISTINTOS entre si;
//   3) assuntos usados nas últimas N semanas ficam proibidos (rotação).
//
// Guardrail-only: nunca lança. No máximo dispara um retry guiado e segue.

export const SUBJECT_ROTATION_WEEKS = 4;

/** Normaliza um assunto para comparação: minúsculas, sem acento, kebab-case. */
export function normalizeSubject(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();
}

export interface RecentSubject {
  tag: string; // normalizado
  raw: string; // como veio do histórico
  weekIndex: number;
  theme?: string;
}

/**
 * Achata os assuntos usados nas últimas `windowWeeks` semanas a partir do
 * histórico do relatório. `weeksRecentFirst` deve vir do mais recente para o
 * mais antigo.
 */
export function collectRecentSubjects(
  weeksRecentFirst: Array<{ weekIndex: number; subjects: Array<{ tag: string; theme?: string }> }>,
  windowWeeks: number = SUBJECT_ROTATION_WEEKS,
): RecentSubject[] {
  const out: RecentSubject[] = [];
  for (const w of (weeksRecentFirst || []).slice(0, windowWeeks)) {
    for (const s of w.subjects || []) {
      const tag = normalizeSubject(s.tag);
      if (!tag) continue;
      out.push({ tag, raw: s.tag, weekIndex: w.weekIndex, theme: s.theme });
    }
  }
  return out;
}

/** Bloco para o system prompt: define o campo subject_tag e a regra de rotação. */
export function renderSubjectAxisBlock(recent: RecentSubject[]): string {
  const recentList = recent.length > 0
    ? Array.from(
        new Set(recent.map((r) => `${r.tag}${r.theme ? ` (ex.: ${r.theme})` : ""}`)),
      ).join("\n- ")
    : "(nenhum ainda — primeira semana com rastreio de assunto)";
  return `

# EIXO DE ASSUNTO — ROTAÇÃO DE TEMA (REGRA OBRIGATÓRIA)
Pilar e formato cuidam da FORMA do post. Este bloco cuida do ASSUNTO — o tema concreto do nicho. É o eixo MAIS importante para o leitor não sentir "já vi esse post".

Cada post DEVE trazer o campo "subject_tag": um identificador curto em kebab-case do ASSUNTO concreto (substantivo do nicho do negócio — NÃO o pilar, NÃO o formato, NÃO o gancho).
Exemplos (advocacia de leilão de imóveis): "leitura-matricula", "situacao-processual", "debitos-condominio", "imissao-na-posse", "leilao-extrajudicial", "precificacao-lance", "ativo-estressado", "tributacao-arrematacao", "due-diligence-documental", "usufruto-direitos-reais".

ANTES DE ESCOLHER OS 4 ASSUNTOS:
1. Liste mentalmente 10 ou mais assuntos DISTINTOS que o negócio poderia abordar no nicho dele.
2. Escolha 4 assuntos DIFERENTES entre si (um subject_tag único por post).
3. NÃO use nenhum assunto da lista "ASSUNTOS USADOS RECENTEMENTE" abaixo — escolha territórios ainda não cobertos.

ASSUNTOS USADOS RECENTEMENTE (PROIBIDOS nesta semana — últimas ${SUBJECT_ROTATION_WEEKS} semanas):
- ${recentList}

REGRA DURA: dois posts com o mesmo assunto, ou qualquer assunto da lista acima, dispara reescrita. Trocar formato, pilar, título ou gancho NÃO resolve — o ASSUNTO precisa ser outro.`;
}

export interface SubjectViolation {
  rule: "subject_duplicate" | "subject_recent_reuse" | "subject_missing";
  detail: string;
  days: number[];
}

export interface SubjectPostLike {
  day: number;
  theme?: string;
  subject_tag?: string;
}

/** Assunto normalizado de um post (vazio se não houver subject_tag). */
export function getPostSubject(p: SubjectPostLike): string {
  return normalizeSubject((p as any).subject_tag || "");
}

/**
 * Valida a semana no eixo de assunto. Retorna violações + o mapa dia→assunto
 * (usado para persistir e para logs).
 */
export function validateWeekSubjects(
  posts: SubjectPostLike[],
  recent: RecentSubject[],
): { ok: boolean; violations: SubjectViolation[]; subjectByDay: Record<number, string> } {
  const violations: SubjectViolation[] = [];
  const subjectByDay: Record<number, string> = {};
  const byTag: Record<string, number[]> = {};
  const missing: number[] = [];

  for (const p of posts || []) {
    const tag = getPostSubject(p);
    subjectByDay[p.day] = tag;
    if (!tag) {
      missing.push(p.day);
      continue;
    }
    (byTag[tag] ||= []).push(p.day);
  }

  // Mesmo assunto 2x na semana
  for (const [tag, days] of Object.entries(byTag)) {
    if (days.length > 1) {
      violations.push({
        rule: "subject_duplicate",
        detail: `Assunto "${tag}" aparece em ${days.length} posts (máx 1 por semana).`,
        days,
      });
    }
  }

  // Reuso de assunto recente
  const recentSet = new Set(recent.map((r) => r.tag));
  for (const [tag, days] of Object.entries(byTag)) {
    if (recentSet.has(tag)) {
      violations.push({
        rule: "subject_recent_reuse",
        detail: `Assunto "${tag}" já foi usado nas últimas ${SUBJECT_ROTATION_WEEKS} semanas — escolha outro território.`,
        days,
      });
    }
  }

  // Post sem subject_tag
  if (missing.length > 0) {
    violations.push({
      rule: "subject_missing",
      detail: `Post(s) sem o campo "subject_tag".`,
      days: missing,
    });
  }

  return { ok: violations.length === 0, violations, subjectByDay };
}

/** Texto de retry guiado quando há violação de assunto. */
export function renderSubjectRetryInstructions(
  violations: SubjectViolation[],
  recent: RecentSubject[],
): string {
  const list = violations
    .map((v, i) => `${i + 1}. ${v.detail} (dias afetados: ${v.days.join(", ")})`)
    .join("\n");
  const recentTags = Array.from(new Set(recent.map((r) => r.tag)));
  const affected = Array.from(new Set(violations.flatMap((v) => v.days))).sort((a, b) => a - b);
  return `

⚠️ AJUSTE NECESSÁRIO — ROTAÇÃO DE ASSUNTO
Os posts abaixo repetem ASSUNTO (entre si ou com semanas recentes):
${list}

REESCREVA APENAS os posts dos dias ${affected.join(", ")}, mantendo os demais. Para cada post reescrito:
- Escolha um ASSUNTO (subject_tag) NOVO: diferente dos outros posts desta semana E fora desta lista de assuntos recentes: ${recentTags.join(", ") || "(nenhum)"}.
- Não basta trocar título, gancho, formato ou pilar — o TEMA concreto precisa ser outro.
- Mantenha formato e pilar coerentes com a semana.
Retorne um array JSON apenas com os posts reescritos (mesmo schema do feed, incluindo o campo "subject_tag").`;
}
