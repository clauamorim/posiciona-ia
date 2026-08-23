import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import LegalConsentCheckbox from "@/components/LegalConsentCheckbox";
import { SeoHead } from "@/components/SeoHead";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";

const Signup = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [legalConsent, setLegalConsent] = useState(false);
  const [legalConsentError, setLegalConsentError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalConsent) {
      setLegalConsentError("Você precisa concordar com os Termos de Serviço e a Política de Privacidade para criar sua conta.");
      return;
    }
    setLegalConsentError("");
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin + "/login",
      },
    });
    if (error) {
      const code = (error as { code?: string }).code || "";
      const raw = (error.message || "").toLowerCase();
      let description = error.message || "Não foi possível criar sua conta. Tente novamente.";
      if (code === "weak_password" || raw.includes("password should contain") || raw.includes("password is known to be weak") || raw.includes("password should be at least")) {
        description = "Sua senha é muito fraca. Use pelo menos 8 caracteres, misturando letras, números e símbolos.";
      } else if (code === "user_already_exists" || code === "user_already_registered" || raw.includes("already registered") || raw.includes("already exists")) {
        description = "Já existe uma conta com este e-mail. Tente entrar em vez de criar uma nova conta.";
      } else if (code === "over_request_rate_limit" || raw.includes("rate limit")) {
        description = "Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.";
      } else if (raw.includes("failed to fetch") || raw.includes("load failed") || raw.includes("networkerror")) {
        description = "Não conseguimos conectar ao servidor. Verifique sua conexão e tente novamente.";
      }
      toast({ title: "Erro ao criar conta", description, variant: "destructive" });
      setLoading(false);
      return;
    }
    // Com a proteção anti-enumeração do Supabase, e-mail já cadastrado e confirmado
    // retorna "sucesso" com usuário obfuscado (identities vazio) e nenhum e-mail é enviado.
    if (data.user && data.user.identities?.length === 0) {
      toast({
        title: "Erro ao criar conta",
        description: "Já existe uma conta com este e-mail. Tente entrar em vez de criar uma nova conta.",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    setLoading(false);
    navigate(`/verify-email?email=${encodeURIComponent(email)}`);
  };

  return (
    <AuthLayout showValueProp>
      <SeoHead title="Criar conta · Posiciona" description="Crie sua conta no Posiciona e comece a estruturar seu posicionamento de marca pessoal com IA." path="/signup" />
      <div className="space-y-6">
        <header className="space-y-2 text-center lg:text-left">
          <h1 className="text-3xl font-display font-bold">Criar sua conta</h1>
          <p className="text-sm text-muted-foreground">Comece a construir seu posicionamento de marca.</p>
        </header>

        <GoogleAuthButton
          guard={() => {
            if (!legalConsent) {
              const msg = "Você precisa concordar com os Termos de Serviço e a Política de Privacidade para criar sua conta.";
              setLegalConsentError(msg);
              toast({ title: "Falta aceitar os termos", description: msg, variant: "destructive" });
              return false;
            }
            setLegalConsentError("");
            return true;
          }}
        />

        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Nome completo</Label>
            <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Seu nome" autoComplete="name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <PasswordInput id="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
            <PasswordStrengthMeter password={password} />
          </div>
          <LegalConsentCheckbox
            checked={legalConsent}
            onCheckedChange={(v) => { setLegalConsent(v); if (v) setLegalConsentError(""); }}
            variant="signup"
            error={legalConsentError}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Criando..." : "Criar conta"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            Em seguida você completará seu perfil em 1 minuto e começará seu diagnóstico.
          </p>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Já tem uma conta? <Link to="/login" className="text-primary hover:underline font-medium">Entrar</Link>
        </p>
      </div>
    </AuthLayout>
  );
};

export default Signup;
