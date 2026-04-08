import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Sparkles,
  Target,
  Brain,
  BarChart3,
  Calendar,
  FileText,
  Camera,
  Check,
  ArrowRight,
  Zap,
  Eye,
  Layers,
  Clock,
  Repeat,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";

const plans = [
  {
    name: "Semana de Conteúdo",
    slug: "semana_conteudo",
    price: "R$ 197",
    period: "pagamento único",
    highlight: false,
    features: [
      "Diagnóstico inicial completo",
      "Guia de posicionamento",
      "StoryBrand personalizado",
      "3 arquétipos principais",
      "Análise inicial do Instagram",
      "1 ciclo editorial de 7 dias",
      "7 conteúdos prontos",
      "Posts, carrosséis e roteiros",
      "Pode comprar créditos de retrato",
    ],
    notIncluded: ["Retratos não inclusos"],
  },
  {
    name: "Presença Mensal",
    slug: "presenca_mensal",
    price: "R$ 297",
    period: "/mês",
    highlight: true,
    features: [
      "Diagnóstico inicial completo",
      "4 ciclos semanais por mês",
      "Conteúdos semanais estratégicos",
      "1 reanálise de perfil por mês",
      "Posts, carrosséis e roteiros",
      "Pode comprar créditos de retrato",
    ],
    notIncluded: ["Retratos não inclusos"],
  },
  {
    name: "Autoridade Total",
    slug: "autoridade_total",
    price: "R$ 497",
    period: "/mês",
    highlight: false,
    features: [
      "Tudo do Presença Mensal",
      "2 reanálises de perfil por mês",
      "Créditos mensais de retrato inclusos",
      "20 créditos de regeneração",
      "Pode comprar créditos extras",
    ],
    notIncluded: [],
  },
];

const steps = [
  { icon: Sparkles, title: "Escolha seu plano", desc: "Selecione o plano ideal para o seu momento" },
  { icon: FileText, title: "Preencha os questionários", desc: "Responda sobre seu negócio e personalidade de marca" },
  { icon: Brain, title: "Descubra seus arquétipos", desc: "O app calcula seus 3 arquétipos principais" },
  { icon: Target, title: "Receba seu StoryBrand", desc: "Posicionamento estratégico gerado por IA" },
  { icon: BarChart3, title: "Análise do Instagram", desc: "Diagnóstico completo do seu perfil" },
  { icon: Calendar, title: "Linha editorial semanal", desc: "Calendário de conteúdo pronto para usar" },
  { icon: Camera, title: "Conteúdos e retratos", desc: "Posts, carrosséis, roteiros e retratos de marca" },
];

const benefits = [
  { icon: Target, title: "Clareza de posicionamento", desc: "Saiba exatamente como se posicionar no mercado" },
  { icon: Eye, title: "Coerência visual", desc: "Identidade visual alinhada aos seus arquétipos" },
  { icon: Layers, title: "Conteúdo estratégico", desc: "Posts e roteiros criados com base na sua essência" },
  { icon: Zap, title: "Agilidade", desc: "Semanas inteiras de conteúdo em minutos" },
  { icon: Repeat, title: "Constância", desc: "Nunca mais fique sem saber o que postar" },
];

const faqItems = [
  {
    q: "Como funciona o diagnóstico inicial?",
    a: "Você preenche dois questionários: um sobre o seu negócio e outro de personalidade de marca. A partir das respostas, o app calcula seus arquétipos, gera seu StoryBrand e cria toda a estratégia de posicionamento.",
  },
  {
    q: "Preciso saber de marketing para usar?",
    a: "Não! O app faz toda a parte estratégica por você. Basta responder os questionários com honestidade sobre o seu negócio e a IA cuida do resto.",
  },
  {
    q: "Os retratos estão inclusos?",
    a: "Depende do plano. O plano Autoridade Total inclui créditos mensais de retrato. Nos outros planos, você pode comprar créditos extras de retrato separadamente.",
  },
  {
    q: "Posso comprar créditos extras?",
    a: "Sim! Todos os planos permitem a compra de créditos extras de retrato para complementar sua estratégia visual.",
  },
  {
    q: "Os conteúdos já vêm prontos?",
    a: "Sim! O app gera posts, carrosséis e roteiros de reels completos, com texto, chamada para ação e sugestão visual. Basta publicar.",
  },
];

const LandingPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);

  useEffect(() => {
    // If logged in with active plan, redirect to dashboard
    // (will be enhanced when AuthContext has subscription info)
  }, []);

  const handleCheckout = async (slug: string) => {
    if (!user) {
      navigate("/login");
      return;
    }
    setLoadingSlug(slug);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: { plan_slug: slug },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      toast({ title: "Erro ao iniciar pagamento", description: err.message, variant: "destructive" });
    }
    setLoadingSlug(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <span className="text-xl font-bold font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            ArcheBrand
          </span>
          <div className="flex gap-3">
            {user ? (
              <Button onClick={() => navigate("/dashboard")} size="sm">Dashboard</Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>Entrar</Button>
                <Button size="sm" onClick={() => navigate("/signup")}>Criar conta</Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="py-20 md:py-32 px-4">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <Badge variant="secondary" className="text-sm px-4 py-1">
            <Sparkles className="h-3 w-3 mr-1" /> Posicionamento de marca com IA
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold font-display leading-tight">
            Descubra sua essência de marca e
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent"> transforme em conteúdo</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            O ArcheBrand define seus arquétipos, gera seu StoryBrand, analisa seu Instagram, cria sua linha editorial semanal, gera posts prontos e oferece retratos profissionais alinhados ao seu posicionamento.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" className="gap-2 text-base" onClick={() => document.getElementById("planos")?.scrollIntoView({ behavior: "smooth" })}>
              Ver planos <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" className="text-base" onClick={() => document.getElementById("como-funciona")?.scrollIntoView({ behavior: "smooth" })}>
              Como funciona
            </Button>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="py-20 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-display">Como funciona</h2>
            <p className="text-muted-foreground mt-2">7 etapas até seu conteúdo estratégico</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <Card key={i} className="border-border/50 hover:shadow-md transition-shadow">
                <CardContent className="pt-6 flex gap-4 items-start">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <s.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Etapa {i + 1}</p>
                    <p className="font-semibold text-sm">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{s.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-display">Por que usar o ArcheBrand</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((b, i) => (
              <div key={i} className="flex gap-4 items-start p-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                  <b.icon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <p className="font-semibold">{b.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section id="planos" className="py-20 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-display">Escolha seu plano</h2>
            <p className="text-muted-foreground mt-2">Comece seu posicionamento estratégico agora</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {plans.map((p) => (
              <Card
                key={p.slug}
                className={`relative flex flex-col ${
                  p.highlight
                    ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary/20"
                    : "border-border/50"
                }`}
              >
                {p.highlight && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Mais popular
                  </Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-lg font-display">{p.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{p.price}</span>
                    <span className="text-muted-foreground text-sm">{p.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-2 flex-1">
                    {p.features.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                    {p.notIncluded.map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="w-4 text-center flex-shrink-0">—</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full mt-6"
                    variant={p.highlight ? "default" : "outline"}
                    onClick={() => handleCheckout(p.slug)}
                    disabled={loadingSlug === p.slug}
                  >
                    {loadingSlug === p.slug ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {loadingSlug === p.slug ? "Processando..." : "Começar agora"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold font-display">Perguntas frequentes</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {faqItems.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-left text-sm font-medium">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/50 py-8 px-4 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} ArcheBrand. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
