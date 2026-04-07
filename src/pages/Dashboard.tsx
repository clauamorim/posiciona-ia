import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Brain, FileText, ArrowRight } from "lucide-react";

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [businessComplete, setBusinessComplete] = useState(false);
  const [archetypeCount, setArchetypeCount] = useState(0);
  const [hasReport, setHasReport] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [profileRes, bqRes, answersRes, reportRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase.from("business_questionnaires").select("is_complete").eq("user_id", user.id).order("version", { ascending: false }).limit(1),
        supabase.from("archetype_answers").select("question_id").eq("user_id", user.id),
        supabase.from("reports").select("status").eq("user_id", user.id).eq("status", "completed").limit(1),
      ]);
      setProfile(profileRes.data);
      setBusinessComplete(bqRes.data?.[0]?.is_complete ?? false);
      // Count distinct question_ids to avoid duplicates inflating count
      const uniqueQuestions = new Set(answersRes.data?.map(a => a.question_id) ?? []);
      setArchetypeCount(uniqueQuestions.size);
      setHasReport((reportRes.data?.length ?? 0) > 0);
    };
    load();
  }, [user]);

  const archetypeProgress = Math.round((archetypeCount / 72) * 100);
  const overallProgress = Math.round(
    ((businessComplete ? 1 : 0) + (archetypeCount === 72 ? 1 : 0) + (hasReport ? 1 : 0)) / 3 * 100
  );

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-display">
            Olá, {profile?.full_name || "Usuário"} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Acompanhe seu progresso de posicionamento de marca</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display">Progresso geral</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={overallProgress} className="h-3" />
            <p className="text-sm text-muted-foreground mt-2">{overallProgress}% concluído</p>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="group hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${businessComplete ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold font-display">Questionário do Negócio</h3>
                  <p className="text-xs text-muted-foreground">{businessComplete ? "Completo ✓" : "Pendente"}</p>
                </div>
              </div>
              <Link to="/business-questionnaire">
                <Button variant="outline" size="sm" className="w-full">
                  {businessComplete ? "Editar" : "Começar"} <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${archetypeCount === 72 ? "bg-success/10 text-success" : "bg-primary/10 text-primary"}`}>
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold font-display">Questionário de Arquétipos</h3>
                  <p className="text-xs text-muted-foreground">{archetypeCount}/72 respondidas ({archetypeProgress}%)</p>
                </div>
              </div>
              <Link to="/archetype-questionnaire">
                <Button variant="outline" size="sm" className="w-full">
                  {archetypeCount === 72 ? "Editar" : "Continuar"} <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg ${hasReport ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold font-display">Relatório</h3>
                  <p className="text-xs text-muted-foreground">{hasReport ? "Disponível ✓" : "Complete os questionários"}</p>
                </div>
              </div>
              <Link to={hasReport ? "/report" : "/results"}>
                <Button variant="outline" size="sm" className="w-full" disabled={archetypeCount < 72 || !businessComplete}>
                  {hasReport ? "Ver relatório" : "Ver resultados"} <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
