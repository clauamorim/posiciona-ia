import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import posicionaLogo from "@/assets/posiciona-logo.png";

const GOALS = [
  "Atrair novos clientes/pacientes",
  "Construir autoridade na minha área",
  "Aumentar minha visibilidade no Instagram",
  "Me diferenciar da concorrência",
  "Manter presença ativa sem perder tempo",
  "Outro",
];

const Signup = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profession, setProfession] = useState("");
  const [niche, setNiche] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [mainGoal, setMainGoal] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, profession, niche, whatsapp, main_goal: mainGoal, gender },
        emailRedirectTo: window.location.origin + "/login",
      },
    });
    if (error) {
      toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setLoading(false);
    toast({ title: "Conta criada!", description: "Verifique seu e-mail para confirmar." });
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-background relative">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 left-4 gap-2 text-muted-foreground"
        onClick={() => navigate("/")}
      >
        <ArrowLeft className="h-4 w-4" /> Página inicial
      </Button>
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src={posicionaLogo} alt="Posiciona" className="h-12 w-12" />
            <h1 className="text-3xl font-bold font-display text-primary">Posiciona</h1>
          </div>
          <CardTitle className="text-xl font-display">Criar sua conta</CardTitle>
          <CardDescription>Comece a construir seu posicionamento de marca</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} required placeholder="Seu nome" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="seu@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input id="whatsapp" type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-2">
                <Label>Gênero</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
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
                <Input id="profession" value={profession} onChange={e => setProfession(e.target.value)} placeholder="Ex: Designer" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="niche">Nicho</Label>
                <Input id="niche" value={niche} onChange={e => setNiche(e.target.value)} placeholder="Ex: Moda" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Objetivo principal com o Posiciona</Label>
              <Select value={mainGoal} onValueChange={setMainGoal}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione seu objetivo" />
                </SelectTrigger>
                <SelectContent>
                  {GOALS.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Criando..." : "Criar conta"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Já tem uma conta?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">Entrar</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
