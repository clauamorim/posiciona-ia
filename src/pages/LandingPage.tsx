import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
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
  Target, Brain, BarChart3, Calendar, FileText, Camera,
  Check, ArrowRight, Loader2, Menu, X, Search, Palette, MessageSquare,
  Image, TrendingUp, Zap
} from "lucide-react";
import posicionaLogo from "@/assets/posiciona-logo.png";
import { useState } from "react";

/* ── Plan data ── */
const plans = [
  {
    name: "Semana de Conteúdo",
    slug: "semana_conteudo",
    price: "197",
    period: "pagamento único",
    description: "Para quem quer clareza e uma primeira semana estratégica pronta para usar.",
    highlight: false,
    features: [
      "Diagnóstico inicial completo",
      "Guia de posicionamento",
      "StoryBrand personalizado",
      "3 arquétipos principais",
      "Análise inicial do Instagram",
      "1 ciclo editorial de 7 dias",
      "7 conteúdos prontos",
    ],
    notIncluded: ["Retratos não inclusos"],
  },
  {
    name: "Presença Mensal",
    slug: "presenca_mensal",
    price: "297",
    period: "/mês",
    description: "Para quem quer manter consistência e continuar produzindo com estratégia ao longo do mês.",
    highlight: true,
    features: [
      "Diagnóstico inicial completo",
      "4 ciclos semanais por mês",
      "Conteúdos semanais estratégicos",
      "1 reanálise de perfil por mês",
      "Posts, carrosséis e roteiros",
    ],
    notIncluded: ["Retratos não inclusos"],
  },
  {
    name: "Autoridade Total",
    slug: "autoridade_total",
    price: "497",
    period: "/mês",
    description: "Para quem quer combinar posicionamento contínuo com reforço visual e presença mais premium.",
    highlight: false,
    features: [
      "Tudo do Presença Mensal",
      "2 reanálises de perfil por mês",
      "Créditos mensais de retrato inclusos",
      "20 créditos de regeneração",
      "Compra de créditos extras",
    ],
    notIncluded: [],
  },
];

const faqItems = [
  { q: "Como funciona o diagnóstico inicial?", a: "Você preenche dois questionários: um sobre o seu negócio e outro de personalidade de marca. A partir das respostas, a IA calcula seus arquétipos, gera seu StoryBrand e cria toda a estratégia de posicionamento." },
  { q: "Preciso entender de marketing para usar?", a: "Não. O Posiciona faz toda a parte estratégica por você. Basta responder os questionários com honestidade sobre o seu negócio e a IA cuida do resto." },
  { q: "Os conteúdos já vêm prontos?", a: "Sim. O app gera posts, carrosséis e roteiros de reels completos, com texto, chamada para ação e sugestão visual. Basta publicar." },
  { q: "Os retratos estão inclusos em todos os planos?", a: "Apenas o plano Autoridade Total inclui créditos mensais de retrato. Nos demais, você pode comprar créditos extras separadamente." },
  { q: "Posso comprar créditos extras?", a: "Sim! Todos os planos permitem a compra de créditos extras de retrato para complementar sua estratégia visual." },
  { q: "Isso serve para o meu nicho?", a: "O Posiciona é feito para profissionais que vendem expertise: coaches, consultores, terapeutas, advogados, médicos, designers, arquitetos e qualquer profissional liberal que precisa comunicar valor com mais clareza." },
  { q: "Em quanto tempo recebo os resultados?", a: "Os arquétipos e o StoryBrand são gerados em minutos após completar os questionários. A linha editorial e os conteúdos são criados sob demanda." },
];

