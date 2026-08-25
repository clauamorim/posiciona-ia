import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertTriangle, User, Building2 } from "lucide-react";
import { SeoHead } from "@/components/SeoHead";
import { toast } from "@/hooks/use-toast";

type Preview = {
  workspace_name: string;
  brand_type: "pessoal" | "institucional";
  email: string;
  role: string;
  is_expired: boolean;
  is_accepted: boolean;
};

const AcceptInvite = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { refreshWorkspaces, switchWorkspace } = useWorkspace();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    supabase.rpc("get_invite_preview", { p_token: token }).then(({ data, error }) => {
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        setNotFound(true);
      } else {
        setPreview(row as Preview);
      }
      setLoading(false);
    });
  }, [token]);

  const handleAccept = async () => {
    setAccepting(true);
    const { data, error } = await supabase.rpc("accept_workspace_invite", { p_token: token });
    setAccepting(false);
    if (error) {
      toast({ title: "Não foi possível aceitar o convite", description: error.message, variant: "destructive" });
      return;
    }
    await refreshWorkspaces();
    if (data) switchWorkspace(data as string);
    toast({ title: "Convite aceito!", description: `Você agora colabora em "${preview?.workspace_name}".` });
    navigate("/dashboard");
  };

  const currentUrl = `/accept-invite?token=${token}`;
  const wrongAccount = !!(user?.email && preview && user.email.toLowerCase() !== preview.email.toLowerCase());

  if (loading || authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <h1 className="text-lg font-semibold">Convite não encontrado</h1>
            <p className="text-sm text-muted-foreground">Verifique se copiou o link completo, ou peça um novo convite.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (preview?.is_expired) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <h1 className="text-lg font-semibold">Este convite expirou</h1>
            <p className="text-sm text-muted-foreground">Peça pra quem te convidou enviar um novo link.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (preview?.is_accepted) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle className="h-8 w-8 text-primary mx-auto" />
            <h1 className="text-lg font-semibold">Este convite já foi aceito</h1>
            <Button onClick={() => navigate(user ? "/dashboard" : "/login")}>
              {user ? "Ir para o Dashboard" : "Entrar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4">
      <SeoHead title="Convite · Posiciona" description="Aceite o convite para colaborar em um perfil." path="/accept-invite" />
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-5">
          {preview?.brand_type === "institucional" ? (
            <Building2 className="h-10 w-10 mx-auto text-primary" />
          ) : (
            <User className="h-10 w-10 mx-auto text-primary" />
          )}
          <div>
            <h1 className="text-xl font-bold font-display">Você foi convidado</h1>
            <p className="text-sm text-muted-foreground mt-2">
              Pra colaborar no perfil <strong>{preview?.workspace_name}</strong>. Convite enviado para{" "}
              <strong>{preview?.email}</strong>.
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Você vai poder preencher o Diagnóstico, Sua História, a História de Venda e responder os
              Arquétipos deste perfil. O restante (relatório, linha editorial, créditos) continua só com o dono.
            </p>
          </div>

          {wrongAccount ? (
            <p className="text-sm text-destructive">
              Você está logada como {user?.email}, mas este convite foi enviado pra {preview?.email}. Saia e entre
              com a conta certa pra aceitar.
            </p>
          ) : user ? (
            <Button className="w-full" onClick={handleAccept} disabled={accepting}>
              {accepting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Aceitar convite
            </Button>
          ) : (
            <div className="space-y-2">
              <Button className="w-full" onClick={() => navigate("/signup")}>
                Criar conta
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate(`/login?next=${encodeURIComponent(currentUrl)}`)}
              >
                Já tenho conta
              </Button>
              <p className="text-[11px] text-muted-foreground pt-1">
                Depois de criar sua conta, volte a este mesmo link pra confirmar o aceite.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AcceptInvite;
