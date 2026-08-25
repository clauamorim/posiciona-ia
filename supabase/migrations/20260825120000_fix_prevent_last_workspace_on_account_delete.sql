-- ============================================================================
-- Corrige "Database error deleting user" ao excluir usuário no Admin.
--
-- Causa: o trigger prevent_last_workspace_delete (20260824140000) foi
-- pensado só pro caso "dono exclui o próprio único perfil mantendo a
-- conta" — mas excluir a CONTA INTEIRA cascateia (owner_id ON DELETE
-- CASCADE) até apagar o workspace dela, e se for o único, o trigger
-- bloqueava achando que era o caso de uso errado. Toda conta com só 1
-- perfil ficou impossível de excluir pelo Admin.
--
-- Fix: se o dono (auth.users) já não existe mais nessa mesma transação
-- (ou seja, é a conta inteira sendo apagada, não só o perfil), deixa
-- passar — ficar sem workspace é o esperado nesse caso.
--
-- Aplicação: MANUAL no SQL editor do Lovable Cloud. Idempotente.
-- ============================================================================

create or replace function public.prevent_last_workspace_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer;
  owner_still_exists boolean;
begin
  select exists(select 1 from auth.users where id = old.owner_id) into owner_still_exists;
  if not owner_still_exists then
    return old;
  end if;

  select count(*) into remaining
  from public.workspaces
  where owner_id = old.owner_id and id <> old.id;

  if remaining = 0 then
    raise exception 'Não é possível excluir o único perfil da conta.';
  end if;

  return old;
end;
$$;
