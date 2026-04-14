
Objetivo: corrigir 5 frentes relacionadas entre si sem mudar a modelagem do banco: histórico de relatórios, PDFs do relatório e da linha editorial, remoção de fundo de retratos, cores customizadas no editor e exibição da última análise do Instagram com PDF.

1. Histórico: fazer o sistema realmente versionar relatórios
- Corrigir `src/pages/Results.tsx`, que hoje ainda reaproveita `version = 1` com `upsert/update`, causando sobrescrita da versão original.
- Passar a criar nova linha em `reports` quando houver nova geração/regeneração, usando `version` incremental.
- Revisar pontos que leem relatórios para sempre buscar a versão mais recente por `version desc` de forma consistente.
- Ajustar `HistoryPage.tsx` para ordenar e exibir corretamente todas as versões, não só o registro original/sobrescrito.
- Validar também cards/resumos que dependem do “relatório atual” (`Dashboard`, `StoryBrand`, `Report`, `Editorial`, `PostEditor`), para manter consistência após novas versões.

2. PDF do relatório: parar de capturar o DOM interativo “como está”
- O problema atual é estrutural: o PDF está sendo gerado em cima da árvore visual com cards, grids e regras globais de `.pdf-capture`, o que está quebrando layout e omitindo conteúdo.
- Em `src/pages/Report.tsx`, criar uma versão de exportação dedicada ao PDF, com a mesma aparência visual, mas sem elementos interativos e sem depender do layout responsivo da tela.
- Renderizar as seções do relatório em blocos estáveis para impressão, com quebras controladas por seção/card.
- Remover a dependência de regras globais agressivas em `src/index.css` como `.pdf-capture .grid { display: block; }`, substituindo por classes específicas do layout de exportação.
- Garantir que o PDF use o conteúdo completo de cada seção, inclusive paleta, StoryBrand, editorial, figurino e símbolos.

3. PDF da linha editorial: exportar uma árvore estática de impressão
- O PDF enviado confirma que hoje só o cabeçalho/abas estão sendo capturados corretamente; o conteúdo das semanas está sumindo ou saindo em branco.
- Em `src/pages/EditorialPage.tsx`, criar um container de exportação próprio, sem `Tabs`, sem `Collapsible` e sem dependência do estado visual aberto/fechado.
- Renderizar todas as semanas sequencialmente no PDF, com o mesmo estilo dos cards da tela.
- Manter o botão “Baixar PDF”, mas apontando para essa versão estática de impressão.
- Ajustar quebras de página por card/semana para evitar cortes e páginas vazias.

4. Remoção de fundo: impedir resultados “quadriculados” ou degradados
- Em `supabase/functions/remove-background/index.ts`, reforçar o prompt para exigir transparência real e proibir checkerboard, fundo branco, cinza ou qualquer fundo simulado.
- Adicionar validação defensiva no retorno antes de substituir a imagem no editor.
- Em `src/pages/PostEditorPage.tsx`, impedir nova execução enquanto a atual estiver em andamento e preservar a imagem original até a resposta ser validada.
- Se necessário, adicionar fallback de erro amigável quando o retorno da IA vier sem transparência útil, em vez de aplicar um resultado ruim ao canvas.

5. Cores customizadas: fazer funcionar em todos os controles
- Corrigir os seletores de cor em `src/components/post-editor/PostToolbar.tsx`. Hoje vários inputs customizados estão inconsistentes; parte deles usa wrappers que não capturam clique corretamente e parte altera estados diferentes.
- Unificar o comportamento para:
  - corpo do texto principal
  - título
  - CTA
  - ícones/elementos
  - barras e molduras
  - caixas de texto
- Garantir que os pickers customizados alterem o estado certo e reflitam imediatamente no canvas.
- Manter recoloração de SVG para ícones/barras/molduras, mas com aplicação consistente também para cores personalizadas.

6. Análise do Instagram: sempre abrir com a última análise disponível
- Em `src/pages/InstagramAnalysis.tsx`, carregar automaticamente a análise mais recente salva em `instagram_analyses` ao entrar na página.
- Exibir essa análise na própria tela mesmo após recarregar a página.
- Reaproveitar a lógica de PDF já existente para permitir download sempre que houver uma análise carregada.
- Após nova análise, atualizar a visualização local e manter o histórico funcionando.

Arquivos principais a ajustar
- `src/pages/Results.tsx`
- `src/pages/HistoryPage.tsx`
- `src/pages/Report.tsx`
- `src/pages/EditorialPage.tsx`
- `src/pages/InstagramAnalysis.tsx`
- `src/pages/PostEditorPage.tsx`
- `src/components/post-editor/PostToolbar.tsx`
- `src/index.css`
- `supabase/functions/remove-background/index.ts`
- possivelmente `src/pages/Dashboard.tsx` e `src/pages/StoryBrand.tsx` para alinhar leitura da versão atual

Detalhes técnicos importantes
- Não vejo necessidade de migration: o campo `version` em `reports` já existe e é suficiente.
- A principal mudança de PDFs será de abordagem: exportar uma árvore dedicada de impressão, em vez de tentar “fotografar” a UI interativa atual.
- O problema do histórico vem do fluxo de geração, não só da listagem.
- O problema das cores customizadas parece ser mistura de estados separados + triggers de input de cor inconsistentes.
- A correção da remoção de fundo precisa tratar qualidade do retorno, não só autenticação/chamada.

Ordem recomendada
1. Corrigir versionamento de relatórios
2. Refatorar exportação PDF do relatório
3. Refatorar exportação PDF da linha editorial
4. Corrigir cores customizadas no editor
5. Endurecer remoção de fundo
6. Mostrar última análise do Instagram + PDF
