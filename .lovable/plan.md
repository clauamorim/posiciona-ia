## Diagnóstico

O backend hospedado está saudável e o endpoint de autenticação responde rapidamente: em teste com credenciais inválidas, a chamada `/auth/v1/token?grant_type=password` voltou em ~400ms com erro correto de credenciais. Isso indica que o timeout visto no login não é indisponibilidade do backend.

O ponto mais provável é o lock interno da biblioteca de autenticação no navegador. A versão instalada (`@supabase/supabase-js` 2.105.4) usa `navigator.locks` por padrão quando disponível; há relatos e correções upstream relacionadas a deadlocks/orphan locks que fazem chamadas como `signInWithPassword()` ficarem presas antes mesmo de enviar a requisição. O patch atual (`supabaseAuthLockFix.ts`) tenta esconder `navigator.locks` apenas por um microtask, mas o cliente é criado depois disso, então o patch não garante que o cliente deixe de usar Web Locks.

## Plano de correção

1. **Substituir o patch temporário por lock explícito**
   - Remover o hack de sobrescrever `navigator.locks`.
   - Configurar o cliente de autenticação com o `processLock` oficial exportado pela própria biblioteca.
   - Isso evita o Web Locks API e mantém serialização segura dentro da aba.

2. **Preservar sessão e refresh normalmente**
   - Manter `persistSession: true` e `autoRefreshToken: true`.
   - Não alterar banco, usuários, senhas, RLS ou regras de plano.

3. **Melhorar a resposta visual do login**
   - Ajustar o erro de timeout para explicar que a sessão local ficou presa e orientar nova tentativa, em vez de parecer falha geral do servidor.
   - Manter o botão destravando sempre.

4. **Validar o fluxo**
   - Testar no preview com credenciais inválidas para confirmar que a chamada responde e o botão volta para “Entrar”.
   - Verificar console/rede para confirmar ausência de erro de lock/timeout.

## Arquivos previstos

- `src/integrations/supabase/client.ts`
- `src/lib/supabaseAuthLockFix.ts`
- `src/main.tsx`
- `src/pages/Login.tsx`

## Observação

O arquivo do cliente é marcado como gerado automaticamente, mas neste caso a correção precisa entrar na configuração do cliente existente. Não haverá alteração de backend nem migração.