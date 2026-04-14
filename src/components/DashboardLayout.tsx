import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Building2, Brain, BarChart3,
  FileText, History, LogOut, Shield, Menu, X, Target, Calendar, Instagram, Camera, HelpCircle, CreditCard, FileUp, Image
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
        "fixed inset-y-0 left-0 z-50 w-[260px] bg-sidebar flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-sidebar-border">
          <img src={posicionaLogo} alt="Posiciona" className="h-8 w-8" />
          <span className="text-lg font-semibold text-sidebar-foreground tracking-tight">Posiciona</span>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
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
                        "flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-sidebar-border space-y-2">
          <p className="text-[11px] text-sidebar-foreground/40 truncate">{user?.email}</p>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-[13px] text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors w-full"
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
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
        <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-sm border-b border-border h-11 flex items-center px-4 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="p-1 -ml-1">
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-1.5 ml-3">
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
