## Diagnóstico atual

Pelos prints e pelos sinais do backend, o problema não parece ser mais uma falha de rede do Preview/Safari.

O endpoint de autenticação está respondendo normalmente no domínio publicado (`https://posiciona.ia.br/login`) e no teste direto. A resposta real registrada foi `400 invalid_credentials`, com CORS correto e tempo de resposta curto. Porém, o app está convertendo essa resposta em uma mensagem genérica de “não conseguimos conectar ao servidor”, o que mascara o erro real.

Também há um ponto crítico no backend: a função `handle_new_user()` existe, mas os logs indicam que não há triggers no banco. Isso pode afetar novos cadastros, porque perfis, papéis e saldos podem não estar sendo criados automaticamente após signup.

## Plano de correção

1. **Corrigir a classificação de erros no login**
   - Ajustar `src/pages/Login.tsx` para identificar primeiro `error.code === "invalid_credentials"` e `error.status === 400`.
   - Exibir “E-mail ou senha incorretos” quando o backend responder 400/invalid_credentials.
   - Reservar a mensagem de “falha de conexão” apenas para erros sem resposta HTTP, como `Failed to fetch`, `Load failed`, `NetworkError` ou timeout real.
   - Evitar que o timeout manual transforme respostas válidas do backend em erro de conexão.

2. **Melhorar o estado do botão de login sem mascarar erros**
   - Manter o botão destravando após a tentativa.
   - Garantir que tentativas consecutivas não fiquem com estado antigo de `loginTriggered`.
   - Só navegar após confirmação de sessão/autenticação.

3. **Verificar e corrigir a criação automática de dados de novos usuários**
   - Criar/restaurar o trigger público que executa `handle_new_user()` após novo cadastro, se ele estiver ausente.
   - Isso não altera senhas nem usuários existentes; apenas garante que novos usuários recebam perfil, papel padrão e saldos iniciais.
   - Se houver usuários já criados sem dados relacionados, mapear depois em uma correção separada, sem misturar com o login.

4. **Validar o fluxo no domínio publicado**
   - Testar tentativa com credenciais inválidas: deve mostrar “E-mail ou senha incorretos”.
   - Testar que a requisição `/auth/v1/token?grant_type=password` aparece como 400 quando a senha está errada, não como timeout/conexão.
   - Se você testar com uma conta real e ainda falhar, os logs vão diferenciar: senha incorreta, e-mail não confirmado, conta inexistente ou outro bloqueio real de autenticação.

## Resultado esperado

O usuário deixa de receber uma mensagem falsa de conexão quando o backend respondeu corretamente. O app passa a mostrar o motivo real do login falhar, e o cadastro volta a ter a estrutura necessária para autenticação e uso da plataforma.