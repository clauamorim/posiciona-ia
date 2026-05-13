## Diagnóstico

O backend está saudável e a conta `claudiacomput@hotmail.com` existe, está confirmada, não está banida e tem assinatura ativa. O erro que aparece agora vem do endpoint de autenticação retornando `invalid_credentials`, não de conexão nem de RLS/permissões do banco.

Há dois pontos frágeis no código atual que podem deixar o login parecendo “quebrado” depois das mudanças de logout/sessão:

1. O login aplica `trim()` na senha. Isso altera a senha digitada se ela tiver espaço no começo ou no fim, e pode gerar `invalid_credentials` mesmo quando a usuária digitou a senha “certa”.
2. O app não faz uma limpeza explícita e completa da sessão local antes de uma nova tentativa de login. Depois do problema anterior de travamento/logout, pode sobrar sessão/token inválido no `localStorage`, especialmente entre Preview, domínio publicado e custom domain.

## Plano de correção

1. **Corrigir o envio da senha no login**
   - Manter normalização apenas no e-mail.
   - Enviar a senha exatamente como digitada, sem `trim()`.
   - Validar senha vazia usando `password.length`, sem modificar o valor.

2. **Adicionar limpeza segura antes de autenticar novamente**
   - Antes de chamar o login, limpar tokens locais antigos do Lovable Cloud/Auth no domínio atual.
   - Chamar logout com escopo local quando houver sessão residual, sem depender de resposta remota.
   - Evitar que uma sessão revogada de logout anterior contamine uma nova tentativa.

3. **Deixar o redirecionamento pós-login determinístico**
   - Após `signInWithPassword` bem-sucedido, navegar imediatamente usando a sessão retornada.
   - Não depender exclusivamente da hidratação assíncrona do `AuthContext` para sair da tela de login.
   - Preservar a verificação de admin/plano existente no `ProtectedRoute`.

4. **Melhorar a mensagem para este caso real**
   - Manter `E-mail ou senha incorretos` quando o backend rejeitar credenciais.
   - Remover a mensagem enganosa de “conexão/servidor” para erros HTTP válidos.
   - Se houver timeout/falha de rede real, aí sim exibir a mensagem de conexão.

5. **Garantir caminho de recuperação caso a senha tenha sido alterada ou o usuário esteja preso**
   - Revisar o fluxo de “Esqueci minha senha” e `/reset-password` para confirmar que ele redefine a senha sem prender o usuário em sessão antiga.
   - Se necessário, ajustar o reset para limpar sessão local antes/depois da atualização e levar de volta ao login com uma mensagem clara.

6. **Validar depois da implementação**
   - Conferir que o login chama o endpoint correto e que os erros são classificados corretamente.
   - Conferir que logout não deixa estado local preso.
   - Conferir que a conta continua com perfil, role e plano ativos depois do login.

## Arquivos envolvidos

- `src/pages/Login.tsx`
- `src/contexts/AuthContext.tsx`
- `src/pages/ResetPassword.tsx` se a revisão confirmar necessidade de ajuste no reset

## Observação importante

Como o backend está respondendo normalmente e a conta está ativa, se após essa correção o backend ainda retornar `invalid_credentials`, a solução definitiva será redefinir a senha pelo fluxo “Esqueci minha senha”. Isso não apaga dados, plano, questionários ou relatórios da conta.