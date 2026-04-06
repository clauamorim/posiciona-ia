import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const Report = () => {
  const { user } = useAuth();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("reports")
      .select("*")
      .eq("user_id", user.id)
      .order("version", { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        setReport(data);
        setLoading(false);
      });
  }, [user]);

  const handleDownloadPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const content = typeof report.content === "string" ? report.content : JSON.stringify(report.content, null, 2);
    const lines = doc.splitTextToSize(content, 170);
    let y = 20;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("ArcheBrand - Relatório de Posicionamento", 20, y);
    y += 15;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    for (const line of lines) {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, 20, y);
      y += 5;
    }
    doc.save("archebrand-relatorio.pdf");
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!report || report.status !== "completed") {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-bold font-display">Nenhum relatório disponível</h2>
          <p className="text-muted-foreground mt-1">
            {report?.status === "generating" ? "Seu relatório está sendo gerado..." : "Complete os questionários e gere seu relatório na página de resultados."}
          </p>
          {report?.status === "generating" && <Loader2 className="h-6 w-6 animate-spin text-primary mt-4" />}
        </div>
      </DashboardLayout>
    );
  }

  const content = report.content;
  const isStructured = typeof content === "object" && content !== null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display">Seu Relatório</h1>
            <p className="text-sm text-muted-foreground">Gerado em {new Date(report.created_at).toLocaleDateString("pt-BR")}</p>
          </div>
          <Button onClick={handleDownloadPDF} className="gap-2">
            <Download className="h-4 w-4" /> Baixar PDF
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6 prose prose-sm max-w-none">
            {isStructured ? (
              <div className="space-y-6">
                {Object.entries(content as Record<string, any>).map(([key, value]) => (
                  <div key={key}>
                    <h3 className="text-lg font-bold font-display capitalize">{key.replace(/_/g, " ")}</h3>
                    <div className="text-sm text-foreground/80 whitespace-pre-wrap">
                      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm">{String(content)}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Report;
