# Plano — Autofit dos templates + overflow mobile global

## Problema 1 — Autofit não funciona, textos cortados

Causa raiz no `EditableSpan` (`shared.tsx`):

- `autoFit` mede `parent.clientHeight` para decidir quando reduzir a fonte.
- No `SertaoCard`, cada slot vive dentro de uma coluna **sem altura fixa** (o pai cresce com o conteúdo). Então `limitH = Infinity` e o autofit só dispara por largura.
- O conteúdo então passa do `styleBase` (card 540×675 / 540×960) e é cortado por `overflow: hidden`.
- Slots novos (ex.: `body` da cover, `kicker`, `countWord`) não têm `autoFit` ativado, e o `titleLead` da cover concorre com o novo `body` sem teto.

## Problema 2 — No mobile, o aplicativo inteiro fica maior que a tela

Não é só o canvas. Investigando o `PostEditorPage`:

- O `SelectTrigger` do seletor de template (linha 1822) é `w-[260px]` dentro de um `flex items-center` sem `flex-wrap` nem `min-w-0`, somando ~310px de largura mínima de uma linha de UI antes do canvas.
- A grid `grid gap-6 md:grid-cols-[1fr_280px]` (linha 1814) e a coluna `flex flex-col gap-3` (linha 1815) não têm `min-w-0`. Em grid/flex, isso permite que o filho (canvas) empurre a coluna além da viewport.
- O canvas em si (Problema 1 acima): com `parent.clientWidth` não constrangido, o cálculo de `scale` estabiliza num tamanho maior que a viewport mobile.

O `DashboardLayout` já tem `[overflow-x:clip]` no `main`, mas o conteúdo interno ainda renderiza maior que a viewport — clip esconde o overflow porém o layout “parece” ter sido cortado/maior. Precisamos corrigir as larguras reais, não só esconder.

---

## Mudanças

### 1) `src/components/post-templates/governante/SertaoCard.tsx`
- Envolver cada slot tipográfico “pesado” em um wrapper com altura máxima explícita (em px do canvas 540×675/960), com `data-fit-bounds` e `overflow: hidden`, para o `autoFit` ter um teto real:
  - **Cover**: `titleLead+titleTail` (`maxHeight ~ big?220:150`), `body` (`maxHeight ~ big?180:110`), `countWord` (`maxHeight ~ big?150:110`), `kicker` (`maxHeight ~ big?60:42`).
  - **Clause**: `title` (`maxHeight ~ big?180:120`), `body` (`maxHeight ~ big?260:170`).
  - **Close**: `title` (`maxHeight ~ big?260:180`), `body` (`maxHeight ~ big?220:150`).
- Ativar `autoFit` nos slots que ainda não o têm: `kicker`, `countWord`, `body` da cover.
- Manter o `flex: 1` pusher para o conteúdo continuar distribuído verticalmente.

### 2) `src/components/post-templates/governante/shared.tsx` — `EditableSpan`
- No `useLayoutEffect` do `autoFit`, procurar o ancestral mais próximo com `data-fit-bounds` (o wrapper acima); cair de volta para `parent.clientHeight` se não houver.
- Reduzir o piso padrão de `0.45*base` para `0.35*base` para acomodar textos longos.
- Aumentar `guard` de 80 para 200.

### 3) `src/components/post-editor/PostCanvas.tsx` (bloco do template, linhas ~1085–1128)
- Wrapper externo: `className="flex items-center justify-center w-full max-w-full min-w-0 overflow-hidden"`.
- No cálculo de `scale` (effect existente), usar `Math.floor(... * 100)/100` para evitar reflow oscilando; garantir que `scale <= sW` mesmo se o filho tiver expandido o pai (medir via `getBoundingClientRect`).

### 4) `src/pages/PostEditorPage.tsx` — corrigir overflow mobile

Pontos identificados que empurram o layout além da viewport:

- **Linha 1814** (grid container): adicionar `min-w-0` na grid e em cada coluna filha (`<div className="flex flex-col gap-3 ... min-w-0">`).
- **Linhas 1816–1843** (cabeçalho do seletor de template): trocar a row `flex items-center gap-2` por `flex flex-wrap items-center gap-2 min-w-0`; trocar `SelectTrigger w-[260px]` por `w-full sm:w-[260px] max-w-full`; envolver o texto auxiliar “Cores e tipografia…” com `truncate min-w-0`.
- **Linha 1844** (wrapper do canvas): adicionar `w-full max-w-full min-w-0` para constranger a largura efetiva no mobile.
- Auditar rápido o resto da página (`grid gap-6 md:grid-cols-...`, banner de auto-layout linha 1797, header linha 1773) e adicionar `min-w-0` / `flex-wrap` onde houver risco de empurrar a viewport.

### 5) Sanity-check do shell

- Confirmar que `DashboardLayout main` (`[overflow-x:clip]`) e `html/body/#root` (`overflow-x: hidden` no `index.css`) continuam aplicados.
- Não alterar o shell — as correções vão na página que está expandindo.

## Fora de escopo
- `CartorioCard` e `ManuscritoCard` (mesma técnica pode ser aplicada depois se necessário).
- Layout do canvas legado (sem template).
- Outras páginas além de `PostEditorPage`.

## Validação
- Carrossel Sertão com texto longo em `titleLead`, `body` (cover) e `body` (clause): nada cortado, fonte reduz suavemente.
- Posts curtos: tamanho base preservado.
- Mobile (390×844 e 360×800): sem scroll horizontal em **nenhum** elemento da página do editor; canvas cabe na largura da viewport; seletor de template quebra linha sem furar o grid.
- Desktop (≥1024px): layout idêntico ao atual.
