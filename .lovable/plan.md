Diagnóstico confirmado:
- O backend está respondendo normalmente.
- No preview da usuária, a chamada real para `/auth/v1/token?grant_type=password` falha como `Load failed` no navegador, antes de expor a resposta ao app.
- Testando fora do navegador com o mesmo domínio, o endpoint responde corretamente com HTTP 400 e `invalid_credentials` quando a senha é falsa. Ou seja: não é erro de RLS, plano, perfil, assinatura ou rota protegida.
- O código atual ainda tem um ponto arriscado: antes de cada login ele chama `supabase.auth.signOut({ scope: "local" })`. Isso dispara fluxo interno de auth e eventos de sessão imediatamente antes do `signInWithPassword`, o que pode produzir comportamento instável em Safari/Chrome e mascarar o erro real como falha de conexão.

Plano de correção:
1. Simplificar a limpeza local antes do login
   - Alterar `clearLocalAuthSession` para apenas remover chaves locais de autenticação do navegador, sem chamar `supabase.auth.signOut({ scope: "local" })`.
   - Manter a função segura para localStorage indisponível/privado.

2. Separar logout real de limpeza local
   - No `AuthContext.signOut`, manter um único `supabase.auth.signOut()` remoto.
   - Depois dele, chamar apenas a limpeza local passiva.
   - Evitar duplo logout remoto/local que pode gerar eventos concorrentes.

3. Corrigir classificação do erro de login
   - No `Login.tsx`, tratar `error.code`, `error.error_code`, `error.status` e mensagens retornadas pela biblioteca.
   - Se o navegador devolver `Load failed`, mostrar como falha de conexão somente quando de fato não houver resposta HTTP.
   - Quando houver resposta HTTP de credenciais inválidas, mostrar `E-mail ou senha incorretos`.

4. Adicionar um fallback de diagnóstico controlado no login
   - Se `signInWithPassword` cair em erro de rede (`Load failed`/timeout), fazer uma segunda chamada `fetch` direta ao mesmo endpoint com os mesmos dados.
   - Se esse fallback receber `invalid_credentials`, mostrar a mensagem correta.
   - Se o fallback também falhar sem resposta, manter a mensagem de conexão.
   - Se o fallback autenticar com sucesso, gravar a sessão no client e navegar normalmente.

5. Preservar segurança e dados
   - Não alterar senha, conta, assinatura, questionários, relatórios ou banco de dados.
   - Não expor credenciais em logs.
   - Não mexer nos arquivos auto-gerados da integração.

Validação:
- Testar no preview com credenciais falsas para confirmar que aparece `E-mail ou senha incorretos`, não “Não conseguimos conectar”.
- Confirmar na aba de rede que a chamada ao auth recebe resposta HTTP quando disponível.
- Confirmar que o backend segue saudável.