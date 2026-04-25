import { useState, useRef, useCallback, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Upload, X, Download, Loader2, ImageIcon, ShoppingCart, Camera, Maximize2, Sparkles, CheckCircle2, AlertCircle, Wand2 } from "lucide-react";
import JSZip from "jszip";
import { compressImage } from "@/lib/imageUtils";
import { PortraitPreviewDialog } from "@/components/PortraitPreviewDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { downloadAsBlob } from "@/lib/portraitUrl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MIN_TRAINING_FILES = 10;
const MAX_TRAINING_FILES = 20;
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const TRAIN_COST_CREDITS = 4;
const GENERATE_COST_CREDITS = 3;

const PortraitGenerator = () => {
  const { user, balances, subscription, refreshSubscription } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [trainSelfies, setTrainSelfies] = useState<{ file: File; preview: string; base64: string }[]>([]);
  const [trainModalOpen, setTrainModalOpen] = useState(false);
  const [confirmTrainOpen, setConfirmTrainOpen] = useState(false);
  const [submittingTrain, setSubmittingTrain] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false);
  const [portraits, setPortraits] = useState<string[]>([]);
  const [backgrounds, setBackgrounds] = useState<string[]>([]);
  const [outfits, setOutfits] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  // Recovery de gerações órfãs: arquivos no Storage sem linha em portrait_generations.
  // Acontece quando a edge function termina o upload mas a resposta HTTP é cortada
  // antes de retornar o JSON ao cliente. Aqui criamos a linha sem debitar créditos.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: files, error: listErr } = await supabase.storage
          .from("portrait-outputs")
          .list(user.id, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
        if (listErr || !files || cancelled) return;
        // Cada item é uma "pasta" (generation_id). Filtramos só folders.
        const generationFolders = files.filter((f) => f.id === null || (f as any).metadata === null).map((f) => f.name);
        if (generationFolders.length === 0) return;

        const { data: existing } = await supabase
          .from("portrait_generations")
          .select("id")
          .eq("user_id", user.id)
          .in("id", generationFolders);
        const existingSet = new Set((existing || []).map((r: any) => r.id));
        const orphans = generationFolders.filter((id) => !existingSet.has(id));
        if (orphans.length === 0 || cancelled) return;

        for (const generationId of orphans) {
          const { data: imgs } = await supabase.storage
            .from("portrait-outputs")
            .list(`${user.id}/${generationId}`, { limit: 10 });
          const paths = (imgs || [])
            .filter((f) => /\.png$/i.test(f.name))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((f) => `${user.id}/${generationId}/${f.name}`);
          if (paths.length === 0) continue;
          await supabase.from("portrait_generations").insert({
            id: generationId,
            user_id: user.id,
            portraits: paths,
            style_index: 0,
            used_hand_poses: [],
            used_outfits: [],
          });
          console.log(`[portrait-recovery] restored orphan generation=${generationId} files=${paths.length}`);
        }
      } catch (e) {
        console.warn("[portrait-recovery] failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const allOverridesFilled = outfitOverrides.every((s) => s.trim().length > 0);
  const someOverridesFilled = outfitOverrides.some((s) => s.trim().length > 0);

  const totalCredits = (balances?.portrait_credits_included ?? 0) + (balances?.portrait_credits_extra ?? 0);

  const { data: archetypes } = useQuery({
    queryKey: ["top-archetypes", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_top_archetypes")
        .select("archetype_name, rank")
        .eq("user_id", user!.id)
        .order("rank", { ascending: true })
        .limit(3);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: report } = useQuery({
    queryKey: ["report-for-portrait", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reports")
        .select("id, content")
        .eq("user_id", user!.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: latestTraining, refetch: refetchTraining } = useQuery({
    queryKey: ["portrait-training-latest", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("portrait_trainings")
        .select("id, status, trigger_word, created_at, completed_at, error_message, was_free")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    refetchInterval: (q) => {
      const d = q.state.data as any;
      return d?.status === "training" ? 30000 : false;
    },
  });

  const { data: packs } = useQuery({
    queryKey: ["portrait-packs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("portrait_packs")
        .select("*")
        .eq("active", true)
        .order("credits", { ascending: true });
      return data || [];
    },
  });

  const hasPrerequisites = (archetypes?.length ?? 0) > 0 && !!report;
  const trainingStatus = latestTraining?.status as "training" | "ready" | "failed" | "expired" | undefined;
  const hasReadyStudio = trainingStatus === "ready";
  const isTraining = trainingStatus === "training";

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleTrainFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_TRAINING_FILES - trainSelfies.length;
    if (remaining <= 0) {
      toast({ title: `Máximo de ${MAX_TRAINING_FILES} fotos`, variant: "destructive" });
      return;
    }
    const validFiles = Array.from(files).slice(0, remaining);
    const next: typeof trainSelfies = [];
    for (const file of validFiles) {
      if (!file.type.startsWith("image/")) {
        toast({ title: `${file.name} não é uma imagem`, variant: "destructive" });
        continue;
      }
      if (file.size > MAX_SIZE_BYTES) {
        toast({ title: `${file.name} excede ${MAX_SIZE_MB}MB`, variant: "destructive" });
        continue;
      }
      const raw = await fileToBase64(file);
      let base64: string;
      try {
        base64 = await compressImage(raw, 1024, 0.85);
      } catch {
        base64 = raw;
      }
      next.push({ file, preview: URL.createObjectURL(file), base64 });
    }
    setTrainSelfies((prev) => [...prev, ...next]);
  }, [trainSelfies.length, toast]);

  const removeTrainSelfie = (index: number) => {
    setTrainSelfies((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const requestTrain = () => {
    if (trainSelfies.length < MIN_TRAINING_FILES) {
      toast({ title: `Envie ao menos ${MIN_TRAINING_FILES} fotos`, variant: "destructive" });
      return;
    }
    setConfirmTrainOpen(true);
  };

  const submitTraining = async (forcePaid = false) => {
    setConfirmTrainOpen(false);
    setSubmittingTrain(true);
    try {
      const { data, error } = await supabase.functions.invoke("portrait-train", {
        body: { selfies: trainSelfies.map((s) => s.base64), force_paid: forcePaid },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Não foi possível iniciar o treino", description: data.error, variant: "destructive" });
        if (data.needs_credits) setPackDialogOpen(true);
      } else {
        toast({
          title: "Treino iniciado",
          description: data.was_free
            ? "Treino gratuito do mês usado. Aguarde ~20 min."
            : `${TRAIN_COST_CREDITS} créditos debitados. Aguarde ~20 min.`,
        });
        setTrainModalOpen(false);
        setTrainSelfies([]);
        await Promise.all([refreshSubscription(), refetchTraining()]);
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message ?? "Falha ao iniciar treino", variant: "destructive" });
    } finally {
      setSubmittingTrain(false);
    }
  };

  const requestGenerate = () => {
    if (!hasReadyStudio) return;
    if (totalCredits < GENERATE_COST_CREDITS) {
      toast({ title: "Sem créditos suficientes", description: `Geração custa ${GENERATE_COST_CREDITS} créditos.`, variant: "destructive" });
      setPackDialogOpen(true);
      return;
    }
    setConfirmGenerateOpen(true);
  };

  const handleGenerate = async () => {
    setConfirmGenerateOpen(false);
    setGenerating(true);
    setPortraits([]);
    setBackgrounds([]);
    setOutfits([]);

    // Edge function pode levar até ~3min (3 gerações + 3 upscales sequenciais).
    // O cliente padrão da SDK aborta antes — usamos fetch nativo com 240s.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 240000);

    try {
      const body: { outfit_overrides?: string[] } = {};
      if (allOverridesFilled) {
        body.outfit_overrides = outfitOverrides.map((s) => s.trim());
      }

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessão expirada — faça login novamente.");

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-portrait`;
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const data = await res.json().catch(() => ({} as any));
      if (!res.ok || data?.error) {
        const msg = data?.error || `Erro HTTP ${res.status}`;
        toast({ title: "Erro", description: msg, variant: "destructive" });
        if (data?.needs_credits) setPackDialogOpen(true);
        return;
      }
      setPortraits(data.portraits || []);
      setBackgrounds(data.backgrounds || []);
      setOutfits(data.outfits || []);
      await refreshSubscription();
      toast({
        title: "Retratos gerados",
        description: `${data.charged_credits ?? 3} créditos debitados. Salvos no histórico.`,
      });
    } catch (err: any) {
      const isAbort = err?.name === "AbortError";
      toast({
        title: "Erro ao gerar retratos",
        description: isAbort
          ? "A geração demorou mais do que o esperado. Verifique seu histórico — os retratos podem já ter sido salvos."
          : (err?.message ?? "Falha desconhecida"),
        variant: "destructive",
      });
    } finally {
      clearTimeout(timeoutId);
      setGenerating(false);
    }
  };

  const downloadPortrait = async (url: string, index: number) => {
    try {
      await downloadAsBlob(url, `retrato-${backgrounds[index] ?? index + 1}.png`);
      toast({ title: "Download iniciado" });
    } catch (e: any) {
      toast({ title: "Erro ao baixar", description: e?.message, variant: "destructive" });
    }
  };

  const downloadAll = async () => {
    if (portraits.length === 0) return;
    try {
      const zip = new JSZip();
      for (let i = 0; i < portraits.length; i++) {
        const url = portraits[i];
        const blob = url.startsWith("data:")
          ? await (await fetch(url)).blob()
          : await (await fetch(url, { credentials: "omit" })).blob();
        zip.file(`retrato-${backgrounds[i] ?? i + 1}.png`, blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "retratos-de-marca.zip";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e: any) {
      toast({ title: "Erro ao baixar ZIP", description: e?.message, variant: "destructive" });
    }
  };

  const handleBuyPack = async (packId: string) => {
    setLoadingPack(packId);
    try {
      const { data, error } = await supabase.functions.invoke("portrait-pack-checkout", {
        body: { pack_id: packId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) window.location.href = data.url;
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setLoadingPack(null);
  };

  // Cleanup object URLs
  useEffect(() => () => {
    trainSelfies.forEach((s) => URL.revokeObjectURL(s.preview));
  }, []);

  const isMonthlyPlan =
    subscription?.status === "active" &&
    subscription?.plan_slug !== "semana_conteudo";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Retratos de Marca</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Treine um Estúdio Pessoal exclusivo do seu rosto e gere retratos profissionais alinhados ao seu arquétipo.
            </p>
          </div>
          <Dialog open={packDialogOpen} onOpenChange={setPackDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <ShoppingCart className="h-4 w-4" />
                Comprar Retratos
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Pacotes de Retrato</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {(packs || []).map((pack: any) => (
                  <Card key={pack.id} className="border-border/50">
                    <CardContent className="flex items-center justify-between py-4">
                      <div>
                        <p className="font-semibold">{pack.name}</p>
                        <p className="text-sm text-muted-foreground">{pack.credits} retratos</p>
                      </div>
                      <Button size="sm" onClick={() => handleBuyPack(pack.id)} disabled={loadingPack === pack.id}>
                        {loadingPack === pack.id ? <Loader2 className="h-4 w-4 animate-spin" /> : `R$ ${(pack.price_cents / 100).toFixed(0)}`}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Saldo */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Camera className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">Saldo de Retratos</p>
                <p className="text-xs text-muted-foreground">
                  {balances?.portrait_credits_included ?? 0} inclusos · {balances?.portrait_credits_extra ?? 0} extras
                </p>
              </div>
            </div>
            <Badge variant={totalCredits > 0 ? "default" : "destructive"}>
              {totalCredits} disponível{totalCredits !== 1 ? "is" : ""}
            </Badge>
          </CardContent>
        </Card>

        {!hasPrerequisites && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-6">
              <p className="text-sm text-destructive font-medium">
                Para gerar retratos, complete antes:
              </p>
              <ul className="text-sm text-destructive/80 mt-2 list-disc list-inside space-y-1">
                {(archetypes?.length ?? 0) === 0 && <li>Questionário de Arquétipos</li>}
                {!report && <li>Relatório Estratégico</li>}
              </ul>
            </CardContent>
          </Card>
        )}

        {hasPrerequisites && (
          <>
            {/* Estúdio Pessoal */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Estúdio Pessoal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!latestTraining && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Treine um modelo exclusivo do seu rosto a partir de {MIN_TRAINING_FILES}–{MAX_TRAINING_FILES} fotos. O treino leva ~20 minutos e só precisa ser feito uma vez.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isMonthlyPlan
                        ? `Você tem 1 treino grátis por mês no seu plano. Treinos extras custam ${TRAIN_COST_CREDITS} créditos.`
                        : `Cada treino custa ${TRAIN_COST_CREDITS} créditos de retrato.`}
                    </p>
                    <Button onClick={() => setTrainModalOpen(true)} size="lg" className="gap-2">
                      <Wand2 className="h-4 w-4" />
                      Treinar meu Estúdio Pessoal
                    </Button>
                  </div>
                )}

                {isTraining && (
                  <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <p className="font-medium">Estúdio sendo treinado</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Estamos treinando um modelo exclusivo para o seu rosto. O processo leva cerca de 20 minutos. Você pode fechar esta página — vamos atualizar automaticamente quando estiver pronto.
                    </p>
                    <Progress value={undefined} className="animate-pulse" />
                  </div>
                )}

                {trainingStatus === "failed" && (
                  <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <p className="font-medium text-destructive">Treino falhou</p>
                    </div>
                    {latestTraining?.error_message && (
                      <p className="text-xs text-muted-foreground font-mono">{latestTraining.error_message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Os créditos foram reembolsados automaticamente (se aplicável).
                    </p>
                    <Button onClick={() => setTrainModalOpen(true)} variant="outline">
                      Tentar novamente
                    </Button>
                  </div>
                )}

                {hasReadyStudio && (
                  <div className="space-y-3 rounded-lg border border-success/40 bg-success/5 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        <p className="font-medium">Estúdio pronto</p>
                      </div>
                      {latestTraining?.created_at && (
                        <Badge variant="outline" className="text-xs">
                          Treinado em {format(new Date(latestTraining.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Seu Estúdio Pessoal está treinado. Cada geração produz <strong>3 retratos</strong> (Neutro, Claro, Escuro) e custa <strong>{GENERATE_COST_CREDITS} créditos</strong>.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={requestGenerate} disabled={generating || totalCredits < GENERATE_COST_CREDITS} size="lg" className="gap-2">
                        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                        Gerar 3 retratos ({GENERATE_COST_CREDITS} créditos)
                      </Button>
                      <Button onClick={() => setOverridesDialogOpen(true)} variant="outline" size="lg" className="gap-2">
                        <Shirt className="h-4 w-4" />
                        Personalizar figurinos
                        {someOverridesFilled && <Badge variant="secondary" className="ml-1 text-[10px]">{outfitOverrides.filter(s => s.trim()).length}/3</Badge>}
                      </Button>
                      <Button onClick={() => setTrainModalOpen(true)} variant="outline" size="lg">
                        Treinar novo Estúdio
                      </Button>
                    </div>
                    {someOverridesFilled && !allOverridesFilled && (
                      <p className="text-xs text-muted-foreground">
                        Para usar figurinos personalizados, descreva os <strong>3 looks</strong>. Caso contrário, usaremos figurinos curados para o seu arquétipo.
                      </p>
                    )}
                    {allOverridesFilled && (
                      <p className="text-xs text-success">
                        ✓ Figurinos personalizados ativos para a próxima geração.
                      </p>
                    )}
                    {generating && (
                      <div className="space-y-2">
                        <Progress value={undefined} className="animate-pulse" />
                        <p className="text-xs text-muted-foreground">
                          Gerando seus 3 retratos com variação de figurino e iluminação. Isso leva cerca de 1 minuto — não feche esta aba.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Resultados */}
            {portraits.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Retratos Gerados
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={downloadAll}>
                    <Download className="h-4 w-4 mr-1" />
                    Baixar todos (ZIP)
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {portraits.map((portrait, i) => (
                      <div key={i} className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setPreviewIndex(i)}
                          className="group relative aspect-[3/4] w-full rounded-lg overflow-hidden border border-border bg-muted cursor-zoom-in"
                        >
                          <img src={portrait} alt={`Retrato ${backgrounds[i] ?? i + 1}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-background/0 group-hover:bg-background/30 transition-colors flex items-center justify-center">
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm border border-border rounded-full p-2">
                              <Maximize2 className="h-4 w-4" />
                            </div>
                          </div>
                          <div className="absolute top-2 left-2">
                            <Badge variant="secondary" className="capitalize text-xs">{backgrounds[i] ?? `look ${i + 1}`}</Badge>
                          </div>
                        </button>
                        {outfits[i] && (
                          <p className="text-xs text-muted-foreground italic line-clamp-2 px-0.5" title={enToPtFashion(outfits[i])}>
                            {enToPtFashion(outfits[i])}
                          </p>
                        )}
                        <Button variant="outline" size="sm" className="w-full" onClick={() => downloadPortrait(portrait, i)}>
                          <Download className="h-4 w-4 mr-1" />
                          Baixar
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Modal de upload para treino */}
      <Dialog open={trainModalOpen} onOpenChange={(o) => { if (!submittingTrain) setTrainModalOpen(o); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Treinar Estúdio Pessoal</DialogTitle>
            <DialogDescription>
              Envie {MIN_TRAINING_FILES} a {MAX_TRAINING_FILES} fotos do seu rosto, com boa iluminação, ângulos variados e expressões diferentes. Quanto mais fiéis ao seu rosto real, melhor o resultado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Para um Estúdio Pessoal fiel ao seu rosto
              </p>
              <ul className="text-xs text-muted-foreground space-y-1 pl-6 list-disc">
                <li>Fotos com <strong>fundo neutro e limpo</strong> (parede lisa, estúdio caseiro). Evite fotos externas — elas fazem o modelo aprender o cenário.</li>
                <li><strong>Iluminação clara e uniforme</strong>, com o rosto bem visível e em foco.</li>
                <li><strong>Sem óculos escuros, máscara ou chapéu</strong> cobrindo o rosto.</li>
                <li>Variedade de <strong>expressões e ângulos</strong> (frente, perfil leve, sorrindo, sério).</li>
              </ul>
            </div>
            <div
              className="border-2 border-dashed border-primary/20 rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-all"
              onClick={() => fileInputRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); handleTrainFiles(e.dataTransfer.files); }}
              onDragOver={(e) => e.preventDefault()}
            >
              <Upload className="h-10 w-10 text-primary/30 mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground/70">
                Arraste fotos aqui ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {trainSelfies.length}/{MAX_TRAINING_FILES} · Mínimo {MIN_TRAINING_FILES} · Máx {MAX_SIZE_MB}MB cada
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleTrainFiles(e.target.files)}
              />
            </div>

            {trainSelfies.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-64 overflow-y-auto">
                {trainSelfies.map((s, i) => (
                  <div key={i} className="relative group aspect-square rounded-md overflow-hidden border border-border">
                    <img src={s.preview} alt={`Selfie ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeTrainSelfie(i)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p><strong>Custo:</strong> {isMonthlyPlan ? `1 treino grátis por mês no seu plano. Extras custam ${TRAIN_COST_CREDITS} créditos.` : `${TRAIN_COST_CREDITS} créditos de retrato.`}</p>
              <p><strong>Tempo:</strong> ~20 minutos. Você pode fechar a página e voltar depois.</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTrainModalOpen(false)} disabled={submittingTrain}>
                Cancelar
              </Button>
              <Button
                onClick={requestTrain}
                disabled={trainSelfies.length < MIN_TRAINING_FILES || submittingTrain}
              >
                {submittingTrain ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Iniciar treino
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmação de treino */}
      <AlertDialog open={confirmTrainOpen} onOpenChange={setConfirmTrainOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar treino do Estúdio Pessoal</AlertDialogTitle>
            <AlertDialogDescription>
              {isMonthlyPlan
                ? `Se você ainda não usou o treino gratuito deste mês, ele será aplicado automaticamente. Caso contrário, ${TRAIN_COST_CREDITS} créditos de retrato serão debitados.`
                : `${TRAIN_COST_CREDITS} créditos de retrato serão debitados ao iniciar o treino.`}
              <br /><br />
              O treino leva ~20 minutos. Em caso de falha, créditos são reembolsados automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => submitTraining(false)}>Iniciar treino</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação de geração */}
      <AlertDialog open={confirmGenerateOpen} onOpenChange={setConfirmGenerateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar 3 retratos — {GENERATE_COST_CREDITS} créditos</AlertDialogTitle>
            <AlertDialogDescription>
              Vamos gerar 3 retratos (Neutro, Claro, Escuro) usando seu Estúdio Pessoal. Cada um custa 1 crédito.
              <br /><br />
              Saldo atual: <strong>{totalCredits} crédito{totalCredits !== 1 ? "s" : ""}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerate}>Gerar agora</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog: Personalizar figurinos */}
      <Dialog open={overridesDialogOpen} onOpenChange={setOverridesDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shirt className="h-5 w-5" />
              Personalizar figurinos
            </DialogTitle>
            <DialogDescription>
              Descreva os 3 looks que você quer ver nos retratos. Para usar, preencha <strong>os três</strong> — caso contrário, manteremos os figurinos curados para o seu arquétipo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
              <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                O <strong>Look 1</strong> é um close-up (rosto e ombros). Para vestidos, decotes ou peças de corpo inteiro, use os <strong>Looks 2 e 3</strong>.
              </p>
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <Label htmlFor={`outfit-${i}`} className="text-sm">
                  Look {i + 1} {i === 0 ? "(close-up · sem mãos)" : i === 1 ? "(fundo claro)" : "(fundo escuro)"}
                </Label>
                <Textarea
                  id={`outfit-${i}`}
                  placeholder={
                    i === 0
                      ? "Ex: blazer bege oversized com blusa de seda branca"
                      : i === 1
                      ? "Ex: vestido midi terracota com cinto fino de couro"
                      : "Ex: blazer preto alfaiataria com calça pantalona, brincos prata"
                  }
                  value={outfitOverrides[i]}
                  onChange={(e) => {
                    const next = [...outfitOverrides];
                    next[i] = e.target.value;
                    setOutfitOverrides(next);
                  }}
                  className="min-h-[60px] text-sm"
                  maxLength={200}
                />
              </div>
            ))}
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              Dica: descreva em poucas palavras peças, cores e tecidos. Termos em português são traduzidos automaticamente.
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={clearOverrides} disabled={!someOverridesFilled}>
                Limpar
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOverridesDialogOpen(false)}>Cancelar</Button>
                <Button onClick={saveOverrides}>Salvar</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PortraitPreviewDialog
        open={previewIndex !== null}
        onOpenChange={(o) => !o && setPreviewIndex(null)}
        portraits={portraits}
        index={previewIndex ?? 0}
        onIndexChange={(i) => setPreviewIndex(i)}
        onDownload={(url, i) => downloadPortrait(url, i)}
        downloadHint="Salvo no histórico · Download gratuito"
        downloadLabel="Baixar"
      />
    </DashboardLayout>
  );
};

export default PortraitGenerator;
