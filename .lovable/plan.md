## Diagnóstico

Olhando os templates globais salvos no banco, todos foram criados sem os campos `canvasWidth`/`canvasHeight` no `state`. Exemplo, Governante:

```
frame: x=60, y=60, w=960, h=960
line:  x=100, y=880, w=160, h=4
```

Essas coordenadas foram salvas dentro do **editor real de "square", que é 1080×1350** (não 1080×1080). Ou seja, na hora do save o `y=60` significava "60px do topo de um canvas 1350px de altura".

No `PostEditorPage.tsx` (linhas 564–565), o fallback quando o template não tem dimensão salva está assumindo origem **1080×1080**:

```ts
const fromW = typeof s.canvasWidth === "number" ? s.canvasWidth : 1080;
const fromH = typeof s.canvasHeight === "number" ? s.canvasHeight : 1080;
```

Resultado para o canvas atual de card 4:5 (1080×1350):

- `s = min(1080/1080, 1350/1080) = 1`
- `offsetY = (1350 − 1080)/2 = 135`
- A moldura sai de `y=60` e vai para `y=195`, e o `tpl-line` de `y=880` vai para `y=1015`

Por isso o template aparece "afundado" no meio do canvas, exatamente o sintoma que você descreve. A correção do rescale uniforme em si está certa — o que está errado é o **valor de origem assumido quando o template legacy não traz `canvasWidth/Height`**.

A confirmação adicional é que o cálculo de `realFormat` em `cH/cW >= 1.5` também está errado para card 4:5 (1350/1080 = 1.25 → cai em "square", o que está certo), mas não influencia esse bug específico — o bug é só o `fromH` padrão.

## Mudança

Arquivo: `src/pages/PostEditorPage.tsx`, no efeito de aplicação do template do arquétipo (linhas ~559–600).

1. Trocar o fallback de origem para refletir o tamanho real em que os templates foram salvos:
   - `fromW` padrão: `1080`
   - `fromH` padrão: `1350` quando o `state` não traz `canvasHeight` (ou usar `1080` apenas se o template explicitamente declarar `canvasFormat: "square-1to1"` no futuro — hoje nenhum declara, então sempre cai em 1350)

2. Manter o rescale uniforme com `min(sx, sy)` e os offsets de centralização — que já estão corretos.

3. Atualizar o log `[archetype-template] rescale overlayImages` para ficar claro que `fromH` agora vem do default 1350.

4. Remover o bloco de log `[archetype-template] init` (linhas 261–270) e o `[archetype-template] flag set before query await` (linhas 501–504), agora que a causa é conhecida — deixar só o log do rescale.

## Resultado esperado

- Card 4:5 (1080×1350): `s=1`, `offsetX=0`, `offsetY=0`. Moldura do Governante volta a ficar em `y=60` (alta no canvas), exatamente como foi salva no admin.
- Reels (1080×1920): `s=min(1, 1920/1350)=1`, `offsetY=285`. Moldura centralizada verticalmente sem distorção.
- Carrossel/quadrado novo: idem ao card.

## Validação no preview (sem novo crédito gasto à toa)

1. Abrir um post novo pelo Dashboard (não reabrir o mesmo, para não pegar draft cacheado).
2. Conferir no console:
   - `fromW=1080`, `fromH=1350`, `toW=1080`, `toH=1350`, `scale=1`, `offsetX=0`, `offsetY=0`.
   - Moldura visível encostada na borda (≈ 60px de inset), e não no meio do canvas.
3. Trocar para Reels e confirmar que a moldura escala/centraliza corretamente (sem virar retângulo achatado).
