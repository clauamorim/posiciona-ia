Diagnóstico do problema

- O backend está respondendo normalmente.
- Nos prints e no snapshot de rede, a chamada `POST /auth/v1/token?grant_type=password` está sendo abortada depois de 15s, por isso aparece a mensagem genérica de timeout.
- No teste direto fora do navegador, o mesmo e-mail inválido responde em ~0,6s com `invalid_credentials`, então a falha não é credencial nem backend.
- A causa provável está no cliente web: a versão atual da biblioteca de autenticação usa Web Locks/navigator locks, e há issues conhecidas de deadlock em `signInWithPassword`, `setSession`, `getSession` e `onAuthStateChange`, especialmente quando uma tentativa anterior deixa lock preso. O código atual ainda chama `supabase.auth.setSession()` e `supabase.auth.getSession()`, então o workaround anterior não removeu a causa.

Plano de correção

1. Substituir o login por senha em `src/pages/Login.tsx` por um fluxo realmente independente do cliente de autenticação:
   - chamar `/auth/v1/token?grant_type=password` via `fetch` com timeout curto e mensagem correta;
   - tratar `400 invalid_credentials` como “E-mail ou senha incorretos”;
   - persistir a sessão manualmente no mesmo formato esperado pelo cliente;
   - não chamar `supabase.auth.signInWithPassword()` nem `supabase.auth.setSession()` no submit.

2. Ajustar `src/contexts/AuthContext.tsx` para não depender de `supabase.auth.getSession()` no carregamento inicial:
   - ler a sessão diretamente do `localStorage` pela chave `sb-...-auth-token`;
   - validar expiração mínima;
   - hidratar usuário/plano/saldos a partir dessa sessão;
   - manter o listener de auth apenas como apoio, mas sem deixar `isLoading` preso se ele travar.

3. Criar uma função utilitária única de sessão em `src/lib/authSession.ts`:
   - calcular a chave de storage;
   - ler/gravar/remover sessão local;
   - normalizar `expires_at`, `expires_in` e `token_type`.
   Isso evita duplicação e reduz risco de um arquivo escrever um formato diferente do outro.

4. Ajustar logout e limpeza:
   - limpar localmente a sessão primeiro para não deixar o app preso em operações internas;
   - tentar `supabase.auth.signOut()` com timeout, sem bloquear a UI se o cliente travar.

5. Melhorar a validação final:
   - testar no preview e-mail inválido: deve voltar imediatamente para “Entrar” e mostrar “E-mail ou senha incorretos”.
   - testar a sequência inválido → tentativa válida: o app não deve ficar preso por lock antigo; se a sessão for aceita, navega para dashboard/admin/planos conforme permissões.

Detalhes técnicos

- Não vou alterar os arquivos auto-gerados da integração.
- Não vou mexer no banco nem nas regras de acesso.
- O objetivo é remover o ponto que ainda causa deadlock: métodos de auth que passam por Web Locks durante o fluxo crítico de login.