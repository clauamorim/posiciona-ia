

## Correções para a montagem inicial dos posts

Identifiquei 3 problemas distintos pelos seus prints, e cada um tem uma causa diferente. Plano enxuto:

## 1. Unsplash retornando fotos irrelevantes (foto de criança chorando)

**Causa**: `extractKeywords` na edge function pega palavras soltas do tema em **português** ("Superando", "cansaço", "pequenos", "descuidos", "diários") e manda direto para a Unsplash API — que tem catálogo majoritariamente em **inglês**. Resultado: a busca casa com "tired" → fotos genéricas de pessoas exaustas, incluindo crianças. Pior, usa o **tema do dia** que é sempre emocional/abstrato (StoryBrand), em vez do **nicho do negócio**.

**Correção**:
- Expandir `extractKeywords` para receber também `niche` e `business_context` (nicho do negócio + 2-3 palavras-chave da empresa).
- Compor a query como: `"<nicho em inglês> <2 substantivos do tema>"` com tradução simples via dicionário interno (ex: `advogado→lawyer`, `psicólogo→therapy`, `marketing→marketing`).
- Filtrar termos sensíveis ("criança", "child", "kid", "baby") quando o nicho não for infantil — prevenção contra fotos inadequadas.
- Usar parâmetro `content_filter=high` (já está) + adicionar `order_by=relevant` (não `latest`).
- Buscar uma **lista de 10** e escolher uma com filtros de qualidade (largura mínima, sem rosto dominante via análise simples do `urls.thumb`).

No `PostEditorPage.tsx` e `EditorialPage.tsx` (modal) passar o nicho/contexto da empresa quando chamar `fetchBackgroundImage` e `fetchImageGallery`.

## 2. IA gerando imagens com texto sem sentido ("ME AJUDE A SEGURAR ESSA BARRA")

**Causa**: o prompt atual diz `"no text"` mas o Gemini Flash Image (e similares) **frequentemente ignora isso quando o tema do post é em português e tem frase emocional**. O modelo interpreta a frase como conteúdo a ser ilustrado literalmente, inserindo letreiros, neon, placas, etc.

**Correção** no `generateWithAI` da edge function:
- Reescrever prompt para **inglês puro**, com tema traduzido (não passar o tema português literal).
- Prompt fixo: `"Editorial photograph, premium magazine quality, soft natural lighting, shallow depth of field. Subject: <tema traduzido>. ABSOLUTELY NO TEXT, NO LETTERS, NO SIGNS, NO NEON, NO TYPOGRAPHY, NO WORDS anywhere in the image. Composition: centered subject with negative space on edges for text overlay. Style: minimal, calm, professional."`.
- Adicionar instrução negativa redundante (3x "no text" funciona melhor empiricamente).
- Trocar para o modelo `google/gemini-3-pro-image-preview` (qualidade superior, vale o custo já que o usuário paga 1 crédito).
- Validação pós-geração: se a edge function detectar falha, retornar erro claro em vez de imagem ruim.

## 3. Texto título sobreposto ao corpo no template minimalista (degradê)

**Causa**: no template `minimal` do square (linha 78-79 em `postTemplates.ts`), o título começa em `y=320` com `fontSize=70` e o corpo começa em `y=600`. Quando o título tem 2-3 linhas (caso de "Combatendo a sensação de desvalorização e o esgotamento emocional"), passa de 320 px → ~600px e colide com o corpo. O bloco decorativo (faixa) fica em y=540 e também é invadido.

**Correção** em `postTemplates.ts`:
- **Square minimal**: título y=200, fontSize=60 (não 70), corpo y=720, decorativo y=680, slideNumber mantém.
- **Reels minimal**: título y=480, corpo y=1180 (espaço vertical sobra).
- **Square content**: título y=200, corpo y=520 (estava 380, muito próximo).
- Adicionar **sistema de fallback**: quando o título é maior que 50 caracteres, o `buildAutoLayout` reduz `titleFontSize` em 20% e empurra `bodySlot.y` para baixo proporcionalmente (sugestão dinâmica via `suggestions`).

## 4. Bonus: opacidade do fundo nas fotos

Pelos prints, a foto fica com `opacity: 0.75` mas o **texto não tem sombra/peso** suficiente para se destacar. 

**Correção**: adicionar `text-shadow: 0 2px 8px rgba(0,0,0,0.6)` automaticamente nos textos quando há overlay de fundo de foto (template cover/Unsplash/AI). Aplicado via `PostCanvas.tsx` condicionalmente.

## Arquivos a editar

- `supabase/functions/fetch-post-image/index.ts` — keyword extraction com nicho, prompt IA reforçado em inglês, modelo pro.
- `src/lib/postAutoLayout.ts` — aceitar `niche` e `businessContext` no input; ajuste dinâmico de fonte conforme tamanho do título.
- `src/lib/postTemplates.ts` — ajustar coordenadas y de minimal e content.
- `src/pages/PostEditorPage.tsx` — passar nicho/contexto do report ao chamar buildAutoLayout/fetchBackgroundImage; aplicar text-shadow condicional.
- `src/pages/EditorialPage.tsx` — passar nicho/contexto ao modal de seleção.
- `src/components/post-editor/StyleSelectionModal.tsx` — receber e usar nicho na pré-busca de preview.
- `src/components/post-editor/inspector/ImageGalleryPanel.tsx` — buscar com nicho como contexto.

## Fora do escopo

- Mudar para outra API de imagens (mantemos Unsplash + IA).
- Implementar moderação automática de conteúdo (filtro simples de keywords basta).
- Re-treinar modelo de IA (impossível, mudança de prompt resolve).

