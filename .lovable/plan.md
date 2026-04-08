

## Atribuir Planos e Créditos a Usuários pelo Painel Admin

### Problema
O painel admin atual mostra usuários mas não permite atribuir planos/assinaturas. O admin só consegue editar créditos legados (`user_credits.balance`) e bloquear/desbloquear.

### Solução
Adicionar duas novas ações no painel de usuários:

1. **Botão "Atribuir Plano"** — abre um dialog onde o admin seleciona um plano e a duração (1, 2, 3... meses). Ao salvar:
   - Cria/atualiza registro na tabela `subscriptions` com status `active` e `current_period_end` calculado
   - Provisiona os créditos correspondentes na tabela `user_balances` com base nos valores do plano selecionado (`weekly_cycles`, `reanalysis_credits`, `portrait_credits`, `regeneration_credits`)
   - Registra log em `credit_logs`

2. **Mostrar plano atual na tabela** — nova coluna "Plano" exibindo o plano ativo do usuário (ou "Nenhum")

### Alterações

**`src/pages/admin/AdminUsers.tsx`**:
- Carregar dados de `subscriptions` e `plans` no `loadUsers` para mostrar plano ativo de cada usuário
- Adicionar coluna "Plano" na tabela
- Novo botão de ação (ícone Crown/CreditCard) para abrir dialog de atribuição de plano
- Novo dialog "Atribuir Plano" com:
  - Select para escolher o plano (carregado da tabela `plans`)
  - Input numérico para duração em meses
  - Ao salvar: upsert em `subscriptions`, atualizar `user_balances` com créditos do plano multiplicados pela duração, inserir `credit_log`
- Atualizar dialog de créditos existente para editar `user_balances` (créditos granulares) em vez do legado `user_credits`

**Nenhuma migração necessária** — as tabelas `subscriptions`, `user_balances`, `plans` e `credit_logs` já existem com as RLS policies corretas (admin pode inserir subscriptions e atualizar balances).

### Fluxo do Admin
1. Clica no ícone de plano ao lado do usuário
2. Seleciona "Autoridade Total" e digita "3" meses
3. Sistema cria subscription ativa com `current_period_end = now + 3 meses`
4. Sistema seta `user_balances`: `weekly_cycles = 4×3=12`, `reanalysis_credits = 2×3=6`, etc.
5. Tabela atualiza mostrando "Autoridade Total" na coluna Plano

