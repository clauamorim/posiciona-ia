Entendi o problema: a caixa selecionada foi redimensionada para 1080×1350, mas o desenho interno da moldura continua com proporção/viewport de 1080×1080. Por isso o contorno visual parece “parado” dentro de uma caixa maior.

Plano de correção:

1. Normalizar SVGs decorativos ao aplicar templates legacy
   - Em `PostEditorPage.tsx`, criar um helper para detectar elementos de moldura (`tpl-frame-*`, `tpl-mframe-*`) e elementos decorativos lineares.
   - Quando o template não tiver `canvasWidth/canvasHeight`, continuar assumindo base 1080×1080, mas regenerar a `src` da moldura para o tamanho final já escalado.
   - A moldura passará a ter um SVG interno com `viewBox` e dimensões compatíveis com a caixa final, em vez de apenas aumentar a caixa do `<img>`.

2. Preservar aparência da moldura
   - Manter cor, opacidade, espessura e inset visual proporcional ao template existente.
   - Para a moldura do print, o contorno deve ficar encostado dentro das margens esperadas do canvas 4:5, sem a faixa vazia inferior ou lateral.

3. Aplicar a mesma regra a templates abertos por link/design salvo
   - O carregamento via `?design=...` hoje restaura `overlayImages` diretamente, sem normalização.
   - Vou reutilizar a mesma normalização nesse fluxo para evitar que designs salvos antigos continuem quebrados.

4. Ajustar renderização do canvas se necessário
   - Em `PostCanvas.tsx`, garantir que SVGs de elementos decorativos usem preenchimento real da caixa (`objectFit: fill`) quando forem molduras/linhas, mantendo fotos em `cover/contain` como hoje.
   - Isso evita que o navegador preserve a proporção quadrada do SVG dentro de uma caixa vertical.

5. Remover logs temporários
   - Remover o `console.log` de debug de tipografia que ainda está no canvas.

Resultado esperado: ao abrir o post no preview, a seleção e a moldura visual passam a representar o mesmo tamanho; o contorno acompanha o canvas 1080×1350 e não fica visualmente preso no layout quadrado antigo.