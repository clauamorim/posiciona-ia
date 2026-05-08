## Plano

Corrigir a formatação inline para funcionar de forma previsível no título e no corpo do texto, tanto pela barra flutuante quanto pelo painel lateral.

## O que será ajustado

1. **Barra flutuante B/I/U**
   - Corrigir o clique nos botões para não ser bloqueado pelo `pointerdown` do wrapper.
   - Trocar a execução para um fluxo que preserva a seleção real antes de aplicar negrito, itálico ou sublinhado.
   - Após aplicar a formatação, sincronizar imediatamente o HTML sanitizado no estado do título/corpo, sem depender apenas do `blur`.

2. **Título**
   - Adicionar os botões de negrito, itálico e sublinhado no painel lateral quando o elemento selecionado for **Título**.
   - Fazer esses botões aplicarem formatação inline quando houver uma seleção ativa dentro do título.
   - Garantir contraste visual no título, já que muitos títulos já partem de peso alto.

3. **Corpo do texto**
   - Ajustar os botões B/I/U do painel lateral para não aplicarem a alteração no bloco inteiro quando há texto selecionado em edição.
   - Manter o comportamento global somente quando não houver seleção ativa dentro do texto editável.
   - Incluir sublinhado também no painel lateral do corpo.

## Detalhes técnicos

- Criar um pequeno estado compartilhado em `PostCanvas` para rastrear:
  - elemento editável ativo (`title` ou `body`),
  - seleção atual,
  - função para aplicar `bold`, `italic` ou `underline`.
- Atualizar `InlineFormatToolbar.tsx` para aplicar formatação no `pointerdown` do botão, não no `mousedown`, evitando que o evento seja cancelado antes da execução.
- Atualizar `SelectionPanel.tsx` para receber callbacks de formatação inline e renderizar os controles B/I/U para título e corpo.
- Preservar a sanitização existente em `richText.ts` e continuar permitindo apenas `<strong>`, `<em>`, `<u>` e `<br>`.

## Validação

Depois da implementação, validar no preview:

1. Selecionar uma palavra no título e clicar B/I/U na barra flutuante.
2. Selecionar uma palavra no título e clicar B/I/U no painel lateral.
3. Selecionar uma palavra no corpo e clicar B/I/U na barra flutuante.
4. Selecionar uma palavra no corpo e clicar B/I/U no painel lateral.
5. Confirmar que, com seleção parcial, apenas o trecho selecionado muda.
6. Confirmar que o PNG exportado mantém a formatação.