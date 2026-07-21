-- ============================================================================
-- Causa real do "new row violates row-level security policy for table
-- workspaces" ao criar perfil: o INSERT passa, mas o RETURNING (o
-- .select("id") do cliente) é validado pela política de SELECT — e a
-- política existente usa has_workspace_access(id, ...), que consulta a
-- própria tabela; a linha recém-inserida ainda não é visível para essa
-- subconsulta no mesmo comando, então a devolução é bloqueada.
--
-- Correção: política de SELECT direta para o dono (owner_id = auth.uid()),
-- avaliada sobre a própria linha retornada — enxerga a linha nova na hora.
-- A política via has_workspace_access permanece (cobre membros convidados
-- na Fase 4). Idempotente.
-- ============================================================================

drop policy if exists "Owner can view workspace" on public.workspaces;
create policy "Owner can view workspace" on public.workspaces
  for select using (owner_id = auth.uid());
