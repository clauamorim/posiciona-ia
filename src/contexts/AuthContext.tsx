import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearLocalAuthSession } from "@/lib/authCleanup";
import { readLocalSession, clearLocalSession } from "@/lib/authSession";

interface UserBalances {
  weekly_cycles: number;
  reanalysis_credits: number;
  portrait_credits_included: number;
  portrait_credits_extra: number;
  regeneration_credits: number;
}

interface UserSubscription {
  plan_id: string;
  plan_slug: string;
  plan_name: string;
  billing_type: string | null;
  status: string;
  current_period_end: string | null;
  created_at: string;
}

export type PlanAccessLevel = "full" | "read_only" | "none";
export type ExpirationReason = "subscription_expired" | "one_time_exhausted" | null;

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  hasActivePlan: boolean;
  planAccessLevel: PlanAccessLevel;
  isReadOnly: boolean;
  expirationReason: ExpirationReason;
  subscription: UserSubscription | null;
  balances: UserBalances | null;
  profileCompleted: boolean;
  adoptSession: (session: Session) => Promise<void>;
  refreshSubscription: () => Promise<void>;
  refreshProfileCompletion: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isAdmin: false,
  isLoading: true,
  hasActivePlan: false,
  planAccessLevel: "none",
  isReadOnly: false,
  expirationReason: null,
  subscription: null,
  balances: null,
  profileCompleted: true,
  adoptSession: async () => {},
  refreshSubscription: async () => {},
  refreshProfileCompletion: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [balances, setBalances] = useState<UserBalances | null>(null);
  const [profileCompleted, setProfileCompleted] = useState<boolean>(true);
  const authRequestRef = useRef(0);
  // Track the current user ID via ref so the onAuthStateChange closure always
  // has access to the latest value (avoids the stale-closure problem).
  const sessionUserIdRef = useRef<string | null>(null);
  const hydrationDoneRef = useRef(false);

  const clearScopedSession = () => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (!key) continue;
        if (
          key === "posiciona-editor-draft" ||
          key.startsWith("posiciona-editor-draft_") ||
          key.startsWith("posiciona-logo-cache-")
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      /* ignore quota / availability errors */
    }
  };

  const resetAuthState = () => {
    setSession(null);
    setIsAdmin(false);
    setSubscription(null);
    setBalances(null);
    setProfileCompleted(true);
    sessionUserIdRef.current = null;
    hydrationDoneRef.current = false;
    clearScopedSession();
  };

  const checkAdmin = async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      return !!data;
    } catch (e) {
      console.error("checkAdmin error:", e);
      return false;
    }
  };

  const loadSubscription = async (userId: string): Promise<UserSubscription | null> => {
    try {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan_id, status, current_period_end, created_at")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub) {
        const { data: plan } = await supabase
          .from("plans")
          .select("slug, name, billing_type")
          .eq("id", sub.plan_id)
          .single();

        return {
          plan_id: sub.plan_id,
          plan_slug: plan?.slug || "",
          plan_name: plan?.name || "",
          billing_type: plan?.billing_type ?? null,
          status: sub.status,
          current_period_end: sub.current_period_end,
          created_at: sub.created_at,
        };
      }
      return null;
    } catch (e) {
      console.error("loadSubscription error:", e);
      return null;
    }
  };

  const loadBalances = async (userId: string): Promise<UserBalances | null> => {
    try {
      const { data } = await supabase
        .from("user_balances")
        .select("weekly_cycles, reanalysis_credits, portrait_credits_included, portrait_credits_extra, regeneration_credits")
        .eq("user_id", userId)
        .maybeSingle();
      return data || null;
    } catch (e) {
      console.error("loadBalances error:", e);
      return null;
    }
  };

  const loadProfileCompleted = async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("profile_completed")
        .eq("user_id", userId)
        .maybeSingle();
      // Default to true if the profile row hasn't been created yet to avoid loops.
      return data ? !!data.profile_completed : true;
    } catch (e) {
      console.error("loadProfileCompleted error:", e);
      return true;
    }
  };

  const hydrateUser = async (newSession: Session, requestId: number) => {
    const userId = newSession.user.id;

    // Fail-safe: never let loading hang forever if a query stalls.
    const timeoutPromise = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), 8000)
    );
    const dataPromise = Promise.all([
      checkAdmin(userId),
      loadSubscription(userId),
      loadBalances(userId),
      loadProfileCompleted(userId),
    ]);

    const result = await Promise.race([dataPromise, timeoutPromise]);
    if (authRequestRef.current !== requestId) return;

    if (result === "timeout") {
      console.warn("AuthContext: hydration timed out — proceeding without full data");
      setSession(newSession);
      sessionUserIdRef.current = userId;
      hydrationDoneRef.current = true;
      setIsLoading(false);
      // Retry in background; UI is already usable.
      dataPromise.then(([adminResult, subResult, balResult, profileResult]) => {
        if (authRequestRef.current !== requestId) return;
        setIsAdmin(adminResult);
        setSubscription(subResult);
        setBalances(balResult);
        setProfileCompleted(profileResult);
      }).catch(() => {});
      return;
    }

    const [adminResult, subResult, balResult, profileResult] = result;
    setSession(newSession);
    sessionUserIdRef.current = userId;
    setIsAdmin(adminResult);
    setSubscription(subResult);
    setBalances(balResult);
    setProfileCompleted(profileResult);
    hydrationDoneRef.current = true;
    setIsLoading(false);
  };

  const refreshSubscription = async () => {
    const userId = sessionUserIdRef.current;
    if (!userId) return;
    const [subResult, balResult] = await Promise.all([
      loadSubscription(userId),
      loadBalances(userId),
    ]);
    setSubscription(subResult);
    setBalances(balResult);
  };

  const refreshProfileCompletion = async () => {
    const userId = sessionUserIdRef.current;
    if (!userId) return;
    const completed = await loadProfileCompleted(userId);
    setProfileCompleted(completed);
  };

  const adoptSession = async (newSession: Session) => {
    const requestId = ++authRequestRef.current;
    setSession(newSession);
    sessionUserIdRef.current = newSession.user.id;
    setIsLoading(true);
    await hydrateUser(newSession, requestId);
  };

  useEffect(() => {
    let mounted = true;

    // 1) Listener síncrono — nunca aguarda chamadas pesadas dentro do callback.
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;

        if (event === "SIGNED_OUT") {
          authRequestRef.current += 1;
          resetAuthState();
          setIsLoading(false);
          return;
        }

        if (event === "TOKEN_REFRESHED") {
          if (newSession) setSession(newSession);
          return;
        }

        if (newSession?.user) {
          if (hydrationDoneRef.current && sessionUserIdRef.current === newSession.user.id) {
            setSession(newSession);
            return;
          }
          if (sessionUserIdRef.current && sessionUserIdRef.current !== newSession.user.id) {
            clearScopedSession();
          }
          // Disponibiliza a sessão IMEDIATAMENTE para destravar a UI/navegação;
          // a hidratação (admin, plano, saldos) roda desacoplada (setTimeout 0).
          setSession(newSession);
          sessionUserIdRef.current = newSession.user.id;
          const requestId = ++authRequestRef.current;
          setIsLoading(true);
          setTimeout(() => {
            if (!mounted) return;
            hydrateUser(newSession, requestId);
          }, 0);
        }
      }
    );

    // 2) Restaura sessão persistida do localStorage — independente do cliente
    //    de auth (que pode travar em locks internos do navegador).
    const existing = readLocalSession();
    if (existing?.user) {
      setSession(existing);
      sessionUserIdRef.current = existing.user.id;
      const requestId = ++authRequestRef.current;
      setIsLoading(true);
      hydrateUser(existing, requestId);
    } else {
      setIsLoading(false);
    }

    return () => {
      mounted = false;
      authSub.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Notify long-running components (polling loops) to abort before we revoke the token.
    try { window.dispatchEvent(new CustomEvent("app:signout")); } catch {}

    // Clear local state first so the UI never gets stuck waiting on the auth client.
    authRequestRef.current += 1;
    clearLocalSession();
    await clearLocalAuthSession();
    resetAuthState();
    setIsLoading(false);

    // Best-effort server signOut — bounded so internal locks can't hang us.
    try {
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch (e) {
      console.error("supabase.auth.signOut error:", e);
    }
  };

  const planAccessLevel: PlanAccessLevel = (() => {
    if (!subscription) return "none";
    if (subscription.status !== "active") return "none";

    // Plano recorrente: checa vencimento real
    if (subscription.current_period_end) {
      const expired = new Date(subscription.current_period_end) < new Date();
      if (expired) return "read_only";
    }

    // Plano one-time: read-only quando weekly_cycles == 0
    if (subscription.billing_type === "one_time") {
      const cyclesLeft = balances?.weekly_cycles ?? 0;
      if (cyclesLeft === 0) return "read_only";
    }

    return "full";
  })();

  const hasActivePlan = planAccessLevel !== "none";
  const isReadOnly = planAccessLevel === "read_only";
  const expirationReason: ExpirationReason = (() => {
    if (planAccessLevel !== "read_only") return null;
    if (subscription?.billing_type === "one_time") return "one_time_exhausted";
    return "subscription_expired";
  })();

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isAdmin,
        isLoading,
        hasActivePlan,
        planAccessLevel,
        isReadOnly,
        expirationReason,
        subscription,
        balances,
        profileCompleted,
        adoptSession,
        refreshSubscription,
        refreshProfileCompletion,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
