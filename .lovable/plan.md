# Texto sempre no topo no editor de posts

## Problema
Hoje, no `PostCanvas`, a ordem visual ranqueia: foto de fundo (0) → moldura (1) → textos (2) → barra/losango decorativo (3) → demais overlays (4). Resultado: decorativos e elementos adicionais ficam acima do título/corpo, dificultando o clique nas caixas de texto.

## Mudança
Alterar a função `sortByVisualLayer` em `src/components/post-editor/PostCanvas.tsx` para que **as caixas de texto (`text-title`, `text-body`) fiquem sempre no rank mais alto**, garantindo que o usuário consiga selecioná-las clicando, mesmo quando há decorativos/elementos sobre elas.

Nova hierarquia:
```text
0 → fotos de fundo (tpl-bg-*)
1 → molduras (tpl-mframe / tpl-frame)
2 → demais overlays (decorativos, ícones, fotos avulsas, logos)
3 → barra/losango decorativos (tpl-mline / tpl-mornament)
4 → caixas de texto (título e corpo) ← SEMPRE NO TOPO
```

Além disso, aplicar a mesma invariante de segurança que já existe para `tpl-bg-*`: **mesmo após o usuário usar "Frente / Trás" em outros elementos, as caixas de texto continuam forçadas para o topo da pilha**. "Frente/Trás" continua valendo normalmente para os demais elementos entre si.

## Detalhes técnicos
Arquivo único: `src/components/post-editor/PostCanvas.tsx`

1. Em `sortByVisualLayer` (≈linha 609), inverter prioridade: textos passam a ser rank 4 (topo), `tpl-mline/mornament` viram rank 3, demais overlays rank 2.
2. No `effectiveRenderOrder` (≈linha 625), adicionar passo final análogo ao dos backgrounds: separar `textIds = merged.filter(isTextBoxId)` e devolver `[...bgs, ...rest, ...textIds]` para garantir que o topo seja sempre o texto.
3. Não mexer em `getZIndex`, drag, resize, halo nem text-shadow — apenas a ordem.

## Impacto / regressões
- "Frente / Trás" no texto deixa de ter efeito visual relativo (texto sempre fica acima). Aceitável: o objetivo do usuário é justamente garantir a seleção.
- Decorativos do template minimal (linha + losango) passam a ficar atrás do texto. Como o losango/linha são posicionados abaixo do bloco de texto, na prática segue invisível a sobreposição.
- Sem mudança em fontes, cores, persistência ou export PNG (o html2canvas respeita a mesma ordem DOM/z-index).

## Fora de escopo
- Carregamento de fonte do template
- Cor do texto sobre foto
- Imagens genéricas de carrossel
