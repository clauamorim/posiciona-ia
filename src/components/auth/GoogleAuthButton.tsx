import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface GoogleAuthButtonProps {
  label?: string;
  disabled?: boolean;
}

export const GoogleAuthButton = ({ label = "Continuar com Google", disabled }: GoogleAuthButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) {
        toast({
          title: "Não foi possível entrar com Google",
          description: error.message || "Tente novamente.",
          variant: "destructive",
        });
        setLoading(false);
      }
      // On success the browser redirects to Google.
    } catch (e: any) {
      toast({
        title: "Não foi possível entrar com Google",
        description: e?.message || "Tente novamente.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full gap-2 bg-background hover:bg-muted/50"
      onClick={handleClick}
      disabled={disabled || loading}
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.8 16 19 13.5 24 13.5c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.5 29.3 4.5 24 4.5 16.3 4.5 9.6 8.9 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 43.5c5.2 0 9.9-2 13.5-5.3l-6.2-5.3c-2 1.4-4.5 2.1-7.3 2.1-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39 16.2 43.5 24 43.5z"/>
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4 5.6l6.2 5.3c-.4.4 6.5-4.7 6.5-14.9 0-1.2-.1-2.3-.4-3.5z"/>
      </svg>
      {loading ? "Conectando..." : label}
    </Button>
  );
};
