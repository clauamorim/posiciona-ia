## Objetivo

Aproximar nossos retratos do resultado manual do Replicate UI (textura de pele realista, iluminação cinematográfica, microexpressão autêntica). Fazer isso replicando exatamente a fórmula que funcionou: **prompt curto + steps 35 + guidance 2.5 + LoRA peso natural + sem instruções competindo**.

## Diagnóstico do que está degradando hoje

Comparando o prompt atual vs. o manual que deu certo:

| Item | Atual (degradado) | Manual (funcionou) |
|---|---|---|
| Tamanho do prompt | ~80+ tokens, com weights | ~30 tokens, linguagem natural |
| Trigger word | Duplicado (`USR..., portrait of USR...`) | 1 vez (`TOK woman`) |
| Pesos numéricos | `(framing:1.5)`, `(outfit:1.05)` | nenhum |
| Identity reinforce phrase | 100+ tokens (`preserve exact facial features, same person, identical face...`) | nenhum |
| Negative prompt | ~60 tokens | nenhum |
| Steps | 45 | 35 |
| Guidance | 3.0–3.4 | 2.5 |
| LoRA scale | 0.86–0.92 | (default ≈0.8) |

A combinação "trigger duplicado + identity reinforce + framing weight 1.5 + outfit weight 1.05 + steps 45 + guidance 3+" está empurrando o modelo pra renderização "plástica", suavizando textura natural de pele e travando expressões.

## Mudanças propostas

### 1. `supabase/functions/_shared/portraitPrompts.ts` — reescrita do `buildPortraitPrompt`

**Estrutura nova do prompt** (linguagem natural, na ordem que o Flux respeita):

```
{trigger} {gender}, {framing simples}, {expressão+iluminação do arquétipo},
{traços físicos}, wearing {outfit}, {hair}, {makeup}, {fundo do arquétipo},
fine skin pores, natural skin texture, photorealistic,
shot on Sony A7, 85mm f/1.4, shallow depth of field
```

Mudanças concretas:

- **Remover trigger duplicado**: usar `${trigger} ${gender},` apenas uma vez no início. Sem `portrait of ${trigger}`.
- **Remover `identityPhrase`** inteiro (as 11 frases de "preserve exact facial features..."). Era ruído e redundância. O LoRA já faz esse trabalho.
- **Remover weights numéricos**: tirar `(framing:1.5)` e `(outfit:1.05)`. Substituir por linguagem natural ("tight head and shoulders portrait", "wearing tailored navy blazer").
- **Encurtar `STUDIO_PREFIX`**: virar só `professional editorial portrait,` (4 tokens em vez de 8).
- **Encurtar templates dos arquétipos**: hoje cada template tem ~20 tokens redundantes (`fine skin pores, sharp focus, photorealistic, shot on Sony A7...`). Mover esses tokens "de qualidade" para um sufixo único compartilhado, aplicado uma vez no fim. Cada template fica só com a *essência* do arquétipo (expressão + iluminação + fundo).
- **Sufixo de qualidade único** (compartilhado por todos os arquétipos):
  ```
  fine skin pores, natural skin texture, photorealistic, shot on Sony A7, 85mm f/1.4, shallow depth of field
  ```
- **Negative enxuto** — substituir `STUDIO_NEGATIVE_BASE` (~60 tokens) por:
  ```
  plastic skin, beauty filter, smoothed skin, airbrushed, deformed hands, extra fingers, deformed face, asymmetric eyes, multiple people, watermark, low quality, blurry
  ```
  Manter as adições de gênero (`man, beard...` ou `woman, makeup...`) e os negatives específicos por outfit (vestido vs. blazer etc.) — esses funcionam.
- **Manter `FRAMING_VARIATIONS`** e estratégia hands-out-of-frame, mas reescrever as instruções em linguagem natural sem peso numérico:
  - Look 0: `tight head and shoulders crop`
  - Look 1: `mid-chest editorial bust crop`
  - Look 2: `chest-up editorial portrait, shoulders subtly turned`
- **Manter `physicalTraits` injection** (`with X hair, Y skin, Z eyes`) — funciona bem e ancora identidade sem inflar prompt.

### 2. `supabase/functions/generate-portrait/index.ts` — recalibrar parâmetros

- `GUIDANCE_VARIATIONS = [2.5, 2.7, 2.9]` (era `[3.0, 3.2, 3.4]`)
- `num_inference_steps: 35` (era `45`)
- `pickLoraScale`:
  - `≤ 12 selfies` → `0.80` (era 0.86)
  - `13–20` → `0.85` (era 0.90)
  - `≥ 21` → `0.88` (era 0.92)
- Manter `aspect_ratio: "3:4"`, `megapixels: "1"`, `output_format: "png"`, `output_quality: 95`, `num_outputs: 1`.
- Adicionar log do prompt completo enviado ao Replicate (truncado em ~500 chars) pra facilitar comparação manual:
  ```ts
  console.log(`[generate-portrait] PROMPT[${i}]: ${built.prompt.slice(0, 500)}`);
  console.log(`[generate-portrait] NEGATIVE[${i}]: ${built.negative.slice(0, 300)}`);
  ```

### 3. Deploy e validação

- Deploy de `generate-portrait` (a função `_shared/portraitPrompts.ts` é importada — não precisa redeploy isolado, vai junto).
- Testar gerando uma rodada nova.
- Comparar logs do prompt gerado vs. o manual que funcionou — devem estar parecidos em forma e tamanho.

## O que NÃO muda

- Estratégia hands-out-of-frame (mantida — sem mãos = sem dedos deformados).
- Memória curta de outfits/poses.
- Sistema de pool curado de outfits por profissão.
- Storage privado, signed URLs, débito de créditos.
- Não precisa retreinar LoRA.

## Risco e mitigação

- **Risco**: prompt curto pode reduzir aderência ao arquétipo (ex.: "Governante" pode parecer só "executivo genérico"). Mitigação: cada template ainda tem 2–3 tokens identificadores fortes (ex.: "authoritative calm expression, hard directional lighting").
- **Risco**: guidance 2.5 + LoRA scale 0.80 pode reduzir fidelidade facial em casos com poucas selfies. Mitigação: traços físicos extraídos (`physicalTraits`) continuam ancorando cabelo/pele/olhos via texto.
- **Reversível**: se piorar, basta voltar os 2 arquivos ao estado atual via versão anterior.

## Resultado esperado

Retratos com a textura de pele, iluminação dramática e microexpressão do retrato manual de referência — preservando o sistema de 3 looks (Neutro/Claro/Escuro) e a identidade da pessoa via LoRA.