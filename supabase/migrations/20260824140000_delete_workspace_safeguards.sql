-- ============================================================================
-- Excluir um perfil (workspace) específico — não existia UI nenhuma pra
-- isso até agora (só existia excluir a CONTA inteira). Agora que
-- multi-perfil é plano pago de verdade, alguém vai querer se livrar de 1
-- perfil (cliente que saiu, teste criado por engano) sem falar com
-- suporte. RLS de DELETE em workspaces já existia (owner_id = auth.uid())
-- e o cascade das ~22 tabelas de conteúdo já foi corrigido em
-- 20260823140000 — só faltavam as duas salvaguardas abaixo.
--
-- Aplicação: MANUAL no SQL editor do Lovable Cloud. Idempotente.
-- ============================================================================

-- Nunca deixa a conta ficar sem nenhum perfil.
create or replace function public.prevent_last_workspace_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer;
begin
  select count(*) into remaining
  from public.workspaces
  where owner_id = old.owner_id and id <> old.id;

  if remaining = 0 then
    raise exception 'Não é possível excluir o único perfil da conta.';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_prevent_last_workspace_delete on public.workspaces;
create trigger trg_prevent_last_workspace_delete
  before delete on public.workspaces
  for each row execute function public.prevent_last_workspace_delete();

-- Se o perfil excluído era o "default" da conta, promove outro — senão a
-- conta fica sem nenhum is_default e alguns fallbacks (ex: signup) contam
-- com sempre existir um.
create or replace function public.promote_default_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_default then
    update public.workspaces
    set is_default = true
    where id = (
      select id from public.workspaces
      where owner_id = old.owner_id
      order by created_at asc
      limit 1
    );
  end if;
  return old;
end;
$$;

drop trigger if exists trg_promote_default_workspace on public.workspaces;
create trigger trg_promote_default_workspace
  after delete on public.workspaces
  for each row execute function public.promote_default_workspace();
