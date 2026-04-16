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

  const resetAuthState = () => {
    setSession(null);
    setIsAdmin(false);
    setSubscription(null);
    setBalances(null);
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

  /**
   * Hydrates all user data atomically. isLoading is set to true BEFORE calling
   * this, and only set to false AFTER all data is resolved — so ProtectedRoute
   * never sees a partially-loaded state.
   */
  const hydrateUser = async (newSession: Session, requestId: number) => {
    const userId = newSession.user.id;

    const [adminResult, subResult, balResult] = await Promise.all([
      checkAdmin(userId),
      loadSubscription(userId),
      loadBalances(userId),
    ]);

    // Bail if a newer auth event has arrived while we were loading
    if (authRequestRef.current !== requestId) return;

    setSession(newSession);
    setIsAdmin(adminResult);
    setSubscription(subResult);
    setBalances(balResult);
    setIsLoading(false);
  };

  const refreshSubscription = async () => {
    const userId = session?.user?.id;
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
    let initialHydrationDone = false;

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mounted) return;

        if (event === "SIGNED_OUT") {
          authRequestRef.current += 1;
          resetAuthState();
          setIsLoading(false);
          initialHydrationDone = false;
          return;
        }

        if (event === "TOKEN_REFRESHED") {
          // Just update the session object — do NOT trigger isLoading
          // This prevents ProtectedRoute from unmounting pages on alt+tab
          if (newSession) setSession(newSession);
          return;
        }

        // INITIAL_SESSION, SIGNED_IN, USER_UPDATED
        if (newSession?.user) {
          // If same user and already hydrated, don't re-enter loading
          if (initialHydrationDone && session?.user?.id === newSession.user.id && event !== "SIGNED_IN") {
            setSession(newSession);
            return;
          }
          const requestId = ++authRequestRef.current;
          setIsLoading(true);
          hydrateUser(newSession, requestId).then(() => {
            initialHydrationDone = true;
          });
          return;
        }

        // INITIAL_SESSION with no session (user not logged in)
        if (event === "INITIAL_SESSION") {
          authRequestRef.current += 1;
          resetAuthState();
          setIsLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      authSub.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
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