const LandingPage = () => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleCheckout = async (slug: string) => {
    if (!user) { navigate("/signup"); return; }
    setLoadingSlug(slug);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", { body: { plan_slug: slug } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) { window.location.href = data.url; } else { throw new Error("URL de pagamento não retornada"); }
    } catch (err: any) {
      toast({ title: "Erro ao iniciar pagamento", description: err.message, variant: "destructive" });
      setLoadingSlug(null);
    }
  };

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-landing-bg text-landing-text">
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 border-b border-landing-border/60 bg-landing-bg/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={posicionaLogo} alt="Posiciona" className="h-5 w-5" />
            <span className="text-lg font-semibold tracking-tight">Posiciona</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-landing-text-secondary">
            <button onClick={() => scrollTo("como-funciona")} className="hover:text-landing-text transition-colors">Como funciona</button>
            <button onClick={() => scrollTo("resultados")} className="hover:text-landing-text transition-colors">Resultados</button>
            <button onClick={() => scrollTo("planos")} className="hover:text-landing-text transition-colors">Planos</button>
            <button onClick={() => scrollTo("faq")} className="hover:text-landing-text transition-colors">FAQ</button>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Button size="sm" onClick={() => navigate("/dashboard")} className="bg-landing-purple hover:bg-landing-purple/90 text-white">Dashboard</Button>
            ) : (
              <>
                <button onClick={() => navigate("/login")} className="text-sm text-landing-text-secondary hover:text-landing-text transition-colors">Entrar</button>
                <Button size="sm" onClick={() => navigate("/signup")} className="bg-landing-purple hover:bg-landing-purple/90 text-white">Criar conta</Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-1" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-landing-border/60 bg-landing-bg px-4 py-4 space-y-3">
            <button onClick={() => scrollTo("como-funciona")} className="block text-sm text-landing-text-secondary hover:text-landing-text w-full text-left py-1">Como funciona</button>
            <button onClick={() => scrollTo("resultados")} className="block text-sm text-landing-text-secondary hover:text-landing-text w-full text-left py-1">Resultados</button>
            <button onClick={() => scrollTo("planos")} className="block text-sm text-landing-text-secondary hover:text-landing-text w-full text-left py-1">Planos</button>
            <button onClick={() => scrollTo("faq")} className="block text-sm text-landing-text-secondary hover:text-landing-text w-full text-left py-1">FAQ</button>
            <div className="pt-2 border-t border-landing-border/40 flex gap-3">
              {user ? (
                <Button size="sm" onClick={() => navigate("/dashboard")} className="bg-landing-purple text-white w-full">Dashboard</Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="text-landing-text-secondary flex-1">Entrar</Button>
                  <Button size="sm" onClick={() => navigate("/signup")} className="bg-landing-purple text-white flex-1">Criar conta</Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ── */}
      <section className="pt-16 pb-20 md:pt-24 md:pb-28 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-landing-border bg-landing-bg-secondary/50 text-xs text-landing-text-secondary">
            <img src={posicionaLogo} alt="Posiciona" className="h-3 w-3" />
            Posicionamento estratégico com IA para profissionais que vendem expertise
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-semibold leading-[1.15] tracking-tight">
            Você já é referência na sua área.{" "}
            <span className="italic text-landing-gold">Seu Instagram ainda não mostra isso.</span>
          </h1>

          <p className="text-base md:text-lg text-landing-text-secondary max-w-2xl mx-auto leading-relaxed">
            O Posiciona identifica o que diferencia sua marca, organiza sua mensagem e entrega estratégia, calendário e conteúdo pronto para publicar com mais autoridade e constância.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button size="lg" onClick={() => navigate("/signup")} className="bg-landing-purple hover:bg-landing-purple/90 text-white text-base h-12 px-8">
              Começar agora <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => scrollTo("como-funciona")} className="border-landing-border text-landing-text-secondary hover:bg-landing-bg-secondary hover:text-landing-text text-base h-12 px-8">
              Ver como funciona
            </Button>
          </div>

          <p className="text-xs text-landing-text-secondary/60 pt-1">
            Sem improvisar conteúdo. Sem depender de agência. Com direção clara para sua marca.
          </p>
        </div>
      </section>

      {/* ── PROBLEMA ── */}
      <section className="py-16 md:py-20 px-4 bg-landing-bg-secondary/40">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-2xl md:text-3xl font-display font-semibold leading-tight">
            Quando sua presença digital não acompanha{" "}
            <span className="text-landing-gold italic">seu nível profissional</span>
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
            {[
              "Sua marca parece genérica",
              "Seu conteúdo não traduz sua autoridade",
              "Você perde tempo decidindo o que postar",
              "Seu perfil não atrai com clareza o cliente certo",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-lg border border-landing-border/50 bg-landing-bg/50">
                <div className="w-6 h-6 rounded-full bg-landing-purple/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs text-landing-purple font-semibold">{i + 1}</span>
                </div>
                <p className="text-sm text-landing-text/90">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ── */}
      <section id="como-funciona" className="py-16 md:py-20 px-4">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-display font-semibold">
              Em 3 etapas, sua marca sai da improvisação e{" "}
              <span className="text-landing-gold italic">ganha direção</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                icon: Search,
                title: "Descubra o que diferencia sua marca",
                desc: "Responda ao diagnóstico e o Posiciona organiza sua mensagem, seus arquétipos e sua direção de comunicação.",
              },
              {
                step: "02",
                icon: Target,
                title: "Receba sua estratégia e calendário",
                desc: "Tenha StoryBrand, análise de perfil e linha editorial conectados ao seu posicionamento.",
              },
              {
                step: "03",
                icon: Zap,
                title: "Publique com mais autoridade",
                desc: "Receba posts, carrosséis, roteiros e retratos alinhados à sua marca.",
              },
            ].map((s) => (
              <div key={s.step} className="p-6 rounded-xl border border-landing-border/50 bg-landing-bg-secondary/30 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-landing-gold tracking-wide">{s.step}</span>
                  <div className="w-9 h-9 rounded-lg bg-landing-purple/15 flex items-center justify-center">
                    <s.icon className="h-4 w-4 text-landing-purple" />
                  </div>
                </div>
                <h3 className="text-base font-semibold">{s.title}</h3>
                <p className="text-sm text-landing-text-secondary leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── POR QUE USAR ── */}
      <section className="py-16 md:py-20 px-4 bg-landing-bg-secondary/40">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-2xl md:text-3xl font-display font-semibold text-center">
            Para profissionais que{" "}
            <span className="text-landing-gold italic">não têm tempo de improvisar</span>
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Target, title: "Pare de postar no vazio", desc: "Cada conteúdo tem propósito estratégico e direção clara." },
              { icon: TrendingUp, title: "Atraia o cliente certo", desc: "Posicionamento que fala diretamente com quem precisa de você." },
              { icon: Zap, title: "Ganhe tempo sem parecer genérico", desc: "Conteúdo pronto, original e alinhado à sua marca." },
              { icon: Palette, title: "Sua marca, não um template qualquer", desc: "Tudo é construído a partir da sua essência única." },
            ].map((b, i) => (
              <div key={i} className="flex items-start gap-3 p-5 rounded-xl border border-landing-border/30">
                <div className="w-9 h-9 rounded-lg bg-landing-purple/10 flex items-center justify-center flex-shrink-0">
                  <b.icon className="h-4 w-4 text-landing-purple" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{b.title}</p>
                  <p className="text-xs text-landing-text-secondary mt-1 leading-relaxed">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROVA CONCRETA ── */}
      <section id="resultados" className="py-16 md:py-20 px-4">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-display font-semibold">
              Veja o que o Posiciona entrega{" "}
              <span className="text-landing-gold italic">na prática</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Brain,
                title: "Mapa de Arquétipos",
                desc: "Top 3 arquétipos com pontuação, forças, tom de voz e direção visual.",
                color: "text-purple-400",
              },
              {
                icon: Target,
                title: "StoryBrand Aplicado",
                desc: "Narrativa completa: personagem, problema, guia, plano e transformação.",
                color: "text-amber-400",
              },
              {
                icon: BarChart3,
                title: "Diagnóstico de Perfil",
                desc: "Análise estratégica da bio, conteúdo, hashtags e oportunidades.",
                color: "text-emerald-400",
              },
              {
                icon: Calendar,
                title: "Calendário Editorial",
                desc: "Semanas inteiras de conteúdo com temas, formatos e CTAs definidos.",
                color: "text-blue-400",
              },
              {
                icon: MessageSquare,
                title: "Conteúdos Prontos",
                desc: "Posts, carrosséis e roteiros de reels com legendas e chamadas para ação.",
                color: "text-pink-400",
              },
              {
                icon: Camera,
                title: "Retratos de Posicionamento",
                desc: "Retratos profissionais gerados por IA com base nos seus arquétipos.",
                color: "text-landing-gold",
              },
            ].map((item, i) => (
              <div key={i} className="group p-5 rounded-xl border border-landing-border/40 bg-landing-bg-secondary/20 hover:bg-landing-bg-secondary/40 transition-colors space-y-3">
                <div className="w-10 h-10 rounded-lg bg-landing-bg-secondary flex items-center justify-center">
                  <item.icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <h3 className="font-semibold text-sm">{item.title}</h3>
                <p className="text-xs text-landing-text-secondary leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANOS ── */}
      <section id="planos" className="py-16 md:py-20 px-4 bg-landing-bg-secondary/40">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-display font-semibold">Escolha seu plano</h2>
            <p className="text-sm text-landing-text-secondary">Comece com clareza. Evolua com constância. Reforce com imagem.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {plans.map((p) => (
              <div
                key={p.slug}
                className={`relative flex flex-col rounded-xl border p-6 transition-all ${
                  p.highlight
                    ? "border-landing-purple/60 bg-landing-bg-secondary/60 ring-1 ring-landing-purple/30"
                    : "border-landing-border/50 bg-landing-bg/50"
                }`}
              >
                {p.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-landing-purple text-white text-[10px] font-semibold tracking-wide uppercase">
                    Mais escolhido
                  </span>
                )}
                <div className="space-y-3 mb-5">
                  <h3 className="text-base font-semibold">{p.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-landing-text-secondary">R$</span>
                    <span className="text-3xl font-bold">{p.price}</span>
                    <span className="text-xs text-landing-text-secondary">{p.period}</span>
                  </div>
                  <p className="text-xs text-landing-text-secondary leading-relaxed">{p.description}</p>
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <Check className="h-3.5 w-3.5 text-landing-purple flex-shrink-0 mt-0.5" />
                      <span className="text-landing-text/80">{f}</span>
                    </li>
                  ))}
                  {p.notIncluded.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-landing-text-secondary/50">
                      <span className="w-3.5 text-center flex-shrink-0">—</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className={`w-full ${
                    p.highlight
                      ? "bg-landing-purple hover:bg-landing-purple/90 text-white"
                      : "bg-transparent border border-landing-border hover:bg-landing-bg-secondary text-landing-text"
                  }`}
                  onClick={() => handleCheckout(p.slug)}
                  disabled={loadingSlug === p.slug}
                >
                  {loadingSlug === p.slug && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {loadingSlug === p.slug ? "Processando..." : "Começar agora"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-16 md:py-20 px-4">
        <div className="max-w-2xl mx-auto space-y-8">
          <h2 className="text-2xl md:text-3xl font-display font-semibold text-center">Perguntas frequentes</h2>
          <Accordion type="single" collapsible className="w-full space-y-2">
            {faqItems.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-landing-border/40 rounded-lg px-4 bg-landing-bg-secondary/20">
                <AccordionTrigger className="text-left text-sm font-medium text-landing-text hover:no-underline py-4">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-landing-text-secondary pb-4 leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-16 md:py-20 px-4 bg-landing-bg-secondary/40">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <h2 className="text-2xl md:text-3xl font-display font-semibold leading-tight">
            Seu próximo cliente já está no Instagram.{" "}
            <span className="text-landing-gold italic">Sua marca está pronta para ser escolhida?</span>
          </h2>
          <p className="text-sm text-landing-text-secondary leading-relaxed">
            Comece agora e transforme posicionamento, imagem e conteúdo em uma presença mais clara, mais estratégica e mais valiosa.
          </p>
          <Button size="lg" onClick={() => navigate("/signup")} className="bg-landing-purple hover:bg-landing-purple/90 text-white text-base h-12 px-8">
            Criar minha conta agora <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <p className="text-xs text-landing-text-secondary/50">Sem fidelidade. Cancele quando quiser.</p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-landing-border/40 py-6 px-4 text-center">
        <p className="text-xs text-landing-text-secondary/50">© {new Date().getFullYear()} Posiciona. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
