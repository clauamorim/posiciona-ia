
Objetivo: corrigir o redirecionamento indevido para `/choose-plan` após login, especialmente no admin, e estabilizar os botões da landing.

Diagnóstico
- O problema principal não é mais `getSession()`: o bug atual vem do fato de que o `AuthContext` deixa `isLoading=false` depois do carregamento inicial sem sessão.
- Quando a pessoa faz login, o evento `SIGNED_IN` atualiza `session`, mas não volta `isLoading` para `true` antes de buscar `isAdmin`, assinatura e saldos.
- Nesse intervalo, o `ProtectedRoute` de `/dashboard` avalia:
  - `user` já existe
  - `isAdmin` ainda é `false`
  - `hasActivePlan` ainda é `false`
  - resultado: redireciona para `/choose-plan`
- Isso explica por que o admin caiu na compra, mesmo devendo ser liberado.

Implementação proposta

1. Refatorar o fluxo de hidratação no `AuthContext`
- Criar uma função única para aplicar a sessão autenticada e carregar:
  - papel de admin
  - assinatura
  - saldos
- Sempre que chegar `SIGNED_IN`, `USER_UPDATED` ou `INITIAL_SESSION` com usuário:
  - definir `isLoading=true` imediatamente
  - só depois liberar `isLoading=false` ao fim do carregamento completo
- Em `SIGNED_OUT`:
  - limpar estado
  - finalizar com `isLoading=false`
- Em `TOKEN_REFRESHED`:
  - atualizar apenas a sessão, sem resetar tudo

2. Blindar contra respostas antigas
- Manter `authRequestRef`, mas aplicar a checagem em todos os caminhos assíncronos.
- Garantir que erros em `loadSubscription` ou `loadBalances` também resultem em estado consistente, sem “vazar” valores antigos.

3. Ajustar a navegação pós-login
- No `Login.tsx`, evitar depender só do `navigate("/dashboard")` imediato.
- Opção mais segura:
  - deixar o login autenticar
  - redirecionar depois que o contexto estiver pronto
- Se quiser manter o `navigate("/dashboard")`, ele só ficará seguro após o ajuste do `isLoading`, então não é obrigatório mudar a tela de login, mas eu revisaria esse ponto para evitar nova corrida.

4. Revisar a regra de acesso
- Manter `ProtectedRoute` simples:
  - sem usuário → `/login`
  - admin em rota com `requirePlan` → permitido
  - usuário comum sem plano → `/choose-plan`
- Não precisa alterar a intenção da regra; o bug está no timing dos dados.

Arquivos a ajustar
- `src/contexts/AuthContext.tsx`
- `src/pages/Login.tsx` (revisão leve, se necessário)
- `src/components/ProtectedRoute.tsx` (provavelmente sem mudança funcional)

Resultado esperado
- O botão “Entrar” e o botão “Dashboard” deixam de sumir por causa de transições incompletas de auth.
- Usuário com plano ativo não será mais enviado para compra ao entrar.
- Admin não será mais redirecionado para `/choose-plan` durante o login.

Detalhe técnico
```text
Estado atual:
INITIAL_SESSION sem sessão -> isLoading=false
usuário faz login -> session chega primeiro
/dashboard renderiza antes de admin/plano carregarem
ProtectedRoute entende "sem plano e não admin"
redirect para /choose-plan

Estado corrigido:
SIGNED_IN -> isLoading=true imediatamente
carrega admin + assinatura + saldos
só então isLoading=false
ProtectedRoute decide com dados completos
```
