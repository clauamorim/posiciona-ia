import { useAuth } from "@/contexts/AuthContext";
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
  const location = useLocation();

  if (isLoading) {
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

  // Force profile completion before reaching dashboard / questionnaires / report.
  if (!profileCompleted && !isAdmin && location.pathname !== "/complete-profile") {
    return <Navigate to="/complete-profile" replace />;
  }
  if ((requirePlan || requireFullAccess) && !hasActivePlan && !isAdmin) return <Navigate to="/choose-plan" replace />;
  if (requireFullAccess && isReadOnly && !isAdmin) return <Navigate to="/assinatura-expirada" replace />;

  return <>{children}</>;
};
