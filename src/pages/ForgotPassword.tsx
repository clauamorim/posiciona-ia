import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase().replace(/\s+/g, "");
    if (!cleanEmail) {
      toast({ title: "Informe seu e-mail", description: "Preencha o campo para continuar.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Não foi possível enviar", description: error.message || "Tente novamente em instantes.", variant: "destructive" });
      return;
    }
    setSent(true);
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        {sent ? (
          <>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <MailCheck className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-display font-bold">Verifique seu e-mail</h1>
              <p className="text-sm text-muted-foreground">
                Enviamos um link de recuperação para <strong className="text-foreground">{email}</strong>.
              </p>
            </div>
            <div className="space-y-3">
              <Button className="w-full" onClick={() => navigate("/login")}>Voltar ao login</Button>
              <Button variant="ghost" className="w-full" onClick={() => { setSent(false); setEmail(""); }}>
                Enviar para outro e-mail
              </Button>
            </div>
          </>
        ) : (
          <>
            <header className="space-y-2 text-center lg:text-left">
              <h1 className="text-3xl font-display font-bold">Recuperar acesso</h1>
              <p className="text-sm text-muted-foreground">Informe seu e-mail e enviaremos um link para redefinir sua senha.</p>
            </header>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="seu@email.com" autoComplete="email" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Lembrou a senha? <Link to="/login" className="text-primary hover:underline font-medium">Entrar</Link>
              </p>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
};

export default ForgotPassword;
