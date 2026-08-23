-- ============================================================================
-- Planos multi-perfil (Dupla/Multi/Agência) + limite de perfis por plano.
-- Aplicação: MANUAL no SQL editor do Lovable Cloud (git push não aplica
-- migração). Idempotente.
-- ============================================================================

-- 1. Limite de perfis por plano. Default 1 = comportamento atual, sem
--    mudança nenhuma pros 3 planos já existentes.
alter table public.plans add column if not exists max_workspaces integer not null default 1;

-- 2. Planos novos. Créditos escalam proporcionalmente ao nº de perfis a
--    partir da unidade do Autoridade Total (4 ciclos / 2 reanálises /
--    5 retratos / 20 ajustes por perfil/mês) — cada perfil precisa de
--    cadência semanal própria mesmo com o pool de créditos compartilhado
--    entre os perfis da conta.
insert into public.plans (name, slug, price_cents, billing_type, weekly_cycles, reanalysis_credits, portrait_credits, regeneration_credits, stripe_price_id, max_workspaces, active)
values
  ('Posiciona Dupla',   'dupla',   79700,  'recurring', 8,  4,  10, 40,  'price_1U7dHwCzHWisuWdYzgyIZ5AF', 2,  true),
  ('Posiciona Multi',   'multi',   119700, 'recurring', 16, 8,  20, 80,  'price_1U7dIHCzHWisuWdY5JyRZ7om', 4,  true),
  ('Posiciona Agência', 'agencia', 219700, 'recurring', 40, 20, 50, 200, 'price_1U7dIhCzHWisuWdYj4bYobKU', 10, true)
on conflict (slug) do update set
  price_cents = excluded.price_cents,
  stripe_price_id = excluded.stripe_price_id,
  max_workspaces = excluded.max_workspaces,
  weekly_cycles = excluded.weekly_cycles,
  reanalysis_credits = excluded.reanalysis_credits,
  portrait_credits = excluded.portrait_credits,
  regeneration_credits = excluded.regeneration_credits,
  active = excluded.active;

-- 3. Enforcement do limite no banco — uma checagem só no cliente (JS) não
--    protege nada aqui, dá pra chamar supabase.from("workspaces").insert()
--    direto pelo console. Trigger bloqueia mesmo assim, independente de
--    onde o insert vem.
create or replace function public.enforce_workspace_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  allowed integer;
begin
  select count(*) into current_count
  from public.workspaces
  where owner_id = new.owner_id;

  select p.max_workspaces into allowed
  from public.subscriptions s
  join public.plans p on p.id = s.plan_id
  where s.user_id = new.owner_id
    and s.status = 'active'
  order by s.created_at desc
  limit 1;

  if allowed is null then
    allowed := 1;
  end if;

  if current_count >= allowed then
    raise exception 'Limite de % perfis do plano atual atingido.', allowed;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_workspace_limit on public.workspaces;
create trigger trg_enforce_workspace_limit
  before insert on public.workspaces
  for each row execute function public.enforce_workspace_limit();
