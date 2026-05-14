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
import { Upload, X, Download, Loader2, ImageIcon, ShoppingCart, Camera, Maximize2, Sparkles, Trash2 } from "lucide-react";
import JSZip from "jszip";
import { compressImage } from "@/lib/imageUtils";
import { PortraitPreviewDialog } from "@/components/PortraitPreviewDialog";
import { downloadAsBlob } from "@/lib/portraitUrl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

const MAX_REFERENCES = 5;
const MIN_REFERENCES = 3;
const MAX_SIZE_MB = 6;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const GENERATE_COST_CREDITS = 3;

interface PortraitReference {
  id: string;
  file_path: string;
  position: number;
  created_at: string;
  preview_url: string | null;
}

const PortraitGenerator = () => {
  const { user, balances, refreshSubscription } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadingRef, setUploadingRef] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [confirmGenerateOpen, setConfirmGenerateOpen] = useState(false);
  const [portraits, setPortraits] = useState<string[]>([]);
  const [backgrounds, setBackgrounds] = useState<string[]>([]);
  const [originalIndices, setOriginalIndices] = useState<number[]>([]);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [discardingIndex, setDiscardingIndex] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [hydratedFromHistory, setHydratedFromHistory] = useState(false);

  // Rehydrate the last generation when the page mounts.
  // The edge function persists portraits atomically; if the user navigated away
  // during generation, we recover the result from the database here.
  useEffect(() => {
    if (!user || hydratedFromHistory || generating || portraits.length > 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("portrait_generations")
        .select("id, portraits, kept_indices, status, created_at")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) { setHydratedFromHistory(true); return; }
      const all = Array.isArray(data.portraits) ? (data.portraits as any[]) : [];
      // Respect discarded items
      const kept = Array.isArray(data.kept_indices) ? data.kept_indices as number[] : null;
      const indices = kept ? kept : all.map((_, i) => i);
      const items = indices.map((i) => all[i]).filter(Boolean);
      if (items.length === 0) { setHydratedFromHistory(true); return; }
      setPortraits(items.map((p: any) => p.url));
      setBackgrounds(items.map((p: any) => p.background ?? ""));
      setOriginalIndices(indices);
      setGenerationId(data.id);
      setHydratedFromHistory(true);
    })();
    return () => { cancelled = true; };
  }, [user, hydratedFromHistory, generating, portraits.length]);


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

  // Carrega selfies de referência via edge function (signed URLs)
  const { data: referencesData, refetch: refetchReferences } = useQuery({
    queryKey: ["portrait-references", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("portrait-references", {
        method: "GET",
      });
      if (error) throw error;
      return (data?.references ?? []) as PortraitReference[];
    },
    enabled: !!user,
  });

  const references: PortraitReference[] = referencesData ?? [];

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
  const hasEnoughReferences = references.length >= MIN_REFERENCES;

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleReferenceUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (references.length >= MAX_REFERENCES) {
      toast({ title: `Máximo de ${MAX_REFERENCES} referências`, variant: "destructive" });
      return;
    }
    setUploadingRef(true);
    try {
      const remaining = MAX_REFERENCES - references.length;
      const validFiles = Array.from(files).slice(0, remaining);
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
          base64 = await compressImage(raw, 1280, 0.9);
        } catch {
          base64 = raw;
        }
        const { data, error } = await supabase.functions.invoke("portrait-references", {
          method: "POST",
          body: { base64 },
        });
        if (error) {
          toast({ title: `Falha ao enviar ${file.name}`, description: error.message, variant: "destructive" });
          continue;
        }
        if (data?.error) {
          toast({ title: `Falha ao enviar ${file.name}`, description: data.error, variant: "destructive" });
          continue;
        }
      }
      await refetchReferences();
    } finally {
      setUploadingRef(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [references.length, refetchReferences, toast]);

  const removeReference = async (id: string) => {
    try {
      const { error } = await supabase.functions.invoke("portrait-references", {
        method: "DELETE",
        body: { id },
      });
      if (error) throw error;
      await refetchReferences();
    } catch (e: any) {
      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" });
    }
  };

  const requestedCount = Math.min(totalCredits, GENERATE_COST_CREDITS);

  const requestGenerate = () => {
    if (!hasEnoughReferences) {
      toast({
        title: "Envie suas referências",
        description: `Adicione ao menos ${MIN_REFERENCES} selfies de referência.`,
        variant: "destructive",
      });
      return;
    }
    if (totalCredits < 1) {
      toast({ title: "Sem créditos suficientes", description: "Você precisa de pelo menos 1 crédito de retrato.", variant: "destructive" });
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
    setOriginalIndices([]);
    setGenerationId(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-portrait", {
        body: {},
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        if (data.needs_credits) setPackDialogOpen(true);
        return;
      }

      const generated: Array<{ url: string; background: string }> = data?.portraits ?? [];
      if (generated.length === 0) {
        toast({ title: "Nenhum retrato foi gerado", variant: "destructive" });
        return;
      }

      setPortraits(generated.map((g) => g.url));
      setBackgrounds(generated.map((g) => g.background));
      setOriginalIndices(generated.map((_, i) => i));
      setGenerationId(data?.generation_id ?? null);
      await refreshSubscription();

      toast({
        title: "Retratos prontos",
        description: `${generated.length} retrato${generated.length > 1 ? "s" : ""} gerado${generated.length > 1 ? "s" : ""} com fidelidade premium.`,
      });
    } catch (err: any) {
      toast({
        title: "Erro ao gerar retratos",
        description: err?.message ?? "Falha desconhecida",
        variant: "destructive",
      });
    } finally {
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

  const handleDiscard = async (index: number) => {
    const removeLocal = () => {
      setPortraits((prev) => prev.filter((_, i) => i !== index));
      setBackgrounds((prev) => prev.filter((_, i) => i !== index));
      setOriginalIndices((prev) => prev.filter((_, i) => i !== index));
      if (previewIndex !== null) setPreviewIndex(null);
    };
    if (!generationId) {
      removeLocal();
      return;
    }
    if (!confirm("Descartar este retrato do histórico? Essa ação não pode ser desfeita.")) return;
    const originalIdx = originalIndices[index];
    if (originalIdx === undefined) {
      removeLocal();
      return;
    }
    setDiscardingIndex(index);
    try {
      const { data, error } = await supabase.functions.invoke("portrait-discard", {
        body: { generation_id: generationId, index: originalIdx },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      removeLocal();
      toast({ title: "Retrato removido do histórico" });
    } catch (e: any) {
      toast({ title: "Erro ao descartar", description: e?.message, variant: "destructive" });
    } finally {
      setDiscardingIndex(null);
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Retratos de Marca</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Envie suas selfies de referência e gere retratos editoriais alinhados ao seu arquétipo, com identidade preservada.
          </p>
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
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                  Inclusos renovam mensalmente. Extras não expiram.
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
            {/* Suas Referências */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Suas referências
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Envie de <strong>{MIN_REFERENCES} a {MAX_REFERENCES} selfies nítidas</strong> (frontal, lateral leve, sorrindo) com luz natural e fundo neutro. Elas guiam a fidelidade do seu rosto em cada geração — sem treino, sem espera. Ficam guardadas e são reutilizadas em todas as próximas gerações.
                </p>
                <p className="text-sm text-muted-foreground">
                  Para melhores resultados: use fotos com iluminação frontal uniforme (sem sombras duras no rosto), uma foto de frente, uma de 3/4 e uma de perfil leve. Rosto deve ocupar ao menos 60% do frame. Sem filtros, sem óculos escuros, boa resolução.
                </p>

                {/* Grid de referências */}
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                  {references.map((ref) => (
                    <div key={ref.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                      {ref.preview_url ? (
                        <img src={ref.preview_url} alt="Referência" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      <button
                        onClick={() => removeReference(ref.id)}
                        className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remover referência"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}

                  {references.length < MAX_REFERENCES && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingRef}
                      className="aspect-square rounded-lg border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/[0.03] transition-all flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploadingRef ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-primary/60" />
                          <span>Adicionar</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleReferenceUpload(e.target.files)}
                />

                <p className="text-xs text-muted-foreground">
                  {references.length}/{MAX_REFERENCES} referências · Mínimo {MIN_REFERENCES} · Máx {MAX_SIZE_MB}MB cada
                </p>
              </CardContent>
            </Card>

            {/* Gerar Retratos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  Gerar retratos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Cada geração entrega até <strong>3 retratos</strong> (Neutro, Claro, Escuro) com variação de figurino e iluminação. <strong>1 crédito por retrato</strong> — só cobramos os que ficam prontos.
                </p>
                <Button
                  onClick={requestGenerate}
                  disabled={generating || totalCredits < 1 || !hasEnoughReferences}
                  size="lg"
                  className="gap-2"
                >
                  {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  {!hasEnoughReferences
                    ? `Envie ao menos ${MIN_REFERENCES} referências`
                    : requestedCount > 0
                      ? `Gerar ${requestedCount} retrato${requestedCount > 1 ? "s" : ""} (${requestedCount} crédito${requestedCount > 1 ? "s" : ""})`
                      : "Sem créditos disponíveis"}
                </Button>
                {generating && (
                  <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                    <Progress value={undefined} className="animate-pulse" />
                    <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                      Não saia desta janela.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Gerando seu{requestedCount > 1 ? "s" : ""} {requestedCount} retrato{requestedCount > 1 ? "s" : ""}. Leva cerca de 1 minuto — mantenha esta aba aberta até concluir.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Comprar Retratos */}
            <div className="flex justify-center">
              <Dialog open={packDialogOpen} onOpenChange={setPackDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 text-muted-foreground hover:text-foreground border-border/60">
                    <ShoppingCart className="h-3.5 w-3.5" />
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
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" size="sm" onClick={() => downloadPortrait(portrait, i)}>
                            <Download className="h-4 w-4 mr-1" />
                            Baixar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDiscard(i)}
                            disabled={discardingIndex === i}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            {discardingIndex === i ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 mr-1" />
                            )}
                            Descartar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Confirmação de geração */}
      <AlertDialog open={confirmGenerateOpen} onOpenChange={setConfirmGenerateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Gerar {requestedCount} retrato{requestedCount > 1 ? "s" : ""} — {requestedCount} crédito{requestedCount > 1 ? "s" : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vamos gerar {requestedCount} retrato{requestedCount > 1 ? "s" : ""} a partir das suas referências. Cada um custa 1 crédito — só cobramos os que ficam prontos.
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

      <PortraitPreviewDialog
        open={previewIndex !== null}
        onOpenChange={(o) => !o && setPreviewIndex(null)}
        portraits={portraits}
        index={previewIndex ?? 0}
        onIndexChange={(i) => setPreviewIndex(i)}
        onDownload={(url, i) => downloadPortrait(url, i)}
        downloadHint="Salvo no histórico · Você pode descartar a qualquer momento"
        downloadLabel="Baixar"
      />
    </DashboardLayout>
  );
};

export default PortraitGenerator;
