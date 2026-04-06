import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { History, FileText } from "lucide-react";

const HistoryPage = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("reports")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setReports(data || []));
  }, [user]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <History className="h-6 w-6" /> Histórico
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Todos os seus relatórios gerados</p>
        </div>
        {reports.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum relatório encontrado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map(r => (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <p className="font-medium font-display">Versão {r.version}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                    </p>
                  </div>
                  <Badge variant={r.status === "completed" ? "default" : r.status === "error" ? "destructive" : "secondary"}>
                    {r.status === "completed" ? "Completo" : r.status === "error" ? "Erro" : "Pendente"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default HistoryPage;
