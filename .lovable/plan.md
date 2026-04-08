

## Plano: Corrigir botão sumindo e redirecionamento incorreto

### Problemas identificados

1. **Botão "Entrar"/"Dashboard" some**: O `onAuthStateChange` dispara o evento `INITIAL_SESSION` E o `getSession()` também resolve, ambos chamando `applyAuthenticatedSession`. Isso cria uma corrida onde o primeiro call é invalidado pelo segundo (ref ID mismatch), causando estados intermediários inconsistentes.

2. **Redirecionamento para compra com plano ativo**: O `ProtectedRoute` verifica `hasActivePlan` assim que `isLoading=false`. Se a subscription ainda não carregou completamente (race condition entre os dois caminhos de inicialização), `hasActivePlan=false` e o usuário é enviado para `/choose-plan`.

### Solução

**Arquivo: `src/contexts/AuthContext.tsx`**

- Remover a chamada duplicada `supabase.auth.getSession()` — o `onAuthStateChange` já emite `INITIAL_SESSION` que cumpre o mesmo papel
- Tratar o evento `INITIAL_SESSION` explicitamente no listener
- Garantir que `isLoading` só vira `false` depois que session + subscription + balances + admin estejam todos carregados
- Manter o sistema de `authRequestRef` para cancelar requests obsoletos

**Arquivo: `src/pages/LandingPage.tsx`**

- Nenhuma mudança necessária — o nav já usa `isLoading` corretamente com Skeleton

**Arquivo: `src/components/ProtectedRoute.tsx`**

- Nenhuma mudança necessária — já depende de `isLoading` corretamente; o problema é que `isLoading` fica `false` antes dos dados estarem prontos

### Detalhes técnicos

```text
Antes (problemático):
  onAuthStateChange(INITIAL_SESSION) → applyAuth (ref=1) → loadUserData...
  getSession() resolve             → applyAuth (ref=2) → loadUserData...
  ref=1 loadUserData bails (ref mismatch) → dados parciais
  
Depois (corrigido):
  onAuthStateChange(INITIAL_SESSION) → applyAuth (ref=1) → loadUserData → isLoading=false
  onAuthStateChange(SIGNED_IN)       → applyAuth (ref=2) → loadUserData → isLoading=false
  onAuthStateChange(TOKEN_REFRESHED) → atualiza session sem resetar isLoading
  Sem getSession() duplicado
```

