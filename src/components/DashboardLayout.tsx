import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Building2, Brain, BarChart3,
  FileText, History, LogOut, Shield, Menu, X, Target, Calendar, Instagram, Camera, HelpCircle, CreditCard, FileUp, Image, User, ChevronRight, Layers
} from "lucide-react";
import posicionaLogo from "@/assets/posiciona-logo.png";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { BackToTopButton } from "@/components/BackToTopButton";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  status?: "done" | "in_progress" | "pending" | "blocked";
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const adminGroups: NavGroup[] = [
  {
    label: "Admin",
    items: [
      { label: "Painel Admin", href: "/admin", icon: Shield },
      { label: "Usuários", href: "/admin/users", icon: LayoutDashboard },
      { label: "Documentos LLM", href: "/admin/documents", icon: FileUp },
      { label: "Galeria", href: "/admin/gallery", icon: Image },
    ],
  },
];

export const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Journey status data
  const [journeyStatus, setJourneyStatus] = useState<Record<string, "done" | "in_progress" | "pending" | "blocked">>({});

  useEffect(() => {
    if (!user || isAdmin) return;
    const load = async () => {
      const [bqRes, answersRes, reportRes, igRes, portraitRes] = await Promise.all([
        supabase.from("business_questionnaires").select("is_complete").eq("user_id", user.id).order("version", { ascending: false }).limit(1),
        supabase.from("archetype_answers").select("question_id").eq("user_id", user.id),
        supabase.from("reports").select("status, editorial_weeks, content").eq("user_id", user.id).order("version", { ascending: false }).limit(1),
        supabase.from("instagram_analyses").select("id").eq("user_id", user.id).limit(1),
        supabase.from("portrait_generations").select("id").eq("user_id", user.id).limit(1),
      ]);
      const bComplete = bqRes.data?.[0]?.is_complete ?? false;
      const uniqueQ = new Set(answersRes.data?.map(a => a.question_id) ?? []);
      const aDone = uniqueQ.size === 72;
      const reportData = reportRes.data?.[0];
      const rDone = reportData?.status === "completed";
      const hasIg = (igRes.data?.length ?? 0) > 0;
      const hasEditorialWeeks = !!(reportData?.editorial_weeks && (reportData.editorial_weeks as any[]).length > 0);
      let hasContentEditorial = false;
      if (reportData) {
        try {
          let c: any = reportData.content;
          if (typeof c === "string") c = JSON.parse(c);
          if (c && Array.isArray(c.editorial) && c.editorial.length > 0) {
            hasContentEditorial = true;
          }
        } catch {}
      }
      const hasEditorial = hasEditorialWeeks || hasContentEditorial;
      const hasPortraits = (portraitRes.data?.length ?? 0) > 0;

      setJourneyStatus({
        "/business-questionnaire": bComplete ? "done" : "in_progress",
        "/archetype-questionnaire": aDone ? "done" : bComplete ? "in_progress" : "blocked",
        "/results": rDone ? "done" : aDone ? "in_progress" : "blocked",
        "/storybrand": rDone ? "done" : "blocked",
        "/report": rDone ? "done" : "blocked",
        "/instagram-analysis": hasIg ? "done" : rDone ? "in_progress" : "blocked",
        "/editorial": hasEditorial ? "done" : rDone ? "in_progress" : "blocked",
        "/portraits": hasPortraits ? "done" : rDone ? "in_progress" : "blocked",
      });
    };
    load();
  }, [user, isAdmin]);

  const userGroups: NavGroup[] = [
    {
      label: "",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      label: "Sua jornada",
      items: [
        { label: "Diagnóstico", href: "/business-questionnaire", icon: Building2, status: journeyStatus["/business-questionnaire"] },
        { label: "Arquétipos", href: "/archetype-questionnaire", icon: Brain, status: journeyStatus["/archetype-questionnaire"] },
        { label: "Resultados", href: "/results", icon: BarChart3, status: journeyStatus["/results"] },
        { label: "Narrativa da Marca", href: "/storybrand", icon: Target, status: journeyStatus["/storybrand"] },
        { label: "Relatório", href: "/report", icon: FileText, status: journeyStatus["/report"] },
        { label: "Instagram", href: "/instagram-analysis", icon: Instagram, status: journeyStatus["/instagram-analysis"] },
        { label: "Linha Editorial", href: "/editorial", icon: Calendar, status: journeyStatus["/editorial"] },
        { label: "Retratos de Marca", href: "/portraits", icon: Camera, status: journeyStatus["/portraits"] },
      ],
    },
  ];

  const groups = isAdmin ? adminGroups : userGroups;

  const statusDot = (status?: string) => {
    if (!status) return null;
    const colors: Record<string, string> = {
      done: "bg-success",
      in_progress: "bg-warning",
      pending: "bg-disabled",
      blocked: "bg-disabled/40",
    };
    return <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", colors[status] || "bg-disabled")} />;
  };

  const footerItems: NavItem[] = isAdmin ? [] : [
    { label: "Meus Designs", href: "/my-designs", icon: Layers },
    { label: "Histórico", href: "/history", icon: History },
    { label: "Plano e Créditos", href: "/choose-plan", icon: CreditCard },
    { label: "Ajuda", href: "/help", icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar / Drawer */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-[280px] bg-background flex flex-col border-r border-border transition-transform duration-300 ease-out lg:relative lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <img src={posicionaLogo} alt="Posiciona" className="h-5 w-5" />
            </div>
            <span className="text-base font-display font-semibold tracking-tight">Posiciona</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 -mr-2 lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-3">
          {groups.map((group) => (
            <div key={group.label || "top"}>
              {group.label && (
                <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map(item => {
                  const active = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 min-h-[40px] rounded-lg text-[13px] font-medium transition-all duration-150",
                        active
                          ? "bg-primary text-primary-foreground"
                          : item.status === "blocked"
                            ? "text-disabled hover:text-muted-foreground"
                            : "text-muted-foreground hover:bg-card hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {!active && statusDot(item.status)}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-border space-y-0.5">
          {footerItems.map(item => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 min-h-[40px] rounded-lg text-[13px] font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
          {!isAdmin && (
            <div className="flex items-center gap-3 px-3 pt-2 text-[11px] text-muted-foreground/50">
              <Link to="/termos-de-servico" className="hover:text-muted-foreground transition-colors">Termos</Link>
              <Link to="/politica-de-privacidade" className="hover:text-muted-foreground transition-colors">Privacidade</Link>
            </div>
          )}
          <div className="pt-2 pb-1 px-3">
            <p className="text-[11px] text-muted-foreground/50 truncate mb-2">{user?.email}</p>
            <button
              onClick={signOut}
              className="flex items-center gap-2 text-[13px] text-muted-foreground/60 hover:text-foreground transition-colors w-full py-1.5 min-h-[40px]"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
          {/* Safari safe area padding */}
          <div className="pb-[env(safe-area-inset-bottom)]" />
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-200"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <main className="flex-1 min-h-screen flex flex-col w-full max-w-full [overflow-x:clip]">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border h-12 flex items-center px-4 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
          <div className="flex items-center gap-2 ml-2">
            <img src={posicionaLogo} alt="Posiciona" className="h-5 w-5" />
            <span className="text-sm font-display font-semibold tracking-tight">Posiciona</span>
          </div>
        </header>
        <div className="flex-1 px-4 py-5 lg:px-8 lg:py-8 max-w-4xl mx-auto w-full pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
        <BackToTopButton />
      </main>
    </div>
  );
};
