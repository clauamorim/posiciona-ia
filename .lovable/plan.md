
Problema confirmado: o `Report.tsx` já tem parsing para `report.content` quando ele vem como string JSON, então o bug persistente não é aquele ajuste isolado. Hoje ainda existe dependência de um check frágil:

- `src/pages/Report.tsx`: considera estruturado só quando `content.archetypes` existe
- `src/pages/StoryBrand.tsx`, `src/pages/EditorialPage.tsx` e `src/pages/PostEditorPage.tsx`: ainda leem `report?.content` sem parsing seguro
- o fallback do relatório continua renderizando `String(content)`, então qualquer shape inesperado volta a aparecer como JSON cru

Plano de correção:

1. Criar um parser único e resiliente para conteúdo de relatório
- Adicionar um helper compartilhado em `src/lib` para:
  - aceitar `object`, `string JSON`, `string com markdown fences`, ou conteúdo aninhado
  - retornar `parsedContent`
  - expor flags como `isStructuredReport`, `hasStorybrand`, `hasEditorial`

2. Aplicar esse parser em todas as telas que consomem `reports.content`
- `src/pages/Report.tsx`
- `src/pages/StoryBrand.tsx`
- `src/pages/EditorialPage.tsx`
- `src/pages/PostEditorPage.tsx`

3. Tornar o `Report.tsx` menos frágil
- substituir a regra atual `content.archetypes` por validação mais robusta do shape
- se o conteúdo vier parcialmente válido, renderizar o que existir em vez de cair direto no JSON cru
- manter fallback legível só para casos realmente inválidos

4. Blindar o salvamento do relatório
- revisar `src/pages/Results.tsx` para garantir que o valor salvo em `reports.content` seja sempre objeto normalizado antes do `update`
- se necessário, normalizar `reportData.report` antes de persistir

5. Investigar compatibilidade com relatórios antigos
- incluir suporte a registros antigos que possam estar com estrutura diferente no banco
- se houver formatos legados, adaptar a UI para eles sem quebrar a versão atual

6. Verificação final
- validar fluxo completo: gerar relatório → abrir Análises → abrir StoryBrand → abrir Linha Editorial → abrir editor de post
- confirmar que nenhuma dessas páginas exibe JSON cru quando `content` vier como string

Arquivos a ajustar:
- `src/lib/...` novo helper de parsing/normalização
- `src/pages/Report.tsx`
- `src/pages/StoryBrand.tsx`
- `src/pages/EditorialPage.tsx`
- `src/pages/PostEditorPage.tsx`
- `src/pages/Results.tsx`

Observação importante:
o sintoma “continua igual” indica forte chance de haver mais de uma tela afetada e/ou um formato legado salvo em `reports.content`. Por isso, a correção precisa ser sistêmica, não apenas uma linha no `Report.tsx`.
