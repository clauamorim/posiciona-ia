/**
 * Versão atual do gerador de conteúdo editorial — espelho do arquivo
 * `src/lib/generatorVersion.ts`. Mantenha em sincronia ao incrementar.
 */
export const EDITORIAL_GENERATOR_VERSION = "2026-05-14-v8";

export function isOutdatedVersion(version?: string | null): boolean {
  if (!version) return true;
  return version !== EDITORIAL_GENERATOR_VERSION;
}
