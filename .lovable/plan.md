

# Correções: Camadas de texto no carrossel e upload de imagens

## Problemas identificados

1. **Botões "Para frente/Para trás" não aparecem para texto no carrossel**: O `CarouselEditor` não repassa `onSelectedTextChange`, `renderOrder` e `onRenderOrderChange` ao `PostCanvas`. Como resultado, quando o texto é selecionado no canvas do carrossel, `selectedTextId` no `PostEditorPage` permanece `null` e os botões de camada não aparecem no toolbar.

2. **Upload de imagens não funciona**: Preciso verificar se há um erro silencioso no `handleFileUpload` ou se o problema está na compressão/adição da imagem. O código parece correto na leitura, mas pode haver um problema de referência ou estado que impede o upload de concluir.

## Plano

### 1. CarouselEditor — repassar props de texto e renderOrder

**Arquivo:** `src/components/post-editor/CarouselEditor.tsx`

- Adicionar props: `onSelectedTextChange`, `renderOrder`, `onRenderOrderChange`
- Repassar ao `PostCanvas` interno

**Arquivo:** `src/pages/PostEditorPage.tsx`

- Passar `onSelectedTextChange={setSelectedTextId}`, `renderOrder={renderOrder}`, `onRenderOrderChange={setRenderOrder}` ao `CarouselEditor`

### 2. Upload de imagens — diagnóstico e correção

**Arquivo:** `src/components/post-editor/PostToolbar.tsx`

- Adicionar tratamento de erro no `handleFileUpload` (try/catch no `FileReader`)
- Verificar se `onAddImage` está sendo chamado corretamente
- Testar se há problema com imagens grandes (comprimir antes de adicionar ao canvas)

### Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `src/components/post-editor/CarouselEditor.tsx` | Adicionar e repassar props de `onSelectedTextChange`, `renderOrder`, `onRenderOrderChange` |
| `src/pages/PostEditorPage.tsx` | Passar as novas props ao `CarouselEditor` |
| `src/components/post-editor/PostToolbar.tsx` | Melhorar robustez do `handleFileUpload` |

