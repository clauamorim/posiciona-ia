import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { History, FileText, Instagram, Camera } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const HistoryPage = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [portraits, setPortraits] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("reports").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("instagram_analyses").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("portrait_generations").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]).then(([reportsRes, analysesRes, portraitsRes]) => {
      setReports(reportsRes.data || []);
      setAnalyses(analysesRes.data || []);
      setPortraits(portraitsRes.data || []);
    });
  }, [user]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <History className="h-6 w-6" /> Histórico
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Relatórios, análises e retratos gerados</p>
        </div>

        <Tabs defaultValue="reports">
          <TabsList>
            <TabsTrigger value="reports" className="gap-1">
              <FileText className="h-4 w-4" /> Relatórios
            </TabsTrigger>
            <TabsTrigger value="analyses" className="gap-1">
              <Instagram className="h-4 w-4" /> Análises Instagram
            </TabsTrigger>
            <TabsTrigger value="portraits" className="gap-1">
              <Camera className="h-4 w-4" /> Retratos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reports" className="mt-4">
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
                        <p className="text-sm text-muted-foreground">{formatDate(r.created_at)}</p>
                      </div>
                      <Badge variant={r.status === "completed" ? "default" : r.status === "error" ? "destructive" : "secondary"}>
                        {r.status === "completed" ? "Completo" : r.status === "error" ? "Erro" : "Pendente"}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="analyses" className="mt-4">
            {analyses.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Instagram className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma análise encontrada.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {analyses.map((a: any) => {
                  const items = Array.isArray(a.analysis) ? a.analysis : [];
                  return (
                    <Card key={a.id}>
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium font-display">
                            {a.username ? `@${a.username}` : "Perfil Instagram"}
                          </p>
                          <p className="text-sm text-muted-foreground">{formatDate(a.created_at)}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{items.length} aspectos analisados</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="portraits" className="mt-4">
            {portraits.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Camera className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum retrato gerado.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {portraits.map((p: any) => {
                  const imgs = Array.isArray(p.portraits) ? p.portraits : [];
                  return imgs.map((img: string, i: number) => (
                    <div key={`${p.id}-${i}`} className="space-y-2">
                      <div className="aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                        <img src={img} alt="Retrato" className="w-full h-full object-cover" />
                      </div>
                      <p className="text-xs text-center text-muted-foreground">{formatDate(p.created_at)}</p>
                    </div>
                  ));
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default HistoryPage;
