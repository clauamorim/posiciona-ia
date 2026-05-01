# Correções: download em post único + estilos de IA não diferenciados

## Problema 1 — Botão de download some em posts únicos

No modo carrossel, `CarouselEditor.tsx` renderiza, logo abaixo do canvas, dois botões grandes: **"Baixar slide N"** e **"Baixar todos (ZIP)"**. No modo single, o `PostCanvas` é renderizado direto em `PostEditorPage.tsx` sem nenhum botão equivalente ao redor — o usuário só consegue baixar pelo botão "Baixar PNG" da sidebar de ferramentas (ou pela `MobileEditorBar` no mobile). Quando a sidebar não está rolada até o fim, o botão fica fora de vista.

### Solução
Adicionar, em `PostEditorPage.tsx`, uma barra de ação imediatamente abaixo do `PostCanvas` (apenas quando `!isCarousel`), espelhando o padrão visual do carrossel, com um único botão **"Baixar PNG"** (chama `handleDownloadSlide(0)`).

## Problema 2 — Todos os estilos de IA devolvem fotos claras e parecidas

Em `supabase/functions/fetch-post-image/index.ts`, função `generateWithAI`, o prompt fixo já dita uma estética muito forte:

> *"Editorial photograph, premium magazine quality, soft natural lighting, shallow depth of field… Soft palette, calm contrast. Style: minimal, calm, professional, contemporary photography. Avoid people's faces dominating the frame."*

A `Style direction` extra (vinda do estilo escolhido) é apenas concatenada no meio, então **nunca consegue contradizer** o tom "editorial / soft / minimal / calm / contemporary photography". Resultado: independente de o usuário escolher "Editorial Luxo", "Moderno Vibrante" ou "Autoridade Técnica", o modelo segue a estética padrão (foto clara, luz natural). Além disso, "pure photography only" elimina qualquer estética gráfica/ilustrativa que o estilo poderia sugerir.

### Solução
Reformular `generateWithAI` para que, quando `aiStyleDirective` estiver presente:
1. **Substituir** (não acumular) os adjetivos estéticos. O prompt passa a ter dois ramos:
   - **Sem estilo selecionado:** mantém o prompt editorial atual (compatibilidade).
   - **Com estilo selecionado:** monta o prompt usando a `aiStyleDirective` como descritor estético principal, removendo os termos conflitantes ("soft natural lighting", "soft palette, calm contrast", "minimal, calm, professional, contemporary photography", "pure photography only").
2. Trocar `"pure photography only"` por uma instrução mais neutra: a estética (fotografia, ilustração editorial, design gráfico) passa a ser determinada pelo estilo.
3. Manter as restrições universais que **não** afetam estilo: sem texto/letras/logos, área segura para overlay, aspect ratio, semente de variação.
4. Subir a temperatura/variação por estilo: incluir o `id` do estilo na semente para que o modelo entenda que cada estilo é um pedido diferente.

Adicionalmente, encurtar/reescrever as `directive` em `src/lib/aiImageStyles.ts` para que sejam **mais imperativas e mutuamente exclusivas** (ex.: "Editorial Luxo" hoje diz "dark background, gold or cream accents" — mas o prompt base força "soft palette" e ganha; após o fix, a directive vira o descritor dominante).

### Sobre "fora de contexto"
O subject é construído a partir de `cardCopy + theme + niche` (já inclui contexto). O problema reportado de "alguma foto fora do contexto" tende a desaparecer junto com o fix #2: hoje, como o prompt força "editorial photograph com pessoa de costas/objeto neutro", a IA tende a gerar cenas genéricas que se distanciam do tema. Com a directive dominando, o subject ganha mais peso relativo.

## Arquivos afetados

- `src/pages/PostEditorPage.tsx` — adicionar barra com botão "Baixar PNG" abaixo do `PostCanvas` no modo single.
- `supabase/functions/fetch-post-image/index.ts` — refatorar `generateWithAI` para que `aiStyleDirective`, quando presente, substitua os adjetivos estéticos do prompt-base.
- `src/lib/aiImageStyles.ts` — reforçar as `directive` (mais curtas, mais imperativas, sem ambiguidade).

## Fora do escopo
Sem mudanças no fluxo de débito de créditos, na busca Pexels, na UI de seleção de estilo ou em qualquer outra parte do editor.
