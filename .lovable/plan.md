## O que será feito

Duas melhorias no editor de posts com template Editorial:

### 1. Permitir redimensionar campos de texto manualmente

Como o autofit nem sempre consegue acomodar textos longos (especialmente na **Frase de fechamento** e no **Apoio do fechamento**), adicionar controles manuais de tamanho de fonte por slot no painel "Conteúdo do slide".

- Novo campo `fontScale` (multiplicador 0.6×–1.4×) por tipo de slot no painel:
  - Slide **Fechamento**: sliders para "Frase de fechamento" e "Apoio do fechamento"
  - Slide **Capa**: sliders para "Título principal" e "Palavra-destaque"
  - Slide **Cláusula**: slider para "Texto da cláusula"
- Os multiplicadores são salvos como overrides no token do template (ex.: `closeTitleScale`, `closeBodyScale`, `coverTitleScale`, `coverCountScale`, `clauseBodyScale`) e aplicados sobre o `fontSize` base hardcoded nos componentes (`SertaoCard`, `CartorioCard`, `ManuscritoCard`, `HorizonteCard`, `RetratoCard`).
- Cada slider tem botão "Restaurar" para voltar a 1×.
- Os valores são persistidos junto com `templateTokens` no mesmo fluxo de save existente.

Importante: o autofit existente (`data-fit-bounds`) continua funcionando — o multiplicador é aplicado **antes** do shrink-to-fit, então textos curtos com `fontScale = 1.4` realmente ficam maiores, e textos longos com `fontScale = 0.8` já partem menores (reduzindo a chance do autofit precisar cortar).

### 2. Adicionar upload de imagens nos templates com foto

Hoje, nos templates **Horizonte** e **Retrato**, o painel lateral mostra a aba "Upload" mas:
- A imagem enviada vira asset na galeria, **não** substitui a foto do slide
- A aba "Minha galeria" também só permite adicionar como overlay (não como fundo)

Correção em `AddElementPanel.tsx`:
- Quando `onSwapBackground` está definido (= modo template de foto), clicar em "Enviar imagem" no upload usa o URL recém-criado para **chamar `onSwapBackground`** em vez de só salvar na galeria.
- Mesma lógica para clicar numa thumbnail da aba "Minha galeria": vira `onSwapBackground(url, "saved")` em vez de overlay.
- Modo não-template (sem `onSwapBackground`) continua igual: upload/galeria adicionam como overlay.

## Arquivos afetados

- `src/components/post-templates/governante/types.ts` — adicionar campos de scale opcionais em `SertaoTokens`
- `src/components/post-templates/governante/SertaoCard.tsx`, `CartorioCard.tsx`, `ManuscritoCard.tsx`, `HorizonteCard.tsx`, `RetratoCard.tsx` — multiplicar `fontSize` dos slots editáveis pelo respectivo scale (default 1)
- `src/components/post-editor/inspector/TemplateSertaoPanel.tsx` — sliders de tamanho por slot dentro de "Conteúdo do slide"
- `src/components/post-editor/inspector/AddElementPanel.tsx` — usar `onSwapBackground` no upload e na galeria quando disponível

## Fora do escopo

- Não mexe na geração de conteúdo nem na pipeline da IA
- Não altera o algoritmo de autofit existente
- Não adiciona resize handles arrastáveis no canvas (só sliders no painel)
