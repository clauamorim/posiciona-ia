
Objetivo: corrigir os 3 sintomas do mesmo fluxo quebrado: contagem errada (49/72), botão “Calcular resultados” desabilitado e erro ao gerar relatório com IA.

Diagnóstico confirmado:
1. O questionário de arquétipos mostra o slider em “3 / Neutro” mesmo quando a resposta não existe no estado nem no banco. Ou seja: visualmente parece respondido, mas tecnicamente não está salvo.
2. O botão “Calcular resultados” depende de `answeredCount < 72`, e essa contagem hoje usa apenas as chaves realmente presentes em `answers`, por isso fica menor que 72.
3. O dashboard repete o mesmo problema porque conta linhas salvas em `archetype_answers`, então exibe 49/72 se várias perguntas ficaram no valor visual padrão sem persistência.
4. O erro da IA está separado do problema acima: a edge function usa a URL errada do gateway (`ai-gateway...`), enquanto o endpoint correto é `ai.gateway...`, o que bate exatamente com o erro de DNS dos prints/logs.

Plano de implementação:
1. Corrigir o estado inicial do questionário de arquétipos
- Ao carregar as 72 perguntas, montar `answers` com todas elas.
- Para perguntas já respondidas, manter o valor salvo.
- Para perguntas sem resposta, preencher com valor padrão `3`, já que a UI já exibe “Neutro” por padrão.
- Assim, o que aparece na tela passa a bater com o que o sistema considera respondido.

2. Corrigir a lógica de contagem e habilitação
- Recalcular `answeredCount` com base na lista real de perguntas carregadas, não só em `Object.keys(answers)`.
- Manter o botão “Calcular resultados” habilitado quando existir uma resposta efetiva para as 72 perguntas.
- Garantir que a navegação entre páginas espere o salvamento antes de avançar/voltar/finalizar, evitando inconsistência por corrida assíncrona.

3. Corrigir o dashboard e a leitura dos resultados
- Ajustar o dashboard para contar cobertura real das 72 perguntas, em vez de confiar apenas no total bruto de linhas.
- Restringir leituras ao conjunto/versionamento correto para evitar mistura de dados e já deixar a base mais segura para histórico futuro.
- Fazer a página de resultados usar a mesma referência consistente de respostas.

4. Corrigir a geração do relatório com IA
- Trocar a URL da edge function para `https://ai.gateway.lovable.dev/v1/chat/completions`.
- Melhorar o tratamento de erro para retornar mensagens mais claras em casos de falha do gateway, limite ou crédito.
- Manter a chamada da IA no backend, como já está estruturado.

Arquivos a ajustar:
- `src/pages/ArchetypeQuestionnaire.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Results.tsx`
- `supabase/functions/generate-report/index.ts`

Detalhes técnicos:
- O problema principal não parece ser do banco, e sim um desalinhamento entre valor visual padrão do slider e estado persistido.
- Não vejo necessidade de migração de banco para essa correção.
- Usuários que ficaram com respostas “faltando” devem se recuperar automaticamente quando o questionário recarregar e salvar os itens ausentes com valor 3.

Validação após implementação:
1. Abrir um usuário afetado e confirmar que o questionário sobe para 72/72.
2. Verificar que o botão “Calcular resultados” fica habilitado na última página.
3. Confirmar que o dashboard mostra 72/72 após salvar.
4. Gerar relatório e validar que o erro 500 de DNS desapareceu.
5. Testar o fluxo completo: negócio → arquétipos → resultados → gerar relatório → visualizar relatório.
