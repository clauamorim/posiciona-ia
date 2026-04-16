import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";

interface LegalPageLayoutProps {
  title: string;
  metaTitle: string;
  metaDescription: string;
  lastUpdated: string;
  breadcrumb: string;
  children: React.ReactNode;
}

const LegalPageLayout = ({ title, metaTitle, metaDescription, lastUpdated, breadcrumb, children }: LegalPageLayoutProps) => {
  return (
    <>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
      </Helmet>
      <div className="min-h-screen bg-[#0D0B1A] text-white">
        {/* Header */}
        <header className="border-b border-[#2E2A4A]/60 bg-[#0D0B1A]/90 backdrop-blur-md">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-sm text-[#A09CC0] hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Voltar para o site
            </Link>
            <nav className="text-xs text-[#5C5880]">
              <Link to="/" className="hover:text-[#A09CC0] transition-colors">Início</Link>
              <span className="mx-2">/</span>
              <span className="text-[#A09CC0]">{breadcrumb}</span>
            </nav>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-3xl mx-auto px-4 py-10 md:py-16">
          <div className="bg-[#13102A] border border-[#2E2A4A] rounded-2xl px-6 py-10 md:px-10 md:py-14">
            <h1 className="font-display text-2xl md:text-3xl font-bold mb-2">{title}</h1>
            <p className="text-sm text-[#A09CC0] mb-10">Última atualização: {lastUpdated}</p>

            <div className="legal-content space-y-6 text-[15px] leading-relaxed text-[#A09CC0]">
              {children}
            </div>

            {/* Contact block */}
            <div className="mt-14 pt-8 border-t border-[#2E2A4A]">
              <p className="text-sm text-[#5C5880]">
                Contato, suporte e privacidade:{" "}
                <a href="mailto:contato@posiciona.ia.br" className="text-[#C9A84C] hover:text-[#E2C06A] transition-colors">
                  contato@posiciona.ia.br
                </a>
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-[#2E2A4A]/40 py-6 px-4">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#5C5880]">
            <p>© {new Date().getFullYear()} Posiciona. Todos os direitos reservados.</p>
            <div className="flex items-center gap-4">
              <Link to="/termos-de-servico" className="hover:text-[#A09CC0] transition-colors">Termos de Serviço</Link>
              <Link to="/politica-de-privacidade" className="hover:text-[#A09CC0] transition-colors">Política de Privacidade</Link>
            </div>
          </div>
        </footer>

        {/* Safari safe area */}
        <div className="pb-[env(safe-area-inset-bottom)]" />
      </div>
    </>
  );
};

export default LegalPageLayout;
