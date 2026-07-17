// Autenticação real + resolução de workspace para edge functions.
// Etapa 1.4 do plano multi-workspace (docs/plano-multi-workspace.md).
//
// Como todas as funções usam service role, a RLS não protege este caminho —
// a checagem precisa ser explícita em código. Este helper:
//   - requireUser(req): valida o JWT DE VERDADE (auth.getUser) — a anon key
//     sozinha não passa. 401 se ausente/inválido.
//   - resolveWorkspace(req): requireUser + resolve o workspace ativo — o
//     `x-workspace-id` do header (com checagem de acesso via RPC
//     has_workspace_access) ou, na ausência, o workspace default do usuário.
//     Retrocompatível: durante a Fase 1 nenhum cliente envia o header.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export interface AuthedUser {
  userId: string;
  /** Client com o JWT do usuário — RLS e auth.uid() valem aqui. */
  userClient: ReturnType<typeof createClient>;
}

export interface WorkspaceContext extends AuthedUser {
  workspaceId: string | null;
}

export async function requireUser(req: Request): Promise<AuthedUser> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Não autenticado.");
  }
  const token = authHeader.slice("Bearer ".length);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) {
    throw new AuthError("Não autenticado.");
  }
  return { userId: data.user.id, userClient };
}

export async function resolveWorkspace(req: Request): Promise<WorkspaceContext> {
  const authed = await requireUser(req);

  const requested = req.headers.get("x-workspace-id");
  if (requested) {
    // has_workspace_access roda com auth.uid() do usuário (RPC via userClient)
    const { data: allowed } = await authed.userClient.rpc("has_workspace_access", {
      _workspace_id: requested,
      _min_role: "editor",
    });
    if (!allowed) throw new AuthError("Sem acesso a este perfil.", 403);
    return { ...authed, workspaceId: requested };
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: ws } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", authed.userId)
    .eq("is_default", true)
    .maybeSingle();

  return { ...authed, workspaceId: ws?.id ?? null };
}
