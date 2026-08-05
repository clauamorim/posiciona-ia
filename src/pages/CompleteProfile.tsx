import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SeoHead } from "@/components/SeoHead";
import { User, Building2 } from "lucide-react";

type BrandType = "pessoal" | "institucional";

const GOALS = [
  "Atrair novos clientes/pacientes",
  "Construir autoridade na minha área",
  "Aumentar minha visibilidade no Instagram",
  "Me diferenciar da concorrência",
  "Manter presença ativa sem perder tempo",
  "Outro",
];

const CompleteProfile = () => {
  const navigate = useNavigate();
  const { user, profileCompleted, refreshProfileCompletion, isLoading } = useAuth();
  const { refreshWorkspaces } = useWorkspace();
  const [whatsapp, setWhatsapp] = useState("");
  const [gender, setGender] = useState("");
  const [profession, setProfession] = useState("");
  const [niche, setNiche] = useState("");
  const [mainGoal, setMainGoal] = useState("");
  const [brandType, setBrandType] = useState<BrandType>("pessoal");
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);
  const isInstitutional = brandType === "institucional";

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate("/login", { replace: true }); return; }
    if (profileCompleted) { navigate("/dashboard", { replace: true }); return; }
    (async () => {
      const [{ data }, { data: ws }] = await Promise.all([
        supabase.from("profiles").select("whatsapp, gender, profession, niche, main_goal").eq("user_id", user.id).maybeSingle(),
        supabase.from("workspaces").select("brand_type").eq("owner_id", user.id).eq("is_default", true).maybeSingle(),
      ]);
      if (data) {
        setWhatsapp(data.whatsapp ?? "");
        setGender(data.gender ?? "");
        setProfession(data.profession ?? "");
        setNiche(data.niche ?? "");
        setMainGoal(data.main_goal ?? "");
      }
      if (ws?.brand_type === "institucional") setBrandType("institucional");
      setHydrating(false);
    })();
  }, [user, profileCompleted, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!whatsapp.trim() || (!isInstitutional && !gender) || !profession.trim() || !niche.trim() || !mainGoal) {
      toast({ title: "Preencha todos os campos", description: "Esses dados personalizam sua experiência.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const [{ error }, { error: wsError }] = await Promise.all([
      supabase
        .from("profiles")
        .update({
          whatsapp: whatsapp.trim(),
          gender: isInstitutional ? null : gender,
          profession: profession.trim(),
          niche: niche.trim(),
          main_goal: mainGoal,
          profile_completed: true,
        })
        .eq("user_id", user.id),
      supabase
        .from("workspaces")
        .update({ brand_type: brandType, profession: profession.trim(), niche: niche.trim() })
        .eq("owner_id", user.id)
        .eq("is_default", true),
    ]);
    setLoading(false);
    if (error || wsError) {
      toast({ title: "Não foi possível salvar", description: (error || wsError)?.message, variant: "destructive" });
      return;
    }
    await refreshProfileCompletion();
    // WorkspaceContext já carregou o perfil default como "pessoal" (valor de
    // nascimento do trigger) antes desta tela salvar o tipo escolhido —
    // sem isso, o seletor no dashboard mostra o tipo antigo até um F5.
    await refreshWorkspaces();
    toast({ title: "Perfil completo", description: "Pronto para começar." });
    navigate("/dashboard", { replace: true });
  };

  return (
    <AuthLayout>
      <SeoHead title="Complete seu perfil · Posiciona" description="Conte um pouco sobre você para personalizar sua estratégia de marca." path="/complete-profile" />
      <div className="space-y-6">
        <header className="space-y-2 text-center lg:text-left">
          <h1 className="text-3xl font-display font-bold">Antes de começar, conta um pouco sobre você</h1>
          <p className="text-sm text-muted-foreground">Esses dados personalizam seu diagnóstico, sua narrativa e seus conteúdos.</p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Você vai posicionar uma marca pessoal ou institucional?</Label>
            <RadioGroup
              value={brandType}
              onValueChange={(v) => setBrandType(v as BrandType)}
              className="grid sm:grid-cols-2 gap-3"
            >
              <Label
                htmlFor="brand-pessoal"
                className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                  brandType === "pessoal" ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"
                }`}
              >
                <RadioGroupItem value="pessoal" id="brand-pessoal" className="mt-0.5" disabled={hydrating} />
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <User className="h-3.5 w-3.5" /> Pessoal
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Você é a marca — profissional liberal, autoridade individual.
                  </p>
                </div>
              </Label>
              <Label
                htmlFor="brand-institucional"
                className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                  brandType === "institucional" ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/40"
                }`}
              >
                <RadioGroupItem value="institucional" id="brand-institucional" className="mt-0.5" disabled={hydrating} />
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Building2 className="h-3.5 w-3.5" /> Institucional
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Empresa, clínica, escritório — a marca existe além de uma pessoa.
                  </p>
                </div>
              </Label>
            </RadioGroup>
          </div>
          <div className={isInstitutional ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-3"}>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" disabled={hydrating} />
            </div>
            {!isInstitutional && (
              <div className="space-y-2">
                <Label>Gênero</Label>
                <Select value={gender} onValueChange={setGender} disabled={hydrating}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Prefiro não informar">Prefiro não informar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="profession">{isInstitutional ? "Área de atuação" : "Profissão"}</Label>
              <Input
                id="profession"
                value={profession}
                onChange={e => setProfession(e.target.value)}
                placeholder={isInstitutional ? "Ex: Clínica odontológica" : "Ex: Designer"}
                disabled={hydrating}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="niche">Nicho</Label>
              <Input id="niche" value={niche} onChange={e => setNiche(e.target.value)} placeholder="Ex: Moda" disabled={hydrating} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Objetivo principal com o Posiciona</Label>
            <Select value={mainGoal} onValueChange={setMainGoal} disabled={hydrating}>
              <SelectTrigger><SelectValue placeholder="Selecione seu objetivo" /></SelectTrigger>
              <SelectContent>
                {GOALS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={loading || hydrating}>
            {loading ? "Salvando..." : "Continuar"}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
};

export default CompleteProfile;
