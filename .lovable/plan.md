
## Correções prioritárias para o editor de posts

Há 3 causas bem prováveis para o que você está vendo agora, e elas se conectam entre si.

## 1. Unsplash/IA “caem no minimalista” porque o editor está reutilizando o draft antigo

Hoje o `PostEditorPage` carrega draft por `weekIndex + dayIndex` apenas. Então, se você abriu antes em modo minimalista, ao voltar com `?style=unsplash` ou `?style=ai` ele reaproveita o estado anterior e nem roda a montagem nova, porque `autoLayoutRanRef` já nasce como `true`.

### Correção
- Alterar a lógica de draft para considerar também:
  - `style`
  - `format`
  - e se há `design` salvo
- Regra nova:
  - se o usuário entrou com `?style=...`, abrir uma composição nova para esse estilo
  - não reaproveitar draft incompatível de outro estilo
- Ao aplicar um novo estilo, limpar somente os overlays automáticos antigos (`tpl-*`) antes de montar os novos, para não misturar restos do minimalista com Unsplash/IA.
- Se o usuário abrir um design salvo (`?design=...`), aí sim preservar o estado salvo.

## 2. O minimalista continua desorganizado porque o canvas não usa as posições do template

Hoje `postTemplates.ts` define `titleSlot`, `bodySlot`, `logoSlot`, etc., mas o `PostCanvas` ainda calcula as caixas de texto com posições genéricas (`computeTextBoxPositions`). Na prática:
- o template decorativo vai para um lugar
- o título e o corpo vão para outro
- o resultado parece “bagunçado”

### Correção
- Fazer `buildAutoLayout` devolver também as posições iniciais do template:
  - título
  - corpo
  - CTA
  - número do slide
- Passar essas posições para `PostEditorPage`.
- Atualizar `PostCanvas` para inicializar `textBoxes` a partir do template recebido, e não mais por um cálculo genérico.
- Garantir reset dessas posições quando mudar:
  - estilo
  - formato
  - slide inicial do carrossel
- Ajustar o template minimalista para ficar mais editorial:
  - moldura interna
  - linha decorativa
  - ornamento central
  - respiro maior entre logo, título e corpo

## 3. A logo continua com fundo porque a lógica atual confia demais na extensão do arquivo

Hoje a busca da logo:
- pega a primeira `is_logo = true`
- ordena pela mais antiga
- considera `.png` como se já estivesse com fundo removido
- e só tenta reprocessar quando não é PNG

Isso falha em 3 cenários:
- a logo branca já está em PNG, mas sem transparência real
- existem várias logos marcadas, e ele pega a antiga
- o upload removeu o fundo, mas não gravou corretamente `bg_removed = true`

### Correção
- No upload de logo, salvar `bg_removed = true` quando a remoção realmente der certo.
- Em `fetchUserLogo`, deixar de usar “é PNG” como prova de transparência.
- Reprocessar qualquer logo com `bg_removed = false`, mesmo se for PNG.
- Trocar a ordenação para usar a logo mais recente, não a mais antiga.
- Ao marcar uma imagem como logo, desmarcar automaticamente as demais do usuário, para existir uma única logo ativa.
- Manter o botão manual “Sem fundo”, mas tornar a busca automática mais confiável para que o usuário não precise corrigir isso toda vez.

## 4. Ajuste de entrada no editor para o estilo escolhido

Para evitar nova confusão visual:
- `EditorialPage` continuará abrindo o modal de estilo
- ao confirmar, o editor deve abrir já em estado coerente com esse estilo
- se for Unsplash ou IA, a montagem inicial precisa criar o fundo imediatamente
- se houver falha real de busca/geração, mostrar erro claro e não parecer “minimalista por engano”

### Comportamento esperado após a correção
- **Minimalista**: abre com gradiente + moldura + linha/ornamento + logo tratada + texto já bem posicionado
- **Unsplash**: abre com foto de fundo real + faixa/bloco do template + texto posicionado corretamente
- **IA**: abre com imagem gerada + composição pronta, sem herdar estado do minimalista

## Arquivos a ajustar

### Frontend
- `src/pages/PostEditorPage.tsx`
  - corrigir chave/uso do draft
  - resetar estado automático por estilo
  - aplicar slots do template ao canvas
- `src/components/post-editor/PostCanvas.tsx`
  - receber posições iniciais do template
  - parar de depender só do `computeTextBoxPositions`
- `src/lib/postAutoLayout.ts`
  - devolver slots/layout inicial completos
  - melhorar seleção e reprocessamento da logo
- `src/lib/postTemplates.ts`
  - refinar layout minimalista e manter elementos decorativos coerentes
- `src/pages/EditorialPage.tsx`
  - garantir entrada limpa no editor conforme estilo escolhido
- `src/components/post-editor/inspector/AddElementPanel.tsx`
  - garantir consistência do `bg_removed`
  - manter fluxo manual de remoção de fundo

### Banco de dados
- aproveitar a coluna `bg_removed` já criada
- ajustar o uso no frontend para ela refletir o estado real da logo

## Ordem de implementação

1. Corrigir o reaproveitamento indevido de draft por estilo/formato.
2. Fazer o canvas respeitar os slots reais do template.
3. Corrigir a lógica de seleção/reprocessamento da logo.
4. Refinar o minimalista para ficar visualmente consistente.
5. Validar que Unsplash e IA não herdam mais o layout minimalista.

## Resultado esperado

Depois disso:
- o minimalista deixa de parecer “quebrado”
- a logo passa a vir transparente de forma consistente
- Unsplash e IA deixam de abrir com aparência de minimalista
- a primeira montagem passa a vir realmente pronta, com layout coerente ao estilo escolhido

## Detalhes técnicos

```text
Problema principal hoje:
Escolha de estilo -> abre editor -> draft antigo é carregado -> auto-layout novo não roda

Novo fluxo:
Escolha de estilo -> valida draft compatível
  -> se incompatível, limpa apenas estado automático
  -> monta novo layout do estilo escolhido
  -> aplica slots reais do template no canvas
  -> busca logo ativa mais recente e garante transparência
```
