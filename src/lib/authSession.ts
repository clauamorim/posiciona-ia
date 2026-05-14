import type { Session, User } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export const authStorageKey = (): string => {
  try {
    const host = new URL(SUPABASE_URL).hostname;
    return `sb-${host.split(".")[0]}-auth-token`;
  } catch {
    return "sb-auth-token";
  }
};

export interface RawTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user: User;
}

export const normalizeSession = (raw: RawTokenResponse): Session => {
  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = raw.expires_at ?? nowSec + (raw.expires_in ?? 3600);
  const expiresIn = raw.expires_in ?? Math.max(expiresAt - nowSec, 0);
  return {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token,
    expires_at: expiresAt,
    expires_in: expiresIn,
    token_type: (raw.token_type as "bearer") ?? "bearer",
    user: raw.user,
  } as Session;
};

export const persistLocalSession = (session: Session): void => {
  try {
    localStorage.setItem(authStorageKey(), JSON.stringify(session));
  } catch {
    /* ignore */
  }
};

export const readLocalSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(authStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.access_token || !parsed?.user) return null;
    if (parsed.expires_at && parsed.expires_at * 1000 < Date.now() - 5000) {
      // Expired — let the auth client handle refresh later, but don't trust it for hydration.
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearLocalSession = (): void => {
  try {
    localStorage.removeItem(authStorageKey());
  } catch {
    /* ignore */
  }
};
