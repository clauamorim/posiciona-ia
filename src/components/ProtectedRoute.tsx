import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Navigate, useLocation } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { PENDING_INVITE_KEY } from "@/pages/AcceptInvite";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requirePlan?: boolean;
  requireFullAccess?: boolean;
}

export const ProtectedRoute = ({ children, requireAdmin = false, requirePlan = false, requireFullAccess = false }: ProtectedRouteProps) => {
  const { user, isAdmin, isLoading, hasActivePlan, isReadOnly, profileCompleted } = useAuth();
  const { activeWorkspace, isLoading: workspaceLoading } = useWorkspace();
  const location = useLocation();

  // Só espera o 1º carregamento — recarregar a lista depois (criar/excluir
  // perfil) não pode trocar a página inteira por um skeleton.
  if (isLoading || (user && workspaceLoading && !activeWorkspace)) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (requireAdmin && !isAdmin) return <Navigate to="/dashboard" replace />;

  // Quem se cadastrou pra aceitar um convite de outra conta não deveria
  // configurar marca própria nem escolher/pagar um plano — isso é só pra
  // quem está criando a PRÓPRIA jornada. Manda direto de volta pro convite.
  const pendingInviteToken = !isAdmin ? localStorage.getItem(PENDING_INVITE_KEY) : null;
  if (pendingInviteToken && location.pathname !== "/accept-invite") {
    return <Navigate to={`/accept-invite?token=${pendingInviteToken}`} replace />;
  }

  // Trabalhando num perfil de OUTRA conta (convidado): quem paga plano e
  // configura a marca é o dono — o convidado não precisa de perfil
  // completo nem de plano próprio pra preencher os questionários dali.
  // (O que ele pode tocar é limitado pelo RLS, não por esta checagem.)
  const viaMembership = !!activeWorkspace && activeWorkspace.role !== "owner";

  // Force profile completion before reaching dashboard / questionnaires / report.
  if (!profileCompleted && !isAdmin && !viaMembership && location.pathname !== "/complete-profile") {
    return <Navigate to="/complete-profile" replace />;
  }
  if ((requirePlan || requireFullAccess) && !hasActivePlan && !isAdmin && !viaMembership) return <Navigate to="/choose-plan" replace />;
  if (requireFullAccess && isReadOnly && !isAdmin && !viaMembership) return <Navigate to="/assinatura-expirada" replace />;

  return <>{children}</>;
};
