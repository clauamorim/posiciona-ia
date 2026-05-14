import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SeoHead } from "@/components/SeoHead";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { signedUserUploadUrl } from "@/lib/userGalleryUrl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Image as ImageIcon, Sparkles, Camera, Upload, Star, Trash2, Download, Plus } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Filter = "all" | "ai" | "pexels" | "upload" | "logos";

interface GalleryRow {
  id: string;
  name: string;
  file_path: string;
  source: string;
  is_logo: boolean;
  attribution: any;
  created_at: string;
  publicUrl: string;
}

const FILTERS: { id: Filter; label: string; icon: any }[] = [
  { id: "all", label: "Todas", icon: ImageIcon },
  { id: "ai", label: "Geradas por IA", icon: Sparkles },
  { id: "pexels", label: "Pexels", icon: Camera },
  { id: "upload", label: "Uploads", icon: Upload },
  { id: "logos", label: "Logos", icon: Star },
];

const sourceBadge = (source: string, isLogo: boolean) => {
  if (isLogo) return { label: "Logo", className: "bg-primary/15 text-primary" };
  if (source === "ai") return { label: "IA", className: "bg-purple-500/15 text-purple-600 dark:text-purple-300" };
  if (source === "pexels") return { label: "Pexels", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" };
  if (source === "unsplash") return { label: "Unsplash", className: "bg-blue-500/15 text-blue-600 dark:text-blue-300" };
  return { label: "Upload", className: "bg-muted text-muted-foreground" };
};

const MyGalleryPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<GalleryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [pendingDelete, setPendingDelete] = useState<GalleryRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("user_gallery_assets")
      .select("id, name, file_path, source, is_logo, attribution, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro ao carregar galeria", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    // Bucket é privado — sempre usar URL assinada para exibir thumbnails.
    const rows: GalleryRow[] = await Promise.all((data || []).map(async (r: any) => {
      const url = await signedUserUploadUrl(r.file_path);
      return { ...r, publicUrl: url };
    }));
    setItems(rows);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Recarrega quando uma nova imagem IA/Pexels é salva pelo editor
    const handler = () => load();
    window.addEventListener("posiciona:gallery-updated", handler);
    return () => window.removeEventListener("posiciona:gallery-updated", handler);
    /* eslint-disable-next-line */
  }, [user]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "logos") return items.filter(i => i.is_logo);
    if (filter === "ai") return items.filter(i => i.source === "ai" && !i.is_logo);
    if (filter === "pexels") return items.filter(i => (i.source === "pexels" || i.source === "unsplash") && !i.is_logo);
    if (filter === "upload") return items.filter(i => i.source === "upload" && !i.is_logo);
    return items;
  }, [items, filter]);

  const counts = useMemo(() => ({
    all: items.length,
    ai: items.filter(i => i.source === "ai" && !i.is_logo).length,
    pexels: items.filter(i => (i.source === "pexels" || i.source === "unsplash") && !i.is_logo).length,
    upload: items.filter(i => i.source === "upload" && !i.is_logo).length,
    logos: items.filter(i => i.is_logo).length,
  }), [items]);

  const handleUseInPost = (item: GalleryRow) => {
    navigate(`/post-editor?fromGallery=${item.id}`);
  };

  const handleDownload = async (item: GalleryRow) => {
    try {
      const resp = await fetch(item.publicUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = (blob.type.split("/")[1] || "jpg").split(";")[0];
      a.download = `${(item.name || "imagem").replace(/[^a-z0-9-_]+/gi, "-")}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "Erro ao baixar", description: e?.message, variant: "destructive" });
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || !user) return;
    setDeleting(true);
    try {
      await supabase.storage.from("user-uploads").remove([pendingDelete.file_path]);
      const { error } = await supabase
        .from("user_gallery_assets")
        .delete()
        .eq("id", pendingDelete.id)
        .eq("user_id", user.id);
      if (error) throw error;
      setItems(prev => prev.filter(i => i.id !== pendingDelete.id));
      toast({ title: "Imagem removida" });
    } catch (e: any) {
      toast({ title: "Erro ao remover", description: e?.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  return (
    <DashboardLayout>
      <SeoHead title="Minha Galeria · Posiciona" description="Imagens e retratos da sua marca." path="/my-gallery" />
      <div className="space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-display font-semibold tracking-tight">Minha galeria</h1>
            <p className="text-sm text-muted-foreground">
              Todas as imagens que você gerou, salvou ou enviou. Reutilize em novos posts sem gastar créditos.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/post-editor">
              <Plus className="h-4 w-4" /> Novo post
            </Link>
          </Button>
        </header>

        {/* Filtros */}
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(f => {
            const active = filter === f.id;
            const count = counts[f.id];
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
                )}
              >
                <f.icon className="h-3.5 w-3.5" />
                {f.label}
                <span className={cn("text-[10px] tabular-nums opacity-70")}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title={filter === "all" ? "Sua galeria está vazia" : "Nada por aqui ainda"}
            description={
              filter === "all"
                ? "As imagens IA, Pexels e uploads dos seus posts aparecerão automaticamente aqui ao salvar um design."
                : "Mude o filtro ou crie um novo post para popular esta categoria."
            }
          >
            <Button asChild variant="default" size="sm" className="gap-2">
              <Link to="/post-editor">
                <Plus className="h-4 w-4" /> Criar um post
              </Link>
            </Button>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map(item => {
              const badge = sourceBadge(item.source, item.is_logo);
              const photographerName = item.attribution?.name as string | undefined;
              return (
                <article
                  key={item.id}
                  className="group rounded-lg border border-border bg-card overflow-hidden flex flex-col"
                >
                  <div className="relative aspect-[4/5] bg-muted/40">
                    <img
                      src={item.publicUrl}
                      alt={item.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                    <span className={cn(
                      "absolute top-2 left-2 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider",
                      badge.className
                    )}>
                      {badge.label}
                    </span>
                  </div>
                  <div className="p-2.5 space-y-2 flex-1 flex flex-col">
                    <div className="space-y-0.5 flex-1 min-h-0">
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      {photographerName && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          Foto por {photographerName} / {item.source === "unsplash" ? "Unsplash" : "Pexels"}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="default"
                        className="h-7 px-2 text-[11px] gap-1 flex-1 min-h-[28px]"
                        onClick={() => handleUseInPost(item)}
                      >
                        Usar
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 min-h-[28px] min-w-[28px]"
                        onClick={() => handleDownload(item)}
                        title="Baixar"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-7 w-7 min-h-[28px] min-w-[28px] text-destructive hover:text-destructive"
                        onClick={() => setPendingDelete(item)}
                        title="Excluir"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir imagem da galeria?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta imagem será removida da sua galeria e do armazenamento. Posts já salvos não são afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleConfirmDelete(); }} disabled={deleting}>
              {deleting ? "Removendo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default MyGalleryPage;
