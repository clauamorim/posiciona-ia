## Diagnóstico

O backend hospedado está saudável. No meu teste no Preview, uma tentativa com credenciais inválidas chamou `/auth/v1/token?grant_type=password` e voltou em ~400ms com `invalid_credentials`, então a autenticação em si responde.

O travamento relatado acontece antes da requisição aparecer na rede, e começou depois das correções para travamento ao trocar de aba/logout. O ponto frágil atual é o patch `supabaseAuthLockFix.ts`: ele tenta esconder `navigator.locks`, mas isso é um hack global e pode falhar por ordem de carregamento, Safari/Preview ou HMR. Além disso, o cliente gerado não está usando a API oficial de lock da biblioteca.

## Plano de correção

1. **Trocar o hack global por lock explícito e estável**
   - Remover o arquivo `src/lib/supabaseAuthLockFix.ts` e o import em `src/main.tsx`.
   - Configurar o cliente de autenticação com `processLock` oficial da biblioteca, evitando o Web Locks API que pode ficar preso ao trocar de aba.
   - Manter `persistSession` e `autoRefreshToken`.

2. **Proteger o login contra requisições órfãs**
   - Remover retries longos que fazem o usuário esperar até 45s.
   - Usar uma única tentativa com timeout curto e mensagem clara.
   - Garantir que o botão sempre volte para “Entrar”.

3. **Revisar restauração/logout sem bloquear a UI**
   - Conferir `AuthContext` para manter o padrão correto: listener síncrono, hidratação desacoplada e timeout de hidratação.
   - Não alterar banco, usuários, senhas, planos ou RLS.

4. **Validar no Preview**
   - Testar login inválido: deve responder rapidamente com “E-mail ou senha incorretos”.
   - Confirmar na rede que `/auth/v1/token` é chamado.
   - Confirmar que não aparece mais a mensagem falsa “sessão local ficou presa” quando a requisição de auth está funcionando.

## Arquivos envolvidos

- `src/integrations/supabase/client.ts`
- `src/main.tsx`
- `src/lib/supabaseAuthLockFix.ts`
- `src/pages/Login.tsx`
- `src/contexts/AuthContext.tsx` apenas se a revisão mostrar bloqueio real no fluxo de sessão