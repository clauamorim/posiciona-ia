## Diagnóstico

Investiguei o editor com `style=pexels` (foto de fundo) vs `style=minimal`. Encontrei três problemas independentes:

### 1. Cor do título não muda quando há foto de fundo
`src/components/post-editor/PostCanvas.tsx` linha 729:
```ts
color: hasPhotoBackground ? "#ffffff" : (isTitle ? resolvedTitleColor : textColor)
```
Sempre que há foto cobrindo o canvas, a cor do texto é **forçada em branco**, ignorando qualquer cor que o usuário escolhe no ColorPicker. O mesmo vale para o corpo. Por isso "se eu clico para mudar a cor da fonte, a cor não muda" — ela está sendo sobrescrita a cada render.

### 2. Fonte do título não aparece quando há foto
Há uma corrida entre dois efeitos no `PostEditorPage.tsx`:
- linhas 451-455 (`useEffect` que aplica `typography.display`/`typography.body` do relatório)
- linhas 486-583 (`useEffect` do template global do arquétipo, que define `setDisplayFont(s.displayFont)` e `setTitleFontFamily(...)`)

No fluxo Minimalista o template aplica e nada vem por cima. No fluxo Pexels/IA o auto-layout demora (chama edge function), e durante esse intervalo o efeito de typography (linha 451) roda **depois** do template, sobrescrevendo `displayFont` para o valor do relatório. Como `titleFontFamily` foi setado a partir de `s.displayFont` (linha 524-531), na primeira passada ele fica correto — mas se o template global do arquétipo não tem `displayFont` salvo (caso comum: usuário nunca personalizou), `titleFontFamily` permanece `null` e o canvas cai no `displayFont` (que já foi sobrescrito por `typography.display`).

Resultado: no card aparece a fonte do relatório (sans-serif) em vez da fonte serifada do template.

### 3. "Voltou a carregar imagens genéricas nos cards"
Preciso confirmar com o usuário o que está aparecendo de "genérico" (foto que não tem nada a ver com o tema vs. mesma foto repetida). O fluxo de imagem do carrossel (`slideBgRanRef`, linhas 696-767) hoje pula o slide 0 — então o slide 1 mantém a foto que o auto-layout escolheu, e os demais buscam novas. Se o auto-layout falhou para o slide 1, ele cai em gradiente; se a edge `fetch-post-image` está respondendo com fotos pouco específicas, é problema de prompt/contexto na função, não do front.

## Alterações

### A. Não forçar branco quando o usuário escolheu cor — `PostCanvas.tsx` linha 729
- Se `titleColor` (ou `customTextColor` para o corpo) for **explicitamente definido**, respeitar essa cor mesmo com foto de fundo.
- Manter o fallback automático para branco apenas quando a cor não foi customizada (`titleColor == null` e `customTextColor == null`).
- Preservar o `text-shadow` em ambos os casos para garantir legibilidade.

Isso resolve "mudar cor não muda".

### B. Garantir que a fonte do template prevaleça — `PostEditorPage.tsx`
1. No useEffect de typography (linhas 451-455), só aplicar `typography.display`/`typography.body` se o template do arquétipo **ainda não foi aplicado** (`!archetypeTemplateAppliedRef.current`).
2. Quando o template do arquétipo é aplicado mas não tem `displayFont` salvo, derivar do `archetypeTypography` (helper já existente em `src/lib/archetypeTypography.ts`) em vez de cair no `typography.display` do relatório.

Isso garante que a fonte serifada do template global apareça em qualquer estilo (minimal, pexels, IA).

### C. Diagnóstico das "imagens genéricas"
Antes de mexer no fluxo, vou pedir ao usuário:
- Print de um exemplo de card com a foto que está vindo "genérica".
- Tema/dia (semana, dia) onde isso acontece.

Sem essa amostra, qualquer mudança no `fetch-post-image` é tiro no escuro e pode regredir outros casos. Só vou tocar nesse fluxo depois de identificar o padrão (ex.: fotos sem niche, fallback caindo em palavra-chave genérica, cache).

## Como vou validar
1. Abrir `/post-editor?week=2&day=2&style=pexels`:
   - Título e corpo carregam na fonte serifada do template do arquétipo.
   - Selecionar título → trocar cor no ColorPicker → cor é aplicada de fato no canvas (mesmo com foto de fundo).
2. Abrir `/post-editor?week=2&day=2&style=minimal` para garantir que nada quebrou no caso que já funcionava.
3. Pedir confirmação visual do usuário sobre as imagens "genéricas" antes de tocar no fetch-post-image.
