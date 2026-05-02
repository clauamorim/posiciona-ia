# Cenas editoriais por nicho + variação por slide no carrossel

Hoje a edge function `fetch-post-image` extrai keywords do texto do post (ITCMD, inventário, etc.) e gera consultas/prompts genéricos. Além disso, no editor o carrossel usa **um único overlay de fundo global** para todos os slides — não há per-slide background.

## 1. Banco de cenas editoriais por nicho (edge function)

Adicionar em `supabase/functions/fetch-post-image/index.ts`:

```ts
// Direção fotográfica editorial premium por nicho.
// Cada cena: ambiente + iluminação + composição + postura.
const NICHE_SCENES: Record<string, string[]> = {
  lawyer: [
    "attorney at mahogany desk reviewing documents, dramatic side lighting, leather-bound books in background",
    "lawyer in tailored dark suit walking through neoclassical courthouse corridor, warm afternoon light",
    "close-up of hands signing contract beside a fountain pen and law books, shallow depth of field",
    "female attorney by tall office window, city skyline behind, soft directional light, contemplative posture",
  ],
  doctor: [
    "physician in white coat at modern clinic, confident posture, soft window light, stethoscope visible",
    "doctor reviewing chart at minimalist consultation desk, warm natural light, calm and authoritative",
    "hands of a physician examining medical imaging on a tablet, clean clinical environment, soft shadows",
  ],
  executive: [
    "executive in dark suit at glass desk, bokeh city view behind, golden hour light",
    "businesswoman in cream blazer leading strategy meeting in glass-walled boardroom, soft daylight",
    "close-up of wristwatch and laptop on dark walnut desk, espresso cup beside, moody editorial light",
  ],
  consultant: [
    "consultant standing at whiteboard sketching diagrams, sleeves rolled, focused expression, side daylight",
    "two professionals reviewing strategy document at minimalist meeting table, warm filtered light",
    "consultant at coworking space with laptop and notebook, neutral palette, soft window light",
  ],
  accountant: [
    "accountant at clean desk reviewing spreadsheets on dual monitors, calm task light, organized workspace",
    "close-up of calculator, ledger and cup of coffee on a wooden desk, morning light from the side",
    "professional in shirt and tie examining financial reports, glasses in hand, contemplative expression",
  ],
  therapist: [
    "therapist's office with two armchairs, warm lamp light, plants and bookshelf, inviting and calm atmosphere",
    "hands holding a notebook in a softly lit consultation room, neutral earthy palette",
    "psychologist in knit sweater listening attentively, soft daylight, blurred bookshelf background",
  ],
  architect: [
    "architect reviewing blueprints on a long wooden table, scale model nearby, daylight from skylight",
    "designer's desk with rolled drawings, T-square and brass lamp, minimal Scandinavian palette",
    "architect at construction site wearing white shirt and hard hat, golden hour, confident stance",
  ],
  coach: [
    "coach mid-conversation in airy studio with plants, soft daylight, warm and energetic posture",
    "notebook with handwritten goals beside steaming coffee on a linen tablecloth, morning light",
    "speaker on minimal stage addressing small audience, warm spotlight, editorial framing",
  ],
  marketing: [
    "creative team reviewing mood board on studio wall, natural light, energetic but composed",
    "designer at iMac with sketches pinned around the desk, warm afternoon light",
    "social media strategist with smartphone and notebook in modern cafe, soft window light",
  ],
  realtor: [
    "real-estate agent handing keys in front of bright contemporary house, golden hour",
    "professional touring buyers through sunlit modern living room with floor-to-ceiling windows",
    "close-up of architectural model and floor plan on concrete table, directional daylight",
  ],
  fitness: [
    "personal trainer in minimalist gym demonstrating posture, raking morning light, athletic but composed",
    "athlete tying running shoes on stadium track at sunrise, muted palette, editorial framing",
    "kettlebell and towel on polished concrete floor, dramatic side light, calm composition",
  ],
  nutrition: [
    "nutritionist plating colorful seasonal vegetables on a marble counter, soft daylight overhead",
    "close-up of fresh produce, olive oil and notebook on light wooden table, airy editorial style",
    "professional in linen apron writing meal plan beside bowl of fruit, warm window light",
  ],
  designer: [
    "graphic designer sketching in notebook beside laptop and color swatches, soft side light",
    "studio desk with minimal still life of design tools, neutral palette, gentle shadows",
  ],
  default: [
    "minimalist editorial workspace with notebook, warm coffee and morning daylight from the side",
    "professional in neutral attire by tall window, soft directional light, calm confident posture",
    "still-life of leather notebook, fountain pen and ceramic cup on linen surface, editorial framing",
    "architectural interior with single armchair and plant, warm ambient light, generous negative space",
  ],
};
```

Função utilitária `pickNicheScene(niche, seed)`:
- Mapeia o `niche` PT (`advogado` → `lawyer`, `medica` → `doctor`, `executivo` → `executive`, `contador` → `accountant`, `psicologa` → `therapist`, `arquiteto` → `architect`, `coach` → `coach`, `marketing/publicidade` → `marketing`, `corretor/imobiliaria` → `realtor`, `personal/fitness` → `fitness`, `nutricionista` → `nutrition`, `designer` → `designer`, `consultor/consultoria` → `consultant`) — fallback `default`.
- Retorna uma cena escolhida aleatoriamente. Quando vier um `nonce`/`seed`, usa hash determinístico para variedade controlada por slide.

