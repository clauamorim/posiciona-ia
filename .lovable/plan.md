

# Análise do Instagram via Upload de Screenshot

## Problema

O Firecrawl **não suporta instagram.com**. Os logs confirmam: *"We apologize for the inconvenience but we do not support this site."* Não há como contornar isso — é uma limitação do serviço.

## Solução

O usuário fará **upload de um print** do seu perfil do Instagram. A IA (Gemini 2.5 Flash, multimodal) analisará a imagem junto com os dados de StoryBrand e arquétipos.

## Alterações

### `supabase/functions/analyze-instagram/index.ts`
- Remover toda a lógica do Firecrawl (scrape, `FIRECRAWL_API_KEY`)
- Receber `{ username, screenshot }` onde `screenshot` é o base64 da imagem enviada pelo usuário
- Validar que `screenshot` foi fornecido (obrigatório)
- Manter a busca de StoryBrand/arquétipos e a chamada ao Gemini com a imagem

### `src/pages/InstagramAnalysis.tsx`
- Trocar o campo de `@` por um campo de upload de imagem (input type="file" accept="image/*")
- Manter o campo de `@` como opcional (para referência no prompt)
- Converter a imagem para base64 no frontend antes de enviar
- Limitar tamanho do arquivo (~5MB) para não estourar o payload
- Mostrar preview da imagem selecionada

## Fluxo do usuário

1. Usuário tira um print da primeira página do seu Instagram
2. Faz upload do print na página de Análise
3. Opcionalmente informa o @ (para contexto)
4. Clica "Analisar Perfil"
5. A IA analisa o print + dados de StoryBrand/arquétipos
6. Resultados aparecem nos cards "Situação Atual" vs "Sugestão"

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/analyze-instagram/index.ts` | Remover Firecrawl, aceitar screenshot base64 do frontend |
| `src/pages/InstagramAnalysis.tsx` | Adicionar upload de imagem, preview, conversão base64 |

