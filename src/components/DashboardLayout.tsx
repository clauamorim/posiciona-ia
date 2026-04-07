import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sparkles, LayoutDashboard, Building2, Brain, BarChart3,
  FileText, History, LogOut, Shield, Menu, X, Target, Calendar, Instagram
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const userNav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Questionário do Negócio", href: "/business-questionnaire", icon: Building2 },
  { label: "Questionário de Arquétipos", href: "/archetype-questionnaire", icon: Brain },
  { label: "Arquétipos", href: "/results", icon: BarChart3 },
  { label: "StoryBrand", href: "/storybrand", icon: Target },
  { label: "Análises", href: "/report", icon: FileText },
  { label: "Linha Editorial", href: "/editorial", icon: Calendar },
  { label: "Análise do Instagram", href: "/instagram-analysis", icon: Instagram },
  { label: "Histórico", href: "/history", icon: History },
];

const adminNav = [
  { label: "Painel Admin", href: "/admin", icon: Shield },
  { label: "Usuários", href: "/admin/users", icon: LayoutDashboard },
];

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = isAdmin ? [...userNav, ...adminNav] : userNav;

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 lg:relative lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center gap-2 p-6 border-b border-sidebar-border">
          <Sparkles className="h-6 w-6 text-sidebar-primary" />
          <span className="text-xl font-bold font-display">ArcheBrand</span>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(item => (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                location.pathname === item.href
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-sidebar-border">
          <p className="text-xs text-sidebar-foreground/50 mb-2 truncate">{user?.email}</p>
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <main className="flex-1 min-h-screen">
        <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-3 flex items-center lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="ml-3 font-display font-bold text-primary">ArcheBrand</span>
        </header>
        <div className="p-6 lg:p-8 max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
