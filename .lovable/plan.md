

# Plano: Edge Function `remove-background`

## O que será feito

Criar a edge function `supabase/functions/remove-background/index.ts` que recebe uma imagem (base64 ou URL), envia ao Lovable AI Gateway pedindo para remover o fundo, e retorna a imagem processada.

## Implementação

**Arquivo:** `supabase/functions/remove-background/index.ts`

- Recebe `{ imageUrl: string }` no body (base64 data URL ou URL pública)
- Autentica o usuário via header Authorization
- Envia a imagem ao Lovable AI Gateway (`google/gemini-3.1-flash-image-preview`) com prompt: "Remove the background from this image completely. Make the background fully transparent. Keep only the main subject with clean edges. Output a PNG with transparent background."
- Usa `modalities: ["image", "text"]` para receber imagem de volta
- Retorna `{ image: "data:image/png;base64,..." }`
- Trata erros 429/402 e CORS

## Frontend (toolbar integration)

**Arquivo:** `src/components/post-editor/PostToolbar.tsx`
- Adicionar botão "Remover fundo" no painel do elemento selecionado (quando é tipo `photo` ou `element`)

**Arquivo:** `src/pages/PostEditorPage.tsx`
- Adicionar handler `handleRemoveBackground` que chama a edge function e atualiza o `src` do overlay selecionado com a imagem sem fundo

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/remove-background/index.ts` | Criar (nova edge function) |
| `src/components/post-editor/PostToolbar.tsx` | Adicionar botão "Remover fundo" |
| `src/pages/PostEditorPage.tsx` | Adicionar handler de remoção de fundo |

