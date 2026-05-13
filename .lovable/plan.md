## Diagnóstico

- O backend hospedado está respondendo normalmente.
- O endpoint de login responde quando chamado; em teste com credenciais inválidas, ele retorna erro em menos de 1 segundo, então não há indisponibilidade geral.
- O ponto frágil está no fluxo do frontend: o `AuthContext` executa consultas assíncronas diretamente dentro do callback de mudança de autenticação. Esse padrão pode bloquear eventos internos do cliente de autenticação e deixar a tela em `Entrando...` quando a sessão precisa ser restaurada/hidratada, especialmente em Safari/iPhone ou após sessões presas.

## Plano de correção

1. **Refatorar a inicialização da autenticação**
   - Fazer o `AuthProvider` restaurar a sessão com `getSession()` ao montar.
   - Só depois manter o `onAuthStateChange` para eventos subsequentes.
   - Evitar `await`/hidratações pesadas dentro do callback do listener, usando execução desacoplada.

2. **Adicionar proteção contra login preso**
   - No `Login.tsx`, envolver `signInWithPassword` com timeout controlado.
   - Garantir que o botão sempre volte de `Entrando...` para `Entrar` em erro, timeout ou falha de rede.
   - Exibir mensagem clara quando a conexão/auth demorar demais.

3. **Separar navegação pós-login da hidratação completa**
   - Após login bem-sucedido, permitir navegação quando houver sessão válida, sem depender indefinidamente de consultas de plano/admin/saldos.
   - Manter os dados complementares carregando em segundo plano com fallback seguro.

4. **Preservar o logout robusto**
   - Manter o evento `app:signout` para interromper processos longos.
   - Garantir limpeza local imediata mesmo se o serviço de autenticação atrasar.

5. **Validar o fluxo**
   - Testar o formulário com credenciais inválidas para confirmar que não fica travado.
   - Verificar, via rede/console, que erros voltam para a UI e que o botão destrava.

## Arquivos previstos

- `src/contexts/AuthContext.tsx`
- `src/pages/Login.tsx`

Não pretendo alterar banco de dados nem regras de acesso para essa correção.