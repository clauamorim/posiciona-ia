import React, { createContext, useContext, useEffect, useState } from "react";
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

  const checkAdmin = async (userId: string) => {
    const { data } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    setIsAdmin(!!data);
  };

  const loadSubscription = async (userId: string) => {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan_id, status, current_period_end")
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
  };

  const loadBalances = async (userId: string) => {
    const { data } = await supabase
      .from("user_balances")
      .select("weekly_cycles, reanalysis_credits, portrait_credits_included, portrait_credits_extra, regeneration_credits")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      setBalances(data);
    } else {
      setBalances(null);
    }
  };

  const refreshSubscription = async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    await Promise.all([loadSubscription(userId), loadBalances(userId)]);
  };

  useEffect(() => {
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          await Promise.all([
            checkAdmin(session.user.id),
            loadSubscription(session.user.id),
            loadBalances(session.user.id),
          ]);
        } else {
          setIsAdmin(false);
          setSubscription(null);
          setBalances(null);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        await Promise.all([
          checkAdmin(session.user.id),
          loadSubscription(session.user.id),
          loadBalances(session.user.id),
        ]);
      }
      setIsLoading(false);
    });

    return () => authSub.unsubscribe();
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
