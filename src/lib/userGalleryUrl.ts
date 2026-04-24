/**
 * Helper centralizado para resolver URLs do bucket privado `user-uploads`.
 *
 * Como o bucket é privado, getPublicUrl não funciona — precisamos sempre
 * usar createSignedUrl. Este helper concentra essa lógica.
 */
import { supabase } from "@/integrations/supabase/client";

const ONE_HOUR = 60 * 60;

/** Resolve uma file_path do bucket user-uploads para uma URL assinada de 1h. */
export async function signedUserUploadUrl(filePath: string, expiresIn = ONE_HOUR): Promise<string> {
  if (!filePath) return "";
  const { data, error } = await supabase.storage
    .from("user-uploads")
    .createSignedUrl(filePath, expiresIn);
  if (error) {
    console.warn("signedUserUploadUrl failed", filePath, error);
    return "";
  }
  return data?.signedUrl || "";
}

/** Versão batch — resolve várias file_paths em paralelo. */
export async function signedUserUploadUrls(filePaths: string[], expiresIn = ONE_HOUR): Promise<string[]> {
  return Promise.all(filePaths.map((p) => signedUserUploadUrl(p, expiresIn)));
}
