-- ============================================================================
-- Fecha o ciclo do pedido de exclusão LGPD ("Meus dados" -> Excluir conta).
-- Hoje account_deletion_requests não tem status nenhum nem FK pra
-- auth.users — mesmo depois do admin excluir a conta de verdade, o pedido
-- continua aparecendo pra sempre em /admin/exclusoes-lgpd como pendente,
-- sem jeito de marcar como resolvido.
-- Aplicação: MANUAL no SQL editor do Lovable Cloud. Idempotente.
-- ============================================================================

alter table public.account_deletion_requests add column if not exists processed_at timestamptz;
