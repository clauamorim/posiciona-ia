import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Search, Download, Ban, Coins, Crown } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  slug: string;
  weekly_cycles: number;
  reanalysis_credits: number;
  portrait_credits: number;
  regeneration_credits: number;
}

const AdminUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [filter, setFilter] = useState("");

  // Credits dialog
  const [editingCredits, setEditingCredits] = useState<{ userId: string; name: string } | null>(null);
  const [balanceForm, setBalanceForm] = useState({ weekly_cycles: 0, reanalysis_credits: 0, portrait_credits_included: 0, portrait_credits_extra: 0, regeneration_credits: 0 });

  // Plan dialog
  const [assigningPlan, setAssigningPlan] = useState<{ userId: string; name: string } | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [planMonths, setPlanMonths] = useState("1");

  const loadPlans = async () => {
    const { data } = await supabase.from("plans").select("*").eq("active", true);
    if (data) setPlans(data);
  };

  const loadUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (!profiles) { setUsers([]); return; }

    const userIds = profiles.map(p => p.user_id);
    const [balancesRes, reportsRes, bqRes, subsRes] = await Promise.all([
      supabase.from("user_balances").select("*").in("user_id", userIds),
      supabase.from("reports").select("user_id").in("user_id", userIds).eq("status", "completed"),
      supabase.from("business_questionnaires").select("user_id, is_complete").in("user_id", userIds).eq("is_complete", true),
      supabase.from("subscriptions").select("user_id, plan_id, status, current_period_end").in("user_id", userIds).eq("status", "active"),
    ]);

    const balancesMap = Object.fromEntries((balancesRes.data || []).map(b => [b.user_id, b]));
    const reportsCount: Record<string, number> = {};
    (reportsRes.data || []).forEach(r => { reportsCount[r.user_id] = (reportsCount[r.user_id] || 0) + 1; });
    const bqSet = new Set((bqRes.data || []).map(b => b.user_id));
    const subsMap = Object.fromEntries((subsRes.data || []).map(s => [s.user_id, s]));

    setUsers(profiles.map(p => ({
      ...p,
      balances: balancesMap[p.user_id] || null,
      reportsCount: reportsCount[p.user_id] || 0,
      bqComplete: bqSet.has(p.user_id),
      subscription: subsMap[p.user_id] || null,
    })));
  };

  useEffect(() => { loadPlans(); loadUsers(); }, []);

  const getPlanName = (planId: string) => plans.find(p => p.id === planId)?.name || "—";

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

  // --- Credits ---
  const openCreditsDialog = (u: any) => {
    const b = u.balances;
    setBalanceForm({
      weekly_cycles: b?.weekly_cycles ?? 0,
      reanalysis_credits: b?.reanalysis_credits ?? 0,
      portrait_credits_included: b?.portrait_credits_included ?? 0,
      portrait_credits_extra: b?.portrait_credits_extra ?? 0,
      regeneration_credits: b?.regeneration_credits ?? 0,
    });
    setEditingCredits({ userId: u.user_id, name: u.full_name });
  };

  const saveCredits = async () => {
    if (!editingCredits) return;
    const { error } = await supabase.from("user_balances").update(balanceForm).eq("user_id", editingCredits.userId);
    if (error) { toast({ title: "Erro ao salvar", variant: "destructive" }); return; }
    await supabase.from("credit_logs").insert({ user_id: editingCredits.userId, credit_type: "admin_adjustment", amount: 0, description: "Ajuste manual de saldos pelo admin" });
    toast({ title: "Saldos atualizados" });
    setEditingCredits(null);
    loadUsers();
  };

  // --- Assign Plan ---
  const savePlan = async () => {
    if (!assigningPlan || !selectedPlanId) return;
    const months = parseInt(planMonths);
    if (isNaN(months) || months < 1) { toast({ title: "Duração inválida", variant: "destructive" }); return; }

    const plan = plans.find(p => p.id === selectedPlanId);
    if (!plan) return;

    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + months);

    // Upsert subscription
    const { data: existingSub } = await supabase.from("subscriptions").select("id").eq("user_id", assigningPlan.userId).eq("status", "active").maybeSingle();

    if (existingSub) {
      await supabase.from("subscriptions").update({
        plan_id: selectedPlanId,
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        status: "active",
      }).eq("id", existingSub.id);
    } else {
      await supabase.from("subscriptions").insert({
        user_id: assigningPlan.userId,
        plan_id: selectedPlanId,
        current_period_start: now.toISOString(),
        current_period_end: end.toISOString(),
        status: "active",
      });
    }

    // Provision balances
    await supabase.from("user_balances").update({
      weekly_cycles: plan.weekly_cycles * months,
      reanalysis_credits: plan.reanalysis_credits * months,
      portrait_credits_included: plan.portrait_credits * months,
      regeneration_credits: plan.regeneration_credits * months,
    }).eq("user_id", assigningPlan.userId);

    // Log
    await supabase.from("credit_logs").insert({
      user_id: assigningPlan.userId,
      credit_type: "admin_plan_assign",
      amount: months,
      description: `Plano "${plan.name}" atribuído por ${months} mês(es) pelo admin`,
    });

    toast({ title: `Plano "${plan.name}" atribuído com sucesso` });
    setAssigningPlan(null);
    setSelectedPlanId("");
    setPlanMonths("1");
    loadUsers();
  };

  const exportCSV = () => {
    const headers = ["Nome", "Profissão", "Nicho", "Plano", "Relatórios", "Questionário", "Status", "Criado em"];
    const rows = filtered.map(u => [
      u.full_name, u.profession || "", u.niche || "",
      u.subscription ? getPlanName(u.subscription.plan_id) : "Nenhum",
      u.reportsCount, u.bqComplete ? "Completo" : "Incompleto",
      u.is_blocked ? "Bloqueado" : "Ativo",
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
                  <TableHead>Plano</TableHead>
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
                    <TableCell>
                      {u.subscription ? (
                        <Badge variant="default">{getPlanName(u.subscription.plan_id)}</Badge>
                      ) : (
                        <Badge variant="secondary">Nenhum</Badge>
                      )}
                    </TableCell>
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
                      <Button variant="ghost" size="icon" title="Atribuir Plano" onClick={() => { setAssigningPlan({ userId: u.user_id, name: u.full_name }); setSelectedPlanId(u.subscription?.plan_id || ""); setPlanMonths("1"); }}>
                        <Crown className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Editar Créditos" onClick={() => openCreditsDialog(u)}>
                        <Coins className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title={u.is_blocked ? "Desbloquear" : "Bloquear"} onClick={() => toggleBlock(u.user_id, u.is_blocked)}>
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

      {/* Dialog: Atribuir Plano */}
      <Dialog open={!!assigningPlan} onOpenChange={() => setAssigningPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Plano — {assigningPlan?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Plano</Label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                <SelectContent>
                  {plans.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="planMonths">Duração (meses)</Label>
              <Input id="planMonths" type="number" min="1" value={planMonths} onChange={e => setPlanMonths(e.target.value)} />
            </div>
            {selectedPlanId && (() => {
              const p = plans.find(pl => pl.id === selectedPlanId);
              const m = parseInt(planMonths) || 1;
              if (!p) return null;
              return (
                <div className="rounded-md border p-3 text-sm space-y-1 bg-muted/50">
                  <p className="font-medium">Créditos provisionados:</p>
                  <p>Ciclos semanais: {p.weekly_cycles * m}</p>
                  <p>Reanálises: {p.reanalysis_credits * m}</p>
                  <p>Retratos: {p.portrait_credits * m}</p>
                  <p>Regenerações: {p.regeneration_credits * m}</p>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningPlan(null)}>Cancelar</Button>
            <Button onClick={savePlan} disabled={!selectedPlanId}>Atribuir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar Créditos */}
      <Dialog open={!!editingCredits} onOpenChange={() => setEditingCredits(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Créditos — {editingCredits?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {[
              { key: "weekly_cycles", label: "Ciclos semanais" },
              { key: "reanalysis_credits", label: "Reanálises" },
              { key: "portrait_credits_included", label: "Retratos (inclusos)" },
              { key: "portrait_credits_extra", label: "Retratos (extras)" },
              { key: "regeneration_credits", label: "Regenerações" },
            ].map(({ key, label }) => (
              <div key={key}>
                <Label>{label}</Label>
                <Input type="number" min="0" value={(balanceForm as any)[key]} onChange={e => setBalanceForm(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))} />
              </div>
            ))}
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
