import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UserBrandColor {
  color_name: string;
  hex: string;
  usage: string | null;
  role: string;
  priority: number;
}

/** Carrega a paleta SSoT do usuário (do relatório). Vazio = sem relatório ou
 *  ainda não persistido — chamadores devem aplicar fallback de paleta padrão. */
export function useUserBrandPalette() {
  const [palette, setPalette] = useState<UserBrandColor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { if (!cancelled) setLoading(false); return; }
      const { data } = await supabase
        .from("user_brand_palette" as any)
        .select("color_name, hex, usage, role, priority")
        .eq("user_id", auth.user.id)
        .order("priority", { ascending: true });
      if (!cancelled) {
        setPalette((data as any[]) || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { palette, loading };
}
