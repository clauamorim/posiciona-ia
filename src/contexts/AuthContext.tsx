import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
  status: string;
  current_period_end: string | null;
  created_at: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  isLoading: boolean;
  hasActivePlan: boolean;
  subscription: UserSubscription | null;
  balances: UserBalances | null;
  refreshSubscription: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isAdmin: false,
  isLoading: true,
  hasActivePlan: false,
  subscription: null,
  balances: null,
  refreshSubscription: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [balances, setBalances] = useState<UserBalances | null>(null);
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
          .select("slug, name")
          .eq("id", sub.plan_id)
          .single();

        return {
          plan_id: sub.plan_id,
          plan_slug: plan?.slug || "",
          plan_name: plan?.name || "",
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
      dataPromise.then(([adminResult, subResult, balResult]) => {
        if (authRequestRef.current !== requestId) return;
        setIsAdmin(adminResult);
        setSubscription(subResult);
        setBalances(balResult);
      }).catch(() => {});
      return;
    }

    const [adminResult, subResult, balResult] = result;
    setSession(newSession);
    sessionUserIdRef.current = userId;
    setIsAdmin(adminResult);
    setSubscription(subResult);
    setBalances(balResult);
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

    // 2) Restaura sessão persistida ao montar — não depende do INITIAL_SESSION.
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      if (!mounted) return;
      if (existing?.user) {
        if (hydrationDoneRef.current && sessionUserIdRef.current === existing.user.id) return;
        setSession(existing);
        sessionUserIdRef.current = existing.user.id;
        const requestId = ++authRequestRef.current;
        setIsLoading(true);
        hydrateUser(existing, requestId);
      } else {
        setIsLoading(false);
      }
    }).catch(() => {
      if (mounted) setIsLoading(false);
    });

    return () => {
      mounted = false;
      authSub.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Notify long-running components (polling loops) to abort before we revoke the token.
    try { window.dispatchEvent(new CustomEvent("app:signout")); } catch {}
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("supabase.auth.signOut error:", e);
    }
    // Force-clear local state in case onAuthStateChange doesn't fire fast enough.
    authRequestRef.current += 1;
    resetAuthState();
    setIsLoading(false);
  };

  const hasActivePlan = !!subscription && subscription.status === "active";

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isAdmin,
        isLoading,
        hasActivePlan,
        subscription,
        balances,
        refreshSubscription,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
