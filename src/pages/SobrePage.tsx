import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowRight, Menu, X } from "lucide-react";
import posicionaLogo from "@/assets/posiciona-logo.png";
import claudiaPhoto from "@/assets/claudia-avatar.webp";
import { useState } from "react";
import { SeoHead } from "@/components/SeoHead";

const SobrePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-landing-bg text-landing-text">
      <SeoHead
        title="Sobre — Posiciona"
        description="Conheça a história e o método por trás do Posiciona, criado por Cláudia Amorim para profissionais que vendem expertise."
        path="/sobre"
      />
      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 border-b border-landing-border/60 bg-landing-bg/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <img src={posicionaLogo} alt="Posiciona" className="h-8 w-8" />
            <span className="text-lg font-semibold tracking-tight">Posiciona</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-landing-text-secondary">
            <Link to="/" className="hover:text-landing-text transition-colors">Início</Link>
            <Link to="/sobre" className="text-landing-text font-medium transition-colors">Sobre</Link>
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
            <Link to="/" className="block text-sm text-landing-text-secondary hover:text-landing-text w-full text-left py-1">Início</Link>
            <Link to="/sobre" className="block text-sm text-landing-text font-medium w-full text-left py-1">Sobre</Link>
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
      <section className="pt-12 pb-10 md:pt-20 md:pb-16 px-4">
        <div className="max-w-3xl mx-auto flex flex-col items-center text-center space-y-6">
          {/* Photo — larger and more prominent */}
          <div className="relative">
            <div className="w-44 h-44 md:w-56 md:h-56 rounded-full overflow-hidden ring-2 ring-landing-border/40 ring-offset-4 ring-offset-landing-bg shadow-2xl">
              <img
                src={claudiaPhoto}
                alt="Cláudia Amorim — Criadora do Posiciona"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = "none";
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = "flex";
                }}
              />
              <div
                className="w-full h-full items-center justify-center bg-landing-bg-secondary text-landing-text-secondary text-2xl font-semibold"
                style={{ display: "none" }}
              >
                CL
              </div>
            </div>
          </div>

          {/* Identity */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-landing-gold">Criadora do Posiciona</p>
            <h2 className="text-2xl md:text-3xl font-display font-semibold">Cláudia Amorim</h2>
            <p className="text-sm text-landing-text-secondary">Posicionamento de imagem, estratégia e tecnologia</p>
          </div>

          {/* Main headline */}
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold leading-[1.2] tracking-tight max-w-2xl">
            Você é excelente no que faz —{" "}
            <span className="italic text-landing-gold">sua presença online também deveria demonstrar isso.</span>
          </h1>

          <p className="text-base text-landing-text-secondary max-w-2xl leading-relaxed">
            O Posiciona nasceu para ajudar profissionais altamente competentes a transformar conhecimento, experiência e autoridade em uma presença clara, coerente e confiável.
          </p>
        </div>
      </section>

      {/* ── DIFERENCIAL TÉCNICO (early mention) ── */}
      <section className="py-10 md:py-14 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="p-6 rounded-xl border border-landing-purple/20 bg-landing-bg-secondary/30 text-center space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-landing-purple/80">A base que sustenta o Posiciona</p>
            <p className="text-base md:text-lg text-landing-text/90 font-display italic leading-relaxed">
              "20 anos de fotografia, 4 anos de posicionamento de imagem e uma formação em Ciência da Computação. A união entre percepção visual, estratégia e tecnologia."
            </p>
          </div>
        </div>
      </section>

      {/* ── TESE ── */}
      <section className="py-10 md:py-14 px-4 bg-landing-bg-secondary/40">
        <div className="max-w-2xl mx-auto space-y-5 text-center">
          <h2 className="text-2xl md:text-3xl font-display font-semibold leading-tight">
            Competência não é o problema.{" "}
            <span className="text-landing-gold italic">Clareza é.</span>
          </h2>
          <p className="text-sm md:text-base text-landing-text-secondary leading-relaxed">
            A maioria dos profissionais que atendo — advogados, médicos, executivos e especialistas — domina profundamente sua área. O problema raramente está na entrega. Está na forma como essa entrega aparece online. Sem posicionamento, até a competência mais sólida pode parecer genérica, confusa ou invisível.
          </p>
        </div>
      </section>

      {/* ── ORIGEM E AUTORIDADE ── */}
      <section className="py-10 md:py-14 px-4">
        <div className="max-w-2xl mx-auto space-y-6">
          <p className="text-sm md:text-base text-landing-text/90 leading-relaxed">
            Entendo esse problema de dentro. Depois de duas décadas na fotografia, aprendi a perceber o que faz uma presença transmitir força, confiança e distinção antes mesmo de qualquer palavra ser lida.
          </p>

          {/* Highlighted quote block */}
          <div className="border-l-2 border-landing-gold pl-6 py-2">
            <p className="text-sm md:text-base text-landing-text/90 leading-relaxed">
              Nos últimos 4 anos, aprofundei esse trabalho por meio do posicionamento de imagem com arquétipos de marca e do framework de narrativa de marca (StoryBrand). Minha formação em Ciência da Computação e minha experiência prévia na área me deram uma base rara: transformar percepção, estratégia e linguagem em lógica aplicada e tecnologia.
            </p>
          </div>

          <p className="text-sm md:text-base text-landing-text/90 leading-relaxed">
            Foi dessa união que surgiu o Posiciona: uma plataforma criada para simplificar um processo que normalmente exige consultoria, repertório de marca, clareza de mensagem e tempo.
          </p>
        </div>
      </section>

      {/* ── O QUE TORNA DIFERENTE ── */}
      <section className="py-10 md:py-14 px-4 bg-landing-bg-secondary/40">
        <div className="max-w-4xl mx-auto space-y-10">
          <h2 className="text-2xl md:text-3xl font-display font-semibold text-center">
            O que torna o Posiciona{" "}
            <span className="text-landing-gold italic">diferente</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                title: "Imagem com intenção",
                desc: "A presença visual não é tratada como estética solta, mas como extensão do posicionamento.",
              },
              {
                title: "Arquétipos e Narrativa de Marca",
                desc: "A comunicação é construída com base em identidade, clareza de mensagem e percepção de autoridade.",
              },
              {
                title: "Estratégia transformada em tecnologia",
                desc: "O processo é organizado para entregar direção prática em minutos, sem exigir que o usuário domine branding, copywriting ou marketing.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="p-6 rounded-xl border border-landing-border/50 bg-landing-bg/50 space-y-3"
              >
                <h3 className="text-base font-semibold">{card.title}</h3>
                <p className="text-sm text-landing-text-secondary leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ── */}
      <section className="px-4">
        <div className="max-w-3xl mx-auto">
          <div className="border-t border-landing-border/40" />
        </div>
      </section>

      <section className="py-10 md:py-14 px-4">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <h2 className="text-2xl md:text-3xl font-display font-semibold leading-tight">
            Pronto para construir uma presença que reflita{" "}
            <span className="text-landing-gold italic">a qualidade do seu trabalho?</span>
          </h2>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/")}
              className="bg-landing-purple hover:bg-landing-purple/90 text-white text-base h-12 px-8"
            >
              Começar meu posicionamento agora <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/")}
              className="border-landing-border text-landing-text-secondary hover:bg-landing-bg-secondary hover:text-landing-text text-base h-12 px-8"
            >
              Voltar para a página inicial
            </Button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-landing-border/40 py-6 px-4">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-landing-text-secondary/50">
          <p>© {new Date().getFullYear()} Posiciona. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <Link to="/termos-de-servico" className="hover:text-landing-gold transition-colors">Termos de Serviço</Link>
            <Link to="/politica-de-privacidade" className="hover:text-landing-gold transition-colors">Política de Privacidade</Link>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp */}
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
          <svg viewBox="0 0 32 32" className="h-7 w-7 md:h-8 md:w-8 fill-black">
            <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16.004c0 3.5 1.132 6.744 3.056 9.38L1.058 31.2l6.06-1.94A15.92 15.92 0 0016.004 32C24.826 32 32 24.826 32 16.004 32 7.176 24.826 0 16.004 0zm9.316 22.594c-.39 1.1-1.932 2.014-3.164 2.282-.844.18-1.946.324-5.66-1.216-4.752-1.97-7.81-6.79-8.046-7.104-.228-.314-1.87-2.49-1.87-4.748s1.184-3.37 1.604-3.832c.42-.462.918-.578 1.224-.578.306 0 .612.002.878.016.282.014.66-.108.934.712.306.876 1.044 3.022 1.134 3.242.092.22.154.478.032.77-.122.292-.184.474-.368.734-.184.26-.386.58-.552.778-.184.214-.376.446-.162.876.214.43.952 1.568 2.044 2.54 1.404 1.252 2.588 1.64 2.954 1.822.368.184.582.154.796-.092.214-.246.918-1.07 1.162-1.438.246-.368.49-.306.828-.184.336.122 2.138 1.008 2.504 1.192.368.184.612.276.702.43.092.154.092.878-.298 1.978z" />
          </svg>
        </a>
      </div>
    </div>
  );
};

export default SobrePage;
