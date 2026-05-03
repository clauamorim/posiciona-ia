Plano de correção:

1. Remover a dependência do `canvasFormat` defasado no momento de aplicar o template global.
   - Calcular o formato efetivo a partir das dimensões reais usadas no canvas (`cW`, `cH`).
   - Usar esse formato efetivo também para gravar/normalizar `canvasFormat` quando houver divergência.

2. Ajustar o rescale dos `overlayImages` decorativos do template global.
   - Manter `s = Math.min(cW / fromW, cH / fromH)`.
   - Aplicar centralização com:
     - `offsetX = (cW - fromW * s) / 2`
     - `offsetY = (cH - fromH * s) / 2`
   - Aplicar em cada overlay:
     - `x = Math.round(o.x * s + offsetX)`
     - `y = Math.round(o.y * s + offsetY)`
     - `width = Math.round(o.width * s)`
     - `height = Math.round(o.height * s)`

3. Corrigir o caso específico que ainda mantém os decorativos no meio do canvas 4:5.
   - Os templates globais estão salvos como `square` e sem `canvasWidth/canvasHeight`, mas o editor usa `square = 1080×1350`.
   - Para templates legados sem dimensão salva, tratar `fromW/fromH` como `1080×1080`, preservando o quadrado original e centralizando no canvas real.

4. Adicionar logs temporários objetivos para validação.
   - Logar `fromW`, `fromH`, `toW`, `toH`, `canvasFormat`, formato efetivo, escala e offsets no momento do rescale.
   - Logar uma amostra antes/depois dos overlays para confirmar a nova posição.

5. Validar no preview.
   - Abrir um post novo.
   - Confirmar no console que o rescale usa `fromW=1080`, `fromH=1080`, `toW=1080`, `toH=1350`, `scale=1`, `offsetY=135`.
   - Confirmar que `setOverlayImages` recebe os overlays já centralizados, com a moldura em `y=195` para o template Governante atual.