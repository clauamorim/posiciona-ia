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

/**
 * Faz download de uma imagem para o disco do usuário forçando o uso do atributo
 * `download`. Necessário porque URLs assinadas vêm de outro origin (storage da
 * Supabase) e o browser ignora `download` em links cross-origin — isso fazia
 * a imagem abrir em nova aba em vez de baixar.
 */
export async function downloadAsBlob(url: string, filename: string): Promise<void> {
  if (!url) return;
  // Para data URLs, link direto basta — mesma origem.
  if (url.startsWith("data:")) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  const res = await fetch(url, { credentials: "omit" });
  if (!res.ok) throw new Error(`Falha ao baixar imagem (${res.status})`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}
