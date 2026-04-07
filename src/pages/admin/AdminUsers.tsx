import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Search, Download, Ban, Coins } from "lucide-react";

const AdminUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [editingCredits, setEditingCredits] = useState<{ userId: string; name: string; current: number } | null>(null);
  const [newBalance, setNewBalance] = useState("");

  const loadUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (!profiles) { setUsers([]); return; }

    const userIds = profiles.map(p => p.user_id);
    const [creditsRes, reportsRes, bqRes] = await Promise.all([
      supabase.from("user_credits").select("user_id, balance").in("user_id", userIds),
      supabase.from("reports").select("user_id").in("user_id", userIds).eq("status", "completed"),
      supabase.from("business_questionnaires").select("user_id, is_complete").in("user_id", userIds).eq("is_complete", true),
    ]);

    const creditsMap = Object.fromEntries((creditsRes.data || []).map(c => [c.user_id, c.balance]));
    const reportsCount: Record<string, number> = {};
    (reportsRes.data || []).forEach(r => { reportsCount[r.user_id] = (reportsCount[r.user_id] || 0) + 1; });
    const bqSet = new Set((bqRes.data || []).map(b => b.user_id));

    setUsers(profiles.map(p => ({
      ...p,
      credits: creditsMap[p.user_id] ?? 0,
      reportsCount: reportsCount[p.user_id] || 0,
      bqComplete: bqSet.has(p.user_id),
    })));
  };

  useEffect(() => { loadUsers(); }, []);

  const filtered = users.filter(u =>
    (u.full_name || "").toLowerCase().includes(filter.toLowerCase()) ||
    (u.profession || "").toLowerCase().includes(filter.toLowerCase()) ||
    (u.niche || "").toLowerCase().includes(filter.toLowerCase())
  );

  const toggleBlock = async (userId: string, currentlyBlocked: boolean) => {
    await supabase.from("profiles").update({ is_blocked: !currentlyBlocked }).eq("user_id", userId);
    toast({ title: currentlyBlocked ? "Usuário desbloqueado" : "Usuário bloqueado" });
    loadUsers();
  };

  const saveCredits = async () => {
    if (!editingCredits) return;
    const val = parseInt(newBalance);
    if (isNaN(val) || val < 0) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
    await supabase.from("user_credits").update({ balance: val }).eq("user_id", editingCredits.userId);
    toast({ title: "Créditos atualizados" });
    setEditingCredits(null);
    loadUsers();
  };

  const exportCSV = () => {
    const headers = ["Nome", "Profissão", "Nicho", "Créditos", "Relatórios", "Questionário", "Status", "Criado em"];
    const rows = filtered.map(u => [
      u.full_name, u.profession || "", u.niche || "", u.credits, u.reportsCount,
      u.bqComplete ? "Completo" : "Incompleto", u.is_blocked ? "Bloqueado" : "Ativo",
      new Date(u.created_at).toLocaleDateString("pt-BR"),
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "usuarios-archebrand.csv"; a.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold font-display">Gerenciar Usuários</h1>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome, profissão ou nicho..." value={filter} onChange={e => setFilter(e.target.value)} className="pl-9" />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Profissão</TableHead>
                  <TableHead>Créditos</TableHead>
                  <TableHead>Relatórios</TableHead>
                  <TableHead>Questionário</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell>{u.profession || "—"}</TableCell>
                    <TableCell>{u.credits}</TableCell>
                    <TableCell>{u.reportsCount}</TableCell>
                    <TableCell>
                      <Badge variant={u.bqComplete ? "default" : "secondary"}>
                        {u.bqComplete ? "Completo" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.is_blocked ? "destructive" : "default"}>
                        {u.is_blocked ? "Bloqueado" : "Ativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingCredits({ userId: u.user_id, name: u.full_name, current: u.credits }); setNewBalance(String(u.credits)); }}>
                        <Coins className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => toggleBlock(u.user_id, u.is_blocked)}>
                        <Ban className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!editingCredits} onOpenChange={() => setEditingCredits(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Créditos — {editingCredits?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Saldo atual: {editingCredits?.current}</Label>
            </div>
            <div>
              <Label htmlFor="newBalance">Novo saldo</Label>
              <Input id="newBalance" type="number" min="0" value={newBalance} onChange={e => setNewBalance(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCredits(null)}>Cancelar</Button>
            <Button onClick={saveCredits}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminUsers;
