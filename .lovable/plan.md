

# Plano: redimensionamento mobile + cor de fundo correta no editor

## Problema 1 — Redimensionar imagens no mobile

### Causa
Os handles de resize (`RESIZE_HANDLE_SIZE = 14px` em `PostCanvas.tsx`) são pequenos demais para o dedo. A lógica de pointer events já está correta (`setPointerCapture`, `touch-action: none`, `preventDefault`), mas o alvo de toque é muito pequeno — em iOS o mínimo recomendado é 44px. Por isso o usuário "erra" o handle e acaba arrastando o canvas ou rolando.

### Solução (sem aviso de fallback)
Manter o visual delicado no desktop e ampliar a área de toque no mobile, sem mudar o tamanho aparente do handle.

**Em `src/components/post-editor/PostCanvas.tsx`:**

1. Detectar mobile via `useIsMobile()` (hook já existe em `src/hooks/use-mobile.tsx`).
2. Ajustar `RESIZE_HANDLE_SIZE` dinamicamente: 14px no desktop, 22px no mobile.
3. Em `renderResizeHandles`, envolver cada handle visual em um wrapper transparente maior (ex: 36×36px no mobile, 20×20px no desktop) que captura o `onPointerDown`. O quadrado branco visível continua pequeno e centralizado dentro do wrapper.
4. Aumentar o `zIndex` do wrapper para garantir que ele fique acima da própria imagem.
5. Ajustar `touch-action: none` no wrapper (já existe).

Resultado: no mobile o usuário tem ~36×36px de área tocável para cada handle, mantendo a estética premium no desktop.

## Problema 2 — Cor de fundo correta ao abrir o editor

### Causa
Em `PostEditorPage.tsx`, `bgIndex` inicia em `0` e o `bgColor` vira `palette[0].hex`. Mas a primeira cor da paleta nem sempre é a "Cor de fundo principal" — frequentemente é a cor dominante/de poder do arquétipo (ex: Herói começa com `#C0392B` Vermelho Poder).

Cada cor da paleta tem o campo `usage` (ex: `"Cor de fundo principal"`, `"Cor de destaque para CTAs"`).

### Solução

**Em `src/pages/PostEditorPage.tsx`:**

1. Criar helper `findBackgroundIndex(palette)` que procura a primeira cor cujo `usage` (case-insensitive) contenha `"fundo"` ou `"background"`.
2. Se encontrar, usar esse índice como default. Se não encontrar, manter `0` (fallback atual).
3. Aplicar esse default apenas quando `draft?.bgIndex` for `undefined` (preservar escolha do usuário em sessões salvas).
4. Como `palette` é derivado do `report` carregado de forma assíncrona, mover a inicialização para um `useEffect` que dispara quando `palette` chega — só atualiza `bgIndex` se ainda não houver `customBgColor` e se o usuário ainda não trocou (controlar com um ref `bgInitializedRef`).

Resultado: ao abrir o editor pela primeira vez para um relatório, a cor de fundo padrão é a marcada como "fundo" pelo relatório, não a primeira aleatória da paleta.

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/post-editor/PostCanvas.tsx` | Importar `useIsMobile`, ampliar área de toque dos handles de resize no mobile via wrapper transparente |
| `src/pages/PostEditorPage.tsx` | Helper `findBackgroundIndex(palette)`, inicialização do `bgIndex` baseada em `usage` da paleta |

Sem mudanças no schema, sem alterações na lógica de geração do relatório, sem nova dependência.

