## Diagnóstico

O **post único** funciona porque é renderizado como `close`, cujos 3 slots (`title`, `body`, `cta`) batem 1:1 com o que a IA devolve (`title`, `card_copy[0]`/`caption`, `cta`). Toda a copy aparece e o layout fica cheio.

O **carrossel** quebra porque o `SertaoCard` capa+cláusulas tem 9 slots especializados (`eyebrow`, `kicker`, `countWord`, `titleLead`, `titleTail`, `footer`, `topic[]`, `titles[]`, `body[]`) mas a IA só entrega `title` + `card_copy[]` + `caption` + `cta`. Sem `meta`, `mapPostToCards` devolve strings vazias em quase todos esses slots — daí a capa com só um título solto e um corpo, sem o eyebrow/régua/kicker italic/numeral gigante que dá personalidade ao template (IMG_4881). As cláusulas (slides 1–5) ficam só com `body`, sem topic nem título.

## O que vou fazer

### 1. `mapPostToCards.ts` — sintetizar slots a partir do que existe

**Capa (índice 0):**
- `eyebrow`: deriva de `meta.eyebrow` → senão `"POSICIONA EDITORIAL"` (ou nome do negócio quando passado) + categoria/semana opcional. Hoje fica vazio.
- `kicker`: deriva do `sectionLabel` no plural ("Cláusulas", "Situações", "Passos") quando ausente.
- `countWord`: número de cláusulas por extenso em pt-BR (`"Sete"` para 5+cover+close=7, mas usamos a contagem real de cláusulas: 1→"Uma", 2→"Duas", …, 10→"Dez"). Hoje fica vazio.
- `titleLead`: já vem do `title`.
- `body`: já vem do `copy[0]`.
- `footer`: default `"arraste para começar"` quando vazio.

**Cláusulas (índices 1..N):**
- Parser `splitTitleBody(copy[i])`: se o slide tiver "Título.\nCorpo" ou primeira frase curta (<70 chars terminada em `.`/`?`/`:`), separa em `title` + `body`. Senão a primeira frase vira `title` e o resto vai pro `body`.
- `topic`: deriva de `meta.topic[i]` → senão tenta extrair de prefixo MAIÚSCULO no início do slide ("PRAZO: ...") → senão vazio (renderiza placeholder).
- `title`: do parser acima.
- `body`: do parser.

**Close (índice último):**
- Sem mudança — já funciona.

### 2. `SertaoCard.tsx` — fallback elegante quando capa está incompleta

Quando, mesmo após a síntese, a capa não tiver `kicker` E `countWord` preenchidos (cenário raro mas possível com posts de outras estruturas), trocar o layout da capa para o **modo "editorial enxuto"**: igual ao close — eyebrow + régua + título Playfair italic grande centralizado + body + régua + footer. Assim a capa nunca aparece esvaziada como em IMG_4881.

Condição: `!card.kicker?.trim() && !card.countWord?.trim()` → renderiza o branch "cover-as-close".

### 3. Helper `numberToPortuguese(n)` em `mapPostToCards.ts`

Pequeno mapa 1–20 + fallback numérico. Usado para sintetizar `countWord`.

## Fora de escopo

- Não vou tocar na edge function `generate-content-week` nem alterar o prompt da IA. A síntese é totalmente client-side.
- Não vou mudar `CartorioCard` nem `ManuscritoCard`.
- Não vou refatorar o pipeline de salvamento — overrides em `templateSlots` continuam funcionando por cima dos slots sintetizados.

## Validação

- Carrossel atual (IMG_4881): capa passa a mostrar eyebrow + régua dourada + "Cláusulas" italic + "Cinco" gigante + título Playfair + corpo + footer "arraste para começar" + paginação.
- Cláusulas 1–5: mostram "CLÁUSULA · TÓPICO" (quando deriva) + numeral romano/árabe grande + título + body.
- Post único (IMG_4884): inalterado.
- Posts com `meta` futuro vindo da IA: overrides prevalecem sobre os defaults sintetizados.
