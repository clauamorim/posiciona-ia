import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Layers, Trash2, Copy, Pencil } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UserDesign {
  id: string;
  title: string;
  thumbnail: string | null;
  week_index: number | null;
  day_index: number | null;
  state: any;
  updated_at: string;
  created_at: string;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

function bucketLabel(iso: string): "Hoje" | "Esta semana" | "Mais antigos" {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return "Hoje";
  const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 7) return "Esta semana";
  return "Mais antigos";
}

const MyDesignsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [designs, setDesigns] = useState<UserDesign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDesigns = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("user_designs")
      .select("id, title, thumbnail, week_index, day_index, state, updated_at, created_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar designs", description: error.message, variant: "destructive" });
    } else {
      setDesigns((data as UserDesign[]) || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchDesigns(); }, [fetchDesigns]);

  const handleOpen = (d: UserDesign) => {
    const w = d.week_index ?? 0;
    const day = d.day_index ?? 0;
    navigate(`/post-editor?week=${w}&day=${day}&design=${d.id}`);
  };

  const handleDuplicate = async (d: UserDesign) => {
    if (!user) return;
    try {
      const { error } = await supabase.from("user_designs").insert({
        user_id: user.id,
        title: `${d.title} (cópia)`,
        thumbnail: d.thumbnail,
        week_index: d.week_index,
        day_index: d.day_index,
        state: d.state,
      });
      if (error) throw error;
      toast({ title: "Design duplicado" });
      fetchDesigns();
    } catch (err: any) {
      toast({ title: "Erro ao duplicar", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (d: UserDesign) => {
    try {
      const { error } = await supabase.from("user_designs").delete().eq("id", d.id);
      if (error) throw error;
      setDesigns((prev) => prev.filter((x) => x.id !== d.id));
      toast({ title: "Design excluído" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const groups: Record<string, UserDesign[]> = { "Hoje": [], "Esta semana": [], "Mais antigos": [] };
  designs.forEach((d) => groups[bucketLabel(d.updated_at)].push(d));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" /> Meus Designs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Suas artes salvas, prontas para retomar.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-square w-full" />)}
          </div>
        ) : designs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Layers className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Nenhum design salvo ainda.</p>
            <p className="text-xs mt-1">Edite um post na Linha Editorial e use "Salvar design".</p>
          </div>
        ) : (
          <div className="space-y-8">
            {(Object.keys(groups) as Array<keyof typeof groups>).map((label) => {
              const items = groups[label];
              if (items.length === 0) return null;
              return (
                <section key={label}>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-3">{label}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {items.map((d) => (
                      <Card key={d.id} className="overflow-hidden group">
                        <button onClick={() => handleOpen(d)} className="block w-full aspect-square bg-muted relative">
                          {d.thumbnail ? (
                            <img src={d.thumbnail} alt={d.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                              <Layers className="h-8 w-8" />
                            </div>
                          )}
                        </button>
                        <CardContent className="p-3 space-y-2">
                          <div>
                            <p className="text-sm font-medium truncate">{d.title}</p>
                            <p className="text-[11px] text-muted-foreground">{relTime(d.updated_at)}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" className="flex-1 h-7 text-[11px] gap-1" onClick={() => handleOpen(d)}>
                              <Pencil className="h-3 w-3" /> Abrir
                            </Button>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleDuplicate(d)} aria-label="Duplicar">
                              <Copy className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Excluir">
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir design?</AlertDialogTitle>
                                  <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDelete(d)}>Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MyDesignsPage;
