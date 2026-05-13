Vou corrigir o login para nunca ficar preso em “Entrando...” e para separar claramente erro de credenciais, e-mail não confirmado e falha de conexão.

Plano:
1. Ajustar `src/pages/Login.tsx` para envolver `signInWithPassword` com timeout controlado, garantindo que `loading` sempre volte para `false` mesmo se a chamada de autenticação travar.
2. Ignorar respostas atrasadas de tentativas antigas, evitando que uma tentativa anterior altere o estado ou a mensagem de uma tentativa nova.
3. Melhorar o mapeamento de erros: credenciais inválidas → “E-mail ou senha incorretos”; e-mail não confirmado → orientação de confirmação; timeout/rede → mensagem para tentar novamente.
4. Validar no preview com e-mail incorreto: o botão deve voltar para “Entrar” e exibir erro, sem travar.

Detalhe técnico:
- O preview reproduziu corretamente um erro 400 `invalid_credentials`, mas há evidência externa de travamentos intermitentes em `signInWithPassword` por lock interno da biblioteca de autenticação. Por isso a correção precisa tratar tanto erro normal quanto Promise que nunca resolve.