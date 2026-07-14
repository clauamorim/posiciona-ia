import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { SeoHead } from "@/components/SeoHead";

// Local typed wrapper for the beta supabase.auth.oauth namespace.
type OAuthDetails = {
  client?: { name?: string; client_uri?: string; redirect_uris?: string[] };
  redirect_url?: string;
  redirect_to?: string;
  scopes?: string[];
  requested_scopes?: string[];
};
type OAuthResp<T> = { data: T | null; error: { message: string } | null };
const authOauth = (supabase.auth as unknown as {
  oauth: {
    getAuthorizationDetails: (id: string) => Promise<OAuthResp<OAuthDetails>>;
    approveAuthorization: (id: string) => Promise<OAuthResp<{ redirect_url?: string; redirect_to?: string }>>;
    denyAuthorization: (id: string) => Promise<OAuthResp<{ redirect_url?: string; redirect_to?: string }>>;
  };
}).oauth;

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const { user, isLoading } = useAuth();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<OAuthDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!authorizationId) {
      setError("Solicitação de autorização inválida (authorization_id ausente).");
      return;
    }
    if (!user) {
      // Preserve full consent URL so login returns here.
      const next = window.location.pathname + window.location.search;
      window.location.href = `/login?next=${encodeURIComponent(next)}`;
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await authOauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, user, isLoading]);

  const decide = async (approve: boolean) => {
    if (!authorizationId || busy) return;
    setBusy(true);
    const { data, error } = approve
      ? await authOauth.approveAuthorization(authorizationId)
      : await authOauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("O servidor de autorização não retornou uma URL de redirecionamento.");
    }
    window.location.href = target;
  };

  const clientName = details?.client?.name ?? "o aplicativo";
  const scopes = details?.scopes ?? details?.requested_scopes ?? [];

  return (
    <AuthLayout>
      <SeoHead
        title="Autorizar acesso · Posiciona"
        description="Autorize um aplicativo externo a acessar sua conta Posiciona."
        path="/.lovable/oauth/consent"
      />
      <div className="space-y-6">
        {error ? (
          <div className="space-y-4">
            <h1 className="text-2xl font-display font-semibold">Não foi possível carregar a autorização</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button asChild variant="outline">
              <Link to="/dashboard">Voltar ao painel</Link>
            </Button>
          </div>
        ) : !details ? (
          <p className="text-sm text-muted-foreground">Carregando solicitação…</p>
        ) : (
          <div className="space-y-5">
            <header className="space-y-2">
              <h1 className="text-2xl font-display font-semibold">
                Conectar {clientName} à sua conta Posiciona
              </h1>
              <p className="text-sm text-muted-foreground">
                Isto permite que {clientName} use este aplicativo como você, com as ferramentas
                habilitadas do Posiciona, enquanto você estiver conectada.
              </p>
            </header>

            {user?.email && (
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                Conectada como <span className="font-medium">{user.email}</span>
              </div>
            )}

            {scopes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Permissões solicitadas
                </p>
                <ul className="list-disc pl-5 text-sm">
                  {scopes.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Isto não substitui as políticas de acesso do Posiciona — o cliente conectado só
              consegue ler ou agir sobre dados que você já pode acessar.
            </p>

            <div className="flex gap-3">
              <Button onClick={() => decide(true)} disabled={busy} className="flex-1">
                {busy ? "Processando…" : "Aprovar"}
              </Button>
              <Button onClick={() => decide(false)} disabled={busy} variant="outline" className="flex-1">
                Recusar
              </Button>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};

export default OAuthConsent;
