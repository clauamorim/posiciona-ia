

# Plano: Correção de Remoção de Fundo e Cores Customizadas

## Problemas Identificados

### 1. Remoção de fundo não funciona
- **Auth:** `supabase.auth.getClaims(token)` não existe no SDK Supabase JS v2. Deve usar `supabase.auth.getUser(token)`.
- **Resposta da IA:** O caminho `data.choices[0].message.images[0].image_url.url` pode não corresponder à resposta real do gateway. Precisa de logging e fallback para outros formatos de resposta (ex: `content[].image_url`).
- **Duplo clique:** Não há guard contra clique duplo — o botão deveria ser desabilitado durante o processamento (já tem `disabled={removingBackground}` mas o estado pode não ser propagado corretamente se o overlay muda).

### 2. Cores customizadas não funcionam
- **`handleRecolorSelected`** (linha 310) verifica `selectedOverlay.type !== "element"` e retorna early. Porém **ícones Lucide** também são tipo `"element"` — o problema é que `recolorSvgDataUrl` usa regex que procura `stroke|fill|color="(#hex|rgb|word)"` mas os SVGs gerados por `renderToStaticMarkup` do Lucide usam atributos como `stroke="currentColor"` que já são substituídos por cor na criação. Na segunda vez, o regex pode não casar se a cor tiver formato inesperado.
- A regex `(#[0-9a-fA-F]{3,8}|rgb[^"]*|[a-zA-Z]+)` casa `[a-zA-Z]+` que inclui "none", mas o check `match.includes('"none"')` tenta preservar "none". O problema é que a regex também casa atributos como `xmlns` ou `version` se tiverem valor de cor falso.

## Correções

### Edge Function (`remove-background/index.ts`)
1. Substituir `supabase.auth.getClaims(token)` por `supabase.auth.getUser(token)`
2. Adicionar logging da resposta da IA para diagnóstico
3. Tentar múltiplos caminhos de extração da imagem (o gateway pode retornar em `choices[0].message.content[0].image_url.url` ou como base64 inline)
4. Retornar a imagem como data URL completo `data:image/png;base64,...` se vier só base64

### Cores customizadas (`PostToolbar.tsx`)
1. Corrigir `recolorSvgDataUrl` — usar regex mais precisa que só casa `fill` e `stroke` (não `color`), e ignorar `fill="none"` e `stroke="none"` corretamente
2. Garantir que o color picker customizado no painel de "Elemento selecionado" chama `handleRecolorSelected` corretamente (já chama — o problema é o regex)

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/remove-background/index.ts` | Fix auth + parsing de resposta |
| `src/components/post-editor/PostToolbar.tsx` | Fix regex de recoloração SVG |

