-- ============================================================================
-- Corrige "null value in column invited_by... violates not-null constraint"
-- ao criar convite. workspace_invites.invited_by ficou NOT NULL sem
-- default nenhum, e o insert do client (WorkspaceMembersDialog.tsx) não
-- envia esse campo — mesmo padrão que workspaces.owner_id já usa
-- (DEFAULT auth.uid(), cliente não precisa mandar).
--
-- Aplicação: MANUAL no SQL editor do Lovable Cloud. Idempotente.
-- ============================================================================

alter table public.workspace_invites alter column invited_by set default auth.uid();
