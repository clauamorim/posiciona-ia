import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Upload, Trash2, FileText } from "lucide-react";

interface RefDoc {
  id: string;
  name: string;
  description: string | null;
  file_path: string;
  file_size: number;
  is_active: boolean;
  created_at: string;
}

export default function AdminDocuments() {
  const [docs, setDocs] = useState<RefDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const fetchDocs = async () => {
    const { data } = await supabase
      .from("reference_documents")
      .select("*")
      .order("created_at", { ascending: false });
    setDocs((data as RefDoc[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleUpload = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error("PDF muito grande. Máximo: 5MB");
        return;
      }
      if (!name.trim()) {
        toast.error("Informe um nome para o documento");
        return;
      }
      setUploading(true);
      try {
        const filePath = `${crypto.randomUUID()}.pdf`;
        const { error: uploadErr } = await supabase.storage
          .from("reference-pdfs")
          .upload(filePath, file);
        if (uploadErr) throw uploadErr;

        const { error: insertErr } = await supabase
          .from("reference_documents")
          .insert({
            name: name.trim(),
            description: description.trim() || null,
            file_path: filePath,
            file_size: file.size,
          });
        if (insertErr) throw insertErr;

        toast.success("PDF cadastrado com sucesso");
        setName("");
        setDescription("");
        fetchDocs();
      } catch (err: any) {
        toast.error(err.message || "Erro ao enviar PDF");
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const toggleActive = async (doc: RefDoc) => {
    const { error } = await supabase
      .from("reference_documents")
      .update({ is_active: !doc.is_active })
      .eq("id", doc.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, is_active: !d.is_active } : d));
  };

  const handleDelete = async (doc: RefDoc) => {
    if (!confirm(`Excluir "${doc.name}"?`)) return;
    await supabase.storage.from("reference-pdfs").remove([doc.file_path]);
    const { error } = await supabase.from("reference_documents").delete().eq("id", doc.id);
    if (error) { toast.error("Erro ao excluir"); return; }
    setDocs(prev => prev.filter(d => d.id !== doc.id));
    toast.success("Documento excluído");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Documentos de Referência (LLM)</h1>
        <p className="text-sm text-muted-foreground">
          PDFs cadastrados aqui serão enviados como contexto para a IA ao gerar relatórios e análises. Máx. 5MB cada.
        </p>

        {/* Upload form */}
        <div className="bg-card border rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="Nome do documento" value={name} onChange={e => setName(e.target.value)} />
            <Input placeholder="Descrição (opcional)" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <Button onClick={handleUpload} disabled={uploading || !name.trim()} className="gap-2">
            <Upload className="h-4 w-4" /> {uploading ? "Enviando..." : "Upload PDF"}
          </Button>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum documento cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 bg-card border rounded-lg p-3">
                <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  {doc.description && <p className="text-xs text-muted-foreground truncate">{doc.description}</p>}
                  <p className="text-xs text-muted-foreground">{(doc.file_size / 1024).toFixed(0)} KB</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={doc.is_active} onCheckedChange={() => toggleActive(doc)} />
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(doc)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
