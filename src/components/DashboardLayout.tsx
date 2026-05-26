import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, Building2, Brain, BarChart3,
  FileText, History, LogOut, Shield, Menu, X, Target, Calendar, Instagram, Camera, HelpCircle, CreditCard, FileUp, Image, User, ChevronRight, ChevronDown, Layers, ImageIcon, Sparkles, MessageSquareQuote
} from "lucide-react";
import posicionaLogo from "@/assets/posiciona-logo.png";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { BackToTopButton } from "@/components/BackToTopButton";
import { ReadOnlyBanner } from "@/components/ReadOnlyBanner";
import { MobileBottomNav } from "@/components/MobileBottomNav";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  status?: "done" | "in_progress" | "pending" | "blocked";
  badge?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export const DashboardLayout = ({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) => {
  const { user, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingDeletions, setPendingDeletions] = useState<number>(0);

  const handleSignOut = async () => {
    setMobileOpen(false);
    try { await signOut(); } catch (e) { console.error("signOut error:", e); }
    navigate("/login", { replace: true });
  };

  // Journey status data
  const [journeyStatus, setJourneyStatus] = useState<Record<string, "done" | "in_progress" | "pending" | "blocked">>({});

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("account_deletion_requests")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setPendingDeletions(count ?? 0));
  }, [isAdmin]);

  useEffect(() => {
    if (!user || isAdmin) return;
    const load = async () => {
      const [bqRes, answersRes, reportRes, igRes, portraitRes, pqRes, snRes, ssRes] = await Promise.all([
        supabase.from("business_questionnaires").select("is_complete").eq("user_id", user.id).order("version", { ascending: false }).limit(1),
        supabase.from("archetype_answers").select("question_id").eq("user_id", user.id),
        supabase.from("reports").select("status, editorial_weeks, content").eq("user_id", user.id).order("version", { ascending: false }).limit(1),
        supabase.from("instagram_analyses").select("id").eq("user_id", user.id).limit(1),
        supabase.from("portrait_generations").select("id").eq("user_id", user.id).limit(1),
        supabase.from("personal_questionnaires").select("status").eq("user_id", user.id).order("version", { ascending: false }).limit(1),
        supabase.from("sales_narrative_questionnaires").select("status").eq("user_id", user.id).order("version", { ascending: false }).limit(1),
        supabase.from("sales_story_sequences").select("id").eq("user_id", user.id).limit(1),
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
      const pqSubmitted = pqRes.data?.[0]?.status === "submitted";
      const snSubmitted = snRes.data?.[0]?.status === "submitted";
      const hasSalesStories = (ssRes.data?.length ?? 0) > 0;

      setJourneyStatus({
        "/business-questionnaire": bComplete ? "done" : "in_progress",
        "/personal-questionnaire": pqSubmitted ? "done" : bComplete ? "in_progress" : "blocked",
        "/archetype-questionnaire": aDone ? "done" : (bComplete && pqSubmitted) ? "in_progress" : "blocked",
        "/results": rDone ? "done" : aDone ? "in_progress" : "blocked",
        "/storybrand": rDone ? "done" : "blocked",
        "/report": rDone ? "done" : "blocked",
        "/instagram-analysis": hasIg ? "done" : rDone ? "in_progress" : "blocked",
        "/editorial": hasEditorial ? "done" : (rDone && pqSubmitted) ? "in_progress" : "blocked",
        "/stories-de-venda": hasSalesStories ? "done" : (snSubmitted ? "in_progress" : "blocked"),
        "/portraits": hasPortraits ? "done" : rDone ? "in_progress" : "blocked",
      });
    };
    load();
  }, [user, isAdmin]);

  // Journey progress for sidebar collapsing
  const JOURNEY_KEYS = ["/business-questionnaire","/personal-questionnaire","/archetype-questionnaire","/results","/report","/instagram-analysis","/editorial","/portraits"];
  const journeyDoneAll = JOURNEY_KEYS.every(k => journeyStatus[k] === "done");
  const CONTINUOUS_HREFS = new Set(["/editorial", "/stories-de-venda", "/portraits", "/report"]);

  const [journeyGroupOpen, setJourneyGroupOpen] = useState<boolean>(true);
  useEffect(() => {
    const saved = localStorage.getItem("sidebar.journey.expanded");
    if (saved !== null) setJourneyGroupOpen(saved === "true");
    else setJourneyGroupOpen(!journeyDoneAll);
  }, [journeyDoneAll]);
  const toggleJourneyGroup = () => {
    setJourneyGroupOpen(prev => {
      const next = !prev;
      localStorage.setItem("sidebar.journey.expanded", String(next));
      return next;
    });
  };

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
        { label: "Sua História", href: "/personal-questionnaire", icon: Sparkles, status: journeyStatus["/personal-questionnaire"] },
        { label: "Arquétipos", href: "/archetype-questionnaire", icon: Brain, status: journeyStatus["/archetype-questionnaire"] },
        { label: "Resultados", href: "/results", icon: BarChart3, status: journeyStatus["/results"] },
        // "Narrativa da Marca" consolidada como tab dentro do Relatório — /storybrand permanece acessível por links antigos
        { label: "Relatório", href: "/report", icon: FileText, status: journeyStatus["/report"] },
        { label: "Instagram", href: "/instagram-analysis", icon: Instagram, status: journeyStatus["/instagram-analysis"] },
        { label: "Linha Editorial", href: "/editorial", icon: Calendar, status: journeyStatus["/editorial"] },
        { label: "Stories de Venda", href: "/stories-de-venda", icon: MessageSquareQuote, status: journeyStatus["/stories-de-venda"] },
        { label: "Retratos de Marca", href: "/portraits", icon: Camera, status: journeyStatus["/portraits"] },
      ],
    },
    {
      label: "Conteúdo",
      items: [
        { label: "Meus Designs", href: "/my-designs", icon: Layers },
        { label: "Minha Galeria", href: "/my-gallery", icon: ImageIcon },
        { label: "Histórico", href: "/history", icon: History },
      ],
    },
    {
      label: "Conta",
      items: [
        { label: "Conta", href: "/conta", icon: User },
        { label: "Plano e Créditos", href: "/choose-plan", icon: CreditCard },
        { label: "Ajuda", href: "/help", icon: HelpCircle },
        { label: "Termos", href: "/termos-de-servico", icon: FileText },
        { label: "Privacidade", href: "/politica-de-privacidade", icon: Shield },
      ],
    },
  ];

  const adminGroups: NavGroup[] = [
    {
      label: "Admin",
      items: [
        { label: "Usuários", href: "/admin", icon: LayoutDashboard },
        { label: "Métricas", href: "/admin/metrics", icon: BarChart3 },
        { label: "Documentos LLM", href: "/admin/documents", icon: FileUp },
        { label: "Galeria", href: "/admin/gallery", icon: Image },
        { label: "Templates Globais", href: "/admin/templates", icon: Layers },
        { label: "Exclusões LGPD", href: "/admin/exclusoes-lgpd", icon: Shield, badge: pendingDeletions },
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

  return (
    <div className="min-h-dvh flex min-w-0 overflow-x-hidden bg-background">
      {/* Sidebar / Drawer */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-[280px] bg-background flex flex-col border-r border-border transition-transform duration-300 ease-out lg:relative lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <img src={posicionaLogo} alt="Posiciona" className="h-7 w-7" />
            </div>
            <span className="text-xl font-display font-semibold tracking-tight">Posiciona</span>
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-2 -mr-2 lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-3">
          {groups.map((group, gi) => {
            const isJourneyGroup = group.label === "Sua jornada";
            const collapsed = isJourneyGroup && !journeyGroupOpen;
            const visibleItems = collapsed
              ? group.items.filter(it => CONTINUOUS_HREFS.has(it.href))
              : group.items;
            return (
            <div key={group.label || `top-${gi}`}>
              {gi > 0 && <div className="border-t border-border/60 my-2 mx-1" />}
              {group.label && (
                isJourneyGroup ? (
                  <button
                    onClick={toggleJourneyGroup}
                    className="w-full flex items-center justify-between px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    <span>{group.label}</span>
                    {journeyGroupOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                ) : (
                  <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                    {group.label}
                  </p>
                )
              )}
              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const active = location.pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 min-h-[40px] rounded-lg text-sm lg:text-[15px] font-medium transition-all duration-150",
                        active
                          ? "bg-primary text-primary-foreground"
                          : item.status === "blocked"
                            ? "text-disabled hover:text-muted-foreground"
                            : "text-muted-foreground hover:bg-card hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px] flex-shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{item.badge}</Badge>
                      )}
                      {!active && statusDot(item.status)}
                    </Link>
                  );
                })}
              </div>
            </div>
            );
          })}
        </nav>

        {/* Footer — e-mail + botão Sair (sempre visível) */}
        <div className="px-3 py-3 border-t border-border space-y-2">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2.5 px-3 py-2 min-h-[44px] rounded-lg text-sm lg:text-[15px] font-medium transition-colors w-full text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <LogOut className="h-[18px] w-[18px] flex-shrink-0" />
            <span className="flex-1 truncate text-left">Sair</span>
          </button>
          {!isAdmin && user?.email && (
            <p className="px-3 text-xs text-muted-foreground/60 truncate">{user.email}</p>
          )}
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
      <main className="flex-1 min-w-0 min-h-dvh flex flex-col w-full max-w-full overflow-x-hidden [overflow-x:clip]">
        <ReadOnlyBanner />
        {/* Mobile header */}
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border h-12 flex items-center px-4 lg:hidden">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <Menu className="h-5 w-5 text-muted-foreground" />
          </button>
          <Link to="/" className="flex items-center gap-2 ml-2 hover:opacity-80 transition-opacity">
            <img src={posicionaLogo} alt="Posiciona" className="h-7 w-7" />
            <span className="text-base font-display font-semibold tracking-tight">Posiciona</span>
          </Link>
        </header>
        <div className={cn("flex-1 min-w-0 px-4 md:px-6 py-5 lg:px-12 lg:py-8 mx-auto w-full max-w-full pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-[calc(1.5rem+env(safe-area-inset-bottom))]", wide ? "lg:max-w-[1400px]" : "lg:max-w-[1200px]")}>
          {children}
        </div>
        <BackToTopButton />
        <MobileBottomNav />
      </main>
    </div>
  );
};
