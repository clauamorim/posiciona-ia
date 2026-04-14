

# Plano: Remover borda verde residual do Chroma Key

O problema é que os thresholds atuais do chroma key são conservadores demais, deixando pixels semi-verdes nas bordas do recorte.

## Correção em `src/pages/PostEditorPage.tsx` (função `chromaKeyToTransparent`)

Três ajustes:

1. **Aumentar tolerância principal** de `80` para `120` e relaxar condição de green dominance de `+40` para `+30`
2. **Ampliar faixa de anti-aliasing** — baixar thresholds de `g > 120, r < 120, b < 120` para `g > 80, r < 160, b < 160` e reduzir greenness mínimo de `0.3` para `0.15`
3. **Adicionar passo extra de "despill"** — após o loop principal, fazer um segundo passo nos pixels restantes que ainda têm componente verde dominante, removendo o tint verde residual (reduzir canal G para a média de R e B)

Resultado: bordas mais limpas sem resíduos verdes visíveis.

