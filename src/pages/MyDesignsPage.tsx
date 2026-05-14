import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SeoHead } from "@/components/SeoHead";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Layers, Trash2, Copy, Pencil, AlertTriangle, BookmarkPlus } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { isOutdated } from "@/lib/generatorVersion";

interface UserDesign {
  id: string;
  title: string;
  thumbnail: string | null;
  week_index: number | null;
  day_index: number | null;
  state: any;
  is_template: boolean;
  is_global?: boolean;
  archetype?: string | null;
  user_id?: string;
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
  const [allWeeks, setAllWeeks] = useState<any[][]>([]);

  const fetchDesigns = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [ownRes, globalRes, reportRes] = await Promise.all([
      supabase
        .from("user_designs")
        .select("id, title, thumbnail, week_index, day_index, state, is_template, is_global, archetype, user_id, updated_at, created_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      supabase
        .from("user_designs")
        .select("id, title, thumbnail, week_index, day_index, state, is_template, is_global, archetype, user_id, updated_at, created_at")
        .eq("is_template", true)
        .eq("is_global", true)
        .order("updated_at", { ascending: false }),
      supabase.from("reports").select("content, editorial_weeks")
        .eq("user_id", user.id).eq("status", "completed")
        .order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (ownRes.error) {
      toast({ title: "Erro ao carregar designs", description: ownRes.error.message, variant: "destructive" });
    } else {
      const own = (ownRes.data as UserDesign[]) || [];
      const globals = ((globalRes.data as UserDesign[]) || []).filter((g) => g.user_id !== user.id);
      setDesigns([...own, ...globals]);
    }
    const structured = (reportRes.data?.content as any)?.editorial;
    const structuredArr = Array.isArray(structured) ? structured : [];
    const weeks: any[][] = Array.isArray(reportRes.data?.editorial_weeks) ? reportRes.data!.editorial_weeks as any[][] : [];
    setAllWeeks([...(structuredArr.length > 0 ? [structuredArr] : []), ...weeks]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchDesigns(); }, [fetchDesigns]);

  const isDesignStale = (d: UserDesign): boolean => {
    if (d.is_template) return false;
    if (d.week_index == null || d.day_index == null) return false;
    const week = allWeeks[d.week_index];
    if (!week) return false;
    const day = week[d.day_index];
    if (!day) return false;
    if (isOutdated(day)) return false;
    const designCreated = new Date(d.created_at).getTime();
    const versionEpoch = new Date("2026-04-23T00:00:00Z").getTime();
    return designCreated < versionEpoch;
  };

  const handleOpen = (d: UserDesign) => {
    const w = d.week_index ?? 0;
    const day = d.day_index ?? 0;
    const params = new URLSearchParams();
    params.set("week", String(w));
    params.set("day", String(day));
    params.set("design", d.id);
    if (d.is_template) params.set("fromTemplate", "1");
    navigate(`/post-editor?${params.toString()}`);
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
        is_template: d.is_template,
      });
      if (error) throw error;
      toast({ title: d.is_template ? "Modelo duplicado" : "Design duplicado" });
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
      toast({ title: d.is_template ? "Modelo excluído" : "Design excluído" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    }
  };

  const renderDesignCard = (d: UserDesign) => {
    const stale = isDesignStale(d);
    const isGlobal = !!d.is_global && d.user_id !== user?.id;
    return (
      <Card key={d.id} className="overflow-hidden group">
        <button onClick={() => handleOpen(d)} className="block w-full aspect-[4/5] bg-muted relative">
          {d.thumbnail ? (
            <img src={d.thumbnail} alt={d.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
              <Layers className="h-8 w-8" />
            </div>
          )}
          {d.is_template && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-primary/90 text-primary-foreground text-[10px] font-semibold uppercase tracking-wider">
              {isGlobal ? "Posiciona" : "Modelo"}
            </span>
          )}
          {isGlobal && d.archetype && (
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-background/90 text-foreground text-[10px] font-semibold uppercase tracking-wider">
              {d.archetype}
            </span>
          )}
        </button>
        <CardContent className="p-3 space-y-2">
          <div>
            <p className="text-sm font-medium truncate">{d.title}</p>
            <p className="text-[11px] text-muted-foreground">{relTime(d.updated_at)}</p>
          </div>
          {stale && (
            <div className="flex items-start gap-1.5 rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-2 py-1.5">
              <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-[10px] text-amber-900 dark:text-amber-200 leading-snug">
                O conteúdo-base foi atualizado. Reabra para ver as melhorias na cópia.
              </p>
            </div>
          )}
          <div className="flex gap-1">
            <Button variant="outline" size="sm" className="flex-1 h-7 text-[11px] gap-1" onClick={() => handleOpen(d)}>
              <Pencil className="h-3 w-3" /> {d.is_template ? "Usar" : "Abrir"}
            </Button>
            {!isGlobal && (
              <>
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
                      <AlertDialogTitle>{d.is_template ? "Excluir modelo?" : "Excluir design?"}</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(d)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderList = (items: UserDesign[], emptyHint: string, emptyIcon: JSX.Element) => {
    if (loading) {
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5] w-full" />)}
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div className="text-center py-16 text-muted-foreground">
          {emptyIcon}
          <p className="text-sm mt-3">{emptyHint}</p>
        </div>
      );
    }
    const groups: Record<string, UserDesign[]> = { "Hoje": [], "Esta semana": [], "Mais antigos": [] };
    items.forEach((d) => groups[bucketLabel(d.updated_at)].push(d));
    return (
      <div className="space-y-8">
        {(Object.keys(groups) as Array<keyof typeof groups>).map((label) => {
          const group = groups[label];
          if (group.length === 0) return null;
          return (
            <section key={label}>
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-3">{label}</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {group.map(renderDesignCard)}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  const designsOnly = designs.filter((d) => !d.is_template);
  const templatesOnly = designs.filter((d) => d.is_template);

  return (
    <DashboardLayout>
      <SeoHead title="Meus Designs · Posiciona" description="Seus designs salvos." path="/my-designs" />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" /> Meus Designs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Suas artes salvas e modelos prontos para reutilizar.</p>
        </div>

        <Tabs defaultValue="designs" className="space-y-6">
          <TabsList>
            <TabsTrigger value="designs">Meus designs ({designsOnly.length})</TabsTrigger>
            <TabsTrigger value="templates">Meus modelos ({templatesOnly.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="designs">
            {renderList(
              designsOnly,
              'Edite um post na Linha Editorial e use "Salvar design".',
              <Layers className="h-12 w-12 mx-auto opacity-40" />,
            )}
          </TabsContent>

          <TabsContent value="templates">
            {renderList(
              templatesOnly,
              'No editor, use "Salvar como modelo" para reutilizar layouts depois.',
              <BookmarkPlus className="h-12 w-12 mx-auto opacity-40" />,
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default MyDesignsPage;
