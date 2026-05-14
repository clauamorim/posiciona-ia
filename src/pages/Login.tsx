import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft } from "lucide-react";
import posicionaLogo from "@/assets/posiciona-logo.png";
import { normalizeSession, persistLocalSession, type RawTokenResponse } from "@/lib/authSession";

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
      return {
        kind: "error",
        error: {
          code,
          message: message || `Erro ${res.status}.`,
          status: res.status,
        },
      };
    }
    return { kind: "ok", data: payload as RawTokenResponse };
  } catch (err: any) {
    if (err?.name === "AbortError") return { kind: "timeout" };
    return { kind: "error", error: { message: err?.message || "Falha de conexão." } };
  } finally {
    clearTimeout(timer);
  }
};

const Login = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading, adoptSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginTriggered, setLoginTriggered] = useState(false);
  const attemptRef = useRef(0);

  useEffect(() => {
    if (!loginTriggered || authLoading) return;
    if (user) navigate(isAdmin ? "/admin" : "/dashboard", { replace: true });
  }, [loginTriggered, authLoading, user, isAdmin, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const attemptId = ++attemptRef.current;
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase().replace(/\s+/g, "");
    if (!cleanEmail || !password) {
      setLoading(false);
      toast({
        title: "Dados incompletos",
        description: "Preencha e-mail e senha para continuar.",
        variant: "destructive",
      });
      return;
    }

    const result = await passwordGrant(cleanEmail, password);
    if (attemptId !== attemptRef.current) return;
    setLoading(false);

    if (result.kind === "timeout") {
      toast({
        title: "Erro ao entrar",
        description: "A conexão demorou mais que o esperado. Tente novamente em alguns instantes.",
        variant: "destructive",
      });
      return;
    }

    if (result.kind === "error") {
      const code = result.error.code || "";
      const status = result.error.status;
      const raw = (result.error.message || "").toLowerCase();
      let description = result.error.message || "Não foi possível entrar. Tente novamente.";
      if (
        code === "invalid_credentials" ||
        code === "invalid_grant" ||
        raw.includes("invalid login") ||
        raw.includes("invalid_credentials") ||
        (status === 400 && !code)
      ) {
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
      toast({
        title: "Erro ao entrar",
        description: "Não foi possível iniciar sua sessão. Tente novamente.",
        variant: "destructive",
      });
      return;
    }

    const session = normalizeSession(data);
    persistLocalSession(session);
    await adoptSession(session);
    setLoginTriggered(true);
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
