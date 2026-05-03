## Objetivo

Corrigir a conversão dos 12 templates para 4:5 e 9:16 sem “esticar cegamente” o template antigo. O Governante deve manter a intenção visual do modelo original do print: composição editorial, respiro amplo, linhas finas nos cantos, texto posicionado no terço médio/inferior, CTA e assinatura próximos da base — apenas adaptado para a altura extra do 4:5.

## Ajustes principais

1. **Governante como referência de conversão**
   - Não transformar a moldura quadrada antiga em uma moldura colada nas laterais.
   - Manter a estética do template original: margens visuais largas, linhas douradas curtas nos cantos, pouca ornamentação e muito espaço negativo.
   - Em 4:5, a altura extra deve entrar principalmente como respiro vertical, não como distorção do desenho.

2. **Molduras e margens seguras**
   - Definir uma área segura para templates legados:
     - 4:5: margem lateral maior que a atual, aproximadamente 90–110px.
     - 9:16: margem lateral semelhante e margem vertical proporcionalmente maior.
   - Reposicionar `tpl-frame-*` para essa área segura.
   - Reescrever SVGs decorativos para não criarem linhas internas indesejadas.

3. **Remover barra dourada perdida**
   - Detectar e remover/neutralizar elementos SVG internos que viram barra vertical ou horizontal isolada após a conversão.
   - Para Governante, preservar apenas as linhas curtas de canto e detalhes editoriais coerentes com o template original.

4. **Reposicionar elementos decorativos dos 12 templates**
   - `tpl-line-*` e `tpl-accent-*` não serão apenas escalados por `sy`.
   - Eles serão ancorados ao retângulo seguro do template:
     - linhas superiores próximas ao topo da área segura;
     - linhas inferiores próximas à base da área segura;
     - acentos verticais dentro da composição, sem atravessar texto ou aparecer soltos.
   - Isso cobre Governante, Explorador, Rebelde e os demais arquétipos.

5. **Posts com foto não podem voltar ao layout antigo**
   - Quando houver foto, preservar a composição do template do arquétipo.
   - A foto deve entrar como background/overlay, sem substituir posições de texto e decorativos por defaults antigos.
   - Se o template global não tiver `slideTextBoxes`, gerar caixas de texto em 4:5 compatíveis com a composição original, em vez de cair no layout legado.

6. **Textos do Governante em 4:5**
   - Adaptar a posição do título, corpo, CTA e assinatura conforme o modelo enviado:
     - título no bloco editorial central/inferior;
     - corpo abaixo do título;
     - destaque/observação curta abaixo do corpo;
     - CTA e assinatura próximos da parte inferior, com respiro.
   - Com foto, manter essa hierarquia, apenas garantindo contraste.

## Arquivos a alterar

- `src/lib/template-normalize.ts`
  - Normalização por área segura.
  - Limpeza/regravação de SVGs decorativos.
  - Ancoragem correta de linhas e acentos.

- `src/pages/PostEditorPage.tsx`
  - Preservar layout do template ao inserir foto.
  - Criar fallback de caixas de texto em 4:5/9:16 quando o template legado não trouxer `slideTextBoxes`.
  - Evitar que `setInitialTextBoxes(result.slots)` sobrescreva a composição do arquétipo aplicado.

## Validação esperada

- Governante sem foto: visual próximo ao print original, mas em 4:5, com mais altura e sem barra perdida.
- Governante com foto: mantém o mesmo layout editorial, com foto apenas como fundo/elemento visual.
- Explorador e Rebelde: linhas/acento reposicionados dentro da nova área segura.
- Todos os 12 templates: sem moldura colada, sem elementos decorativos soltos e sem retorno parcial ao layout antigo ao usar foto.