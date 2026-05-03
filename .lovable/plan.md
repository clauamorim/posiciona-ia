## Objetivo

Instrumentar o ponto exato onde o template global é aplicado para confirmar os valores reais de `cW`, `cH` e `canvasFormat` no momento do rescale dos `overlayImages`.

## Mudança única

**Arquivo:** `src/pages/PostEditorPage.tsx`

**Local:** imediatamente antes do bloco de rescale (linha ~554, logo antes do cálculo de `fromW`/`fromH`/`sx`/`sy`).

**Inserir:**
```ts
console.log("[debug-canvas-size] cW:", cW, "cH:", cH,
  "canvasFormat:", canvasFormat,
  "timestamp:", Date.now());
```

Nenhuma outra alteração. Nenhuma correção de bug nesta etapa.

## Próximo passo (após aprovação)

1. Aplicar o log.
2. Abrir um post novo no preview.
3. Capturar o log via `code--read_console_logs` e reportar os valores de `cW`, `cH` e `canvasFormat` para diagnóstico.
