import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Layers, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ARCHETYPE_MAP } from "@/lib/archetypes";

interface GlobalTemplate {
  id: string;
  title: string;
  thumbnail: string | null;
  week_index: number | null;
  day_index: number | null;
  archetype: string | null;
  is_global: boolean;
  is_template: boolean;
  updated_at: string;
}

const ARCHETYPES = Object.keys(ARCHETYPE_MAP);

export default function AdminTemplates() {
  const navigate = useNavigate();
  const [items, setItems] = useState<GlobalTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [createArchetype, setCreateArchetype] = useState<string>(ARCHETYPES[0]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("user_designs")
      .select("id, title, thumbnail, week_index, day_index, archetype, is_global, is_template, updated_at")
      .eq("is_template", true)
      .eq("is_global", true)
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar templates", description: error.message, variant: "destructive" });
    } else {
      setItems((data as GlobalTemplate[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = () => {
    const params = new URLSearchParams();
    params.set("week", "0");
    params.set("day", "0");
    params.set("adminTemplate", "1");
    params.set("archetype", createArchetype);
    navigate(`/post-editor?${params.toString()}`);
  };

  const handleOpen = (t: GlobalTemplate) => {
    const params = new URLSearchParams();
    params.set("week", String(t.week_index ?? 0));
    params.set("day", String(t.day_index ?? 0));
    params.set("design", t.id);
    params.set("fromTemplate", "1");
    navigate(`/post-editor?${params.toString()}`);
  };

  const toggleActive = async (t: GlobalTemplate) => {
    // "Ativar/Desativar" alterna is_global. Quando desativado, o template
    // deixa de aparecer para os usuários comuns mas continua salvo.
    const { error } = await supabase
      .from("user_designs")
      .update({ is_global: !t.is_global })
      .eq("id", t.id);
    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: t.is_global ? "Template desativado" : "Template ativado" });
      fetchAll();
    }
  };

  const handleDelete = async (t: GlobalTemplate) => {
    const { error } = await supabase.from("user_designs").delete().eq("id", t.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      setItems((prev) => prev.filter((x) => x.id !== t.id));
      toast({ title: "Template excluído" });
    }
  };

  const filtered = filter === "all" ? items : items.filter((t) => (t.archetype || "Sem arquétipo") === filter);

  return (
    <DashboardLayout wide>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <Layers className="h-5 w-5 text-muted-foreground" /> Templates Globais
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Modelos visíveis a todos os usuários autenticados em "Meus modelos".
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Arquétipo do novo template</Label>
              <Select value={createArchetype} onValueChange={setCreateArchetype}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ARCHETYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate}><Plus className="h-4 w-4 mr-1" /> Criar template global</Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground">Filtrar por arquétipo</Label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ARCHETYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              <SelectItem value="Sem arquétipo">Sem arquétipo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5] w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Layers className="h-12 w-12 mx-auto opacity-40" />
            <p className="text-sm mt-3">Nenhum template global ainda. Use "Criar template global" acima.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((t) => (
              <Card key={t.id} className="overflow-hidden">
                <button onClick={() => handleOpen(t)} className="block w-full aspect-[4/5] bg-muted relative">
                  {t.thumbnail ? (
                    <img src={t.thumbnail} alt={t.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                      <Layers className="h-8 w-8" />
                    </div>
                  )}
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-primary/90 text-primary-foreground text-[10px] font-semibold uppercase tracking-wider">
                    {t.archetype || "Neutro"}
                  </span>
                  {!t.is_global && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-muted text-foreground text-[10px] font-semibold uppercase tracking-wider">
                      Inativo
                    </span>
                  )}
                </button>
                <CardContent className="p-3 space-y-2">
                  <p className="text-sm font-medium truncate">{t.title}</p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={t.is_global} onCheckedChange={() => toggleActive(t)} />
                      <span className="text-[11px] text-muted-foreground">Ativo</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleOpen(t)} aria-label="Editar">
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Excluir">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir template global?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. O template deixará de aparecer para todos os usuários.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(t)}>Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
