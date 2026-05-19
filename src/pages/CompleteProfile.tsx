import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SeoHead } from "@/components/SeoHead";

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
  const [whatsapp, setWhatsapp] = useState("");
  const [gender, setGender] = useState("");
  const [profession, setProfession] = useState("");
  const [niche, setNiche] = useState("");
  const [mainGoal, setMainGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { navigate("/login", { replace: true }); return; }
    if (profileCompleted) { navigate("/dashboard", { replace: true }); return; }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("whatsapp, gender, profession, niche, main_goal")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setWhatsapp(data.whatsapp ?? "");
        setGender(data.gender ?? "");
        setProfession(data.profession ?? "");
        setNiche(data.niche ?? "");
        setMainGoal(data.main_goal ?? "");
      }
      setHydrating(false);
    })();
  }, [user, profileCompleted, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!whatsapp.trim() || !gender || !profession.trim() || !niche.trim() || !mainGoal) {
      toast({ title: "Preencha todos os campos", description: "Esses dados personalizam sua experiência.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        whatsapp: whatsapp.trim(),
        gender,
        profession: profession.trim(),
        niche: niche.trim(),
        main_goal: mainGoal,
        profile_completed: true,
      })
      .eq("user_id", user.id);
    setLoading(false);
    if (error) {
      toast({ title: "Não foi possível salvar", description: error.message, variant: "destructive" });
      return;
    }
    await refreshProfileCompletion();
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" disabled={hydrating} />
            </div>
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
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="profession">Profissão</Label>
              <Input id="profession" value={profession} onChange={e => setProfession(e.target.value)} placeholder="Ex: Designer" disabled={hydrating} />
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
