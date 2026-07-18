import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SeoHead } from "@/components/SeoHead";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink, Trash2, Eye, EyeOff, User, Building2 } from "lucide-react";

type BrandType = "pessoal" | "institucional";

type PasswordStrength = { score: number; label: string; color: string };

function evaluatePasswordStrength(pwd: string): PasswordStrength | null {
  if (!pwd) return null;
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++;
  if (/\d/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  if (score <= 2) return { score, label: "Fraca", color: "bg-destructive" };
  if (score <= 3) return { score, label: "Média", color: "bg-amber-500" };
  return { score, label: "Forte", color: "bg-emerald-500" };
}

const Conta = () => {
  const { user, subscription, planAccessLevel, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<{ profession: string | null; niche: string | null } | null>(null);
  const [brandType, setBrandType] = useState<BrandType>("pessoal");
  const [pendingBrandType, setPendingBrandType] = useState<BrandType | null>(null);
  const [brandTypeLoading, setBrandTypeLoading] = useState(false);
  const [savingBrandType, setSavingBrandType] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const pwdStrength = evaluatePasswordStrength(pwdNew);

  const [confirmText, setConfirmText] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("profession, niche")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
    setBrandTypeLoading(true);
    supabase
      .from("workspaces")
      .select("brand_type")
      .eq("owner_id", user.id)
      .eq("is_default", true)
      .maybeSingle()
      .then(({ data }) => {
        setBrandType(data?.brand_type === "institucional" ? "institucional" : "pessoal");
        setBrandTypeLoading(false);
      });
  }, [user]);

  const confirmBrandTypeChange = async () => {
    if (!user || !pendingBrandType) return;
    setSavingBrandType(true);
    try {
      const { error } = await supabase
        .from("workspaces")
        .update({ brand_type: pendingBrandType })
        .eq("owner_id", user.id)
        .eq("is_default", true);
      if (error) throw error;
      setBrandType(pendingBrandType);
      toast({
        title: "Tipo de marca atualizado",
        description: pendingBrandType === "institucional"
          ? "Seus questionários e conteúdo agora seguem o enquadramento de marca/empresa."
          : "Seus questionários e conteúdo agora seguem o enquadramento pessoal.",
      });
    } catch (e: any) {
      toast({ title: "Erro ao atualizar", description: e?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setSavingBrandType(false);
      setPendingBrandType(null);
    }
  };

  const handleUpdatePassword = async () => {
    if (pwdNew.length < 8) {
      toast({ title: "Nova senha muito curta", description: "Use pelo menos 8 caracteres.", variant: "destructive" });
      return;
    }
    if (pwdNew !== pwdConfirm) {
      toast({ title: "Senhas não conferem", description: "Confirme a nova senha corretamente.", variant: "destructive" });
      return;
    }
    if (!user?.email) return;
    setPwdLoading(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: pwdCurrent,
      });
      if (signInErr) {
        toast({ title: "Senha atual incorreta", description: "Verifique a senha atual e tente novamente.", variant: "destructive" });
        return;
      }
      const { error: updErr } = await supabase.auth.updateUser({ password: pwdNew });
      if (updErr) throw updErr;
      toast({ title: "Senha atualizada", description: "Sua senha foi alterada com sucesso." });
      setPwdCurrent(""); setPwdNew(""); setPwdConfirm("");
    } catch (e: any) {
      const code = e?.code || "";
      const raw = (e?.message || "").toLowerCase();
      let description = e?.message || "Tente novamente.";
      if (code === "weak_password" || raw.includes("password should contain") || raw.includes("password is known to be weak") || raw.includes("password should be at least")) {
        description = "Sua senha é muito fraca. Use pelo menos 8 caracteres, misturando letras, números e símbolos.";
      }
      toast({ title: "Erro ao atualizar senha", description, variant: "destructive" });
    } finally {
      setPwdLoading(false);
    }
  };

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-customer-portal");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
      else throw new Error("URL do portal não retornada");
    } catch (e: any) {
      toast({
        title: "Não foi possível abrir o portal",
        description: e?.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (confirmText !== "EXCLUIR") return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account-request");
      if (error) throw error;
      toast({
        title: "Solicitação registrada",
        description: "Em até 15 dias úteis você receberá confirmação da exclusão.",
      });
      setDeleteOpen(false);
      await signOut();
      navigate("/", { replace: true });
    } catch (e: any) {
      toast({ title: "Erro ao registrar solicitação", description: e?.message || "", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (s: string | null | undefined) =>
    s ? new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "—";

  const statusLabel =
    planAccessLevel === "full" ? "Ativa"
      : planAccessLevel === "read_only" ? "Modo leitura"
      : "Sem plano";

  return (
    <DashboardLayout>
      <SeoHead title="Conta · Posiciona" description="Suas informações de conta e assinatura." path="/conta" />
      <div className="space-y-5 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight">Conta</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie seus dados, segurança e assinatura.</p>
        </div>

        {/* Seus dados */}
        <Card>
          <CardHeader>
            <CardTitle>Seus dados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input value={user?.email ?? ""} readOnly className="mt-1 bg-muted/30 cursor-default" />
              <p className="text-xs text-muted-foreground/70 mt-1">
                Para alterar, contate o suporte: <a href="mailto:contato@posiciona.ia.br" className="underline hover:text-foreground">contato@posiciona.ia.br</a>
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Profissão</Label>
              <Input value={profile?.profession ?? ""} readOnly className="mt-1 bg-muted/30 cursor-default" />
              <p className="text-xs text-muted-foreground/70 mt-1">
                Para alterar, edite o{" "}
                <Link to="/business-questionnaire" className="underline hover:text-foreground">Diagnóstico do Negócio</Link>.
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Nicho</Label>
              <Input value={profile?.niche ?? ""} readOnly className="mt-1 bg-muted/30 cursor-default" />
              <p className="text-xs text-muted-foreground/70 mt-1">
                Para alterar, edite o{" "}
                <Link to="/business-questionnaire" className="underline hover:text-foreground">Diagnóstico do Negócio</Link>.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tipo de marca */}
        <Card>
          <CardHeader>
            <CardTitle>Tipo de marca</CardTitle>
            <CardDescription>
              Define se os questionários, o relatório e a linha editorial são construídos em torno de
              você (marca pessoal) ou da sua empresa/negócio (marca institucional).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {brandTypeLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : (
              <RadioGroup
                value={brandType}
                onValueChange={(v) => setPendingBrandType(v as BrandType)}
                className="grid sm:grid-cols-2 gap-3"
              >
                <Label
                  htmlFor="brand-pessoal"
                  className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                    brandType === "pessoal" ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <RadioGroupItem value="pessoal" id="brand-pessoal" className="mt-0.5" />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <User className="h-3.5 w-3.5" /> Pessoal
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Você é a marca — profissional liberal, autoridade individual.
                    </p>
                  </div>
                </Label>
                <Label
                  htmlFor="brand-institucional"
                  className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                    brandType === "institucional" ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <RadioGroupItem value="institucional" id="brand-institucional" className="mt-0.5" />
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <Building2 className="h-3.5 w-3.5" /> Institucional
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Empresa, clínica, escritório — a marca existe além de uma pessoa.
                    </p>
                  </div>
                </Label>
              </RadioGroup>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={pendingBrandType !== null} onOpenChange={(o) => { if (!o) setPendingBrandType(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Mudar para {pendingBrandType === "institucional" ? "marca institucional" : "marca pessoal"}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Isso muda o enquadramento dos seus questionários (Sua História/Voz da Marca, Arquétipos),
                do relatório e da linha editorial gerada a partir de agora. Respostas já dadas no
                enquadramento anterior ficam salvas, mas deixam de contar até você trocar de volta.
                Se já tiver conteúdo gerado, considere regenerar depois da troca.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={savingBrandType}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmBrandTypeChange} disabled={savingBrandType}>
                {savingBrandType && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Segurança */}
        <Card>
          <CardHeader>
            <CardTitle>Segurança</CardTitle>
            <CardDescription>Atualize sua senha de acesso.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="pwd-current" className="text-xs text-muted-foreground">Senha atual</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">Esqueci minha senha</Link>
              </div>
              <div className="relative">
                <Input
                  id="pwd-current"
                  type={showCurrent ? "text" : "password"}
                  value={pwdCurrent}
                  onChange={(e) => setPwdCurrent(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showCurrent ? "Ocultar senha" : "Mostrar senha"}
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label htmlFor="pwd-new" className="text-xs text-muted-foreground">Nova senha (mínimo 8 caracteres)</Label>
              <div className="relative mt-1">
                <Input
                  id="pwd-new"
                  type={showNew ? "text" : "password"}
                  value={pwdNew}
                  onChange={(e) => setPwdNew(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showNew ? "Ocultar senha" : "Mostrar senha"}
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwdStrength && (
                <div className="mt-2 space-y-1">
                  <div className="flex h-1 gap-1">
                    {[1, 2, 3, 4, 5].map((bar) => (
                      <div
                        key={bar}
                        className={`flex-1 rounded-full ${
                          bar <= pwdStrength.score ? pwdStrength.color : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Força: <span className="font-medium text-foreground/80">{pwdStrength.label}</span>
                  </p>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="pwd-confirm" className="text-xs text-muted-foreground">Confirmar nova senha</Label>
              <div className="relative mt-1">
                <Input
                  id="pwd-confirm"
                  type={showConfirm ? "text" : "password"}
                  value={pwdConfirm}
                  onChange={(e) => setPwdConfirm(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showConfirm ? "Ocultar senha" : "Mostrar senha"}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {pwdConfirm && pwdNew !== pwdConfirm && (
                <p className="text-[11px] text-destructive mt-1">As senhas não coincidem.</p>
              )}
            </div>
            <Button onClick={handleUpdatePassword} disabled={pwdLoading || !pwdCurrent || !pwdNew || pwdNew !== pwdConfirm}>
              {pwdLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Atualizar senha
            </Button>
          </CardContent>
        </Card>

        {/* Assinatura */}
        <Card>
          <CardHeader>
            <CardTitle>Assinatura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plano atual</span>
              <span className="text-sm font-medium">{subscription?.plan_name ?? "Nenhum"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={planAccessLevel === "full" ? "default" : planAccessLevel === "read_only" ? "secondary" : "outline"}>
                {statusLabel}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Próxima renovação</span>
              <span className="text-sm">{formatDate(subscription?.current_period_end)}</span>
            </div>
            {subscription && (
              <>
                <Button variant="outline" onClick={openPortal} disabled={portalLoading} className="w-full gap-2 mt-2">
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                  Gerenciar assinatura
                </Button>
                <p className="text-[11px] text-muted-foreground/80 mt-1.5 text-center">
                  Abre portal externo do Stripe — atualizar cartão, baixar faturas ou cancelar.
                </p>
              </>
            )}
            {!subscription && (
              <Link to="/choose-plan">
                <Button className="w-full mt-2">Escolher um plano</Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Zona de perigo */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Zona de perigo</CardTitle>
            <CardDescription>
              Excluir minha conta — esta ação não pode ser desfeita. Todos os seus dados (questionários,
              conteúdo gerado, retratos) serão permanentemente removidos em até 15 dias úteis, conforme LGPD.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) setConfirmText(""); }}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <Trash2 className="h-4 w-4" /> Excluir conta
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar exclusão da conta</AlertDialogTitle>
                  <AlertDialogDescription>
                    Para confirmar, digite <strong>EXCLUIR</strong> abaixo. A solicitação será registrada
                    e processada em até 15 dias úteis. Você será deslogado em seguida.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                  placeholder="Digite EXCLUIR"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  autoFocus
                />
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => { e.preventDefault(); confirmDelete(); }}
                    disabled={confirmText !== "EXCLUIR" || deleting}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Confirmar exclusão
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Conta;
