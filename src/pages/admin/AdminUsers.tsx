import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Search, Download, Ban, Coins, Crown, Trash2, MailCheck, Loader2, Eye, BarChart3, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";

interface Plan {
  id: string;
  name: string;
  slug: string;
  weekly_cycles: number;
  reanalysis_credits: number;
  portrait_credits: number;
  regeneration_credits: number;
}

interface JourneyPhases {
  bq: boolean;   // Questionário do Negócio
  qa: boolean;   // Questionário de Arquétipos
  re: boolean;   // Relatório Estratégico
  nm: boolean;   // Narrativa da Marca (StoryBrand)
  ig: boolean;   // Análise do Instagram
  le: boolean;   // Linha Editorial
  rt: boolean;   // Retratos de Marca
}

const JOURNEY_LABELS: Record<keyof JourneyPhases, string> = {
  bq: "Questionário do Negócio",
  qa: "Questionário de Arquétipos",
  re: "Relatório Estratégico",
  nm: "Narrativa da Marca",
  ig: "Análise do Instagram",
  le: "Linha Editorial",
  rt: "Retratos de Marca",
};

const AdminUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [emailMap, setEmailMap] = useState<Record<string, string>>({});
  const [lastSignInMap, setLastSignInMap] = useState<Record<string, string | null>>({});
  const [filter, setFilter] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Detail dialog
  const [viewingUser, setViewingUser] = useState<any | null>(null);

  // Credits dialog
  const [editingCredits, setEditingCredits] = useState<{ userId: string; name: string } | null>(null);
  const [balanceForm, setBalanceForm] = useState({ weekly_cycles: 0, reanalysis_credits: 0, portrait_credits_included: 0, portrait_credits_extra: 0, regeneration_credits: 0 });

  // Plan dialog
  const [assigningPlan, setAssigningPlan] = useState<{ userId: string; name: string } | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [planMonths, setPlanMonths] = useState("1");

  // Delete confirm
  const [deletingUser, setDeletingUser] = useState<{ userId: string; name: string } | null>(null);

  const loadPlans = async () => {
    const { data } = await supabase.from("plans").select("*").eq("active", true);
    if (data) setPlans(data);
  };

  const loadEmails = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "list_users", userId: "system" },
      });
      if (!error && data?.emailMap) {
        setEmailMap(data.emailMap);
      }
      if (!error && data?.lastSignInMap) {
        setLastSignInMap(data.lastSignInMap);
      }
    } catch (e) {
      console.error("Failed to load emails:", e);
    }
  };

  const loadUsers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (!profiles) { setUsers([]); return; }

    const userIds = profiles.map(p => p.user_id);
    const [balancesRes, reportsRes, bqRes, subsRes, archetypeRes, igRes, portraitRes] = await Promise.all([
      supabase.from("user_balances").select("*").in("user_id", userIds),
      supabase.from("reports").select("user_id, status, content, editorial_weeks").in("user_id", userIds),
      supabase.from("business_questionnaires").select("user_id, is_complete").in("user_id", userIds).eq("is_complete", true),
      supabase.from("subscriptions").select("user_id, plan_id, status, current_period_end").in("user_id", userIds).eq("status", "active"),
      supabase.from("archetype_scores").select("user_id").in("user_id", userIds),
      supabase.from("instagram_analyses").select("user_id").in("user_id", userIds),
      supabase.from("portrait_generations").select("user_id").in("user_id", userIds),
    ]);

    const balancesMap = Object.fromEntries((balancesRes.data || []).map(b => [b.user_id, b]));
    const bqSet = new Set((bqRes.data || []).map(b => b.user_id));
    const subsMap = Object.fromEntries((subsRes.data || []).map(s => [s.user_id, s]));
    const archetypeSet = new Set((archetypeRes.data || []).map(a => a.user_id));
    const igSet = new Set((igRes.data || []).map(a => a.user_id));
    const portraitSet = new Set((portraitRes.data || []).map(a => a.user_id));

    // Build per-user report info
    const reportsCompleted = new Set<string>();
    const hasStoryBrand = new Set<string>();
    const hasEditorial = new Set<string>();
    (reportsRes.data || []).forEach(r => {
      if (r.status === "completed") reportsCompleted.add(r.user_id);
      if (r.content && typeof r.content === "object") {
        const c = r.content as any;
        if (c.storybrand || c.story_brand || c.narrativa) hasStoryBrand.add(r.user_id);
      }
      if (r.editorial_weeks && Array.isArray(r.editorial_weeks) && r.editorial_weeks.length > 0) {
        hasEditorial.add(r.user_id);
      }
    });

    setUsers(profiles.map(p => {
      const journey: JourneyPhases = {
        bq: bqSet.has(p.user_id),
        qa: archetypeSet.has(p.user_id),
        re: reportsCompleted.has(p.user_id),
        nm: hasStoryBrand.has(p.user_id),
        ig: igSet.has(p.user_id),
        le: hasEditorial.has(p.user_id),
        rt: portraitSet.has(p.user_id),
      };
      return {
        ...p,
        balances: balancesMap[p.user_id] || null,
        reportsCount: reportsCompleted.has(p.user_id) ? 1 : 0,
        bqComplete: bqSet.has(p.user_id),
        subscription: subsMap[p.user_id] || null,
        journey,
      };
    }));
  };

  useEffect(() => { loadPlans(); loadUsers(); loadEmails(); }, []);

  const getPlanName = (planId: string) => plans.find(p => p.id === planId)?.name || "—";

  const filtered = users.filter(u =>
    (u.full_name || "").toLowerCase().includes(filter.toLowerCase()) ||
    (u.profession || "").toLowerCase().includes(filter.toLowerCase()) ||
    (u.niche || "").toLowerCase().includes(filter.toLowerCase()) ||
    (emailMap[u.user_id] || "").toLowerCase().includes(filter.toLowerCase())
  );

  const toggleBlock = async (userId: string, currentlyBlocked: boolean) => {
    await supabase.from("profiles").update({ is_blocked: !currentlyBlocked }).eq("user_id", userId);
    toast({ title: currentlyBlocked ? "Usuário desbloqueado" : "Usuário bloqueado" });
    loadUsers();
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    setActionLoading("delete");
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "delete_user", userId: deletingUser.userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Usuário excluído com sucesso" });
      loadUsers();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
    setActionLoading(null);
    setDeletingUser(null);
  };

  const handleConfirmEmail = async (userId: string) => {
    setActionLoading(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-user", {
        body: { action: "confirm_email", userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "E-mail confirmado com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro ao confirmar e-mail", description: err.message, variant: "destructive" });
    }
    setActionLoading(null);
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

    await supabase.from("user_balances").update({
      weekly_cycles: plan.weekly_cycles * months,
      reanalysis_credits: plan.reanalysis_credits * months,
      portrait_credits_included: plan.portrait_credits * months,
      regeneration_credits: plan.regeneration_credits * months,
    }).eq("user_id", assigningPlan.userId);

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

  const formatLastLogin = (userId: string) => {
    const dt = lastSignInMap[userId];
    if (!dt) return "—";
    return new Date(dt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const renderJourneyBadges = (journey: JourneyPhases) => {
    const keys = Object.keys(journey) as (keyof JourneyPhases)[];
    return (
      <div className="flex flex-wrap gap-1">
        {keys.map(k => (
          <Tooltip key={k}>
            <TooltipTrigger asChild>
              <span
                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase cursor-default ${
                  journey[k]
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground/40"
                }`}
              >
                {k.toUpperCase()}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {JOURNEY_LABELS[k]}: {journey[k] ? "Concluído" : "Pendente"}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    );
  };

  const exportCSV = () => {
    const headers = ["Nome", "E-mail", "Gênero", "WhatsApp", "Profissão", "Nicho", "Objetivo", "Plano", "Último Login", "Jornada", "Status", "Criado em"];
    const rows = filtered.map(u => {
      const j = u.journey as JourneyPhases;
      const journeyStr = (Object.keys(j) as (keyof JourneyPhases)[]).filter(k => j[k]).map(k => k.toUpperCase()).join(" ");
      return [
        u.full_name, emailMap[u.user_id] || "", u.gender || "", u.whatsapp || "",
        u.profession || "", u.niche || "", u.main_goal || "",
        u.subscription ? getPlanName(u.subscription.plan_id) : "Nenhum",
        formatLastLogin(u.user_id),
        journeyStr || "Nenhuma",
        u.is_blocked ? "Bloqueado" : "Ativo",
        new Date(u.created_at).toLocaleDateString("pt-BR"),
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "usuarios-posiciona.csv"; a.click();
  };

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold font-display">Gerenciar Usuários</h1>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link to="/admin/metrics">
                  <BarChart3 className="h-4 w-4" /> Ver métricas
                </Link>
              </Button>
              <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
                <Download className="h-4 w-4" /> Exportar CSV
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, e-mail, profissão ou nicho..." value={filter} onChange={e => setFilter(e.target.value)} className="pl-9" />
          </div>

          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Último Login</TableHead>
                    <TableHead>Jornada</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(u => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.full_name || "—"}</div>
                        <div className="text-xs text-muted-foreground">{u.profession || ""}{u.niche ? ` · ${u.niche}` : ""}</div>
                      </TableCell>
                      <TableCell className="text-xs">{emailMap[u.user_id] || "—"}</TableCell>
                      <TableCell>
                        {u.subscription ? (
                          <Badge variant="default">{getPlanName(u.subscription.plan_id)}</Badge>
                        ) : (
                          <Badge variant="secondary">Nenhum</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatLastLogin(u.user_id)}
                      </TableCell>
                      <TableCell>
                        {renderJourneyBadges(u.journey)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.is_blocked ? "destructive" : "default"}>
                          {u.is_blocked ? "Bloqueado" : "Ativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" title="Ver Detalhes" onClick={() => setViewingUser(u)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Atribuir Plano" onClick={() => { setAssigningPlan({ userId: u.user_id, name: u.full_name }); setSelectedPlanId(u.subscription?.plan_id || ""); setPlanMonths("1"); }}>
                          <Crown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Editar Créditos" onClick={() => openCreditsDialog(u)}>
                          <Coins className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Confirmar E-mail" onClick={() => handleConfirmEmail(u.user_id)} disabled={actionLoading === u.user_id}>
                          {actionLoading === u.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" title={u.is_blocked ? "Desbloquear" : "Bloquear"} onClick={() => toggleBlock(u.user_id, u.is_blocked)}>
                          <Ban className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Excluir Usuário" className="text-destructive hover:text-destructive" onClick={() => setDeletingUser({ userId: u.user_id, name: u.full_name })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Dialog: Ver Detalhes */}
        <Dialog open={!!viewingUser} onOpenChange={() => setViewingUser(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes do Usuário</DialogTitle>
            </DialogHeader>
            {viewingUser && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: "Nome", value: viewingUser.full_name },
                    { label: "E-mail", value: emailMap[viewingUser.user_id] || "—" },
                    { label: "Gênero", value: viewingUser.gender || "—" },
                    { label: "WhatsApp", value: viewingUser.whatsapp || "—" },
                    { label: "Profissão", value: viewingUser.profession || "—" },
                    { label: "Nicho", value: viewingUser.niche || "—" },
                    { label: "Objetivo Principal", value: viewingUser.main_goal || "—" },
                    { label: "Plano", value: viewingUser.subscription ? getPlanName(viewingUser.subscription.plan_id) : "Nenhum" },
                    { label: "Último Login", value: formatLastLogin(viewingUser.user_id) },
                    { label: "Status", value: viewingUser.is_blocked ? "Bloqueado" : "Ativo" },
                    { label: "Cadastro", value: new Date(viewingUser.created_at).toLocaleDateString("pt-BR") },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-muted-foreground text-xs">{label}</p>
                      <p className="font-medium">{value}</p>
                    </div>
                  ))}
                </div>

                {/* Journey phases */}
                {viewingUser.journey && (
                  <div className="rounded-md border p-3 bg-muted/50 space-y-2">
                    <p className="font-medium text-xs text-muted-foreground">Jornada</p>
                    <div className="grid grid-cols-1 gap-1.5 text-xs">
                      {(Object.keys(viewingUser.journey) as (keyof JourneyPhases)[]).map(k => (
                        <div key={k} className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${viewingUser.journey[k] ? "bg-primary" : "bg-muted-foreground/20"}`} />
                          <span className={viewingUser.journey[k] ? "font-medium" : "text-muted-foreground"}>
                            {JOURNEY_LABELS[k]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewingUser.balances && (
                  <div className="rounded-md border p-3 bg-muted/50 space-y-1">
                    <p className="font-medium text-xs text-muted-foreground mb-1">Créditos</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <span>Ciclos semanais: <strong>{viewingUser.balances.weekly_cycles}</strong></span>
                      <span>Reanálises: <strong>{viewingUser.balances.reanalysis_credits}</strong></span>
                      <span>Retratos (inclusos): <strong>{viewingUser.balances.portrait_credits_included}</strong></span>
                      <span>Retratos (extras): <strong>{viewingUser.balances.portrait_credits_extra}</strong></span>
                      <span>Ajustes de conteúdo: <strong>{viewingUser.balances.regeneration_credits}</strong></span>
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewingUser(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                    <p>Ajustes de conteúdo: {p.regeneration_credits * m}</p>
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
                { key: "regeneration_credits", label: "Ajustes de conteúdo" },
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

        {/* Alert: Excluir Usuário */}
        <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir permanentemente o usuário <strong>{deletingUser?.name}</strong>? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteUser} disabled={actionLoading === "delete"} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {actionLoading === "delete" ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TooltipProvider>
    </DashboardLayout>
  );
};

export default AdminUsers;
