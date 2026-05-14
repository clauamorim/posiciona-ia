import { useNavigate, Link } from "react-router-dom";
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
  Image, TrendingUp, Zap, ChevronLeft, ChevronRight, GripVertical
} from "lucide-react";
import posicionaLogo from "@/assets/posiciona-logo.png";
import { useState, useCallback, useRef, useEffect } from "react";
import { SeoHead } from "@/components/SeoHead";

/* ── Demo screenshots ── */
import demoDashboard from "@/assets/demo/dashboard.png";
import demoQuestionario from "@/assets/demo/questionario-arquetipos.png";
import demoArquetipos from "@/assets/demo/arquetipos.png";
import demoNarrativa from "@/assets/demo/narrativa-marca.png";
import demoEditorial from "@/assets/demo/linha-editorial.png";

const DEMO_SLIDES = [
  { src: demoDashboard, label: "Dashboard estratégico" },
  { src: demoQuestionario, label: "Diagnóstico guiado" },
  { src: demoArquetipos, label: "Resultado de posicionamento" },
  { src: demoNarrativa, label: "Narrativa da marca" },
  { src: demoEditorial, label: "Linha editorial pronta" },
];

/* ── Plan data ── */
const plans = [
  {
    name: "Semana de Conteúdo",
    slug: "semana_conteudo",
    price: "197",
    period: "pagamento único",
    description: "Para quem quer clareza e uma primeira semana estratégica pronta para usar.",
    highlight: false,
    badge: null,
    features: [
      "Diagnóstico inicial completo",
      "Guia de posicionamento e narrativa de marca",
      "3 arquétipos principais",
      "Análise inicial do Instagram",
      "1 ciclo editorial de 7 dias",
      "Conteúdos prontos para publicar",
      "3 créditos de ajuste de conteúdo",
    ],
    notIncluded: ["Retratos não inclusos"],
    footer: "Upgrade em até 7 dias e desconte R$ 197",
  },
  {
    name: "Presença Mensal",
    slug: "presenca_mensal",
    price: "297",
    period: "/mês",
    description: "Para quem quer manter consistência e continuar produzindo com estratégia ao longo do mês.",
    highlight: true,
    badge: "Mais escolhido",
    features: [
      "Tudo do Semana de Conteúdo",
      "4 ciclos semanais por mês",
      "1 reanálise estratégica mensal",
      "12 créditos de ajuste de conteúdo/mês",
      "Preço especial em extras",
    ],
    notIncluded: ["Retratos não inclusos"],
    footer: null,
  },
  {
    name: "Autoridade Total",
    slug: "autoridade_total",
    price: "497",
    period: "/mês",
    description: "Para quem quer combinar posicionamento contínuo com reforço visual e presença mais premium.",
    highlight: false,
    badge: "Mais completo",
    features: [
      "Tudo do Presença Mensal",
      "2 reanálises estratégicas/mês",
      "5 créditos de retrato inclusos/mês",
      "20 créditos de ajuste de conteúdo/mês",
      "Melhor preço em extras",
    ],
    notIncluded: [],
    footer: null,
  },
];

const faqItems = [
  { q: "Como funciona o diagnóstico inicial?", a: "Você preenche dois questionários: um sobre o seu negócio e outro de personalidade de marca. A partir das respostas, a IA calcula seus arquétipos, gera sua narrativa de marca e cria toda a estratégia de posicionamento." },
  { q: "Preciso entender de marketing para usar?", a: "Não. O Posiciona faz toda a parte estratégica por você. Basta responder os questionários com honestidade sobre o seu negócio e a IA cuida do resto." },
  { q: "Os conteúdos já vêm prontos?", a: "Sim. O app gera posts, carrosséis e roteiros de reels completos, com texto, chamada para ação e sugestão visual. Basta publicar." },
  { q: "Os retratos estão inclusos em todos os planos?", a: "Apenas o plano Autoridade Total inclui créditos mensais de retrato. Nos demais, você pode comprar créditos extras separadamente." },
  { q: "Posso comprar créditos extras?", a: "Sim! Todos os planos permitem a compra de créditos extras de retrato para complementar sua estratégia visual." },
  { q: "Isso serve para o meu nicho?", a: "O Posiciona é feito para profissionais que vendem expertise: coaches, consultores, terapeutas, advogados, médicos, designers, arquitetos e qualquer profissional liberal que precisa comunicar valor com mais clareza." },
  { q: "Em quanto tempo recebo os resultados?", a: "Os arquétipos e a narrativa de marca são gerados em minutos após completar os questionários. A linha editorial e os conteúdos são criados sob demanda." },
];

