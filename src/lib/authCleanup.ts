const isAuthStorageKey = (key: string) =>
  /^sb-[^-]+-auth-token$/.test(key) ||
  key.includes("supabase.auth.token") ||
  key.includes("gotrue");

export const clearLocalAuthSession = async () => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && isAuthStorageKey(key)) keysToRemove.push(key);
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore browsers or privacy modes that restrict localStorage access.
  }
};