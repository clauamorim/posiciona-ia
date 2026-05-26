import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Sparkles, Images, CircleUser } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomItem {
  label: string;
  href: string;
  icon: React.ElementType;
  matchPrefixes?: string[];
}

const items: BottomItem[] = [
  { label: "Início", href: "/dashboard", icon: LayoutDashboard },
  { label: "Criar", href: "/editorial", icon: Sparkles, matchPrefixes: ["/editorial", "/post-editor"] },
  { label: "Biblioteca", href: "/my-designs", icon: Images, matchPrefixes: ["/my-designs", "/my-gallery"] },
  { label: "Conta", href: "/conta", icon: CircleUser },
];

// Rotas que possuem sua própria barra de ação fixa no mobile e portanto
// precisam esconder a navegação principal para não haver sobreposição
// (mesma posição fixed bottom-0 + mesmo z-index).
const HIDE_ON_ROUTES = ["/post-editor"];

export const MobileBottomNav = () => {
  const location = useLocation();
  const pathname = location.pathname;

  const shouldHide = HIDE_ON_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (shouldHide) return null;

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-background/85 backdrop-blur-md border-t border-white/[0.08]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch justify-around h-16">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.matchPrefixes?.some((p) => pathname === p || pathname.startsWith(p + "/")) ?? false);
          return (
            <li key={item.href} className="flex-1">
              <Link
                to={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 h-full transition-colors",
                  active ? "text-primary" : "text-foreground/40 hover:text-foreground/70"
                )}
              >
                <Icon size={22} strokeWidth={1.5} />
                <span className="text-[11px] font-medium leading-none">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
