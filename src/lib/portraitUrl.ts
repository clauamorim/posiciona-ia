/**
 * Helper para resolver URLs de retratos.
 *
 * A coluna `portrait_generations.portraits` agora pode conter:
 *   - Paths relativos do bucket privado `portrait-outputs` (formato novo)
 *     ex: "{user_id}/{generation_id}/0.png"
 *   - Data URLs base64 (formato legado, anterior à migração)
 *     ex: "data:image/png;base64,..."
 *   - URLs HTTP (raras, ex: ainda hospedadas em replicate.delivery)
 *
 * Esta função detecta o formato e devolve sempre uma URL utilizável pelo <img>.
 */
import { supabase } from "@/integrations/supabase/client";

const ONE_HOUR = 60 * 60;

export async function resolvePortraitUrl(value: string, expiresIn = ONE_HOUR): Promise<string> {
  if (!value) return "";
  // Legado base64 ou URL absoluta — usa direto.
  if (value.startsWith("data:") || value.startsWith("http")) return value;
  // Novo formato: path no bucket privado.
  const { data, error } = await supabase.storage
    .from("portrait-outputs")
    .createSignedUrl(value, expiresIn);
  if (error) {
    console.warn("resolvePortraitUrl failed", value, error);
    return "";
  }
  return data?.signedUrl ?? "";
}

/** Versão batch — paraleliza resoluções. */
export async function resolvePortraitUrls(values: string[], expiresIn = ONE_HOUR): Promise<string[]> {
  return Promise.all(values.map((v) => resolvePortraitUrl(v, expiresIn)));
}
