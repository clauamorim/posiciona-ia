import { useState, useEffect } from "react";
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

const Login = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginTriggered, setLoginTriggered] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const runConnectivityTest = async () => {
    setDebugInfo("Testando conexão...");
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "https://opmheegtmdjqwrfkdboq.supabase.co";
    const lines: string[] = [];
    lines.push(`URL: ${supabaseUrl}`);
    lines.push(`Online: ${navigator.onLine}`);
    lines.push(`UA: ${navigator.userAgent.slice(0, 80)}`);
    try {
      const t0 = Date.now();
      const r = await fetch(`${supabaseUrl}/auth/v1/health`, { method: "GET" });
      lines.push(`Health: HTTP ${r.status} em ${Date.now() - t0}ms`);
    } catch (err: any) {
      lines.push(`Health ERRO: ${err?.name || ""} ${err?.message || String(err)}`);
    }
    try {
      const t0 = Date.now();
      const r = await fetch(`${supabaseUrl}/auth/v1/settings`, {
        method: "GET",
        headers: { apikey: (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY || "" },
      });
      lines.push(`Settings: HTTP ${r.status} em ${Date.now() - t0}ms`);
    } catch (err: any) {
      lines.push(`Settings ERRO: ${err?.name || ""} ${err?.message || String(err)}`);
    }
    setDebugInfo(lines.join("\n"));
  };

  useEffect(() => {
    if (!loginTriggered || authLoading) return;
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [loginTriggered, authLoading, user, navigate]);

  const attemptLogin = async (cleanEmail: string, cleanPassword: string, retries = 2): Promise<{ error: any }> => {
    let lastError: any = null;
    for (let i = 0; i <= retries; i++) {
      try {
        const result = await supabase.auth.signInWithPassword({ email: cleanEmail, password: cleanPassword });
        return result;
      } catch (err) {
        lastError = err;
        // Wait briefly before retry (network may be momentarily unstable)
        if (i < retries) await new Promise(r => setTimeout(r, 800));
      }
    }
    return { error: lastError ?? new Error("Falha de conexão após múltiplas tentativas") };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Sanitize inputs (mobile keyboards often add trailing spaces or invisible chars)
    const cleanEmail = email.trim().toLowerCase().replace(/\s+/g, "");
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setLoading(false);
      toast({
        title: "Dados incompletos",
        description: "Preencha e-mail e senha para continuar.",
        variant: "destructive",
      });
      return;
    }

    if (!navigator.onLine) {
      setLoading(false);
      toast({
        title: "Sem conexão",
        description: "Você parece estar offline. Conecte-se à internet e tente novamente.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await attemptLogin(cleanEmail, cleanPassword);
      setLoading(false);
      if (error) {
        const raw = (error.message || "").toLowerCase();
        let description = error.message || "Erro desconhecido.";
        if (raw.includes("invalid login") || raw.includes("invalid_credentials")) {
          description = "E-mail ou senha incorretos. Verifique e tente novamente.";
        } else if (raw.includes("email not confirmed")) {
          description = "Você ainda não confirmou seu e-mail. Verifique sua caixa de entrada.";
        } else if (
          raw.includes("load failed") ||
          raw.includes("failed to fetch") ||
          raw.includes("network") ||
          raw.includes("fetch")
        ) {
          description =
            "Não conseguimos conectar ao servidor. Tente alternar entre Wi-Fi e 4G/5G. Algumas redes corporativas ou de operadoras bloqueiam o acesso. Se persistir, tente em outro navegador ou rede.";
        }
        toast({ title: "Erro ao entrar", description, variant: "destructive" });
      } else {
        setLoginTriggered(true);
      }
    } catch (err: any) {
      setLoading(false);
      const detail = `${err?.name || "Error"}: ${err?.message || String(err)}`;
      setDebugInfo(`Falha no signInWithPassword:\n${detail}`);
      toast({
        title: "Falha de conexão",
        description: detail,
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
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src={posicionaLogo} alt="Posiciona" className="h-12 w-12" />
            <h1 className="text-3xl font-bold font-display text-primary">Posiciona</h1>
          </div>
          <CardTitle className="text-xl font-display">Entrar na sua conta</CardTitle>
          <CardDescription>Preencha seus dados para acessar a plataforma</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Não tem uma conta?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">Criar conta</Link>
          </p>
          <div className="mt-4 border-t border-border/50 pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={runConnectivityTest}
            >
              Testar conexão (diagnóstico)
            </Button>
            {debugInfo && (
              <pre className="mt-3 whitespace-pre-wrap break-all text-xs bg-muted/40 border border-border/50 rounded-md p-3 text-muted-foreground max-h-60 overflow-auto">
                {debugInfo}
              </pre>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
