import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Users, FileText, Brain, Building2, Coins, Calendar } from "lucide-react";

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState({ users: 0, reports: 0, bq: 0, archetypes: 0, totalCredits: 0, editorialWeeks: 0 });
  const [recentReports, setRecentReports] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [usersRes, reportsRes, bqRes, scoresRes, creditsRes, allReportsRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("business_questionnaires").select("id", { count: "exact", head: true }).eq("is_complete", true),
        supabase.from("archetype_scores").select("id", { count: "exact", head: true }),
        supabase.from("user_credits").select("balance"),
        supabase.from("reports").select("id, user_id, status, created_at, editorial_weeks").order("created_at", { ascending: false }).limit(10),
      ]);

      const totalCredits = (creditsRes.data || []).reduce((sum: number, c: any) => sum + (c.balance || 0), 0);
      const editorialWeeks = (allReportsRes.data || []).filter((r: any) => r.editorial_weeks && (Array.isArray(r.editorial_weeks) ? r.editorial_weeks.length > 0 : true)).length;

      setMetrics({
        users: usersRes.count || 0,
        reports: reportsRes.count || 0,
        bq: bqRes.count || 0,
        archetypes: scoresRes.count ? Math.floor(scoresRes.count / 12) : 0,
        totalCredits,
        editorialWeeks,
      });

      // Fetch profile names for recent reports
      const reports = allReportsRes.data || [];
      if (reports.length > 0) {
        const userIds = [...new Set(reports.map((r: any) => r.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
        const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.user_id, p.full_name]));
        setRecentReports(reports.map((r: any) => ({ ...r, userName: profileMap[r.user_id] || "—" })));
      }
    };
    load();
  }, []);

  const cards = [
    { label: "Total de Usuários", value: metrics.users, icon: Users, color: "text-primary" },
    { label: "Relatórios Gerados", value: metrics.reports, icon: FileText, color: "text-green-500" },
    { label: "Questionários Completos", value: metrics.bq, icon: Building2, color: "text-accent" },
    { label: "Testes de Arquétipos", value: metrics.archetypes, icon: Brain, color: "text-yellow-500" },
    { label: "Total de Créditos", value: metrics.totalCredits, icon: Coins, color: "text-primary" },
    { label: "Semanas Editoriais", value: metrics.editorialWeeks, icon: Calendar, color: "text-green-500" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold font-display">Painel Administrativo</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

        <Card>
          <CardHeader>
            <CardTitle>Últimos Relatórios</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentReports.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.userName}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "completed" ? "default" : "secondary"}>{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
                {recentReports.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Nenhum relatório</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
