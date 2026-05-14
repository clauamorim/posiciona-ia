import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft } from "lucide-react";
import posicionaLogo from "@/assets/posiciona-logo.png";

const LOGIN_TIMEOUT_MS = 15000;
const SESSION_SYNC_TIMEOUT_MS = 6000;

type PasswordGrantSuccess = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: "bearer";
  user: NonNullable<Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"]>;
};

type PasswordGrantResult =
  | { data: PasswordGrantSuccess; error: null }
  | { data: null; error: { code?: string; message: string; status?: number } }
  | { data: null; error: null; timedOut: true };

const authStorageKey = () => {
  const host = new URL(import.meta.env.VITE_SUPABASE_URL).hostname;
  return `sb-${host.split(".")[0]}-auth-token`;
};

const persistSessionFallback = (session: PasswordGrantSuccess) => {
  const expiresAt = session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600);
  localStorage.setItem(
    authStorageKey(),
    JSON.stringify({
      ...session,
      expires_at: expiresAt,
      expires_in: session.expires_in ?? Math.max(expiresAt - Math.floor(Date.now() / 1000), 0),
      token_type: session.token_type ?? "bearer",
    })
  );
};

const passwordGrantWithTimeout = async (
  email: string,
  password: string
): Promise<PasswordGrantResult> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          "X-Supabase-Api-Version": "2024-01-01",
        },
        body: JSON.stringify({
          email,
          password,
          gotrue_meta_security: {},
        }),
      }
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        data: null,
        error: {
          code: payload?.code || payload?.error_code,
          message: payload?.message || payload?.error_description || "Erro desconhecido.",
          status: response.status,
        },
      };
    }

    return { data: payload as PasswordGrantSuccess, error: null };
  } catch (error: any) {
    if (error?.name === "AbortError") return { data: null, error: null, timedOut: true };
    return {
      data: null,
      error: {
        message: error?.message || "Não conseguimos conectar ao servidor.",
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
};

const syncSessionWithTimeout = async (session: PasswordGrantSuccess) =>
  Promise.race([
    supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), SESSION_SYNC_TIMEOUT_MS)),
  ]);

const Login = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading, adoptSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginTriggered, setLoginTriggered] = useState(false);
  const loginAttemptRef = useRef(0);

  useEffect(() => {
    if (!loginTriggered || authLoading) return;
    if (user) {
      navigate(isAdmin ? "/admin" : "/dashboard", { replace: true });
    }
  }, [loginTriggered, authLoading, user, isAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const attemptId = ++loginAttemptRef.current;
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase().replace(/\s+/g, "");
    const cleanPassword = password;

    if (!cleanEmail || cleanPassword.length === 0) {
      setLoading(false);
      toast({
        title: "Dados incompletos",
        description: "Preencha e-mail e senha para continuar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await passwordGrantWithTimeout(cleanEmail, cleanPassword);

      if (attemptId !== loginAttemptRef.current) return;

      setLoading(false);

      if ("timedOut" in result) {
        toast({
          title: "Erro ao entrar",
          description: "A conexão demorou mais que o esperado. Tente novamente em alguns instantes.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = result;

      if (error) {
        const code = (error as any)?.code || (error as any)?.error_code || "";
        const raw = (error.message || "").toLowerCase();
        let description = error.message || "Erro desconhecido.";

        if (
          code === "invalid_credentials" ||
          raw.includes("invalid login") ||
          raw.includes("invalid_credentials")
        ) {
          description = "E-mail ou senha incorretos. Verifique e tente novamente.";
        } else if (code === "email_not_confirmed" || raw.includes("email not confirmed")) {
          description = "Você ainda não confirmou seu e-mail. Verifique sua caixa de entrada.";
        } else if (code === "over_request_rate_limit" || raw.includes("rate limit")) {
          description = "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.";
        } else if (
          raw.includes("failed to fetch") ||
          raw.includes("load failed") ||
          raw.includes("networkerror")
        ) {
          description =
            "Não conseguimos conectar ao servidor. Verifique sua conexão e tente novamente.";
        }

        toast({ title: "Erro ao entrar", description, variant: "destructive" });
        return;
      }

      if (!data?.access_token || !data.refresh_token || !data.user) {
        toast({
          title: "Erro ao entrar",
          description: "Não foi possível iniciar sua sessão. Tente novamente.",
          variant: "destructive",
        });
        return;
      }

      persistSessionFallback(data);
      const syncResult = await syncSessionWithTimeout(data);
      if (attemptId !== loginAttemptRef.current) return;

      if (syncResult === "timeout" || syncResult.error) {
        await adoptSession({
          ...data,
          expires_at: data.expires_at ?? Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
          expires_in: data.expires_in ?? 3600,
          token_type: data.token_type ?? "bearer",
          user: data.user,
        });
      }

      setLoginTriggered(true);
    } catch (err: any) {
      if (attemptId !== loginAttemptRef.current) return;
      setLoading(false);
      toast({
        title: "Erro ao entrar",
        description: err?.message || "Não foi possível concluir o login. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-background relative">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 left-4 gap-2 text-muted-foreground"
        onClick={() => navigate("/")}
      >
        <ArrowLeft className="h-4 w-4" /> Página inicial
      </Button>
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-1">
            <img src={posicionaLogo} alt="Posiciona" className="h-10 w-10" />
            <h1 className="text-2xl font-bold font-display text-primary">Posiciona</h1>
          </div>
          <CardTitle className="text-xl font-display">Entrar na sua conta</CardTitle>
          <CardDescription>Preencha seus dados para acessar a plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" className="border-white/25 focus-visible:border-white/40" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                  Esqueci minha senha
                </Link>
              </div>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="border-white/25 focus-visible:border-white/40" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Não tem uma conta?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">Criar conta</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
