-- ============================================================================
-- ETAPA 1.1 — Fundação multi-workspace (expand, parte 1)
-- Plano: docs/plano-multi-workspace.md | Aplicação: MANUAL no SQL editor do
-- Lovable Cloud (git push não aplica migração). Não muda nada visível: cria
-- estruturas novas e dá 1 workspace default "pessoal" a cada usuário existente.
-- Idempotente: pode rodar de novo sem duplicar nada.
-- ============================================================================

-- 1. Enums
do $$ begin
  create type public.brand_type as enum ('pessoal', 'institucional');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.workspace_role as enum ('owner', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

-- 2. Workspaces: um perfil de marca com tipo
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  brand_type  public.brand_type not null default 'pessoal',
  handle      text,
  profession  text,
  niche       text,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index if not exists one_default_workspace_per_owner
  on public.workspaces (owner_id) where is_default;
create index if not exists idx_workspaces_owner on public.workspaces (owner_id);

drop trigger if exists workspaces_updated_at on public.workspaces;
create trigger workspaces_updated_at
  before update on public.workspaces
  for each row execute function public.update_updated_at_column();

-- 3. Membros (schema nasce agora; UI de convites fica para a Fase 4)
create table if not exists public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         public.workspace_role not null default 'editor',
  invited_by   uuid references auth.users(id),
  created_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index if not exists idx_workspace_members_user on public.workspace_members (user_id);

-- 4. Função de acesso — base de toda a RLS nova.
--    SECURITY DEFINER evita recursão de RLS (mesmo padrão de has_role).
create or replace function public.has_workspace_access(
  _workspace_id uuid,
  _min_role public.workspace_role default 'viewer'
)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspaces w
    where w.id = _workspace_id and w.owner_id = auth.uid()
  )
  or exists (
    select 1 from public.workspace_members m
    where m.workspace_id = _workspace_id
      and m.user_id = auth.uid()
      and (
        _min_role = 'viewer'
        or (_min_role = 'editor' and m.role in ('owner','editor'))
        or (_min_role = 'owner'  and m.role = 'owner')
      )
  )
$$;

revoke execute on function public.has_workspace_access(uuid, public.workspace_role) from public, anon;
grant  execute on function public.has_workspace_access(uuid, public.workspace_role) to authenticated;

-- 5. RLS das tabelas novas
alter table public.workspaces enable row level security;

drop policy if exists "Members can view workspace" on public.workspaces;
create policy "Members can view workspace" on public.workspaces
  for select using (public.has_workspace_access(id, 'viewer'));

drop policy if exists "Users can create own workspaces" on public.workspaces;
create policy "Users can create own workspaces" on public.workspaces
  for insert with check (owner_id = auth.uid());

drop policy if exists "Owner can update workspace" on public.workspaces;
create policy "Owner can update workspace" on public.workspaces
  for update using (owner_id = auth.uid());

drop policy if exists "Owner can delete workspace" on public.workspaces;
create policy "Owner can delete workspace" on public.workspaces
  for delete using (owner_id = auth.uid());

drop policy if exists "Admins can view all workspaces" on public.workspaces;
create policy "Admins can view all workspaces" on public.workspaces
  for select using (public.has_role(auth.uid(), 'admin'));

alter table public.workspace_members enable row level security;

drop policy if exists "Members see own membership" on public.workspace_members;
create policy "Members see own membership" on public.workspace_members
  for select using (user_id = auth.uid() or public.has_workspace_access(workspace_id, 'owner'));

drop policy if exists "Workspace owner manages members" on public.workspace_members;
create policy "Workspace owner manages members" on public.workspace_members
  for all using (public.has_workspace_access(workspace_id, 'owner'))
  with check (public.has_workspace_access(workspace_id, 'owner'));

-- 6. Backfill: todo usuário existente ganha 1 workspace default 'pessoal'
--    (comportamento idêntico ao atual — 1 conta = 1 marca)
insert into public.workspaces (owner_id, name, brand_type, profession, niche, is_default)
select p.user_id,
       coalesce(nullif(p.full_name, ''), 'Minha marca'),
       'pessoal',
       p.profession,
       p.niche,
       true
from public.profiles p
where not exists (
  select 1 from public.workspaces w
  where w.owner_id = p.user_id and w.is_default
);

-- 7. Signup: novo usuário nasce com workspace default
--    (corpo atual de handle_new_user + o insert em workspaces no fim)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (user_id, full_name, profession, niche, whatsapp, main_goal, gender)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    new.raw_user_meta_data->>'profession',
    new.raw_user_meta_data->>'niche',
    new.raw_user_meta_data->>'whatsapp',
    new.raw_user_meta_data->>'main_goal',
    new.raw_user_meta_data->>'gender'
  );
  insert into public.user_roles (user_id, role)
  values (new.id, 'user');
  insert into public.user_credits (user_id, balance)
  values (new.id, 1);
  insert into public.user_balances (user_id)
  values (new.id);
  insert into public.workspaces (owner_id, name, brand_type, profession, niche, is_default)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'Minha marca'),
    'pessoal',
    new.raw_user_meta_data->>'profession',
    new.raw_user_meta_data->>'niche',
    true
  );
  return new;
end;
$function$;
