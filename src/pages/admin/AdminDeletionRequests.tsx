import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Shield } from "lucide-react";

interface DeletionRequest {
  id: string;
  user_id: string;
  email: string;
  profession: string | null;
  niche: string | null;
  requested_at: string;
}

const AdminDeletionRequests = () => {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("account_deletion_requests")
        .select("*")
        .order("requested_at", { ascending: false });
      setRequests((data as DeletionRequest[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <DashboardLayout wide>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-destructive" />
          <div>
            <h1 className="text-2xl font-bold font-display">Solicitações de exclusão LGPD</h1>
            <p className="text-sm text-muted-foreground">Solicitações de exclusão de conta pendentes ou processadas.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Pendentes <Badge variant="destructive">{requests.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma solicitação registrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Profissão</TableHead>
                    <TableHead>Nicho</TableHead>
                    <TableHead>Data da solicitação</TableHead>
                    <TableHead className="text-xs">User ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.email}</TableCell>
                      <TableCell className="text-sm">{r.profession || "—"}</TableCell>
                      <TableCell className="text-sm">{r.niche || "—"}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{formatDate(r.requested_at)}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{r.user_id}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminDeletionRequests;
