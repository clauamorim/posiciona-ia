import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AssistantPanel } from "./AssistantPanel";
import { getRouteLabel } from "@/lib/assistantJourney";
import { ASSISTANT_OPEN_EVENT } from "@/lib/assistantBus";
import { cn } from "@/lib/utils";

const HIDDEN_ROUTES = ["/", "/login", "/signup", "/verify-email", "/forgot-password", "/reset-password", "/sobre", "/termos-de-servico", "/politica-de-privacidade", "/checkout-success"];
// Telas onde o FAB flutuante é substituído por botões inline ao lado de cada pergunta.
const FAB_HIDDEN_ROUTES = ["/business-questionnaire", "/personal-questionnaire", "/archetype-questionnaire"];
const HINT_DISMISS_KEY = "posiciona.assistant.hint.dismissed";

export function AssistantButton() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [pulseRoute, setPulseRoute] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  // Auto-collapse the FAB label after 3s on every route change.
  useEffect(() => {
    if (!user) return;
    if (HIDDEN_ROUTES.includes(location.pathname)) return;
    setExpanded(true);
    const t = setTimeout(() => setExpanded(false), 3000);
    return () => clearTimeout(t);
  }, [location.pathname, user]);

  // Show hint pulse when entering a known journey route (once per route per session)
  useEffect(() => {
    if (!user) return;
    const label = getRouteLabel(location.pathname);
    if (!label) return;

    const dismissed = sessionStorage.getItem(HINT_DISMISS_KEY + ":" + location.pathname);
    if (dismissed) return;

    setPulseRoute(location.pathname);
    setShowHint(true);
    const t = setTimeout(() => setShowHint(false), 6000);
    return () => clearTimeout(t);
  }, [location.pathname, user]);

  const handleOpen = () => {
    setOpen(true);
    setShowHint(false);
    if (pulseRoute) sessionStorage.setItem(HINT_DISMISS_KEY + ":" + pulseRoute, "1");
  };

  // Listener global: permite que botões inline (InlineHelpButton) abram o painel.
  useEffect(() => {
    if (!user) return;
    const handler = () => setOpen(true);
    window.addEventListener(ASSISTANT_OPEN_EVENT, handler);
    return () => window.removeEventListener(ASSISTANT_OPEN_EVENT, handler);
  }, [user]);

  if (!user) return null;
  if (HIDDEN_ROUTES.includes(location.pathname)) return null;

  const fabHidden = FAB_HIDDEN_ROUTES.includes(location.pathname);

  return (
    <>
      {!fabHidden && (
      <div
        className="fixed right-5 z-50 flex items-end gap-2 bottom-20 lg:bottom-5"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {showHint && !expanded && (
          <button
            onClick={handleOpen}
            className={cn(
              "hidden sm:block max-w-[220px] text-left bg-card border border-border rounded-xl shadow-lg px-3 py-2",
              "text-xs text-foreground hover:bg-accent transition-colors animate-fade-in"
            )}
          >
            Posso explicar essa etapa?
          </button>
        )}
        <button
          onClick={handleOpen}
          aria-label="Abrir assistente"
          className={cn(
            "relative rounded-full bg-primary text-primary-foreground shadow-xl",
            "flex items-center justify-center hover:scale-105 overflow-hidden",
            "h-12 lg:h-14 transition-all duration-500 ease-out",
            expanded ? "pl-4 pr-5 gap-2" : "w-12 lg:w-14"
          )}
        >
          {showHint && !expanded && (
            <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
          )}
          <Sparkles className="h-5 w-5 lg:h-6 lg:w-6 relative z-10 flex-shrink-0" />
          <span
            className={cn(
              "relative z-10 text-sm font-medium whitespace-nowrap transition-all duration-300",
              expanded ? "max-w-[140px] opacity-100" : "max-w-0 opacity-0"
            )}
          >
            Assistente IA
          </span>
        </button>
      </div>

      <AssistantPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