/* Highlighted deliverables */
const HIGHLIGHTED_DELIVERABLES = ["Mapa de Arquétipos", "Narrativa de Marca", "Calendário Editorial"];

/* ── Demo Carousel Component ── */
const DemoCarousel = ({ navigate }: { navigate: ReturnType<typeof useNavigate> }) => {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(0);

  const prev = () => setCurrent((c) => (c === 0 ? DEMO_SLIDES.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === DEMO_SLIDES.length - 1 ? 0 : c + 1));

  return (
    <section className="py-12 md:py-16 px-4 bg-landing-bg-secondary/40">
      <div className="max-w-5xl mx-auto space-y-8 text-center">
        <div className="space-y-3">
          <h2 className="text-2xl md:text-3xl font-display font-semibold">
            Veja o Posiciona{" "}
            <span className="text-landing-gold italic">por dentro</span>
          </h2>
          <p className="text-sm md:text-base text-landing-text-secondary max-w-2xl mx-auto leading-relaxed">
            Do diagnóstico à estratégia, da narrativa ao conteúdo: veja como a plataforma organiza seu posicionamento na prática.
          </p>
        </div>

        {/* Carousel */}
        <div className="relative">
          {/* Arrows */}
          <button
            onClick={prev}
            className="absolute left-0 md:-left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-landing-bg/80 border border-landing-border/50 flex items-center justify-center text-landing-text-secondary hover:text-landing-text hover:border-landing-purple/40 transition-all"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-0 md:-right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-landing-bg/80 border border-landing-border/50 flex items-center justify-center text-landing-text-secondary hover:text-landing-text hover:border-landing-purple/40 transition-all"
            aria-label="Próximo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Image */}
          <div
            className="overflow-hidden rounded-xl border border-landing-border/50 bg-landing-bg/80 shadow-[0_8px_40px_rgba(0,0,0,0.4)] mx-8 md:mx-0"
            onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              const diff = touchStartX.current - e.changedTouches[0].clientX;
              if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
            }}
          >
            <img
              src={DEMO_SLIDES[current].src}
              alt={DEMO_SLIDES[current].label}
              className="w-full h-auto object-contain transition-opacity duration-300"
              loading="lazy"
            />
          </div>

          {/* Caption */}
          <p className="mt-4 text-sm font-medium text-landing-text-secondary">
            {DEMO_SLIDES[current].label}
          </p>

          {/* Dots */}
          <div className="flex items-center justify-center gap-2 mt-3">
            {DEMO_SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  i === current
                    ? "bg-landing-purple w-6"
                    : "bg-landing-border hover:bg-landing-text-secondary/50"
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </div>

        <Button size="lg" onClick={() => navigate("/signup")} className="bg-landing-purple hover:bg-landing-purple/90 text-white text-base h-12 px-8">
          Começar meu posicionamento agora <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </section>
  );
};

/* ── Portrait Comparison Images ── */
import comparisonBase from "@/assets/comparison/foto-base.jpeg";
import comparisonRetrato1 from "@/assets/comparison/retrato-1.png";
import comparisonRetrato2 from "@/assets/comparison/retrato-2.png";

const PORTRAIT_OPTIONS = [
  { src: comparisonRetrato1, label: "Estilo 1" },
  { src: comparisonRetrato2, label: "Estilo 2" },
];

