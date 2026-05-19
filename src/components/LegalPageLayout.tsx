import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Helmet } from "react-helmet-async";

interface LegalPageLayoutProps {
  title: string;
  metaTitle: string;
  metaDescription: string;
  lastUpdated: string;
  breadcrumb: string;
  path?: string;
  children: React.ReactNode;
}

const LegalPageLayout = ({ title, metaTitle, metaDescription, lastUpdated, breadcrumb, path, children }: LegalPageLayoutProps) => {
  const url = path ? `https://posiciona.ia.br${path}` : undefined;
  return (
    <>
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        {url && <link rel="canonical" href={url} />}
        {url && <meta property="og:url" content={url} />}
      </Helmet>
      <div className="min-h-dvh bg-background text-foreground">
        {/* Header */}
        <header className="border-b border-border/60 bg-background/90 backdrop-blur-md">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Voltar para o site
            </Link>
            <nav className="text-xs text-muted-foreground">
              <Link to="/" className="hover:text-muted-foreground transition-colors">Início</Link>
              <span className="mx-2">/</span>
              <span className="text-muted-foreground">{breadcrumb}</span>
            </nav>
          </div>
        </header>

        {/* Content */}
        <main className="max-w-3xl mx-auto px-4 py-10 md:py-16">
          <div className="bg-card border border-border rounded-2xl px-6 py-10 md:px-10 md:py-14">
            <h1 className="font-display text-2xl md:text-3xl font-bold mb-2">{title}</h1>
            <p className="text-sm text-muted-foreground mb-10">Última atualização: {lastUpdated}</p>

            <div className="legal-content space-y-6 text-[15px] leading-relaxed text-muted-foreground">
              {children}
            </div>

            {/* Contact block */}
            <div className="mt-14 pt-8 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Suporte e privacidade:{" "}
                <a href="mailto:suporte@posiciona.ia.br" className="text-gold hover:text-gold-hover transition-colors">
                  suporte@posiciona.ia.br
                </a>
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border/40 py-6 px-4">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>© {new Date().getFullYear()} Posiciona. Todos os direitos reservados.</p>
            <div className="flex items-center gap-4">
              <Link to="/termos-de-servico" className="hover:text-foreground transition-colors">Termos de Serviço</Link>
              <Link to="/politica-de-privacidade" className="hover:text-foreground transition-colors">Política de Privacidade</Link>
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
