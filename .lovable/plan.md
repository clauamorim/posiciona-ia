## Diagnóstico

O problema real não parece ser senha, plano, assinatura ou banco de dados. O backend está saudável, mas no navegador a chamada de login para `/auth/v1/token?grant_type=password` aparece como `Fetch is aborted` antes de receber resposta. Isso acontece tanto com e-mail inválido quanto com credenciais corretas.

A causa mais provável está no fluxo atual do `Login.tsx`: ele combina `signInWithPassword`, limpeza manual de sessão, `Promise.race` com timeout e um fallback `fetch` com `AbortController`. Esse fallback também aborta e acaba mascarando qualquer resultado real, inclusive login válido.

## Plano de correção

1. **Simplificar o login para parar de abortar a autenticação**
   - Remover o `Promise.race` manual ao redor de `supabase.auth.signInWithPassword`.
   - Remover o fallback direto com `fetch` para `/auth/v1/token` e seu `AbortController`.
   - Manter o fluxo oficial da biblioteca de autenticação como fonte única da verdade.

2. **Não limpar a sessão imediatamente antes de tentar login**
   - Parar de chamar `clearLocalAuthSession()` dentro do submit de login.
   - Preservar `clearLocalAuthSession()` para logout e recuperação de senha, onde faz sentido limpar estado local.
   - Evitar remover chaves de autenticação enquanto a própria biblioteca está tentando adquirir lock/salvar sessão.

3. **Melhorar a mensagem de erro sem esconder o erro real**
   - Mapear `invalid_credentials` para `E-mail ou senha incorretos`.
   - Mapear `email_not_confirmed` para orientação de confirmação de e-mail.
   - Se ainda houver erro de rede real, mostrar mensagem de conexão, mas sem transformar aborts artificiais em diagnóstico final.

4. **Deixar a navegação pós-login depender do estado de autenticação**
   - Após sucesso do `signInWithPassword`, marcar `loginTriggered` e deixar o `AuthContext` hidratar a sessão.
   - Evitar chamada extra imediata de admin no `Login.tsx` quando o contexto já faz essa hidratação.
   - Isso reduz corrida entre salvar sessão, carregar permissões e navegar.

5. **Validação após implementação**
   - Testar e-mail inválido: deve retornar mensagem de credenciais incorretas, não `Fetch is aborted`.
   - Testar e-mail correto: deve concluir login e ir para dashboard/admin.
   - Conferir no preview/rede que não há duas tentativas concorrentes nem abort manual no login.

## Arquivos previstos

- `src/pages/Login.tsx`: simplificar fluxo de submit, remover timeout/fallback direto e ajustar mensagens.
- `src/lib/authCleanup.ts`: manter como limpeza passiva local, sem mudanças grandes se não for necessário.
- `src/contexts/AuthContext.tsx`: revisar apenas se necessário para garantir que logout continue seguro e login não dependa de estado concorrente.

## Observação

Não pretendo alterar senha, conta, dados do usuário, planos, relatórios ou estrutura do backend.