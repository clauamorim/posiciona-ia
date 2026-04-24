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
 * - 2026-04-24-v3: sanitização backend obrigatória (editorialSanitize.ts)
 *   antes de devolver posts. Strip de rótulos StoryBrand/posicionais e
 *   detecção de "vazamento de framework" com retry automático.
 * - 2026-04-24-v4: PDFs enviados à LLM restritos a StoryBrand, Made to
 *   Stick e Obviously Awesome (análise de IG e linha editorial).
 *   Sanitização detecta meta-narrativa embutida (ex.: "marca como guia",
 *   "jornada do herói"). Regeneração de post único deixa de enviar
 *   captions dos posts vizinhos — só o tema, para evitar contaminação.
 */
export const EDITORIAL_GENERATOR_VERSION = "2026-04-24-v4";

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
