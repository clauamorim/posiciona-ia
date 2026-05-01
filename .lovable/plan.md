## Diagnóstico

### Fundos com elementos de cenário
Os prompts dos arquétipos (em `_shared/portraitPrompts.ts`, `ARCHETYPE_PROMPTS`) descrevem fundos variados que **não são fundo de estúdio**:
- Criador: **"weathered artistic background"** ← cenário
- Herói: **"dark stone background"** ← cenário (pedra)
- Explorador: **"earthy textured background"** ← cenário/exterior
- Amante: **"deep warm terracotta background"**
- Rebelde: **"raw industrial background"** ← cenário industrial
- Bobo-da-corte: **"warm colorful background"**
- demais: "dark background", "warm beige background", "mysterious dark background", etc.

Daí o Gemini interpreta "industrial", "stone", "weathered", "artistic" como autorização para encher o fundo de paredes de tijolo, equipamentos, móveis, plantas etc.

A variação `BACKGROUND_VARIATIONS` (Neutro/Claro/Escuro) também usa termos vagos ("warm light background", "dark moody background") — não é estúdio.

### Histórico
Investigado: `generate-portrait` salva em `portrait_generations.portraits` **exatamente os mesmos retratos retornados à tela** — não há retratos "extras" gerados ocultamente. O que acontece é que cada clique em "Gerar" cria uma nova linha, e o histórico empilha tudo, inclusive gerações antigas com alucinações. Hoje não existe forma de a usuária descartar um retrato ruim do histórico.

## Mudanças propostas

### 1. Substituir TODOS os fundos por "paper backdrop" de estúdio em paleta neutra

Em `supabase/functions/_shared/portraitPrompts.ts`:

**Restrição cromática (regra universal):** APENAS tons de **cinza** (claro, médio, grafite, carvão), **marrom** (taupe, café, mocha, sépia) e **preto**. Sem terracota, sem mostarda, sem rosa, sem verde, sem azul, sem creme/marfim quente, sem qualquer cor saturada.

**a)** Reescrever `ARCHETYPE_PROMPTS` para que o fundo seja sempre **seamless paper studio backdrop**, variando apenas dentro da paleta neutra:
- Governante: `"deep charcoal seamless paper studio backdrop with subtle paper texture"`
- Sábio: `"dark grey seamless paper studio backdrop with subtle paper texture"`
- Cuidador: `"warm taupe seamless paper studio backdrop with subtle paper texture"`
- Criador: `"sepia brown seamless paper studio backdrop with subtle paper texture"`
- Herói: `"black seamless paper studio backdrop with subtle paper texture"`
- Explorador: `"mocha brown seamless paper studio backdrop with subtle paper texture"`
- Inocente: `"light grey seamless paper studio backdrop with subtle paper texture"`
- Cara-comum: `"medium grey seamless paper studio backdrop with subtle paper texture"`
- Mago: `"deep black seamless paper studio backdrop with subtle paper texture"`
- Amante: `"warm dark brown seamless paper studio backdrop with subtle paper texture"`
- Rebelde: `"matte black seamless paper studio backdrop with subtle paper texture"` (sem "industrial")
- Bobo-da-corte: `"warm grey seamless paper studio backdrop with subtle paper texture"` (sem "colorful")

**b)** Reescrever `BACKGROUND_VARIATIONS`:
- Neutro: mantém o paper do arquétipo
- Claro: `"light grey seamless paper studio backdrop with subtle paper texture,"`
- Escuro: `"deep charcoal seamless paper studio backdrop with subtle paper texture,"`

**c)** No `buildGeminiPortraitPrompt`, adicionar bloco **STUDIO BACKDROP LOCK** logo antes do "Scene direction":
```
### STUDIO BACKDROP LOCK ###
Background must be a clean professional photo studio with a seamless paper backdrop only. Subtle paper texture and a soft light gradient are allowed. Color palette is STRICTLY neutral: shades of grey, brown and black only. ABSOLUTELY NO saturated colors, NO terracotta, NO mustard, NO pink, NO green, NO blue, NO cream, NO ivory. ABSOLUTELY NO props, NO furniture, NO brick walls, NO concrete, NO wood panels, NO windows, NO plants, NO bookshelves, NO studio equipment in frame (no softboxes, no light stands, no tripods, no cables, no reflectors), NO outdoor scenery, NO architectural elements, NO patterns, NO text. Just the subject in front of a clean neutral textured paper backdrop.
```

**d)** Reforçar no bloco "AVOID at all costs":
`"; colorful background, saturated background, terracotta background, mustard background, pink background, green background, blue background, cream background, ivory background, visible studio equipment, softbox in frame, light stand, tripod, cables, reflector, brick wall, concrete wall, wood panel, bookshelf, furniture, props, plants, window, outdoor scenery, architectural background, busy background, patterned background"`.

### 2. Permitir descartar retratos com alucinação do histórico

Hoje o histórico mostra tudo. Ajuste para a usuária **escolher quais ficam salvos**.

**a)** Migration: adicionar coluna `kept_indices INTEGER[]` em `portrait_generations` (default = todos os índices). Descartar = remover o índice desse array (oculta no histórico; arquivo permanece no storage por enquanto).

**b)** Edge function `portrait-history`: filtrar para retornar só retratos cujo índice está em `kept_indices`. Se vazio, esconder a geração inteira.

**c)** Nova edge function `portrait-discard`: recebe `{ generation_id, index }`, valida ownership, remove o índice de `kept_indices`.

**d)** UI `src/pages/PortraitGenerator.tsx` — na grade "Retratos Gerados" e no `PortraitPreviewDialog`, adicionar botão **"Descartar do histórico"** com confirmação. Após descartar: remove da tela, chama `portrait-discard`, exibe toast "Retrato removido do histórico".

**e)** Página de histórico (`HistoryPage.tsx`): mesmo botão "Descartar" em cada thumbnail.

### 3. Microcopy

Atualizar `"Salvo no histórico · Download gratuito"` em `PortraitPreviewDialog` para `"Salvo no histórico · Você pode descartar a qualquer momento"`.

## Não muda

- Modelo (Gemini 3 Pro Image), cobrança de créditos, identidade/cabelo/poses/figurino, fluxo de upload de selfies.
- Retratos já no histórico continuam visíveis até a usuária descartar.

## Validação

1. Gerar nova série para arquétipos "problema" (Rebelde, Explorador, Criador, Amante) e confirmar fundo paper neutro (cinza/marrom/preto), sem cenário, sem equipamento, sem cor saturada.
2. Descartar um retrato do histórico e recarregar: o retrato não aparece mais.
3. Descartar todos de uma geração: a geração some do histórico.
