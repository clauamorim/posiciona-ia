import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, ArrowRight } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");

  return (
    <AuthLayout>
      <div className="text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Mail className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold">Verifique seu e-mail</h1>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            Enviamos um link de confirmação para{" "}
            {email ? <strong className="text-foreground">{email}</strong> : "seu e-mail"}.
            <br />
            Acesse sua caixa de entrada e clique no link para ativar sua conta.
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            Não encontrou? Verifique também a pasta de spam.
          </p>
        </div>
        <Button className="gap-2" onClick={() => navigate("/login")}>
          Ir para o Login <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </AuthLayout>
  );
};

export default VerifyEmail;
