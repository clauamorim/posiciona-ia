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
  Target, Brain, FileText, Camera,
  Check, ArrowRight, Loader2, Menu, X, Search, Palette,
  Image, TrendingUp, Zap, GripVertical
} from "lucide-react";
import posicionaLogo from "@/assets/posiciona-logo.png";
import heroIphones from "@/assets/hero-iphones-posiciona.png";
import pilar1Relatorio from "@/assets/pilar-1-relatorio-marca.png";
import pilar2Editorial from "@/assets/pilar-2-calendario-instagram.png";
import pilar3Stories from "@/assets/pilar-3-stories-venda.png";
import { useState, useCallback, useRef, useEffect } from "react";
import { SeoHead } from "@/components/SeoHead";

/* ── Plan data ── */
const plans = [
  {
    name: "Semana de Conteúdo",
    slug: "semana_conteudo",
    price: "197",
    period: "pagamento único",
    description: "Teste o Posiciona sem compromisso. Saia com posicionamento, narrativa e 7 dias de conteúdo prontos para publicar.",
    highlight: false,
    badge: "Para começar",
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
    footer: "Faça upgrade em até 7 dias e ganhe R$ 197 de desconto no plano superior",
  },
  {
    name: "Presença Mensal",
    slug: "presenca_mensal",
    price: "297",
    period: "/mês",
    description: "Nunca mais improvise. 4 semanas de conteúdo estratégico por mês, com reanálise mensal do seu posicionamento.",
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
    description: "Posicionamento, conteúdo e imagem profissional no mesmo lugar. O pacote completo para ser referência visível no seu nicho.",
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
  {
    name: "Posiciona Dupla",
    slug: "dupla",
    price: "797",
    period: "/mês",
    description: "Pra quem tem mais de um perfil — o seu, pessoal e institucional, ou dois clientes. Mesma potência do Autoridade Total, com créditos compartilhados entre os dois.",
    highlight: false,
    badge: "Pessoal + institucional",
    features: [
      "Tudo do Autoridade Total",
      "2 perfis simultâneos",
      "Créditos e reanálises compartilhados entre os perfis",
      "Troque de perfil sem sair da conta",
    ],
    notIncluded: [],
    footer: null,
  },
  {
    name: "Posiciona Multi",
    slug: "multi",
    price: "1.197",
    period: "/mês",
    description: "Até 4 perfis na mesma conta. Pra quem já atende alguns clientes e não quer abrir uma conta separada pra cada um.",
    highlight: false,
    badge: "Poucos clientes",
    features: [
      "Tudo do Autoridade Total",
      "Até 4 perfis simultâneos",
      "Ideal para quem atende poucos clientes",
      "Créditos compartilhados entre todos os perfis",
    ],
    notIncluded: [],
    footer: null,
  },
  {
    name: "Posiciona Agência",
    slug: "agencia",
    price: "2.197",
    period: "/mês",
    description: "Até 10 perfis, com o melhor custo por perfil de toda a régua. Pra quem faz disso um negócio.",
    highlight: false,
    badge: "Agências",
    features: [
      "Tudo do Autoridade Total",
      "Até 10 perfis simultâneos",
      "Melhor custo por perfil de toda a régua",
      "Créditos compartilhados entre todos os perfis",
    ],
    notIncluded: [],
    footer: null,
  },
];

const MULTI_PROFILE_SLUGS = ["dupla", "multi", "agencia"];
const individualPlans = plans.filter((p) => !MULTI_PROFILE_SLUGS.includes(p.slug));
const multiProfilePlans = plans.filter((p) => MULTI_PROFILE_SLUGS.includes(p.slug));

const faqItems = [
  { q: "Quanto tempo leva pra eu ter meu primeiro post pronto?", a: "Menos de 1 hora. Você responde 3 questionários rápidos (cerca de 15 minutos no total) e a IA entrega seu diagnóstico, narrativa e os primeiros conteúdos prontos para publicar." },
  { q: "Posso cancelar quando quiser?", a: "Sim. Não tem contrato, não tem fidelidade. Você cancela com 1 clique direto na sua conta." },
  { q: "A Posiciona substitui meu social media ou trabalha junto?", a: "Os dois funcionam. Profissionais que não têm social media usam a Posiciona como solução completa. Quem já trabalha com agência usa a Posiciona como diretriz estratégica — a agência executa com mais clareza e menos retrabalho." },
  { q: "Funciona pra qual rede social?", a: "Hoje a entrega é otimizada para Instagram (feed, carrossel, reels). A estratégia gerada serve de base para LinkedIn e outras redes." },
  { q: "Os conteúdos já vêm prontos pra publicar?", a: "Sim. Você recebe legenda, arte e CTA prontos. Pode publicar direto ou ajustar no editor interno se quiser personalizar algo." },
  { q: "Funciona pro meu nicho?", a: "A Posiciona é otimizada para profissionais liberais — advogados, médicos, dentistas, psicólogos, arquitetos, consultores, coaches e terapeutas. Se você atende clientes que valorizam autoridade e confiança, funciona." },
  { q: "Como funciona o suporte se eu travar?", a: "Atendimento direto via WhatsApp em horário comercial, com resposta em até 2 horas úteis. Nos planos mensais, você também tem acompanhamento estratégico da fundadora." },
  { q: "Os retratos profissionais estão inclusos?", a: "No plano Autoridade Total, sim — 5 retratos por mês. No plano Presença Mensal, retratos podem ser adquiridos como crédito extra. No plano Semana de Conteúdo (pagamento único), retratos não estão inclusos." },
];

/* Highlighted deliverables */

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
  const hasAnimated = useRef(false);

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

  // Auto-animate slider once when entering viewport: 50 → 100 → 0 → 50 (~4s, ease-in-out)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          observer.disconnect();
          const start = performance.now();
          const duration = 4000;
          const keyframes = [50, 100, 0, 50];
          const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
          let raf = 0;
          const tick = (now: number) => {
            if (isDragging.current) return; // user took control
            const t = Math.min(1, (now - start) / duration);
            const seg = t * (keyframes.length - 1);
            const i = Math.min(keyframes.length - 2, Math.floor(seg));
            const localT = easeInOut(seg - i);
            const value = keyframes[i] + (keyframes[i + 1] - keyframes[i]) * localT;
            setSliderPos(value);
            if (t < 1) raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
          return () => cancelAnimationFrame(raf);
        }
      });
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
          <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-md bg-background/70 backdrop-blur-sm text-[10px] font-medium text-landing-text-secondary tracking-wide uppercase">
            Retrato de estúdio
          </div>
          <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-md bg-background/70 backdrop-blur-sm text-[10px] font-medium text-landing-purple tracking-wide uppercase">
            Retrato do Posiciona
          </div>

          {/* Divider */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground/80 z-10"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-landing-gold flex items-center justify-center shadow-[0_2px_12px_rgba(201,168,76,0.5)]">
              <GripVertical className="h-4 w-4 text-background" />
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

  const renderPlanCard = (p: typeof plans[0]) => {
    const isPremium = p.slug === "autoridade_total" || MULTI_PROFILE_SLUGS.includes(p.slug);
    const isStarter = !p.highlight && !isPremium;
    return (
      <div
        key={p.slug}
        className={`relative flex flex-col rounded-xl border p-6 transition-all ${
          p.highlight
            ? "border-landing-purple/60 bg-landing-bg-secondary/60 ring-1 ring-landing-purple/30"
            : isPremium
              ? "border-landing-gold/30 bg-landing-bg-secondary/30"
              : "border-2 border-[#7DD3C0]/60 bg-landing-bg/50"
        }`}
      >
        {p.badge && (
          <span className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full text-xs font-medium tracking-wide uppercase ${
            p.highlight
              ? "bg-landing-purple text-foreground px-4 py-1"
              : isStarter
                ? "bg-[#7DD3C0] text-[#0B0820] px-4 py-1"
                : "bg-landing-gold text-foreground px-4 py-1"
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
              ? "bg-landing-purple hover:bg-landing-purple/90 text-foreground"
              : isPremium
                ? "bg-landing-gold/90 hover:bg-landing-gold text-foreground"
                : "bg-[#7DD3C0] text-[#0B0820] hover:bg-[#7DD3C0]/90"
          }`}
          onClick={() => handleCheckout(p.slug)}
          disabled={loadingSlug === p.slug}
        >
          {loadingSlug === p.slug && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          {loadingSlug === p.slug ? "Processando..." : "Começar agora"}
        </Button>
      </div>
    );
  };

  const scrollTo = (id: string) => {
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-dvh bg-landing-bg text-landing-text">
      <SeoHead
        title="Posiciona — Estratégia de Marca Pessoal com IA"
        description="Posicionamento estratégico para profissionais que querem cobrar pelo valor que entregam: arquétipos, narrativa StoryBrand, linha editorial e retratos de marca com IA."
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
            <button onClick={() => scrollTo("entrega")} className="hover:text-landing-text transition-colors">Resultados</button>
            <button onClick={() => scrollTo("planos")} className="hover:text-landing-text transition-colors">Planos</button>
            <button onClick={() => scrollTo("faq")} className="hover:text-landing-text transition-colors">FAQ</button>
            <Link to="/sobre" className="hover:text-landing-text transition-colors">Sobre</Link>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Button size="sm" onClick={() => navigate("/dashboard")} className="bg-landing-purple hover:bg-landing-purple/90 text-foreground">Dashboard</Button>
            ) : (
              <>
                <button onClick={() => navigate("/login")} className="text-sm text-landing-text-secondary hover:text-landing-text transition-colors">Entrar</button>
                <Button size="sm" onClick={() => navigate("/signup")} className="bg-landing-purple hover:bg-landing-purple/90 text-foreground">Criar conta</Button>
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
            <button onClick={() => scrollTo("entrega")} className="block text-sm text-landing-text-secondary hover:text-landing-text w-full text-left py-1">Resultados</button>
            <button onClick={() => scrollTo("planos")} className="block text-sm text-landing-text-secondary hover:text-landing-text w-full text-left py-1">Planos</button>
            <button onClick={() => scrollTo("faq")} className="block text-sm text-landing-text-secondary hover:text-landing-text w-full text-left py-1">FAQ</button>
            <Link to="/sobre" onClick={() => setMobileMenuOpen(false)} className="block text-sm text-landing-text-secondary hover:text-landing-text w-full text-left py-1">Sobre</Link>
            <div className="pt-2 border-t border-landing-border/40 flex gap-3">
              {user ? (
                <Button size="sm" onClick={() => navigate("/dashboard")} className="bg-landing-purple text-foreground w-full">Dashboard</Button>
              ) : (
                <>
                  <Button variant="ghost" size="sm" onClick={() => navigate("/login")} className="text-landing-text-secondary flex-1">Entrar</Button>
                  <Button size="sm" onClick={() => navigate("/signup")} className="bg-landing-purple text-foreground flex-1">Criar conta</Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main>
      {/* ── HERO ── */}
      <section className="pt-12 pb-16 md:pt-20 md:pb-14 px-4">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-landing-border bg-landing-bg-secondary/50 text-xs md:text-sm text-landing-text-secondary">
            <img src={posicionaLogo} alt="Posiciona" className="h-6 w-6" />
            Posicionamento estratégico para profissionais liberais
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-display font-semibold leading-[1.15] tracking-tight">
            Pare de competir por preço.{" "}
            <span className="italic text-landing-gold">Comece a ser escolhido pelo seu valor.</span>
          </h1>

          <p className="text-base md:text-lg text-landing-text-secondary max-w-2xl mx-auto leading-relaxed">
            Posicionamento de marca, narrativa e conteúdo estratégico para profissionais que querem atrair clientes de maior ticket — trabalhar menos, ganhar melhor e construir autoridade de verdade.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button size="lg" onClick={() => scrollTo("planos")} className="bg-landing-purple hover:bg-landing-purple/90 text-foreground text-base h-12 px-8">
              Quero atrair clientes de maior ticket <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => scrollTo("como-funciona")}
              className="bg-foreground/10 border border-foreground/30 text-foreground hover:bg-foreground/15 hover:text-foreground text-base h-12 px-8 backdrop-blur-sm"
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
              "Você atende muitos clientes, mas o preço médio não cresce",
              "Sente que seu trabalho vale mais do que o mercado paga por ele",
              "Quer trabalhar com menos clientes, melhor selecionados — mas não sabe como atraí-los",
              "Vê concorrentes menos preparados cobrando mais e fechando contratos no digital",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-lg border border-landing-border/50 bg-landing-bg/50">
                <div className="w-6 h-6 rounded-full bg-landing-purple/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs text-landing-purple font-semibold">{i + 1}</span>
                </div>
                <p className="text-sm font-medium text-landing-text/90">{item}</p>
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

      {/* ── O QUE O POSICIONA ENTREGA ── */}
      <section id="entrega" className="py-16 md:py-24 px-4">
        <div className="max-w-5xl lg:max-w-[1280px] mx-auto">

          {/* Cabeçalho */}
          <div className="text-center space-y-3 mb-16 md:mb-20">
            <h2 className="text-2xl md:text-3xl font-display font-semibold">
              Veja o que o Posiciona{" "}
              <span className="text-landing-gold italic">entrega</span>
            </h2>
            <p className="text-sm md:text-base text-landing-text-secondary max-w-2xl mx-auto leading-relaxed">
              Conteúdo estratégico, pronto para publicar — adaptado ao seu nicho, seu arquétipo e sua voz.
            </p>
          </div>

          {/* Hero da seção — 2 iPhones */}
          <div className="max-w-[800px] mx-auto mb-[80px] md:mb-[120px]">
            <img
              src={heroIphones}
              alt="Retrato e post gerados pelo Posiciona, exibidos lado a lado em dois iPhones"
              fetchPriority="high"
              decoding="async"
              width={1600}
              height={900}
              className="w-full h-auto rounded-xl"
              style={{ aspectRatio: "16/9", objectFit: "cover" }}
            />
            <p className="mt-3 text-xs text-center text-landing-text-secondary/60 italic">
              O retrato e o post gerados pelo Posiciona — com a mesma identidade visual, do primeiro ao último pixel.
            </p>
          </div>

          {/* Pilar 01 — texto esquerda, imagem direita */}
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center mb-[80px] md:mb-[120px]">
            <div className="space-y-8">
              <div>
                <span className="text-6xl font-display font-bold text-landing-purple/20 leading-none block">01</span>
                <h3 className="text-xl md:text-2xl font-display font-semibold mt-1">Diagnóstico e Identidade</h3>
                <p className="text-base md:text-[18px] text-landing-text-secondary mt-2 leading-relaxed">
                  Quem você é, no que você é referência, e como o mercado deve te enxergar.
                </p>
              </div>
              <ul className="space-y-5">
                <li className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-landing-purple flex-shrink-0" />
                  <p className="text-sm leading-[1.7]"><span className="font-semibold text-landing-text">Análise estratégica do seu negócio</span><span className="font-medium text-landing-text-secondary/85"> — diagnóstico de mercado, posicionamento atual e oportunidades.</span></p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-landing-purple flex-shrink-0" />
                  <p className="text-sm leading-[1.7]"><span className="font-semibold text-landing-text">Mapa de arquétipos</span><span className="font-medium text-landing-text-secondary/85"> — arquétipo principal e secundário com pontuação, forças, tom de voz e direção visual.</span></p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-landing-purple flex-shrink-0" />
                  <p className="text-sm leading-[1.7]"><span className="font-semibold text-landing-text">Narrativa StoryBrand</span><span className="font-medium text-landing-text-secondary/85"> — personagem, problema, guia, plano e transformação prontos.</span></p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-landing-purple flex-shrink-0" />
                  <p className="text-sm leading-[1.7]"><span className="font-semibold text-landing-text">Relatório de marca completo</span><span className="font-medium text-landing-text-secondary/85"> — paleta de cores, tipografia, estilo visual, símbolos, tom de voz e </span><span className="font-bold text-landing-gold">figurino estratégico</span><span className="font-medium text-landing-text-secondary/85"> para suas fotos.</span></p>
                </li>
              </ul>
              <p className="text-xs text-landing-text-secondary/70 italic border-l-2 border-landing-gold/40 pl-3 leading-relaxed">
                Sabia que sua roupa nas fotos pode fortalecer ou enfraquecer seu arquétipo? A Posiciona te diz exatamente como se vestir.
              </p>
            </div>
            <div
              className="rounded-xl border border-landing-border/40 shadow-[0_8px_40px_rgba(0,0,0,0.25)] overflow-hidden"
              style={{ aspectRatio: "4/3" }}
            >
              <img
                src={pilar1Relatorio}
                alt="Relatório de marca com paleta de cores, tipografia e estilo visual gerado pela Posiciona"
                loading="lazy"
                className="w-full h-full object-cover object-top"
              />
            </div>
          </div>

          {/* Pilar 02 — imagem esquerda, texto direita */}
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center mb-[80px] md:mb-[120px]">
            <div
              className="rounded-xl border border-landing-border/40 shadow-[0_8px_40px_rgba(0,0,0,0.25)] overflow-hidden md:order-first order-last"
              style={{ aspectRatio: "4/3", backgroundColor: "hsl(var(--card))" }}
            >
              <img
                src={pilar2Editorial}
                alt="Linha editorial semanal e análise estratégica do Instagram geradas pela Posiciona"
                className="w-full h-full object-cover object-top"
                loading="lazy"
              />
            </div>
            <div className="space-y-8">
              <div>
                <span className="text-6xl font-display font-bold text-landing-purple/20 leading-none block">02</span>
                <h3 className="text-xl md:text-2xl font-display font-semibold mt-1">Estratégia e Planejamento</h3>
                <p className="text-base md:text-[18px] text-landing-text-secondary mt-2 leading-relaxed">
                  O que postar, em qual ordem, pra qual objetivo.
                </p>
              </div>
              <ul className="space-y-5">
                <li className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-landing-purple flex-shrink-0" />
                  <p className="text-sm leading-[1.7]"><span className="font-semibold text-landing-text">Análise do seu Instagram atual</span><span className="font-medium text-landing-text-secondary/85"> — bio, posts, hashtags, fluxo de conteúdo e oportunidades não exploradas.</span></p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-landing-purple flex-shrink-0" />
                  <p className="text-sm leading-[1.7]"><span className="font-semibold text-landing-text">Linha editorial semanal</span><span className="font-medium text-landing-text-secondary/85"> — temas, formatos, CTAs e horários sugeridos para cada post.</span></p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-landing-purple flex-shrink-0" />
                  <p className="text-sm leading-[1.7]"><span className="font-semibold text-landing-text">Calendário recalibrado mensalmente</span><span className="font-medium text-landing-text-secondary/85"> — ajustado com base no que está funcionando.</span></p>
                </li>
              </ul>
            </div>
          </div>

          {/* Pilar 03 — texto esquerda, imagem direita */}
          <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div className="space-y-8">
              <div>
                <span className="text-6xl font-display font-bold text-landing-purple/20 leading-none block">03</span>
                <h3 className="text-xl md:text-2xl font-display font-semibold mt-1">Produção e Conversão</h3>
                <p className="text-base md:text-[18px] text-landing-text-secondary mt-2 leading-relaxed">
                  O conteúdo pronto pra publicar e pra vender.
                </p>
              </div>
              <ul className="space-y-5">
                <li className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-landing-purple flex-shrink-0" />
                  <p className="text-sm leading-[1.7]"><span className="font-semibold text-landing-text">Posts prontos</span><span className="font-medium text-landing-text-secondary/85"> — carrosséis e posts estáticos com legenda, arte e CTA, alinhados ao seu relatório de marca.</span></p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-landing-purple flex-shrink-0" />
                  <p className="text-sm leading-[1.7]"><span className="font-semibold text-landing-text">Stories de venda prontos</span><span className="font-medium text-landing-text-secondary/85"> — sequências completas que transformam seguidores em clientes usando a narrativa da sua marca. Você só publica.</span></p>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-landing-purple flex-shrink-0" />
                  <p className="text-sm leading-[1.7]"><span className="font-semibold text-landing-text">Retratos de posicionamento</span><span className="font-medium text-landing-text-secondary/85"> — imagens profissionais geradas por IA com base no seu arquétipo principal.</span></p>
                </li>
              </ul>
            </div>
            <div
              className="rounded-xl border border-landing-border/40 shadow-[0_8px_40px_rgba(0,0,0,0.25)] overflow-hidden"
              style={{ aspectRatio: "4/3" }}
            >
              <img
                src={pilar3Stories}
                alt="Sequências de stories de venda prontas para publicar, geradas pela Posiciona"
                loading="lazy"
                className="w-full h-full object-cover object-top"
              />
            </div>
          </div>

        </div>
      </section>

      {/* ── COMPARADOR DE RETRATOS ── */}
      <PortraitComparison />

      {/* ── POR QUE USAR ── */}
      <section className="py-12 md:py-16 px-4 bg-landing-bg-secondary/40">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-display font-semibold text-center mb-6">
            Feito para quem quer{" "}
            <span className="text-landing-gold italic">cobrar pelo valor que entrega</span>
          </h2>
          <p className="text-base md:text-[18px] font-normal text-landing-text-secondary/80 text-center leading-relaxed mb-12">
            Posicionamento estratégico, planejamento editorial e produção de conteúdo — entregues juntos pela primeira vez.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { icon: Target, title: "Coaches e consultores", desc: "Saia da guerra de preços. Atraia clientes que pagam pelo seu método, não pela hora." },
              { icon: TrendingUp, title: "Psicólogos e terapeutas", desc: "Construa autoridade que justifica sessões particulares de maior valor." },
              { icon: Zap, title: "Advogados e médicos", desc: "Posicione-se como referência premium no seu nicho — pacientes/clientes selecionados, ticket alto." },
              { icon: Palette, title: "Arquitetos, designers e fotógrafos", desc: "Atraia projetos de maior orçamento. Pare de competir com freela genérico." },
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

      {/* ── DEPOIMENTOS ── */}
      <section id="depoimentos" className="py-12 md:py-16 px-4 bg-landing-bg">
        <div className="max-w-6xl lg:max-w-[1280px] mx-auto space-y-10">
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
                avatar: "/testimonials/girlaydy.jpg",
              },
              {
                quote:
                  "Estou gostando muito do Posiciona. Achei demais a funcionalidade dos arquétipos, e a elaboração do calendário editorial está me ajudando muito a manter a constância na produção de conteúdo. Por fim, a geração de retratos foi um diferencial que me auxiliou a ter novas fotos profissionais para utilizar nas minhas publicações.",
                name: "Júnior Sales",
                role: "Gestor de tráfego",
                avatar: "/testimonials/junior.jpg",
              },
              {
                quote:
                  "O Posiciona é uma facilidade incrível para nós, profissionais! Fiquei encantada com todas as funções: desde o branding e a análise estratégica do Instagram, até a linha editorial que organiza a rotina. Com Posiciona é possível manter uma presença digital forte, e ainda sobram horas preciosas para focar nos nossos pacientes. E as fotos geradas? Simplesmente elevam o nível do perfil para outro patamar!",
                name: "Elisama Delmond",
                role: "Psicóloga",
                avatar: "/testimonials/elisama.jpg",
              },
              {
                quote:
                  "Adorei! Facilitou muito a minha vida, a administrar a minha própria rotina de trabalho de maneira mais eficiente. Me guiou, de maneira muito fácil de entender e pôr em prática. Me ajudou a decidir desde a bio do Instagram até as cores que transmitem a minha essência da maneira mais natural possível.",
                name: "Ângela Macário",
                role: "Fotógrafa",
                avatar: "/testimonials/angela.jpg",
              },
              {
                quote:
                  "Eu trabalho com estratégia de conteúdo para profissionais, então sou extremamente criteriosa com tudo que envolve esse tema. Usei a ferramenta Posiciona e o que mais me chamou atenção foi a objetividade e clareza na construção do posicionamento. Ela organiza toda a comunicação, direciona ajustes práticos que impactam diretamente na forma como o profissional é percebido no mercado de forma muito completa. Para quem precisa comunicar valor e sair do genérico, é uma ferramenta que acelera muito esse processo. Hoje, recomendo com segurança, principalmente para profissionais que querem ser vistos com mais autoridade e intenção no digital.",
                name: "Mariana Bertoldo",
                role: "Estrategista de conteúdo",
                avatar: "/testimonials/mariana.jpg",
              },
            ].map((t) => {
              const initials = t.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
              return (
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
                    {t.avatar ? (
                      <img
                        src={t.avatar}
                        alt={t.name}
                        loading="lazy"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextElementSibling as HTMLElement)?.style.removeProperty("display"); }}
                        className="w-14 h-14 rounded-full object-cover object-top border border-landing-border/40 flex-shrink-0"
                      />
                    ) : null}
                    <div
                      style={{ display: t.avatar ? "none" : undefined }}
                      className="w-14 h-14 rounded-full bg-muted text-foreground flex items-center justify-center text-sm font-semibold flex-shrink-0"
                    >
                      {initials}
                    </div>
                    <figcaption className="space-y-0.5">
                      <p className="text-sm md:text-base font-semibold text-landing-text">{t.name}</p>
                      <p className="text-xs md:text-sm text-landing-text-secondary">{t.role}</p>
                    </figcaption>
                  </div>
                </figure>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PLANOS ── */}
      <section id="planos" className="py-12 md:py-16 px-4 bg-landing-bg-secondary/40">
        <div className="max-w-5xl lg:max-w-[1280px] mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-display font-semibold">Escolha seu plano</h2>
            <p className="text-sm text-landing-text-secondary">Um social media custa R$ 2.000 a R$ 5.000 por mês. Uma consultoria de marca, R$ 3.000 por sessão. O Posiciona entrega os dois juntos — a partir de R$ 197.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {individualPlans.map((p) => renderPlanCard(p))}
          </div>

          <div className="space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-lg md:text-xl font-display font-semibold">Mais de um perfil na mesma conta</h3>
              <p className="text-xs md:text-sm text-landing-text-secondary">Pra quem tem perfil pessoal e institucional, ou atende clientes.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {multiProfilePlans.map((p) => renderPlanCard(p))}
            </div>
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
                <AccordionTrigger className="text-left text-base md:text-[17px] font-medium text-landing-text hover:no-underline py-4">
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
            Cada semana sem aparecer no Instagram é uma semana perdendo cliente pra concorrente menos preparado. Pare de disputar atenção —{" "}
            <span className="text-landing-gold italic">comece a ser escolhido pelo seu valor.</span>
          </h2>
          <p className="text-sm text-landing-text-secondary leading-relaxed">
            Responda o diagnóstico hoje. Amanhã você já tem posicionamento, narrativa e conteúdo prontos para publicar.
          </p>
          <Button size="lg" onClick={() => navigate("/signup")} className="bg-landing-purple hover:bg-landing-purple/90 text-foreground text-base h-12 px-8">
            Quero atrair clientes de maior ticket <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <p className="text-xs text-landing-text-secondary/50">Sem agência. Sem contrato. Resultado em minutos.</p>
        </div>
      </section>

      </main>

      {/* ── FOOTER ── */}
      <footer className="border-t border-landing-border/40 py-8 px-4">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-5">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={posicionaLogo} alt="Posiciona" className="h-7 w-7" />
            <span className="text-base font-semibold tracking-tight text-landing-text">Posiciona</span>
          </Link>
          <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4">
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
        </div>
      </footer>

      {/* Floating WhatsApp button */}
      <div className="fixed z-50 group" style={{ right: 20, bottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}>
        <span className="hidden md:block absolute -top-9 right-0 whitespace-nowrap rounded-lg bg-card border border-landing-border px-3 py-1.5 text-xs text-landing-text-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg">
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
