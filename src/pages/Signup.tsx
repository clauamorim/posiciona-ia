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
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin + "/login",
      },
    });
    if (error) {
      toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
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

        <GoogleAuthButton />

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
