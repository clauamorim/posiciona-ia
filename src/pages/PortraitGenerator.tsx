import { useState, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Upload, X, Download, Loader2, ImageIcon, PackageOpen, ShoppingCart, Camera } from "lucide-react";
import JSZip from "jszip";
import { compressImage } from "@/lib/imageUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const MAX_FILES = 5;
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const PortraitGenerator = () => {
  const { user, balances, subscription, refreshSubscription } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selfies, setSelfies] = useState<{ file: File; preview: string; base64: string }[]>([]);
  const [portraits, setPortraits] = useState<string[]>([]);
  const [portraitStyleIndex, setPortraitStyleIndex] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [confirmingDownload, setConfirmingDownload] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 1 });
  const [packDialogOpen, setPackDialogOpen] = useState(false);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [selectedWardrobe, setSelectedWardrobe] = useState(0);

  const totalCredits = (balances?.portrait_credits_included ?? 0) + (balances?.portrait_credits_extra ?? 0);

  // Check prerequisites
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
        .single();
      return data;
    },
    enabled: !!user,
  });

  const figurino = (report?.content as any)?.figurino;
  const wardrobeOptions = figurino?.pecas_chave?.length > 0
    ? Array.from({ length: Math.min(Math.ceil((figurino.pecas_chave?.length || 0) / 2), 3) }, (_, i) => ({
        label: `Look ${i + 1}`,
        variation: i,
      }))
    : [{ label: "Padrão", variation: 0 }];

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

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_FILES - selfies.length;
    if (remaining <= 0) {
      toast({ title: `Máximo de ${MAX_FILES} imagens`, variant: "destructive" });
      return;
    }

    const validFiles = Array.from(files).slice(0, remaining);
    const newSelfies: typeof selfies = [];

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
        base64 = await compressImage(raw, 1024, 0.8);
      } catch {
        base64 = raw;
      }
      newSelfies.push({ file, preview: URL.createObjectURL(file), base64 });
    }

    setSelfies(prev => [...prev, ...newSelfies]);
  }, [selfies.length, toast]);

  const removeSelfie = (index: number) => {
    setSelfies(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleGenerate = async () => {
    if (selfies.length === 0) return;

    if (totalCredits <= 0) {
      toast({ title: "Sem créditos de retrato", description: "Compre um pacote de retratos para continuar.", variant: "destructive" });
      setPackDialogOpen(true);
      return;
    }

    setGenerating(true);
    setPortraits([]);
    setProgress({ current: 0, total: 1 });

    try {
      const { data, error } = await supabase.functions.invoke("generate-portrait", {
        body: { selfies: selfies.map(s => s.base64), wardrobeVariation: selectedWardrobe },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        if (data.portrait) {
          setPortraits([data.portrait]);
        }
      } else {
        const portrait = data.portrait;
        if (portrait) {
          setPortraits([portrait]);
          setPortraitStyleIndex(data.style_index ?? null);
          toast({ title: "Retrato gerado! Baixe para salvar e debitar o crédito." });
        } else {
          toast({ title: "Nenhum retrato foi gerado", variant: "destructive" });
        }
      }

      // Do NOT refresh balances here — credits are only deducted on download
    } catch (err: any) {
      console.error("Generate error:", err);
      toast({ title: "Erro ao gerar retrato", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const downloadPortrait = async (base64Url: string, index: number) => {
    setConfirmingDownload(true);
    try {
      const { data, error } = await supabase.functions.invoke("confirm-portrait", {
        body: { portrait: base64Url, style_index: portraitStyleIndex },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const link = document.createElement("a");
      link.href = base64Url;
      link.download = `retrato-marca-${index + 1}.png`;
      link.click();

      await refreshSubscription();
      toast({ title: "Retrato salvo e crédito debitado!" });
    } catch (err: any) {
      toast({ title: "Erro ao confirmar retrato", description: err.message, variant: "destructive" });
    }
    setConfirmingDownload(false);
  };

  const downloadAll = async () => {
    if (portraits.length === 0) return;
    const zip = new JSZip();
    for (let i = 0; i < portraits.length; i++) {
      const base64Data = portraits[i].replace(/^data:image\/\w+;base64,/, "");
      zip.file(`retrato-marca-${i + 1}.png`, base64Data, { base64: true });
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "retratos-de-marca.zip";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const handleBuyPack = async (packId: string) => {
    setLoadingPack(packId);
    try {
      const { data, error } = await supabase.functions.invoke("portrait-pack-checkout", {
        body: { pack_id: packId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setLoadingPack(null);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Retratos de Marca</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Faça upload de selfies e gere retratos profissionais alinhados à sua identidade.
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
                {(packs || []).map((pack: any) => {
                  const planSlug = subscription?.plan_slug || "semana_conteudo";
                  const hasDiscount = planSlug !== "semana_conteudo";
                  let priceCents = pack.price_cents;
                  if (pack.stripe_price_ids && typeof pack.stripe_price_ids === "object") {
                    if (pack.credits === 5) {
                      if (planSlug === "presenca_mensal") priceCents = 6400;
                      else if (planSlug === "autoridade_total") priceCents = 5900;
                    } else if (pack.credits === 10) {
                      if (planSlug === "presenca_mensal") priceCents = 10900;
                      else if (planSlug === "autoridade_total") priceCents = 9900;
                    } else if (pack.credits === 15) {
                      if (planSlug === "presenca_mensal") priceCents = 15400;
                      else if (planSlug === "autoridade_total") priceCents = 13900;
                    }
                  }
                  const showDiscount = hasDiscount && priceCents < pack.price_cents;
                  return (
                    <Card key={pack.id} className="border-border/50">
                      <CardContent className="flex items-center justify-between py-4">
                        <div>
                          <p className="font-semibold">{pack.name}</p>
                          <p className="text-sm text-muted-foreground">{pack.credits} retratos</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <span className="font-bold">R$ {(priceCents / 100).toFixed(0)}</span>
                            {showDiscount && (
                              <span className="text-xs text-muted-foreground line-through ml-1.5">R$ {(pack.price_cents / 100).toFixed(0)}</span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleBuyPack(pack.id)}
                            disabled={loadingPack === pack.id}
                          >
                            {loadingPack === pack.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Comprar"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Credit info */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Camera className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">Saldo de Retratos</p>
                <p className="text-xs text-muted-foreground">
                  {balances?.portrait_credits_included ?? 0} inclusos no plano • {balances?.portrait_credits_extra ?? 0} extras comprados
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
                ⚠️ Para gerar retratos, você precisa ter completado:
              </p>
              <ul className="text-sm text-destructive/80 mt-2 list-disc list-inside space-y-1">
                {(archetypes?.length ?? 0) === 0 && <li>Questionário de Arquétipos</li>}
                {!report && <li>Relatório Estratégico (Análise)</li>}
              </ul>
            </CardContent>
          </Card>
        )}

        {hasPrerequisites && (
          <>
            {/* Upload Area */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload de Selfies
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  className="border-2 border-dashed border-primary/20 rounded-xl p-10 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/[0.02] transition-all"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <Upload className="h-12 w-12 text-primary/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground/70">
                    Arraste selfies aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Selfies de rosto bem iluminadas · 1 a {MAX_FILES} imagens · Máx {MAX_SIZE_MB}MB cada
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </div>

                {selfies.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {selfies.map((s, i) => (
                      <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                        <img src={s.preview} alt={`Selfie ${i + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeSelfie(i)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Wardrobe selector */}
                {wardrobeOptions.length > 1 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Opção de figurino</label>
                    <div className="flex gap-2 flex-wrap">
                      {wardrobeOptions.map((opt, i) => (
                        <Button
                          key={i}
                          variant={selectedWardrobe === opt.variation ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedWardrobe(opt.variation)}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Cada look usa peças e acessórios diferentes do seu figurino estratégico.
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleGenerate}
                  disabled={selfies.length === 0 || generating || totalCredits <= 0}
                  className="w-full"
                  size="lg"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Gerando retrato...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-4 w-4" />
                      Gerar 1 Retrato (1 crédito)
                    </>
                  )}
                </Button>

                {totalCredits <= 0 && (
                  <p className="text-sm text-center text-destructive">
                    Você não tem créditos de retrato.{" "}
                    <button className="underline" onClick={() => setPackDialogOpen(true)}>
                      Compre um pacote
                    </button>
                  </p>
                )}

                {generating && (
                  <div className="space-y-2">
                    <Progress value={undefined} className="animate-pulse" />
                    <p className="text-xs text-center text-muted-foreground">
                      Gerando retrato com estilo de marca... Isso pode levar alguns segundos.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Generated Portraits */}
            {portraits.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Retrato Gerado
                  </CardTitle>
                  {portraits.length > 1 && (
                    <Button variant="outline" size="sm" onClick={downloadAll}>
                      <PackageOpen className="h-4 w-4 mr-1" />
                      Baixar Todos (ZIP)
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {portraits.map((portrait, i) => (
                      <div key={i} className="space-y-2">
                        <div className="aspect-square rounded-lg overflow-hidden border border-border bg-muted">
                          <img
                            src={portrait}
                            alt={`Retrato ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => downloadPortrait(portrait, i)}
                          disabled={confirmingDownload}
                        >
                          {confirmingDownload ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                          {confirmingDownload ? "Salvando..." : `Baixar Retrato ${i + 1}`}
                        </Button>
                        <p className="text-[10px] text-muted-foreground text-center">1 crédito será debitado ao baixar</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PortraitGenerator;
