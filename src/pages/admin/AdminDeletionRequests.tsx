import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, Shield, Trash2 } from "lucide-react";

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
  const [deleting, setDeleting] = useState<DeletionRequest | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadRequests = async () => {
    const { data } = await supabase
      .from("account_deletion_requests")
      .select("*")
      .is("processed_at", null)
      .order("requested_at", { ascending: false });
    setRequests((data as DeletionRequest[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleDelete = async () => {
    if (!deleting) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "delete_user", userId: deleting.user_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Conta excluída", description: `${deleting.email} foi apagada e o pedido, encerrado.` });
      setRequests((prev) => prev.filter((r) => r.id !== deleting.id));
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
    setActionLoading(false);
    setDeleting(null);
  };

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <DashboardLayout wide>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-destructive" />
          <div>
            <h1 className="text-2xl font-bold font-display">Solicitações de exclusão LGPD</h1>
            <p className="text-sm text-muted-foreground">Solicitações de exclusão de conta ainda pendentes. Ao excluir, o pedido some desta lista.</p>
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
                    <TableHead className="text-right">Ações</TableHead>
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
                      <TableCell className="text-right">
                        <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setDeleting(r)}>
                          <Trash2 className="h-3.5 w-3.5" /> Excluir agora
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente a conta de <strong>{deleting?.email}</strong>? Isso cancela a assinatura na Stripe e apaga todos os dados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={actionLoading} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default AdminDeletionRequests;
