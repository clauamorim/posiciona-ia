/**
 * Versão atual do gerador de conteúdo editorial.
 *
 * Incremente esta string sempre que houver melhorias relevantes nos prompts,
 * parsers ou sanitização das edge functions de geração — isso marca os
 * conteúdos antigos como "desatualizados" e habilita regeneração gratuita.
 *
 * Histórico:
 * - 2026-04-23-v1: marca inicial. Inclui sanitização de rótulos StoryBrand
 *   ("Problema Externo:", "Slide 1:") e parser JSON robusto contra fences.
 * - 2026-04-24-v2: prompts reforçados com Obviously Awesome (posicionamento)
 *   e Made to Stick (SUCCES). Ganchos específicos do nicho, proibição de
 *   aberturas genéricas. PDFs de referência enviados em todas as semanas.
 */
export const EDITORIAL_GENERATOR_VERSION = "2026-04-24-v2";

/**
 * Retorna true quando o dia/post foi gerado antes da versão atual,
 * ou quando ainda não tem marca de versão (conteúdo legado).
 */
export function isOutdated(day: { generator_version?: string } | null | undefined): boolean {
  if (!day) return false;
  if (!day.generator_version) return true;
  return day.generator_version !== EDITORIAL_GENERATOR_VERSION;
}

/**
 * Retorna true quando pelo menos um dia da semana é desatualizado.
 */
export function isWeekOutdated(week: Array<{ generator_version?: string }> | null | undefined): boolean {
  if (!Array.isArray(week) || week.length === 0) return false;
  return week.some((d) => isOutdated(d));
}
