import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace, type BrandType } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ChevronsUpDown, Check, Plus, User, Building2, Loader2 } from "lucide-react";

const BrandTypeBadge = ({ type }: { type: BrandType }) => (
  <Badge variant="outline" className="h-4 px-1 text-[9px] font-medium gap-0.5">
    {type === "institucional" ? <Building2 className="h-2.5 w-2.5" /> : <User className="h-2.5 w-2.5" />}
    {type === "institucional" ? "Institucional" : "Pessoal"}
  </Badge>
);

export const WorkspaceSwitcher = () => {
  const { workspaces, activeWorkspace, isLoading, switchWorkspace, createWorkspace } = useWorkspace();
  const { subscription } = useAuth();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [brandType, setBrandType] = useState<BrandType>("pessoal");
  const [importData, setImportData] = useState(true);
  const [creating, setCreating] = useState(false);

  // Um só perfil: nada para trocar ainda, mas o botão "Criar novo perfil"
  // já fica disponível para quem quiser um segundo (ex.: pessoal + escritório).
  if (isLoading || !activeWorkspace) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
      </div>
    );
  }

  const maxWorkspaces = subscription?.max_workspaces ?? 1;
  const atLimit = workspaces.length >= maxWorkspaces;

  const openCreate = () => {
    if (atLimit) {
      toast({
        title: "Limite de perfis do seu plano atingido",
        description: `Seu plano permite ${maxWorkspaces} perfil${maxWorkspaces > 1 ? "s" : ""}. Faça upgrade para criar mais.`,
      });
      navigate("/choose-plan");
      return;
    }
    setName("");
    setBrandType("pessoal");
    setImportData(true);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "Dê um nome ao perfil", variant: "destructive" });
      return;
    }
    setCreating(true);
    const res = await createWorkspace({
      name,
      brandType,
      importFrom: importData
        ? { profession: activeWorkspace.profession, niche: activeWorkspace.niche }
        : undefined,
    });
    setCreating(false);
    if (!res.ok) {
      toast({ title: "Não foi possível criar o perfil", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Perfil criado", description: `"${name}" já está ativo.` });
    setCreateOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-left hover:bg-card transition-colors min-h-[40px]">
            <div className="flex-1 min-w-0">
              <p className="truncate">{activeWorkspace.name}</p>
              <BrandTypeBadge type={activeWorkspace.brand_type} />
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60">
            Seus perfis
          </DropdownMenuLabel>
          {workspaces.map((w) => (
            <DropdownMenuItem key={w.id} onClick={() => switchWorkspace(w.id)} className="gap-2">
              <Check className={`h-3.5 w-3.5 flex-shrink-0 ${w.id === activeWorkspace.id ? "opacity-100" : "opacity-0"}`} />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm">{w.name}</p>
                <BrandTypeBadge type={w.brand_type} />
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={openCreate} className="gap-2">
            <Plus className="h-3.5 w-3.5" />
            {atLimit ? "Fazer upgrade para criar mais perfis" : "Criar novo perfil"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar novo perfil</DialogTitle>
            <DialogDescription>
              Cada perfil tem seus próprios questionários, relatório e linha editorial — nada se mistura
              entre eles. Você continua com o mesmo login.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-workspace-name">Nome do perfil</Label>
              <Input
                id="new-workspace-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Ex: "Escritório Silva Advogados"'
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de marca</Label>
              <RadioGroup value={brandType} onValueChange={(v) => setBrandType(v as BrandType)} className="grid grid-cols-2 gap-2">
                <Label
                  htmlFor="new-ws-pessoal"
                  className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer text-sm ${
                    brandType === "pessoal" ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <RadioGroupItem value="pessoal" id="new-ws-pessoal" />
                  <User className="h-3.5 w-3.5" /> Pessoal
                </Label>
                <Label
                  htmlFor="new-ws-institucional"
                  className={`flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer text-sm ${
                    brandType === "institucional" ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"
                  }`}
                >
                  <RadioGroupItem value="institucional" id="new-ws-institucional" />
                  <Building2 className="h-3.5 w-3.5" /> Institucional
                </Label>
              </RadioGroup>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={importData} onCheckedChange={(v) => setImportData(v === true)} className="mt-0.5" />
              <span className="text-xs text-muted-foreground">
                Importar nicho e profissão do perfil "{activeWorkspace.name}" como ponto de partida
                (você pode editar depois — não fica vinculado, é só uma cópia).
              </span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar perfil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
