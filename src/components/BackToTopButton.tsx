import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export const BackToTopButton = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <button
      type="button"
      aria-label="Voltar ao topo"
      onClick={scrollToTop}
      className={cn(
        "lg:hidden fixed right-4 z-40 h-11 w-11 rounded-full",
        "bg-card/90 backdrop-blur-md border border-border shadow-lg shadow-background/50",
        "flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40",
        "transition-all duration-300 ease-out",
        visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-2 pointer-events-none",
      )}
      style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  );
};
