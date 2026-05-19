import { Link } from "react-router-dom";
import posicionaLogo from "@/assets/posiciona-logo.png";
import { Sparkles, FileText, CalendarDays } from "lucide-react";

interface AuthLayoutProps {
  children: React.ReactNode;
  /** Show the value-prop side panel on desktop. */
  showValueProp?: boolean;
}

export const AuthLayout = ({ children, showValueProp = false }: AuthLayoutProps) => {
  return (
    <main className="min-h-dvh bg-background flex flex-col lg:flex-row">
      {/* Header logo (top-left, links to landing) */}
      <Link
        to="/"
        className="absolute top-4 left-4 z-20 flex items-center gap-2 group"
        aria-label="Voltar para a página inicial"
      >
        <img src={posicionaLogo} alt="" className="h-8 w-8" />
        <span className="text-base font-bold font-display text-primary group-hover:opacity-80 transition-opacity">
          Posiciona
        </span>
      </Link>

      {/* Form column */}
      <div className="flex w-full lg:w-1/2 flex-1 items-center justify-center px-4 py-20 lg:py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>

      {/* Value-prop column (desktop only) */}
      {showValueProp && (
        <aside
          className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12 overflow-hidden"
          style={{ backgroundColor: "#0B0820" }}
        >
          <div
            className="absolute inset-0 opacity-60"
            style={{
              background:
                "radial-gradient(ellipse at top right, rgba(122,77,232,0.35), transparent 55%), radial-gradient(ellipse at bottom left, rgba(122,77,232,0.20), transparent 60%)",
            }}
            aria-hidden="true"
          />
          <div className="relative max-w-md text-white space-y-8">
            <h2 className="font-display text-4xl leading-tight" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
              Profissionais que cobram pelo valor que entregam.
            </h2>
            <p className="text-white/70 text-base leading-relaxed">
              Estratégia de posicionamento e conteúdo editorial pensados para quem vende confiança, não volume.
            </p>
            <ul className="space-y-4">
              {[
                { icon: Sparkles, text: "Diagnóstico de marca em 15 minutos" },
                { icon: FileText, text: "Narrativa StoryBrand pronta para usar" },
                { icon: CalendarDays, text: "Conteúdo semanal alinhado ao seu arquétipo" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: "rgba(122,77,232,0.18)", color: "#C9B6FF" }}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-white/90 text-sm leading-relaxed pt-1">{text}</span>
                </li>
              ))}
            </ul>
            <figure className="border-l-2 pl-4 text-white/80" style={{ borderColor: "rgba(122,77,232,0.6)" }}>
              <blockquote className="text-sm italic leading-relaxed">
                "Em duas semanas eu tinha clareza sobre o que comunicar e parei de improvisar conteúdo."
              </blockquote>
              <figcaption className="mt-3 flex items-center gap-2 text-xs text-white/60">
                <img
                  src="/testimonials/elisama.jpg"
                  alt=""
                  className="h-7 w-7 rounded-full object-cover object-top"
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
                Elisama · Psicóloga
              </figcaption>
            </figure>
          </div>
        </aside>
      )}
    </main>
  );
};
