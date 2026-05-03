## Diagnóstico

O comportamento do print indica que o clique está chegando no handler, mas a função de captura está mexendo no próprio canvas visível: ela remove temporariamente o `transform: scale(...)` para exportar em tamanho real. Se o `html2canvas` trava, demora ou falha antes de restaurar visualmente, o post fica ampliado na tela e nenhum download é disparado.

Além disso, no carrossel existe outro risco: só há um `PostCanvas` renderizado por vez, mas `handleDownloadAll` tenta baixar vários `slideRefs`. Na prática, os refs dos slides não existem simultaneamente, então o ZIP pode falhar ou sair incompleto.

## Plano de correção

1. **Não alterar mais o canvas visível durante exportação**
   - Substituir a estratégia atual de `el.style.transform = "scale(1)"`.
   - Capturar um clone temporário/offscreen do slide, em vez do elemento que o usuário está vendo.
   - O canvas visível não deve aumentar nem piscar ao clicar em baixar.

2. **Criar uma função de exportação isolada e segura**
   - Clonar o slide para uma área fora da tela.
   - Remover `transform` apenas no clone.
   - Fixar `width`/`height` reais do post no clone.
   - Rodar `html2canvas` nesse clone com `useCORS: true`, `allowTaint: false`, `backgroundColor: null` e `scale: 2`.
   - Remover o clone no `finally`, mesmo se der erro.

3. **Evitar que controles do editor apareçam no PNG**
   - Antes da captura, ocultar no clone elementos de edição como outlines, handles de resize, réguas e guias.
   - Manter apenas a arte final do post.

4. **Corrigir o download do carrossel**
   - Para baixar slide individual: capturar o slide atual via clone offscreen.
   - Para “Baixar todos (ZIP)”: iterar pelos slides mudando `currentSlide`, aguardar a renderização, capturar o slide atual e adicionar ao ZIP.
   - Reportar falhas por slide sem travar toda a exportação.

5. **Melhorar feedback visual**
   - Adicionar estado `exporting` para desabilitar os botões enquanto exporta.
   - Mostrar toast de sucesso/falha com mensagem específica.

## Arquivos a alterar

- `src/pages/PostEditorPage.tsx`
- Possivelmente `src/components/post-editor/CarouselEditor.tsx`, apenas se for necessário passar estado de exportação para desabilitar botões.

## Resultado esperado

Ao clicar em “Baixar slide” ou “Baixar todos (ZIP)”, o post não aumenta na tela, a interface permanece estável, e o arquivo PNG/ZIP é baixado corretamente.