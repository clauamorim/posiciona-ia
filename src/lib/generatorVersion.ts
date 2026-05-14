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
 * - 2026-04-25-v5: migração de Gemini para Claude Sonnet 4.5 nas três
 *   edge functions de geração editorial (relatório, semana, post único).
 *   Inclui contexto pessoal do criador (questionário pessoal de 16
 *   campos) em todo prompt para humanização via storytelling.
 * - 2026-04-25-v6: linha editorial dividida em Feed (4 posts/semana entre
 *   carrossel, post único e reels) + Stories (7 sugestões/semana, com
 *   espelhamento de tema nos dias com feed). Geração em 2 estágios para
 *   evitar timeout/truncamento e parser robusto para JSON aninhado.
 *   Regeneração granular por target (feed | story).
 * - 2026-04-26-v7: separação rígida entre LEGENDA e CARD_COPY no card
 *   visual. Prompts reforçados (limites por slide, exemplos bom/ruim) +
 *   sanitização backend que compacta itens longos e remove eco da
 *   legenda. Frontend `editorialCardCopy.ts` normaliza conteúdos legados.
 * - 2026-05-14-v9: upgrade para Claude Sonnet 4.6. Bloco FATOS
 *   VERIFICÁVEIS (anti-alucinação) injetado em todo prompt: sem fatos
 *   cadastrados, exemplos numéricos viram pergunta/hipótese. Seis
 *   pilares editoriais fixos (metodo, mito, mercado, caso,
 *   posicionamento, bastidor) com rotação anti-repetição calculada
 *   sobre as últimas 4 semanas — proíbe pilar repetido na mesma semana.
 *   Storytelling pessoal recalibrado: máximo 1 post de feed (só se
 *   pilar "bastidor" estiver sub-representado) e máximo 3 stories. Cada
 *   post didático segue estrutura tese → evidência → aplicação. Posts
 *   passam a carregar campo `pillar`.
 */
export const EDITORIAL_GENERATOR_VERSION = "2026-05-14-v9";

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
