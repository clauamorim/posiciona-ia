## Diagnóstico

O anexo mostra o toast “A conexão demorou demais para responder”. Os sinais atuais indicam:

- A chamada de login está sendo disparada para `/auth/v1/token?grant_type=password`.
- No Preview, a requisição falha como `Load failed`, sem resposta HTTP do backend.
- O backend hospedado está saudável.
- Esse padrão é compatível com falha de rede/proxy do Preview/Safari, não com senha incorreta, RLS ou banco travado.
- A alteração anterior em `src/integrations/supabase/client.ts` editou um arquivo marcado como gerado automaticamente; isso deve ser revertido para evitar instabilidade futura.

## Plano de correção

1. **Desfazer alteração em arquivo gerado**
   - Restaurar `src/integrations/supabase/client.ts` para o formato padrão gerado.
   - Remover o uso manual de `processLock` nesse arquivo, porque ele não deve ser editado diretamente.

2. **Manter o login sem travar a interface**
   - Preservar o timeout curto no `Login.tsx`, para o botão voltar ao estado normal mesmo quando o Preview/Safari bloqueia a requisição.
   - Ajustar a mensagem de erro para diferenciar melhor “falha de conexão no Preview/navegador” de “credenciais incorretas”.
   - Evitar retries automáticos que geram várias chamadas simultâneas e dão aparência de travamento.

3. **Não mexer em backend, CORS ou autenticação hospedada**
   - Não adicionar CORS manual.
   - Não trocar URL/chaves do backend.
   - Não sobrescrever `window.fetch`.
   - Não alterar RLS, usuários, senhas ou planos.

4. **Orientar validação correta**
   - Testar o mesmo login no domínio publicado/custom domain: `https://posiciona.ia.br/login`.
   - Se funcionar no publicado e falhar só no Preview/Safari, confirmar que o problema é do ambiente Preview/proxy/navegador.
   - No Preview, sugerir testar Chrome ou janela privada do Safari como contorno temporário.

## Resultado esperado

O app não ficará preso no login, o código voltará a respeitar os arquivos gerados automaticamente, e a mensagem deixará claro quando a falha é de conexão do Preview/navegador em vez de um erro real de autenticação.