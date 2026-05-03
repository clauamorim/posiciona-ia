Identifiquei o problema no post aberto: a mudança anterior acertou a posição inicial, mas preservou uma escala uniforme baseada em 1080×1350. Só que a moldura salva no template Governante é um quadrado 960×960 em `x:60/y:60`, ou seja, foi criada para uma base 1080×1080. Ao tratar o template inteiro como 1080×1350, ela fica com altura visual errada no canvas 4:5.

Plano de correção:

1. Ajustar a regra de escala de overlays decorativos legacy
   - Detectar templates sem `canvasWidth/canvasHeight` e com moldura quadrada típica (`tpl-frame-*`).
   - Para esses overlays, usar escala não-uniforme por eixo (`scaleX` e `scaleY`) em vez de escala uniforme.
   - Resultado esperado: a moldura volta a preencher corretamente o card 1080×1350, ficando encostada nas margens certas e com altura proporcional ao canvas real.

2. Corrigir identificação de camadas dos templates globais
   - Hoje o canvas reconhece como moldura apenas IDs `tpl-mframe-*`.
   - O template Governante salvo no banco usa `tpl-frame-governante` e `tpl-line-governante`, então ele cai na camada errada.
   - Vou ampliar a regra para reconhecer também `tpl-frame-*`, `tpl-line-*` e ornamentações equivalentes.
   - Resultado esperado: moldura atrás do texto, linha/acento na frente quando necessário, sem elementos “fora do lugar” por ordem visual incorreta.

3. Manter um log curto de validação temporária
   - Registrar `fromW/fromH`, `scaleX/scaleY`, `toW/toH` e quantidade de overlays.
   - Isso permite confirmar no próximo preview se o template foi recalculado como 1080×1080 → 1080×1350.

4. Verificação
   - Abrir o preview no mesmo tamanho mobile aproximado.
   - Conferir se o editor carrega sem erro e se os logs mostram a escala esperada para o Governante.

Arquivos envolvidos:
- `src/pages/PostEditorPage.tsx`
- `src/components/post-editor/PostCanvas.tsx`