/* ── Portrait Comparison Component ── */
const PortraitComparison = () => {
  const [sliderPos, setSliderPos] = useState(50);
  const [activePortrait, setActivePortrait] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  useEffect(() => {
    const onUp = () => { isDragging.current = false; };
    const onMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouch = (e: TouchEvent) => handleMove(e.touches[0].clientX);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchend", onUp);
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("touchmove", onTouch);
    };
  }, [handleMove]);

  return (
    <section className="py-12 md:py-16 px-4">
      <div className="max-w-4xl mx-auto space-y-8 text-center">
        <div className="space-y-3">
          <h2 className="text-2xl md:text-3xl font-display font-semibold">
            Da foto base ao{" "}
            <span className="text-landing-gold italic">retrato de marca</span>
          </h2>
          <p className="text-sm md:text-base text-landing-text-secondary max-w-2xl mx-auto leading-relaxed">
            Compare um retrato feito em estúdio com as versões geradas pelo Posiciona.
          </p>
        </div>

        {/* Comparison slider */}
        <div
          ref={containerRef}
          className="relative aspect-[3/4] max-w-md mx-auto rounded-xl border border-landing-border/50 overflow-hidden select-none cursor-col-resize shadow-[0_8px_40px_rgba(0,0,0,0.4)]"
          onMouseDown={() => { isDragging.current = true; }}
          onTouchStart={() => { isDragging.current = true; }}
        >
          {/* Left side — Foto base (full) */}
          <img
            src={comparisonBase}
            alt="Foto base original"
            className="absolute inset-0 w-full h-full object-cover object-top"
            draggable={false}
          />

          {/* Right side — Retrato Posiciona (clipped from right) */}
          <div
            className="absolute inset-0"
            style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
          >
            <img
              src={PORTRAIT_OPTIONS[activePortrait].src}
              alt="Retrato gerado pelo Posiciona"
              className="absolute inset-0 w-full h-full object-cover object-top"
              draggable={false}
            />
          </div>

          {/* Labels */}
          <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-md bg-[#0D0B1A]/70 backdrop-blur-sm text-[10px] font-medium text-landing-text-secondary tracking-wide uppercase">
            Retrato de estúdio
          </div>
          <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-md bg-[#0D0B1A]/70 backdrop-blur-sm text-[10px] font-medium text-landing-purple tracking-wide uppercase">
            Retrato do Posiciona
          </div>

          {/* Divider */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/80 z-10"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-landing-gold flex items-center justify-center shadow-[0_2px_12px_rgba(201,168,76,0.5)]">
              <GripVertical className="h-4 w-4 text-[#0D0B1A]" />
            </div>
          </div>
        </div>

        <p className="text-xs text-landing-text-secondary/50 italic">Deslize para comparar</p>

        {/* Portrait thumbnails */}
        <div className="flex items-center justify-center gap-3">
          {PORTRAIT_OPTIONS.map((p, i) => (
            <button
              key={i}
              onClick={() => setActivePortrait(i)}
              className={`relative w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                i === activePortrait
                  ? "border-landing-gold shadow-[0_0_12px_rgba(201,168,76,0.3)]"
                  : "border-landing-border/40 opacity-60 hover:opacity-90"
              }`}
              aria-label={p.label}
            >
              <img src={p.src} alt={p.label} className="w-full h-full object-cover object-top" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
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
      <SeoHead
        title="Posiciona — Estratégia de Marca Pessoal com IA"
        description="Posicionamento estratégico para profissionais que vendem expertise: arquétipos, narrativa StoryBrand, linha editorial pronta e retratos de marca com IA."
        path="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }}
      />
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 border-b border-landing-border/60 bg-landing-bg/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <img src={posicionaLogo} alt="Posiciona" className="h-10 w-10" />
            <span className="text-xl md:text-2xl font-semibold tracking-tight">Posiciona</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm md:text-base text-landing-text-secondary">
            <button onClick={() => scrollTo("como-funciona")} className="hover:text-landing-text transition-colors">Como funciona</button>
            <button onClick={() => scrollTo("resultados")} className="hover:text-landing-text transition-colors">Resultados</button>
            <button onClick={() => scrollTo("planos")} className="hover:text-landing-text transition-colors">Planos</button>
            <button onClick={() => scrollTo("faq")} className="hover:text-landing-text transition-colors">FAQ</button>
            <Link to="/sobre" className="hover:text-landing-text transition-colors">Sobre</Link>
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

          <button className="md:hidden p-1" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-landing-border/60 bg-landing-bg px-4 py-4 space-y-3">
            <button onClick={() => scrollTo("como-funciona")} className="block text-sm text-landing-text-secondary hover:text-landing-text w-full text-left py-1">Como funciona</button>
            <button onClick={() => scrollTo("resultados")} className="block text-sm text-landing-text-secondary hover:text-landing-text w-full text-left py-1">Resultados</button>
            <button onClick={() => scrollTo("planos")} className="block text-sm text-landing-text-secondary hover:text-landing-text w-full text-left py-1">Planos</button>
            <button onClick={() => scrollTo("faq")} className="block text-sm text-landing-text-secondary hover:text-landing-text w-full text-left py-1">FAQ</button>
            <Link to="/sobre" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-landing-text-secondary hover:text-landing-text w-full text-left py-1">Sobre</Link>
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

      <main>
      {/* ── HERO ── */}
      <section className="pt-12 pb-16 md:pt-20 md:pb-24 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-landing-border bg-landing-bg-secondary/50 text-xs md:text-sm text-landing-text-secondary">
            <img src={posicionaLogo} alt="Posiciona" className="h-6 w-6" />
            Posicionamento de marca com IA para profissionais que vendem expertise
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-semibold leading-[1.15] tracking-tight">
            Você já é referência na sua área.{" "}
            <span className="italic text-landing-gold">Seu Instagram ainda não mostra isso.</span>
          </h1>

          <p className="text-base md:text-lg text-landing-text-secondary max-w-2xl mx-auto leading-relaxed">
            Responda 3 questionários sobre seu negócio. Em minutos, receba seu posicionamento, sua narrativa de marca e uma semana inteira de conteúdo pronto para publicar — sem agência, sem improvisar.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button size="lg" onClick={() => navigate("/signup")} className="bg-landing-purple hover:bg-landing-purple/90 text-white text-base h-12 px-8">
              Criar meu posicionamento <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => scrollTo("como-funciona")}
              className="bg-white/10 border border-white/30 text-white hover:bg-white/15 hover:text-white text-base h-12 px-8 backdrop-blur-sm"
            >
              Ver como funciona
            </Button>
          </div>

          <p className="text-xs text-landing-text-secondary/60 pt-1">
            Sem contrato. Cancele quando quiser.
          </p>
        </div>
      </section>

      {/* ── PROBLEMA ── */}
      <section className="py-12 md:py-16 px-4 bg-landing-bg-secondary/40">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-2xl md:text-3xl font-display font-semibold leading-tight">
            Parece familiar?{" "}
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 text-left max-w-2xl mx-auto">
            {[
              "Domingo à noite e você ainda não sabe o que postar segunda",
              "Colegas com menos experiência parecem mais visíveis que você",
              "Você cobra bem, mas seu perfil não transmite isso",
              "Publica quando dá, some por semanas, recomeça do zero",
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
      <section id="como-funciona" className="py-12 md:py-16 px-4">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-display font-semibold">
              Do questionário ao conteúdo pronto em{" "}
              <span className="text-landing-gold italic">menos de 1 hora</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                icon: Search,
                title: "Responda o diagnóstico (15 minutos)",
                desc: "3 questionários sobre seu negócio e personalidade de marca. A IA identifica seus arquétipos e organiza sua direção de comunicação.",
              },
              {
                step: "02",
                icon: Target,
                title: "Receba posicionamento e narrativa prontos",
                desc: "Tenha narrativa de marca, análise de perfil e linha editorial conectados ao seu posicionamento.",
              },
              {
                step: "03",
                icon: Zap,
                title: "Publique com mais autoridade",
                desc: "Posts, carrosséis, roteiros de reels e retratos profissionais — tudo alinhado ao seu posicionamento.",
              },
            ].map((s) => (
              <div key={s.step} className="p-6 rounded-xl border border-landing-border/50 bg-landing-bg-secondary/30 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-landing-gold tracking-wide">{s.step}</span>
                  <div className="w-9 h-9 rounded-lg bg-landing-purple/15 flex items-center justify-center">
                    <s.icon className="h-4 w-4 text-landing-purple" />
                  </div>
                </div>
                <h3 className="text-base md:text-lg font-semibold">{s.title}</h3>
                <p className="text-sm md:text-base text-landing-text-secondary leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMONSTRAÇÃO ── */}
      <DemoCarousel navigate={navigate} />

      {/* ── COMPARADOR DE RETRATOS ── */}
      <PortraitComparison />

      {/* ── POR QUE USAR ── */}
      <section className="py-12 md:py-16 px-4 bg-landing-bg-secondary/40">
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
                  <p className="font-semibold text-sm md:text-base">{b.title}</p>
                  <p className="text-xs md:text-sm text-landing-text-secondary mt-1 leading-relaxed">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROVA CONCRETA (entregáveis) ── */}
      <section id="resultados" className="py-12 md:py-16 px-4">
        <div className="max-w-5xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-display font-semibold">
              Veja o que o Posiciona entrega{" "}
              <span className="text-landing-gold italic">na prática</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: Brain, title: "Mapa de Arquétipos", desc: "Top 3 arquétipos com pontuação, forças, tom de voz e direção visual.", color: "text-purple-400" },
              { icon: Target, title: "Narrativa de Marca", desc: "Narrativa completa: personagem, problema, guia, plano e transformação.", color: "text-amber-400" },
              { icon: BarChart3, title: "Diagnóstico de Perfil", desc: "Análise estratégica da bio, conteúdo, hashtags e oportunidades.", color: "text-emerald-400" },
              { icon: Calendar, title: "Calendário Editorial", desc: "Semanas inteiras de conteúdo com temas, formatos e CTAs definidos.", color: "text-blue-400" },
              { icon: MessageSquare, title: "Conteúdos Prontos", desc: "Posts, carrosséis e roteiros de reels com legendas e chamadas para ação.", color: "text-pink-400" },
              { icon: Camera, title: "Retratos de Posicionamento", desc: "Retratos profissionais gerados por IA com base nos seus arquétipos.", color: "text-landing-gold" },
            ].map((item, i) => {
              const isHighlighted = HIGHLIGHTED_DELIVERABLES.includes(item.title);
              return (
                <div
                  key={i}
                  className={`group p-5 rounded-xl border border-landing-border/40 transition-colors space-y-3 ${
                    isHighlighted
                      ? "bg-landing-bg-secondary/40 ring-1 ring-landing-purple/10"
                      : "bg-landing-bg-secondary/20 hover:bg-landing-bg-secondary/40"
                  }`}
                >
                  <div className="w-10 h-10 rounded-lg bg-landing-bg-secondary flex items-center justify-center">
                    <item.icon className={`h-5 w-5 ${item.color}`} />
                  </div>
                  <h3 className="font-semibold text-sm md:text-base">{item.title}</h3>
                  <p className="text-xs md:text-sm text-landing-text-secondary leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ── */}
      <section id="depoimentos" className="py-12 md:py-16 px-4 bg-landing-bg">
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-landing-gold">Quem já usou</p>
            <h2 className="text-2xl md:text-3xl font-display font-semibold leading-tight">
              Resultados que falam por si —{" "}
              <span className="italic text-landing-gold">em palavras de quem confiou no processo.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5 items-start">
            {[
              {
                quote:
                  "Fui afortunada com o sistema Posiciona.ia.br e ele trouxe muita clareza para o meu posicionamento. O relatório de nicho e arquétipo direciona bem, e o plano de conteúdo facilita a execução com qualidade. É uma ferramenta essencial para quem busca consistência e um processo contínuo na comunicação profissional.",
                name: "Girlaydy Costa",
                role: "Fotógrafa",
              },
              {
                quote:
                  "Estou gostando muito do Posiciona. Achei demais a funcionalidade dos arquétipos, e a elaboração do calendário editorial está me ajudando muito a manter a constância na produção de conteúdo. Por fim, a geração de retratos foi um diferencial que me auxiliou a ter novas fotos profissionais para utilizar nas minhas publicações.",
                name: "Júnior Sales",
                role: "Gestor de tráfego",
              },
              {
                quote:
                  "O Posiciona é uma facilidade incrível para nós, profissionais! Fiquei encantada com todas as funções: desde o branding e a análise estratégica do Instagram, até a linha editorial que organiza a rotina. Com Posiciona é possível manter uma presença digital forte, e ainda sobram horas preciosas para focar nos nossos pacientes. E as fotos geradas? Simplesmente elevam o nível do perfil para outro patamar!",
                name: "Elisama Delmond",
                role: "Psicóloga",
              },
              {
                quote:
                  "Eu trabalho com estratégia de conteúdo para profissionais, então sou extremamente criteriosa com tudo que envolve esse tema. Usei a ferramenta Posiciona e o que mais me chamou atenção foi a objetividade e clareza na construção do posicionamento. Ela organiza toda a comunicação, direciona ajustes práticos que impactam diretamente na forma como o profissional é percebido no mercado de forma muito completa. Para quem precisa comunicar valor e sair do genérico, é uma ferramenta que acelera muito esse processo. Hoje, recomendo com segurança, principalmente para profissionais que querem ser vistos com mais autoridade e intenção no digital.",
                name: "Mariana Bertoldo",
                role: "Estrategista de conteúdo",
              },
            ].map((t) => (
              <figure
                key={t.name}
                className="relative flex flex-col rounded-xl border border-landing-border/40 bg-landing-bg-secondary/30 p-6 pt-8"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-2 left-5 font-display text-6xl leading-none text-landing-gold/30 select-none"
                >
                  &ldquo;
                </span>
                <blockquote className="text-sm md:text-base leading-relaxed text-landing-text/90">
                  {t.quote}
                </blockquote>
                <div className="mt-5 pt-5 border-t border-landing-border/30 flex items-center gap-3">
                  <span className="block w-8 h-px bg-landing-gold/50" aria-hidden="true" />
                  <figcaption className="space-y-0.5">
                    <p className="text-sm md:text-base font-semibold text-landing-text">{t.name}</p>
                    <p className="text-xs md:text-sm text-landing-text-secondary">{t.role}</p>
                  </figcaption>
                </div>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANOS ── */}
      <section id="planos" className="py-12 md:py-16 px-4 bg-landing-bg-secondary/40">
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
                    : p.slug === "autoridade_total"
                      ? "border-landing-gold/30 bg-landing-bg-secondary/30"
                      : "border-landing-border/50 bg-landing-bg/50"
                }`}
              >
                {p.badge && (
                  <span className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-white text-[10px] font-semibold tracking-wide uppercase ${
                    p.highlight ? "bg-landing-purple" : "bg-landing-gold"
                  }`}>
                    {p.badge}
                  </span>
                )}
                <div className="space-y-3 mb-5">
                  <h3 className="text-base md:text-lg font-semibold">{p.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs text-landing-text-secondary">R$</span>
                    <span className="text-3xl font-bold">{p.price}</span>
                    <span className="text-xs text-landing-text-secondary">{p.period}</span>
                  </div>
                  <p className="text-xs md:text-sm text-landing-text-secondary leading-relaxed">{p.description}</p>
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs md:text-sm">
                      <Check className="h-3.5 w-3.5 md:h-4 md:w-4 text-landing-purple flex-shrink-0 mt-0.5" />
                      <span className="text-landing-text/80">{f}</span>
                    </li>
                  ))}
                  {p.notIncluded.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs md:text-sm text-landing-text-secondary/50">
                      <span className="w-3.5 text-center flex-shrink-0">—</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {p.footer && (
                  <p className="text-[10px] text-landing-text-secondary/60 mt-2 text-center italic">{p.footer}</p>
                )}

                <Button
                  className={`w-full ${
                    p.highlight
                      ? "bg-landing-purple hover:bg-landing-purple/90 text-white"
                      : p.slug === "autoridade_total"
                        ? "bg-landing-gold/90 hover:bg-landing-gold text-white"
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
      <section id="faq" className="py-12 md:py-16 px-4">
        <div className="max-w-2xl mx-auto space-y-8">
          <h2 className="text-2xl md:text-3xl font-display font-semibold text-center">Perguntas frequentes</h2>
          <Accordion type="single" collapsible className="w-full space-y-2">
            {faqItems.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border border-landing-border/40 rounded-lg px-4 bg-landing-bg-secondary/20">
                <AccordionTrigger className="text-left text-base md:text-lg font-medium text-landing-text hover:no-underline py-4">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm md:text-base text-landing-text-secondary pb-4 leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="py-12 md:py-16 px-4 bg-landing-bg-secondary/40">
        <div className="max-w-2xl mx-auto text-center space-y-5">
          <h2 className="text-2xl md:text-3xl font-display font-semibold leading-tight">
            Seu próximo cliente já está no Instagram.{" "}
            <span className="text-landing-gold italic">Sua marca está pronta para ser escolhida?</span>
          </h2>
          <p className="text-sm text-landing-text-secondary leading-relaxed">
            Comece agora e transforme posicionamento, imagem e conteúdo em uma presença mais clara, mais estratégica e mais valiosa.
          </p>
          <Button size="lg" onClick={() => navigate("/signup")} className="bg-landing-purple hover:bg-landing-purple/90 text-white text-base h-12 px-8">
            Começar meu posicionamento agora <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <p className="text-xs text-landing-text-secondary/50">Sem fidelidade. Cancele quando quiser.</p>
        </div>
      </section>

      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-landing-border/40 py-8 px-4">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-landing-text-secondary/50">© {new Date().getFullYear()} Posiciona. Todos os direitos reservados.</p>
          <div className="flex flex-col sm:flex-row items-center gap-3 text-xs text-landing-text-secondary/60">
            <Link to="/termos-de-servico" className="hover:text-landing-gold transition-colors">Termos de Serviço</Link>
            <span className="hidden sm:inline text-landing-border">|</span>
            <Link to="/politica-de-privacidade" className="hover:text-landing-gold transition-colors">Política de Privacidade</Link>
            <span className="hidden sm:inline text-landing-border">|</span>
            <a href="https://instagram.com/posiciona.ia.br" target="_blank" rel="noopener noreferrer" className="hover:text-landing-gold transition-colors flex items-center gap-1.5">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              @posiciona.ia.br
            </a>
            <span className="hidden sm:inline text-landing-border">|</span>
            <a href="mailto:contato@posiciona.ia.br" className="hover:text-landing-gold transition-colors">contato@posiciona.ia.br</a>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp button */}
      <div className="fixed z-50 group" style={{ right: 20, bottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}>
        <span className="hidden md:block absolute -top-9 right-0 whitespace-nowrap rounded-lg bg-[#13102A] border border-landing-border px-3 py-1.5 text-xs text-landing-text-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg">
          Fale no WhatsApp
        </span>
        <a
          href="https://wa.me/5562994400707"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center rounded-full shadow-[0_4px_20px_rgba(201,168,76,0.3)] transition-all duration-200 hover:shadow-[0_6px_24px_rgba(201,168,76,0.45)] active:scale-[0.97] h-14 w-14 md:h-[60px] md:w-[60px]"
          style={{ backgroundColor: "#C9A84C" }}
          aria-label="Fale conosco no WhatsApp"
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E2C06A")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#C9A84C")}
        >
          <svg viewBox="0 0 32 32" className="h-6 w-6 md:h-[26px] md:w-[26px]" fill="#0D0B1A">
            <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16.004c0 3.5 1.132 6.744 3.056 9.38L1.058 31.2l6.06-1.94A15.92 15.92 0 0016.004 32C24.826 32 32 24.826 32 16.004 32 7.176 24.826 0 16.004 0zm9.316 22.594c-.39 1.1-1.932 2.014-3.164 2.282-.844.18-1.946.324-5.66-1.216-4.752-1.97-7.81-6.79-8.046-7.104-.228-.314-1.87-2.49-1.87-4.748s1.184-3.37 1.604-3.832c.42-.462.918-.578 1.224-.578.306 0 .612.002.878.016.282.014.66-.108.934.712.306.876 1.044 3.022 1.134 3.242.092.22.154.478.032.77-.122.292-.184.474-.368.734-.184.26-.386.58-.552.778-.184.214-.376.446-.162.876.214.43.952 1.568 2.044 2.54 1.404 1.252 2.588 1.64 2.954 1.822.368.184.582.154.796-.092.214-.246.918-1.07 1.162-1.438.246-.368.49-.306.828-.184.336.122 2.138 1.008 2.504 1.192.368.184.612.276.702.43.092.154.092.878-.298 1.978z"/>
          </svg>
        </a>
      </div>
    </div>
  );
};

export default LandingPage;
