import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";
import { clearLocalAuthSession } from "@/lib/authCleanup";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordInput } from "@/components/auth/PasswordInput";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setHasSession(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setHasSession((prev) => prev ?? !!data.session);
    });
    return () => { subscription.subscription.unsubscribe(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Senha muito curta", description: "Use ao menos 8 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Senhas não coincidem", description: "Confirme a nova senha corretamente.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast({ title: "Não foi possível atualizar", description: error.message || "Tente novamente.", variant: "destructive" });
      return;
    }
    toast({ title: "Senha atualizada", description: "Você já pode usar sua nova senha." });
    await clearLocalAuthSession();
    navigate("/login", { replace: true });
  };

  return (
    <AuthLayout>
      <div className="space-y-6">
        <header className="space-y-2 text-center lg:text-left">
          <h1 className="text-3xl font-display font-bold">Definir nova senha</h1>
          <p className="text-sm text-muted-foreground">Escolha uma senha segura para sua conta.</p>
        </header>

        {hasSession === false ? (
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Este link de recuperação é inválido ou expirou. Solicite um novo para continuar.</p>
            <Button className="w-full" onClick={() => navigate("/forgot-password")}>Solicitar novo link</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Mínimo de 8 caracteres" autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar senha</Label>
              <PasswordInput id="confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Repita a nova senha" autoComplete="new-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading || hasSession === null}>
              {loading ? "Atualizando..." : "Atualizar senha"}
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
};

export default ResetPassword;
