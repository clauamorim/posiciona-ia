import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, Trash2 } from "lucide-react";

interface GalleryAsset {
  id: string;
  name: string;
  category: string;
  file_path: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminGallery() {
  const [assets, setAssets] = useState<GalleryAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("geral");

  const fetchAssets = async () => {
    const { data } = await supabase
      .from("gallery_assets")
      .select("*")
      .order("created_at", { ascending: false });
    setAssets((data as GalleryAsset[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAssets(); }, []);

  const getPublicUrl = (filePath: string) =>
    supabase.storage.from("asset-gallery").getPublicUrl(filePath).data.publicUrl;

  const handleUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files?.length) return;
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          if (file.size > 10 * 1024 * 1024) {
            toast.error(`${file.name} muito grande (máx 10MB)`);
            continue;
          }
          const ext = file.name.split(".").pop() || "png";
          const filePath = `${crypto.randomUUID()}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from("asset-gallery")
            .upload(filePath, file);
          if (uploadErr) { toast.error(`Erro ao enviar ${file.name}`); continue; }

          const itemName = name.trim() || file.name.replace(/\.[^.]+$/, "");
          const { error: insertErr } = await supabase
            .from("gallery_assets")
            .insert({ name: itemName, category: category.trim() || "geral", file_path: filePath });
          if (insertErr) toast.error(`Erro ao registrar ${file.name}`);
        }
        toast.success("Imagens cadastradas");
        setName("");
        fetchAssets();
      } catch (err: any) {
        toast.error(err.message || "Erro");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const handleDelete = async (asset: GalleryAsset) => {
    if (!confirm(`Excluir "${asset.name}"?`)) return;
    await supabase.storage.from("asset-gallery").remove([asset.file_path]);
    const { error } = await supabase.from("gallery_assets").delete().eq("id", asset.id);
    if (error) { toast.error("Erro ao excluir"); return; }
    setAssets(prev => prev.filter(a => a.id !== asset.id));
    toast.success("Imagem excluída");
  };

  return (
    <DashboardLayout wide>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Galeria de Imagens</h1>
        <p className="text-sm text-muted-foreground">
          Imagens PNG cadastradas aqui ficam disponíveis para os usuários no editor de posts.
        </p>

        {/* Upload form */}
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="Nome (opcional, usa nome do arquivo)" value={name} onChange={e => setName(e.target.value)} />
            <Input placeholder="Categoria (ex: molduras, ícones)" value={category} onChange={e => setCategory(e.target.value)} />
          </div>
          <Button onClick={handleUpload} disabled={uploading} className="gap-2">
            <Upload className="h-4 w-4" /> {uploading ? "Enviando..." : "Upload Imagens"}
          </Button>
        </div>

        {/* Grid */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : assets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma imagem cadastrada.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {assets.map(asset => (
              <div key={asset.id} className="relative group bg-card border rounded-lg overflow-hidden">
                <img
                  src={getPublicUrl(asset.file_path)}
                  alt={asset.name}
                  className="w-full aspect-square object-contain bg-muted/30"
                  loading="lazy"
                />
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{asset.name}</p>
                  <p className="text-[10px] text-muted-foreground">{asset.category}</p>
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(asset)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
