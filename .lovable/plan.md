## Problema

No editor de posts, a **barra horizontal** (`tpl-mline`) e o **losango** (`tpl-mornament`) que aparecem nos designs ficam atrás das frases e acabam sobrescritos quando o texto é mais longo do que o estimado.

## Causa raiz (duas camadas do problema)

Investiguei `src/components/post-editor/PostCanvas.tsx` e `src/lib/postTemplates.ts` e identifiquei dois fatores combinados:

1. **Ordem de camadas força decorações atrás do texto.** Em `PostCanvas.tsx` (linhas 466-480), há um `sortByVisualLayer` que atribui rank fixo:
   - `0` = foto de fundo
   - `1` = decorações (`mframe`, `mline`, `mornament`) ← barra e losango
   - `2` = textos (título e corpo)
   - `3` = demais overlays
   
   Ou seja, **o texto sempre é desenhado por cima** da barra e do losango, mesmo quando se sobrepõem visualmente.

2. **Posição da barra/losango usa estimativa imprecisa.** Em `postAutoLayout.ts` (linhas 549-554), o `bodyBottomY` é calculado como `fontSize × 1.6 × 4 linhas` — uma estimativa fixa de 4 linhas. Quando o corpo do texto quebra em 5+ linhas (caption mais longa, fonte maior), o texto invade a região da barra/losango.

A moldura (`mframe`) raramente é afetada porque fica na borda; já a barra e o losango ficam logo abaixo do bloco de texto e são exatamente os que sofrem.

## Solução proposta

### 1. Mudar a ordem de camadas: barra e losango passam para a frente do texto

Em `src/components/post-editor/PostCanvas.tsx`, ajustar `sortByVisualLayer` para separar a moldura (que deve continuar atrás) dos elementos pontuais (barra e losango), que devem ficar **acima do texto**:

- `0` = foto de fundo (full-cover)
- `1` = moldura (`tpl-mframe`) — continua atrás de tudo
- `2` = textos (título e corpo)
- `3` = barra e losango (`tpl-mline`, `tpl-mornament`) — agora **na frente** do texto
- `4` = demais overlays

Isso garante que a barra fina e o losango decorativo nunca sejam tampados por uma frase mais longa.

### 2. Melhorar a estimativa de `bodyBottomY` para reduzir colisões

Em `src/lib/postAutoLayout.ts`, ampliar a folga de linhas usada na estimativa (de 4 para 5-6 linhas, dependendo do formato), para que a barra já nasça em uma posição mais segura abaixo do bloco de corpo. Mesmo com o item 1 resolvendo o "tampar visual", manter a barra em posição limpa é importante para a estética.

### 3. Preservar a possibilidade do usuário reorganizar manualmente

A lógica de "trazer para frente / mandar para trás" no painel de seleção continua funcionando. A reordenação automática só é aplicada quando o usuário ainda não mexeu manualmente nas camadas (o código já preserva `externalRenderOrder` quando existe).

## Arquivos afetados

- `src/components/post-editor/PostCanvas.tsx` — ajustar ranks em `sortByVisualLayer` (separar `mframe` de `mline`/`mornament`).
- `src/lib/postAutoLayout.ts` — aumentar a folga na estimativa de `bodyBottomY`.

## Resultado esperado

- A barra e o losango aparecem **sempre visíveis**, mesmo quando o texto é mais longo do que o esperado.
- A moldura externa continua atrás (comportamento correto, ela emoldura tudo).
- Designs já existentes que o usuário tenha customizado manualmente preservam a ordem que ele definiu.
