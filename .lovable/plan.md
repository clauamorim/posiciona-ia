## Problema atual

Hoje, quando o usuário abre o painel "Buscar no Pexels" no editor:

1. O campo de busca chega pré-preenchido com `day.theme || day.caption` — texto bruto, em português, frequentemente longo e abstrato (ex: "como sair do cansaço sem culpa"). Pexels é em inglês e busca melhor por substantivos concretos.
2. Quando o usuário clica em buscar, esse texto literal (`customQuery`) é enviado direto ao Pexels — **a tradução PT→EN e a extração de substantivos visuais (`extractKeywordsFromText`) que existem na edge function só rodam no fallback**, não na busca pedida pelo usuário.
3. O `card_copy` do **slide atual** (a frase visível na imagem, que melhor representa o sentido daquela tela) **não entra** na construção da query — só `theme` e `caption` do dia inteiro são considerados.
4. Em carrosséis, todos os slides acabam buscando a partir do mesmo tema/legenda do dia, então qualquer imagem trazida fica desconexa do conteúdo específico do slide.
5. O prompt da IA (`buildAIPromptSubject`) também ignora o `card_copy` do slide atual e usa palavras genéricas, gerando imagens "editoriais bonitas" mas não conectadas ao tema.

Resultado: imagens vagas, descontextualizadas, mesmo padrão visual em todos os slides do carrossel.

---

## Solução proposta

Levar o "sentido real do post" — entendido como **tema + card_copy do slide ativo + nicho** — até a montagem da query, com tradução PT→EN robusta e ranking por relevância.

### 1. Edge function `supabase/functions/fetch-post-image/index.ts`

**a) Sempre passar pelo construtor inteligente, mesmo com `customQuery`:**

Hoje, quando o usuário digita ou aceita o `defaultQuery`, esse texto vai cru ao Pexels. Vamos:
- Manter `customQuery` apenas como **seed semântica** quando vier do input do usuário.
- Sempre rodar `buildSearchQuery` por cima, combinando: `nicho + keywords-do-customQuery + keywords-do-card_copy + keywords-da-caption`.
- Adicionar um parâmetro `userQuery` opcional para diferenciar "o que o usuário digitou" de "uma query já em inglês". Quando `userQuery` está presente, ele entra com peso maior na extração.

**b) Ampliar dicionário PT→EN** com mais 40-60 termos visuais comuns (ex: "cansaço/exaustão → tired exhausted", "rotina → routine lifestyle", "celular → smartphone", "reunião → meeting", "mesa → desk workspace", "café → coffee morning", etc.).

**c) Priorizar `card_copy` na extração de keywords**:

```ts
// novo richText — card_copy do slide atual primeiro, com peso maior
const richText = [
  opts.cardCopy,        // NOVO: peso máximo (frase visível do slide)
  opts.theme,
  opts.body,
  opts.caption?.slice(0, 200), // só o início da legenda
].filter(Boolean).join(" ");
```

**d) Prompt da IA mais específico**: incluir no `subject` o `card_copy` traduzido como "main message context" para a IA gerar uma cena que ilustra a ideia do slide.

### 2. Cliente `src/pages/PostEditorPage.tsx`

Hoje passa apenas `imageSearchQuery`. Vamos:

- Trocar `imageSearchQuery` por um objeto/props mais ricos: `imageContext` contendo `theme`, `cardCopy` (do slide ativo, normalizado), `caption`, `niche`, `businessContext`.
- O `defaultQuery` mostrado no input passa a ser uma **versão curta e legível do tema do slide** (3-6 palavras), não a legenda inteira. O usuário pode continuar editando livremente.

### 3. Helpers `src/lib/postAutoLayout.ts`

- `fetchImageGallery` e `generateAIImage` já aceitam `caption` e `body`. Vamos adicionar `cardCopy` (slide atual) e `userQuery` para que a edge function diferencie "input cru do usuário" de "tema do slide".

### 4. Painel `ImageGalleryPanel.tsx` e `AddElementPanel.tsx`

- Receber o novo `imageContext` e repassar à edge function.
- Mostrar abaixo do input uma label discreta: "Buscando por: <query traduzida>" para o usuário entender o que foi enviado e poder ajustar.

---

## Arquivos afetados

- `supabase/functions/fetch-post-image/index.ts` — dicionário ampliado, `buildSearchQuery` recebe `cardCopy`, sempre roda mesmo com `customQuery`, prompt IA enriquecido.
- `src/lib/postAutoLayout.ts` — `fetchImageGallery` e `generateAIImage` aceitam `cardCopy` e `userQuery`.
- `src/pages/PostEditorPage.tsx` — passa `cardCopy` do slide ativo + tema enxuto como `defaultQuery`.
- `src/components/post-editor/inspector/ImageGalleryPanel.tsx` — repassa `cardCopy`, mostra "buscando por: …" com a query traduzida retornada pela edge.
- `src/components/post-editor/inspector/AddElementPanel.tsx` — encaminha as novas props.
- `src/components/post-editor/MobileEditorBar.tsx` — encaminha as novas props.
- `src/components/post-editor/PostToolbar.tsx` — adiciona prop `cardCopy` na interface.

## Resultado esperado

- Em **carrosséis**, cada slide busca imagens conectadas ao texto **daquele slide**, não ao tema do dia inteiro.
- Em **posts únicos**, a busca passa a usar substantivos concretos extraídos do tema + card_copy + nicho, traduzidos para inglês — Pexels devolve imagens visualmente coerentes.
- A IA também recebe um `subject` mais rico, gerando cenas que ilustram a mensagem real do slide.
- O usuário continua podendo digitar uma palavra-chave manual; ela é combinada com o contexto do post (não substitui).
