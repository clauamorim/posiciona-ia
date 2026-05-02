Plano para corrigir a perda de respostas nos questionários:

1. **Corrigir o fluxo de salvamento nos dois questionários**
   - Alterar “Próximo” / “Próximo bloco” para aguardar o salvamento terminar antes de avançar.
   - Se o banco retornar erro, não avançar silenciosamente e mostrar uma mensagem clara.
   - Remover o comportamento atual que exibe “Salvo automaticamente” mesmo quando a operação pode ter falhado.

2. **Adicionar autosave real enquanto o usuário responde**
   - Salvar rascunhos automaticamente alguns instantes após alterações nas respostas.
   - Reutilizar a mesma lógica para o botão “Salvar”, navegação entre etapas e conclusão.
   - Evitar múltiplos inserts duplicados quando o usuário clica rápido ou a primeira criação ainda está em andamento.

3. **Adicionar proteção local contra perda temporária**
   - Manter uma cópia temporária por usuário no navegador enquanto o questionário ainda é rascunho.
   - Ao abrir a tela, restaurar essa cópia se o banco ainda não tiver carregado ou se houver conteúdo local mais recente.
   - Limpar essa cópia quando o questionário for concluído com sucesso.

4. **Melhorar feedback visual**
   - Mostrar status discreto: “Salvando…”, “Rascunho salvo” ou “Falha ao salvar”.
   - Desabilitar botões críticos enquanto o salvamento estiver em andamento.
   - Usar mensagens de erro acionáveis quando houver falha de conexão/permissão.

5. **Aplicar nos dois arquivos afetados**
   - `src/pages/BusinessQuestionnaire.tsx`
   - `src/pages/PersonalQuestionnaire.tsx`

**Detalhe técnico**
- A causa provável é que hoje o app só salva em alguns cliques, não aguarda o salvamento em todos os fluxos, ignora erros do banco e ainda mostra toast de sucesso mesmo sem confirmar sucesso. Isso cria perda aparente de dados, especialmente em mobile, conexão instável ou cliques rápidos.