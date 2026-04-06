import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, FileText, Brain, Building2 } from "lucide-react";

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState({ users: 0, reports: 0, bq: 0, archetypes: 0 });

  useEffect(() => {
    const load = async () => {
      const [usersRes, reportsRes, bqRes, scoresRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("business_questionnaires").select("id", { count: "exact", head: true }).eq("is_complete", true),
        supabase.from("archetype_scores").select("id", { count: "exact", head: true }),
      ]);
      setMetrics({
        users: usersRes.count || 0,
        reports: reportsRes.count || 0,
        bq: bqRes.count || 0,
        archetypes: scoresRes.count ? Math.floor((scoresRes.count) / 12) : 0,
      });
    };
    load();
  }, []);

  const cards = [
    { label: "Total de Usuários", value: metrics.users, icon: Users, color: "text-primary" },
    { label: "Relatórios Gerados", value: metrics.reports, icon: FileText, color: "text-success" },
    { label: "Questionários Completos", value: metrics.bq, icon: Building2, color: "text-accent" },
    { label: "Testes de Arquétipos", value: metrics.archetypes, icon: Brain, color: "text-warning" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold font-display">Painel Administrativo</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {cards.map(c => (
            <Card key={c.label}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <c.icon className={`h-8 w-8 ${c.color}`} />
                  <div>
                    <p className="text-2xl font-bold font-display">{c.value}</p>
                    <p className="text-sm text-muted-foreground">{c.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
