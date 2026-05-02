import { useEffect, useRef, useState, useCallback } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface Options<T extends Record<string, any>> {
  userId: string | null | undefined;
  answers: T;
  enabled: boolean; // false when locked/submitted
  storageKey: string; // e.g. `posiciona-bq-draft-${userId}`
  saveFn: () => Promise<{ ok: boolean; error?: string }>;
  debounceMs?: number;
}

/**
 * Centraliza autosave + backup local + status para os questionários.
 * - Faz autosave debounced quando `answers` muda.
 * - Sempre mantém uma cópia em localStorage por usuário enquanto não enviado.
 * - Expõe `flush()` para garantir que mudanças pendentes sejam persistidas
 *   antes de avançar etapa / concluir.
 */
export function useQuestionnaireAutosave<T extends Record<string, any>>({
  userId,
  answers,
  enabled,
  storageKey,
  saveFn,
  debounceMs = 1200,
}: Options<T>) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const dirtyRef = useRef(false);
  const latestSaveFn = useRef(saveFn);
  latestSaveFn.current = saveFn;

  // Backup local sempre que respostas mudam (enquanto editável).
  useEffect(() => {
    if (!enabled || !userId) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ answers, savedAt: Date.now() }));
    } catch { /* ignore quota */ }
  }, [answers, enabled, userId, storageKey]);

  const performSave = useCallback(async () => {
    if (!enabled) return;
    setStatus("saving");
    try {
      const res = await latestSaveFn.current();
      if (res.ok) {
        setStatus("saved");
        dirtyRef.current = false;
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }, [enabled]);

  // Debounced autosave on answer changes.
  useEffect(() => {
    if (!enabled || !userId) return;
    dirtyRef.current = true;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const p = performSave();
      inFlightRef.current = p as unknown as Promise<void>;
    }, debounceMs);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(answers), enabled, userId, debounceMs]);

  // Garante que mudanças pendentes sejam salvas antes de prosseguir.
  const flush = useCallback(async (): Promise<boolean> => {
    if (!enabled) return true;
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current && status !== "error") return true;
    setStatus("saving");
    try {
      const res = await latestSaveFn.current();
      if (res.ok) {
        setStatus("saved");
        dirtyRef.current = false;
        return true;
      }
      setStatus("error");
      return false;
    } catch {
      setStatus("error");
      return false;
    }
  }, [enabled, status]);

  const clearLocalBackup = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [storageKey]);

  const readLocalBackup = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.answers ?? null;
    } catch {
      return null;
    }
  }, [storageKey]);

  return { status, flush, clearLocalBackup, readLocalBackup };
}

export function SaveStatusLabel(status: SaveStatus): string {
  switch (status) {
    case "saving": return "Salvando…";
    case "saved": return "Rascunho salvo";
    case "error": return "Falha ao salvar — verifique conexão";
    default: return "";
  }
}
