import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requirePlan?: boolean;
  requireFullAccess?: boolean;
}

export const ProtectedRoute = ({ children, requireAdmin = false, requirePlan = false, requireFullAccess = false }: ProtectedRouteProps) => {
  const { user, isAdmin, isLoading, hasActivePlan, isReadOnly } = useAuth();

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
  if ((requirePlan || requireFullAccess) && !hasActivePlan && !isAdmin) return <Navigate to="/choose-plan" replace />;
  if (requireFullAccess && isReadOnly && !isAdmin) return <Navigate to="/assinatura-expirada" replace />;

  return <>{children}</>;
};
