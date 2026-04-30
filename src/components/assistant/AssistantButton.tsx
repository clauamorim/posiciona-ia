import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AssistantPanel } from "./AssistantPanel";
import { getRouteLabel } from "@/lib/assistantJourney";
import { cn } from "@/lib/utils";

const HIDDEN_ROUTES = ["/", "/login", "/signup", "/verify-email", "/forgot-password", "/reset-password", "/sobre", "/termos-de-servico", "/politica-de-privacidade", "/checkout-success"];
const HINT_DISMISS_KEY = "posiciona.assistant.hint.dismissed";

export function AssistantButton() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [pulseRoute, setPulseRoute] = useState<string | null>(null);

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

  if (!user) return null;
  if (HIDDEN_ROUTES.includes(location.pathname)) return null;

  return (
    <>
      <div className="fixed bottom-5 right-5 z-50 flex items-end gap-2">
        {showHint && (
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
            "flex items-center justify-center hover:scale-105 transition-transform",
            "h-12 w-12 sm:h-14 sm:w-14"
          )}
        >
          {showHint && (
            <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
          )}
          <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 relative z-10" />
        </button>
      </div>

      <AssistantPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
