-- ============================================================================
-- Fase 4 — Convites de membro pra um perfil (workspace).
-- Modelo decidido: membro convidado ("editor") só acessa Diagnóstico, Sua
-- História/Voz da Marca, História de Venda e as próprias respostas de
-- Arquétipos (preenche e vê). Relatório/resultado, Editorial, Stories de
-- Venda, Análise do Instagram, plano/créditos e gestão de membros
-- continuam só do dono — essas tabelas não precisam de nenhuma mudança,
-- já ficam de fora por já serem `auth.uid() = user_id`.
--
-- Aplicação: MANUAL no SQL editor do Lovable Cloud. Idempotente.
-- ============================================================================

-- 1. Convites pendentes. Precisa existir fora de workspace_members porque
--    quem ainda não tem conta Posiciona não tem user_id nenhum ainda.
create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'editor',
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz
);

create index if not exists idx_workspace_invites_workspace on public.workspace_invites (workspace_id);

alter table public.workspace_invites enable row level security;

-- Só o dono do perfil gerencia (cria/lista/cancela) os convites que ele
-- mandou. O lado de quem RECEBE o convite passa pelas RPCs abaixo
-- (SECURITY DEFINER), não por SELECT direto na tabela — o token já é o
-- segredo que autoriza, não faz sentido expor a tabela por token pra
-- qualquer autenticado.
drop policy if exists "Workspace owner manages invites" on public.workspace_invites;
create policy "Workspace owner manages invites" on public.workspace_invites
  for all using (public.has_workspace_access(workspace_id, 'owner'))
  with check (public.has_workspace_access(workspace_id, 'owner'));

-- 2. Prévia pública do convite (nome do perfil, quem convidou, papel) —
--    usada na tela de aceite antes da pessoa logar/criar conta. Não exige
--    ownership nenhuma, só o token válido.
create or replace function public.get_invite_preview(p_token uuid)
returns table (
  workspace_name text,
  brand_type public.brand_type,
  email text,
  role public.workspace_role,
  is_expired boolean,
  is_accepted boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select w.name, w.brand_type, i.email, i.role,
         (i.expires_at < now()) as is_expired,
         (i.accepted_at is not null) as is_accepted
  from public.workspace_invites i
  join public.workspaces w on w.id = i.workspace_id
  where i.token = p_token
$$;

revoke all on function public.get_invite_preview(uuid) from public, anon;
grant execute on function public.get_invite_preview(uuid) to anon, authenticated;

-- 3. Aceite do convite — precisa estar autenticado, e o e-mail da conta
--    logada precisa bater com o e-mail convidado (evita que outra pessoa
--    aceite um convite que não era pra ela mesmo tendo o link).
create or replace function public.accept_workspace_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.workspace_invites;
  v_caller_email text;
begin
  select * into v_invite from public.workspace_invites where token = p_token;
  if v_invite is null then
    raise exception 'Convite não encontrado.';
  end if;
  if v_invite.accepted_at is not null then
    raise exception 'Este convite já foi aceito.';
  end if;
  if v_invite.expires_at < now() then
    raise exception 'Este convite expirou.';
  end if;

  select email into v_caller_email from auth.users where id = auth.uid();
  if v_caller_email is null or lower(v_caller_email) <> lower(v_invite.email) then
    raise exception 'Este convite foi enviado para outro e-mail.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, invited_by)
  values (v_invite.workspace_id, auth.uid(), v_invite.role, v_invite.invited_by)
  on conflict (workspace_id, user_id) do update set role = excluded.role;

  update public.workspace_invites set accepted_at = now() where id = v_invite.id;

  return v_invite.workspace_id;
end;
$$;

revoke all on function public.accept_workspace_invite(uuid) from public, anon;
grant execute on function public.accept_workspace_invite(uuid) to authenticated;

-- 4. Lista de membros com e-mail, pra tela de gestão do dono — auth.users
--    não é consultável direto do client. A checagem de posse é dentro da
--    própria query (where), não fora: chamar com workspace alheio só
--    retorna vazio, não erro.
create or replace function public.list_workspace_members(p_workspace_id uuid)
returns table (member_id uuid, member_user_id uuid, email text, role public.workspace_role, created_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.user_id, u.email, m.role, m.created_at
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = p_workspace_id
    and public.has_workspace_access(p_workspace_id, 'owner')
$$;

revoke all on function public.list_workspace_members(uuid) from public, anon;
grant execute on function public.list_workspace_members(uuid) to authenticated;

-- 5. Acesso do membro convidado ("editor") aos 4 módulos decididos —
--    políticas ADITIVAS (não substituem as de dono, só somam um caminho
--    novo). Nenhuma outra tabela muda.
drop policy if exists "Workspace members can view pq" on public.personal_questionnaires;
create policy "Workspace members can view pq" on public.personal_questionnaires
  for select using (public.has_workspace_access(workspace_id, 'editor'));
drop policy if exists "Workspace members can insert pq" on public.personal_questionnaires;
create policy "Workspace members can insert pq" on public.personal_questionnaires
  for insert with check (public.has_workspace_access(workspace_id, 'editor'));
drop policy if exists "Workspace members can update pq" on public.personal_questionnaires;
create policy "Workspace members can update pq" on public.personal_questionnaires
  for update using (public.has_workspace_access(workspace_id, 'editor'));

drop policy if exists "Workspace members can view bq" on public.business_questionnaires;
create policy "Workspace members can view bq" on public.business_questionnaires
  for select using (public.has_workspace_access(workspace_id, 'editor'));
drop policy if exists "Workspace members can insert bq" on public.business_questionnaires;
create policy "Workspace members can insert bq" on public.business_questionnaires
  for insert with check (public.has_workspace_access(workspace_id, 'editor'));
drop policy if exists "Workspace members can update bq" on public.business_questionnaires;
create policy "Workspace members can update bq" on public.business_questionnaires
  for update using (public.has_workspace_access(workspace_id, 'editor'));

drop policy if exists "Workspace members can view sales narrative" on public.sales_narrative_questionnaires;
create policy "Workspace members can view sales narrative" on public.sales_narrative_questionnaires
  for select using (public.has_workspace_access(workspace_id, 'editor'));
drop policy if exists "Workspace members can insert sales narrative" on public.sales_narrative_questionnaires;
create policy "Workspace members can insert sales narrative" on public.sales_narrative_questionnaires
  for insert with check (public.has_workspace_access(workspace_id, 'editor'));
drop policy if exists "Workspace members can update sales narrative" on public.sales_narrative_questionnaires;
create policy "Workspace members can update sales narrative" on public.sales_narrative_questionnaires
  for update using (public.has_workspace_access(workspace_id, 'editor'));

drop policy if exists "Workspace members can view answers" on public.archetype_answers;
create policy "Workspace members can view answers" on public.archetype_answers
  for select using (public.has_workspace_access(workspace_id, 'editor'));
drop policy if exists "Workspace members can insert answers" on public.archetype_answers;
create policy "Workspace members can insert answers" on public.archetype_answers
  for insert with check (public.has_workspace_access(workspace_id, 'editor'));
drop policy if exists "Workspace members can update answers" on public.archetype_answers;
create policy "Workspace members can update answers" on public.archetype_answers
  for update using (public.has_workspace_access(workspace_id, 'editor'));
