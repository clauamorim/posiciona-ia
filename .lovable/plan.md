## Problema

Hoje a Linha Editorial (`src/pages/EditorialPage.tsx`) abre fixa na **Semana 1**, porque o `Tabs` usa `defaultValue="week-0"`. Quando o usuário já tem várias semanas geradas, ele precisa clicar manualmente na última toda vez que entra na página.

## Solução

Fazer com que a aba ativa inicial seja sempre a **última semana** disponível (`allWeeks.length - 1`), que corresponde à mais recente gerada (a ordem do array é cronológica: `editorial` da v1 + `editorial_weeks[]` na ordem de criação).

## Implementação

Arquivo único: **`src/pages/EditorialPage.tsx`**

1. **Tornar o Tabs controlado**, com estado `activeWeek: string`.
2. Inicializar/atualizar esse estado assim que `allWeeks` for conhecido (após o `report` carregar do Supabase), apontando para `week-${allWeeks.length - 1}`.
3. Preservar a aba escolhida pelo usuário durante a sessão (não "saltar" para a última toda vez que `report` muda por causa de polling/regeneração) — usar uma flag `hasInitializedTab` via `useRef` para definir a aba apenas na primeira vez que `allWeeks.length > 0`.
4. Quando uma **nova semana é gerada** (handleGenerateWeek conclui com sucesso), forçar o salto para a recém-criada (`week-${allWeeks.length - 1}` após o reload do report) — isso já é o comportamento natural desejado e melhora a UX.
5. Substituir `<Tabs defaultValue="week-0">` por `<Tabs value={activeWeek} onValueChange={setActiveWeek}>`.

## Comportamento esperado

- **Entrar na Linha Editorial com 3 semanas geradas** → abre direto na Semana 3.
- **Usuário clica na Semana 1** para revisar → permanece na Semana 1 (não pula de volta).
- **Usuário gera Semana 4** → salta automaticamente para a Semana 4 ao concluir.
- **Sem semanas geradas** → não há tabs visíveis (já é o caso hoje, comportamento preservado).

Sem alterações de schema, edge functions ou outras telas.