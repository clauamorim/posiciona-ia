-- ============================================================================
-- Corrige "Erro ao excluir — Edge Function returned a non-2xx status code"
-- ao excluir usuário no Admin, de novo — mesma causa raiz de
-- 20260823140000 (FK sem cascade pra auth.users), só que numa tabela nova
-- de hoje que ficou de fora daquela correção: workspace_invites.invited_by
-- e workspace_members.invited_by referenciam auth.users(id) sem cascade.
-- Mesmo com workspace_id/user_id já cascateando essas linhas por outro
-- caminho, a Postgres não garante ordem entre os dois caminhos de cascade
-- dentro do mesmo DELETE — pode checar essa constraint antes da linha
-- sumir pelo outro lado.
--
-- Aplicação: MANUAL no SQL editor do Lovable Cloud. Idempotente.
-- ============================================================================

alter table public.workspace_invites
  drop constraint if exists workspace_invites_invited_by_fkey;
alter table public.workspace_invites
  add constraint workspace_invites_invited_by_fkey
    foreign key (invited_by) references auth.users(id) on delete cascade;

-- workspace_members.invited_by é opcional (nullable) — perde só o dado de
-- "quem convidou", não a associação do membro em si.
alter table public.workspace_members
  drop constraint if exists workspace_members_invited_by_fkey;
alter table public.workspace_members
  add constraint workspace_members_invited_by_fkey
    foreign key (invited_by) references auth.users(id) on delete set null;
