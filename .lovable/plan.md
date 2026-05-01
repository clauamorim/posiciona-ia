## Diagnóstico atualizado

Os retratos gerados pelo Gemini (referência enviada) mostram:
- Pele com textura natural — poros visíveis, não-airbrushed
- Variação real de figurino entre as três fotos (blazer marinho/branco, malha texturizada/saia marinho, camisa azul céu/saia cinza)

Já os retratos atuais via FLUX LoRA mostram:
- Pele "plastificada" / waxy
- Repetição da mesma peça (blazer + camisa de seda) nas três fotos, mesmo o pool tendo variedade

A causa da repetição: a memória curta (`recentlyUsedOutfits`) só evita os figurinos da última geração — dentro da mesma rodada, o pool sorteia 3 itens mas não garante diversidade real entre eles (peça-âncora pode coincidir).

## Plano revisado

### 1. Manter pool de figurinos por profissão (sem ler relatório)

Manter o comportamento atual de usar `outfitPool` curado por profissão como fonte principal — apenas reforçar que **nunca pode haver repetição da mesma peça-âncora dentro da mesma rodada de 3 fotos**.

Mudanças em `supabase/functions/_shared/outfitPool.ts`:

- Adicionar metadata leve em cada item do pool: peça-âncora (`blazer`, `dress`, `cardigan`, `silk shirt`, etc.) e cor dominante.
- Atualizar `pickOutfits` para garantir, na mesma rodada:
  - 3 peças-âncora **diferentes** (ex.: 1 blazer + 1 vestido + 1 cardigã, nunca 3 blazers)
  - 3 cores dominantes **diferentes** (ex.: marinho + bege + esmeralda, nunca 3 marinho)
- Se o pool da combinação família×categoria não tiver variedade suficiente, completar com itens da família "general" da mesma família-de-arquétipo.

### 2. Reforçar negative prompts contra "voltar ao mesmo look"

Em `buildPortraitPrompt` (`portraitPrompts.ts`):

- Detectar a peça-âncora do outfit atual e adicionar negative explícito contra as outras peças que apareceriam em looks vizinhos.
- Já existe lógica parcial; ampliar para cobrir todos os casos do pool.

### 3. Combater pele plastificada (mantido do plano anterior)

Ajustes em `generate-portrait/index.ts` e `portraitPrompts.ts`:

- Reduzir `num_inference_steps` de **35 → 28**.
- Reduzir guidance: `[2.5, 3.0, 3.5]` → `[2.0, 2.4, 2.8]`.
- Reduzir levemente `lora_scale` máximo: `0.70 / 0.75 / 0.78` → `0.68 / 0.72 / 0.75`.
- Reforçar `QUALITY_SUFFIX` com termos pró-textura:
  ```
  natural skin texture, visible fine pores, subtle skin imperfections, 
  no retouching, photographed not rendered, shot on Sony A7, 85mm f/1.4, 
  shallow depth of field
  ```
- Ampliar `STUDIO_NEGATIVE_BASE`:
  ```
  plastic skin, beauty filter, smoothed skin, airbrushed skin, waxy skin, 
  porcelain skin, over-retouched face, AI beauty filter, doll-like skin, 
  heavy makeup, deformed face, deformed hands
  ```

### 4. Logs de validação

Adicionar log da peça-âncora e cor escolhidas por look para auditar variedade:

```
outfits=[{anchor:blazer, color:navy}, {anchor:dress, color:emerald}, {anchor:cardigan, color:beige}]
```

### 5. Não alterar

- Fluxo de upload, treino, créditos, histórico, download, layout, visual da página
- Texto exibido no card abaixo de cada retrato (continua usando `enToPtFashion`)
- Prioridade do pool sobre o relatório (mantida — não voltamos para `figurino.looks_completos`)

## Arquivos afetados

**Modificados:**
- `supabase/functions/_shared/outfitPool.ts` — metadata + diversidade garantida
- `supabase/functions/_shared/portraitPrompts.ts` — quality suffix + negatives mais fortes
- `supabase/functions/generate-portrait/index.ts` — guidance/steps/loraScale revistos + logs

Sem migrations. Sem mudanças de UI. Sem novos secrets.