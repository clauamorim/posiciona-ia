import { useState, useRef, useCallback } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { Upload, X, Download, Loader2, ImageIcon, PackageOpen } from "lucide-react";
import JSZip from "jszip";

const MAX_FILES = 5;
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

const PortraitGenerator = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selfies, setSelfies] = useState<{ file: File; preview: string; base64: string }[]>([]);
  const [portraits, setPortraits] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

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
    queryKey: ["report-check", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("reports")
        .select("id")
        .eq("user_id", user!.id)
        .eq("status", "completed")
        .limit(1)
        .single();
      return data;
    },
    enabled: !!user,
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
      const base64 = await fileToBase64(file);
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
    setGenerating(true);
    setPortraits([]);
    setProgress({ current: 0, total: selfies.length });

    try {
      const { data, error } = await supabase.functions.invoke("generate-portrait", {
        body: { selfies: selfies.map(s => s.base64) },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: "Erro", description: data.error, variant: "destructive" });
        // Still show any partial results
        if (data.portraits?.length) {
          setPortraits(data.portraits.filter((p: string) => p));
        }
      } else {
        const validPortraits = (data.portraits || []).filter((p: string) => p);
        setPortraits(validPortraits);
        if (validPortraits.length > 0) {
          toast({ title: `${validPortraits.length} retrato(s) gerado(s) com sucesso!` });
        } else {
          toast({ title: "Nenhum retrato foi gerado", variant: "destructive" });
        }
      }
    } catch (err: any) {
      console.error("Generate error:", err);
      toast({ title: "Erro ao gerar retratos", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  const downloadPortrait = (base64Url: string, index: number) => {
    const link = document.createElement("a");
    link.href = base64Url;
    link.download = `retrato-marca-${index + 1}.png`;
    link.click();
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-display text-foreground">Retratos de Marca</h1>
          <p className="text-muted-foreground mt-1">
            Faça upload de selfies e gere retratos profissionais alinhados à sua identidade de marca.
          </p>
        </div>

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
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <ImageIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Arraste selfies aqui ou clique para selecionar
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    1 a {MAX_FILES} imagens • Máx {MAX_SIZE_MB}MB cada
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

                <Button
                  onClick={handleGenerate}
                  disabled={selfies.length === 0 || generating}
                  className="w-full"
                  size="lg"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Gerando retrato {progress.current} de 5...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-4 w-4" />
                      Gerar 5 Retratos
                    </>
                  )}
                </Button>

                {generating && (
                  <div className="space-y-2">
                    <Progress value={undefined} className="animate-pulse" />
                    <p className="text-xs text-center text-muted-foreground">
                      Gerando 5 retratos com variações de estilo... Isso pode levar alguns minutos.
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
                    Retratos Gerados
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
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Baixar Retrato {i + 1}
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
    </DashboardLayout>
  );
};

export default PortraitGenerator;
