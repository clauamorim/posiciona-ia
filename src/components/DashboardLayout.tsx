import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Building2, Brain, BarChart3,
  FileText, History, LogOut, Shield, Menu, X, Target, Calendar, Instagram, Camera, HelpCircle, CreditCard, FileUp, Image, Mail, Headphones
} from "lucide-react";
import posicionaLogo from "@/assets/posiciona-logo.png";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavGroup {
  label: string;
  items: { label: string; href: string; icon: React.ElementType }[];
}

const userGroups: NavGroup[] = [
  {
    label: "Início",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Diagnóstico",
    items: [
      { label: "Questionário do Negócio", href: "/business-questionnaire", icon: Building2 },
      { label: "Questionário de Arquétipos", href: "/archetype-questionnaire", icon: Brain },
    ],
  },
  {
    label: "Estratégia",
    items: [
      { label: "Arquétipos", href: "/results", icon: BarChart3 },
      { label: "StoryBrand", href: "/storybrand", icon: Target },
      { label: "Relatório", href: "/report", icon: FileText },
      { label: "Análise do Instagram", href: "/instagram-analysis", icon: Instagram },
      { label: "Linha Editorial", href: "/editorial", icon: Calendar },
    ],
  },
  {
    label: "Produção",
    items: [
      { label: "Retratos de Marca", href: "/portraits", icon: Camera },
    ],
  },
  {
    label: "Conta",
    items: [
      { label: "Histórico", href: "/history", icon: History },
      { label: "Plano e Créditos", href: "/choose-plan", icon: CreditCard },
      { label: "Ajuda", href: "/help", icon: HelpCircle },
    ],
  },
];

const adminGroup: NavGroup = {
  label: "Admin",
  items: [
    { label: "Painel Admin", href: "/admin", icon: Shield },
    { label: "Usuários", href: "/admin/users", icon: LayoutDashboard },
    { label: "Documentos LLM", href: "/admin/documents", icon: FileUp },
    { label: "Galeria", href: "/admin/gallery", icon: Image },
  ],
};

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const groups = isAdmin ? [...userGroups, adminGroup] : userGroups;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-[272px] bg-sidebar flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="w-9 h-9 rounded-xl bg-sidebar-primary/15 flex items-center justify-center">
            <img src={posicionaLogo} alt="Posiciona" className="h-6 w-6" />
          </div>
          <span className="text-lg font-semibold text-sidebar-foreground tracking-tight">Posiciona</span>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-widest text-sidebar-foreground/30">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href + item.label}
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-[13px] font-medium transition-all duration-150",
                        active
                          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-sidebar-primary/20"
                          : "text-sidebar-foreground/55 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 pb-8 border-t border-sidebar-border space-y-3">
          <div className="space-y-1.5">
            <a href="mailto:contato@posiciona.ia.br" className="flex items-center gap-2 text-[11px] text-sidebar-foreground/35 hover:text-sidebar-foreground transition-colors py-1">
              <Mail className="h-3.5 w-3.5 flex-shrink-0" /> contato@posiciona.ia.br
            </a>
            <a href="mailto:suporte@posiciona.ia.br" className="flex items-center gap-2 text-[11px] text-sidebar-foreground/35 hover:text-sidebar-foreground transition-colors py-1">
              <Headphones className="h-3.5 w-3.5 flex-shrink-0" /> suporte@posiciona.ia.br
            </a>
          </div>
          <p className="text-[11px] text-sidebar-foreground/30 truncate">{user?.email}</p>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-[13px] text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors w-full py-1.5 min-h-[44px]"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main */}
      <main className="flex-1 min-h-screen flex flex-col">
        {/* Compact mobile header */}
        <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border h-12 flex items-center px-4 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2 ml-2">
            <img src={posicionaLogo} alt="Posiciona" className="h-6 w-6" />
            <span className="text-sm font-semibold text-foreground tracking-tight">Posiciona</span>
          </div>
        </header>
        <div className="flex-1 p-5 lg:p-8 max-w-5xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
};
