import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requirePlan?: boolean;
}

export const ProtectedRoute = ({ children, requireAdmin = false, requirePlan = false }: ProtectedRouteProps) => {
  const { user, isAdmin, isLoading, hasActivePlan } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
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
  if (requirePlan && !hasActivePlan && !isAdmin) return <Navigate to="/choose-plan" replace />;

  return <>{children}</>;
};
