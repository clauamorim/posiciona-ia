import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, MailCheck } from "lucide-react";
import posicionaLogo from "@/assets/posiciona-logo.png";

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
      toast({
        title: "Não foi possível enviar",
        description: error.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
      return;
    }
    setSent(true);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 bg-background relative">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 left-4 gap-2 text-muted-foreground"
        onClick={() => navigate("/login")}
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao login
      </Button>
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src={posicionaLogo} alt="Posiciona" className="h-12 w-12" />
            <h1 className="text-3xl font-bold font-display text-primary">Posiciona</h1>
          </div>
          {sent ? (
            <>
              <div className="flex justify-center mb-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <MailCheck className="h-6 w-6 text-primary" />
                </div>
              </div>
              <CardTitle className="text-xl font-display">Verifique seu e-mail</CardTitle>
              <CardDescription>
                Enviamos um link de recuperação para <strong>{email}</strong>. Acesse sua caixa de entrada e clique no link para definir uma nova senha.
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle className="text-xl font-display">Recuperar acesso</CardTitle>
              <CardDescription>Informe seu e-mail e enviaremos um link para redefinir sua senha.</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-3">
              <Button className="w-full" onClick={() => navigate("/login")}>
                Voltar ao login
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setSent(false);
                  setEmail("");
                }}
              >
                Enviar para outro e-mail
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Lembrou a senha?{" "}
                <Link to="/login" className="text-primary hover:underline font-medium">
                  Entrar
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
