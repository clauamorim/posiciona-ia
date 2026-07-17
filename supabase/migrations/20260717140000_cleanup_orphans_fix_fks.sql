-- ============================================================================
-- ETAPA 1.2b — Limpeza de órfãs + FKs que faltavam
-- Diagnóstico (17/07/2026): user_gallery_assets e content_generation_jobs são
-- as únicas tabelas SEM FK para auth.users — linhas de contas apagadas ficavam
-- órfãs (134 + 20 confirmadas por contagem, todas de usuários inexistentes).
-- Este script: (1) apaga só as linhas órfãs; (2) adiciona as FKs com
-- on delete cascade para o problema não voltar. Idempotente.
-- ============================================================================

-- 1. Limpeza: apenas linhas cujo dono NÃO existe mais em auth.users
delete from public.user_gallery_assets x
where not exists (select 1 from auth.users u where u.id = x.user_id);

delete from public.content_generation_jobs x
where not exists (select 1 from auth.users u where u.id = x.user_id);

-- 2. FKs definitivas (mesmo comportamento das demais tabelas do produto)
alter table public.user_gallery_assets
  drop constraint if exists user_gallery_assets_user_id_fkey;
alter table public.user_gallery_assets
  add constraint user_gallery_assets_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.content_generation_jobs
  drop constraint if exists content_generation_jobs_user_id_fkey;
alter table public.content_generation_jobs
  add constraint content_generation_jobs_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
