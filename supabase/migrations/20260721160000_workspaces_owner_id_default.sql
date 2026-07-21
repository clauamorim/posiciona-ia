-- ============================================================================
-- Corrige falha ao criar novo perfil: "new row violates row-level security
-- policy for table workspaces". A política em si está correta
-- (owner_id = auth.uid()), mas o valor de owner_id enviado pelo navegador
-- não estava batendo com auth.uid() no momento da gravação.
--
-- Correção definitiva: o próprio banco preenche owner_id a partir da sessão
-- autenticada (auth.uid()) quando a coluna não é enviada — elimina qualquer
-- possibilidade de descompasso entre cliente e servidor. Idempotente.
-- ============================================================================

alter table public.workspaces
  alter column owner_id set default auth.uid();
