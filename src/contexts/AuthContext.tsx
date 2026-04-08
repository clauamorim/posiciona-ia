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

  const checkAdmin = async (userId: string, requestId: number) => {
    try {
      const { data } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (authRequestRef.current !== requestId) return;
      setIsAdmin(!!data);
    } catch (e) {
      console.error("checkAdmin error:", e);
      if (authRequestRef.current !== requestId) return;
      setIsAdmin(false);
    }
  };

  const loadSubscription = async (userId: string, requestId: number) => {
    try {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan_id, status, current_period_end")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (authRequestRef.current !== requestId) return;

      if (sub) {
        const { data: plan } = await supabase
          .from("plans")
          .select("slug, name")
          .eq("id", sub.plan_id)
          .single();

        if (authRequestRef.current !== requestId) return;

        setSubscription({
          plan_id: sub.plan_id,
          plan_slug: plan?.slug || "",
          plan_name: plan?.name || "",
          status: sub.status,
          current_period_end: sub.current_period_end,
        });
      } else {
        setSubscription(null);
      }
    } catch (e) {
      console.error("loadSubscription error:", e);
    }
  };

  const loadBalances = async (userId: string, requestId: number) => {
    try {
      const { data } = await supabase
        .from("user_balances")
        .select("weekly_cycles, reanalysis_credits, portrait_credits_included, portrait_credits_extra, regeneration_credits")
        .eq("user_id", userId)
        .maybeSingle();

      if (authRequestRef.current !== requestId) return;
      setBalances(data || null);
    } catch (e) {
      console.error("loadBalances error:", e);
    }
  };

  const refreshSubscription = async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    const requestId = authRequestRef.current;
    await Promise.all([loadSubscription(userId, requestId), loadBalances(userId, requestId)]);
  };

  useEffect(() => {
    let mounted = true;

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
          // Just update the session object without reloading everything
          if (newSession) {
            setSession(newSession);
          }
          return;
        }

        // INITIAL_SESSION, SIGNED_IN, USER_UPDATED
        if (newSession?.user) {
          const requestId = ++authRequestRef.current;
          setSession(newSession);

          Promise.all([
            checkAdmin(newSession.user.id, requestId),
            loadSubscription(newSession.user.id, requestId),
            loadBalances(newSession.user.id, requestId),
          ]).then(() => {
            if (!mounted || authRequestRef.current !== requestId) return;
            setIsLoading(false);
          });
          return;
        }

        // No session and not SIGNED_OUT — e.g. INITIAL_SESSION with null session
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
