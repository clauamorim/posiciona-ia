# Reordenar "Sua História" como 2º passo da jornada

## Nova ordem
Diagnóstico → **Sua História** → Arquétipos → Resultados → Narrativa → Relatório → Instagram → Linha Editorial → Retratos

## Mudanças

### `src/components/DashboardLayout.tsx`
- Mover item "Sua História" no array `userGroups` para a posição logo após "Diagnóstico".
- Atualizar lógica de `journeyStatus`:
  - `/personal-questionnaire`: `done` se `pqSubmitted`, `in_progress` se `bComplete`, senão `blocked`.
  - `/archetype-questionnaire`: `done` se `aDone`, `in_progress` se `bComplete && pqSubmitted`, senão `blocked`.

### `src/pages/Dashboard.tsx`
- Reordenar `journeySteps` para colocar "Sua História" como 2º item.
- Atualizar `getNextStep` priorizando: Diagnóstico → Sua História → Arquétipos → Estratégia → Editorial → Retratos.
- Ajustar dependências dos status (Arquétipos bloqueado até Sua História submetida).

## Sem mudanças
- Backend `generate-content-week` (já valida via 412).
- Tabela `personal_questionnaires`, página `/personal-questionnaire`, rota em `App.tsx`.
- Lógica de bloqueio da Linha Editorial (continua exigindo questionário pessoal).
