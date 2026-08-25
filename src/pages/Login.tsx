import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeSession, persistLocalSession, type RawTokenResponse } from "@/lib/authSession";
import { SeoHead } from "@/components/SeoHead";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PENDING_INVITE_KEY } from "@/pages/AcceptInvite";

const LOGIN_TIMEOUT_MS = 12000;

type GrantError = { code?: string; message: string; status?: number };
type GrantResult =
  | { kind: "ok"; data: RawTokenResponse }
  | { kind: "error"; error: GrantError }
  | { kind: "timeout" };

const passwordGrant = async (email: string, password: string): Promise<GrantResult> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOGIN_TIMEOUT_MS);
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-login`;
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ email, password }),
    });
    const payload = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      const code = payload?.code || payload?.error_code || payload?.error;
      const message =
        payload?.message ||
        payload?.msg ||
        payload?.error_description ||
        payload?.error_message ||
        (typeof payload?.error === "string" ? payload.error : "") ||
        "";
      return { kind: "error", error: { code, message: message || `Erro ${res.status}.`, status: res.status } };
    }
    return { kind: "ok", data: payload as RawTokenResponse };
  } catch (err: any) {
    if (err?.name === "AbortError") return { kind: "timeout" };
    return { kind: "error", error: { message: err?.message || "Falha de conexão." } };
  } finally {
    clearTimeout(timer);
  }
};

const isSafeRelativePath = (v: string | null): v is string => !!v && v.startsWith("/") && !v.startsWith("//");

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get("next");
  const safeNext = isSafeRelativePath(nextParam) ? nextParam : null;
  const { user, isAdmin, isLoading: authLoading, adoptSession, profileCompleted } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginTriggered, setLoginTriggered] = useState(false);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      const pendingInviteToken = !isAdmin ? localStorage.getItem(PENDING_INVITE_KEY) : null;
      if (pendingInviteToken) navigate(`/accept-invite?token=${pendingInviteToken}`, { replace: true });
      else if (!profileCompleted && !isAdmin) navigate("/complete-profile", { replace: true });
      else if (safeNext) window.location.href = safeNext;
      else navigate(isAdmin ? "/admin" : "/dashboard", { replace: true });
    }
  }, [authLoading, user, isAdmin, profileCompleted, navigate, safeNext]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const attemptId = ++attemptRef.current;
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase().replace(/\s+/g, "");
    if (!cleanEmail || !password) {
      setLoading(false);
      toast({ title: "Dados incompletos", description: "Preencha e-mail e senha para continuar.", variant: "destructive" });
      return;
    }

    const result = await passwordGrant(cleanEmail, password);
    if (attemptId !== attemptRef.current) return;
    setLoading(false);

    if (result.kind === "timeout") {
      toast({ title: "Erro ao entrar", description: "A conexão demorou mais que o esperado. Tente novamente em alguns instantes.", variant: "destructive" });
      return;
    }

    if (result.kind === "error") {
      const code = result.error.code || "";
      const status = result.error.status;
      const raw = (result.error.message || "").toLowerCase();
      let description = result.error.message || "Não foi possível entrar. Tente novamente.";
      if (code === "invalid_credentials" || code === "invalid_grant" || raw.includes("invalid login") || raw.includes("invalid_credentials") || (status === 400 && !code)) {
        description = "E-mail ou senha incorretos. Verifique e tente novamente.";
      } else if (code === "email_not_confirmed" || raw.includes("email not confirmed")) {
        description = "Você ainda não confirmou seu e-mail. Verifique sua caixa de entrada.";
      } else if (code === "over_request_rate_limit" || raw.includes("rate limit") || status === 429) {
        description = "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.";
      } else if (raw.includes("failed to fetch") || raw.includes("load failed") || raw.includes("networkerror")) {
        description = "Não conseguimos conectar ao servidor. Verifique sua conexão e tente novamente.";
      }
      toast({ title: "Erro ao entrar", description, variant: "destructive" });
      return;
    }

    const data = result.data;
    if (!data?.access_token || !data.refresh_token || !data.user) {
      toast({ title: "Erro ao entrar", description: "Não foi possível iniciar sua sessão. Tente novamente.", variant: "destructive" });
      return;
    }

    const session = normalizeSession(data);
    persistLocalSession(session);
    await adoptSession(session);
    setLoginTriggered(true);
  };

  return (
    <AuthLayout showValueProp>
      <SeoHead title="Entrar · Posiciona" description="Acesse sua conta Posiciona para continuar sua estratégia de marca pessoal." path="/login" />
      <div className="space-y-6">
        <header className="space-y-2 text-center lg:text-left">
          <h1 className="text-3xl font-display font-bold">Entrar na sua conta</h1>
          <p className="text-sm text-muted-foreground">Acesse a plataforma para continuar sua estratégia.</p>
        </header>

        <GoogleAuthButton nextPath={safeNext ?? undefined} />

        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" autoComplete="email" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                Esqueci minha senha
              </Link>
            </div>
            <PasswordInput id="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Não tem uma conta? <Link to="/signup" className="text-primary hover:underline font-medium">Criar conta</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Login;