## 2. `buildAIPromptSubject` (linhas 267–289)

Comportamento novo:
- Se `userQuery` presente → mantém EXATO o que existe hoje.
- Sem `userQuery` → âncora principal vira a cena do nicho (`pickNicheScene`); o `mainMessage` continua sendo o `cardCopy`/`theme` em PT (sentido emocional); adicionar **no máximo 2 keywords** do conteúdo do post como contexto leve no `subject`.
- Aceita `seed?: string` no opts (passado pelo handler).

```ts
const scene = pickNicheScene(opts.niche, opts.seed);
const ctxKeywords = extractKeywordsFromText(opts.cardCopy || opts.theme || opts.body || "", 2);
const subject = [scene, ctxKeywords.join(" ")].filter(Boolean).join(", ").trim();
```

## 3. `buildSearchQuery` (linhas 212–261)

Sem `userQuery`:
- Pegar a cena do nicho e extrair as primeiras 4–5 palavras descritivas (parte antes da primeira vírgula) como âncora principal — substitui as `richKeywords` do texto do post.
- Mantém `nicheEN` e o filtro de termos sensíveis. Não passa o texto do post pro Pexels nesse caminho.
- `userQuery` presente → comportamento atual inalterado.

```ts
const scene = pickNicheScene(opts.niche, opts.seed);
const sceneAnchor = scene.split(",")[0].trim(); // "attorney at mahogany desk reviewing documents"
const parts = [nicheEN, sceneAnchor];
```

## 4. Variedade controlada por chamada

- `pickNicheScene` aceita um `seed` opcional. Quando vier, escolhe deterministicamente (hash → modulo). Sem seed, `Math.random()`.
- O handler passa `nonce` (já existente) como `seed` para ambas as funções, garantindo cenas diferentes por chamada.

## 5. Imagem diferente por card do carrossel

Hoje `buildAutoLayout` é chamado **uma vez** com `slideIndex: 0` e o overlay vai pra um array global compartilhado entre slides. Para imagem por slide:

1. Em `src/pages/PostEditorPage.tsx`, depois do auto-layout inicial, disparar um loop assíncrono `for (let i = 0; i < totalSlides; i++)` que chama `fetchBackgroundImage` por slide quando `isCarouselDay && initialStyle === "pexels"` (ou `generateAIImage` quando `initialStyle === "ai"`), passando `nonce = `${Date.now()}-${i}-${rand}`` e `body = day.card_copy[i]`.
2. Armazenar resultado em novo state `slideBackgrounds: Record<number, { url: string; opacity: number; objectPosition: string; photographer?: ... }>`.
3. Cada slide do carrossel recebe seu próprio `bg` ao renderizar:
   - No `CarouselEditor`, propagar `slideBackgrounds[currentSlide]` e injetar como overlay tipo `photo` apenas quando renderizar aquele slide. Estratégia mais limpa: armazenar `slideOverlays: Record<number, OverlayImage[]>` e mesclar com overlays globais ao passar para o `PostCanvas` (parecido com o que já existe pra `slideTextBoxes`).
4. Edge function não muda — quem orquestra a multiplicidade é o front, mas o `nonce` por slide já garante que Pexels (sorteio top-6) e IA (variation seed) entregam imagens distintas.

## 6. Variação sutil de tratamento entre slides

Ao construir cada `slideBackgrounds[i]`:

```ts
const opacityCycle = [0.45, 0.55, 0.65];
const positionCycle = ["center center", "center top", "center bottom"];
const opacity = opacityCycle[i % 3];
const objectPosition = positionCycle[i % 3];
```

- `opacity` é aplicado ao overlay (`OverlayImage.opacity` já existe; hoje o background usa `0.75` quando `withDarkOverlay`). Fazer `buildBackgroundImageOverlay` aceitar um parâmetro `opacity` opcional, ou simplesmente sobrescrever `overlay.opacity` antes de inserir no map.
- `objectPosition`: adicionar campo opcional no tipo `OverlayImage` (`objectPosition?: string`) e aplicar no `<img style={{ objectPosition }} />` em `PostCanvas.tsx` (linha 783) quando definido. Default mantém `"center"`.

## Não-mudanças

- Sem alterar a lógica do dicionário PT→EN, `extractKeywordsFromText`, `searchPexelsList`, fluxo de gallery mode, modelo de IA usado, ou estilos minimalistas.
- `userQuery` continua tendo precedência absoluta — comportamento atual preservado.
- Sem mudança em persistência ou créditos.

## Observações técnicas

- Custos: 1 chamada extra de Pexels por slide do carrossel (4–10 chamadas por dia editorial). Pexels é grátis. IA por slide é caro (Gemini image preview) — **vamos limitar variação por slide somente quando `style === "pexels"`**; no estilo AI manter 1 imagem só (a já gerada) para não estourar custo, a menos que o produto queira o contrário (vale confirmar).
- `nonce` já existe no payload e se propaga para `generateWithAI` como `seed`. Reaproveitar tal qual.
