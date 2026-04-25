
## Diagnóstico dos problemas

Analisando os retratos enviados (cabelo curto vs comprido, loira vs morena, três mãos) e o código atual, identifiquei 4 causas combinadas:

1. **`autocaption: true`** no treino → o trainer da Replicate gera legendas automáticas inconsistentes (varia "woman with long brown hair" e "person"), então o LoRA não fixa cabelo, cor nem gênero.
2. **`lora_scale: 0.85`** na inferência → fidelidade baixa, o modelo inventa traços.
3. **Negative prompt fraco** (`extra fingers, asymmetric eyes`) → não bloqueia "três mãos", "membros extras", "rostos duplicados".
4. **Figurinos**: o código já tem `buildOutfitTextForLook(figurino, i)` com round-robin. **Funciona se `looks_completos` existir**. Vou verificar e logar para garantir que os 3 looks do relatório cheguem ao Flux.

Sem campos manuais no cadastro: extraio cabelo/pele/gênero direto das selfies de treino com Gemini Vision.

---

## Etapa 1 — Schema (migration)

Adicionar coluna em `portrait_trainings`:

| Campo | Tipo | Descrição |
|---|---|---|
| `physical_traits` | jsonb | `{ gender, hair_color, hair_length, skin_tone, eye_color }` extraídos das selfies |

Sem retrocompatibilidade — quem treinar a partir de agora terá os traços; treinos antigos continuam funcionando com prompts mais fracos (mas serão re-treinados no próximo teste).

---

## Etapa 2 — `supabase/functions/portrait-train/index.ts`

Antes de subir o ZIP para o Replicate, chamar **Gemini Vision** (`google/gemini-2.5-flash`) com 3 selfies aleatórias do batch:

**Prompt (PT, retorno JSON):**
```
Analise as fotos e devolva APENAS JSON com:
{
  "gender": "woman" | "man",
  "hair_color": "<descrição curta em inglês: brown, dark brown, blonde, black, red, grey>",
  "hair_length": "<short | medium | long | very long>",
  "hair_style": "<straight | wavy | curly | coily>",
  "skin_tone": "<descrição curta em inglês: fair, light, medium, olive, tan, brown, dark brown, deep>",
  "eye_color": "<brown | dark brown | hazel | green | blue | grey>"
}
```

Salvar em `portrait_trainings.physical_traits`.

**Mudanças no input do Replicate:**
- Trocar `autocaption: true` por:
  - `autocaption: false`
  - `autocaption_prefix: "a photo of USR<id>, a {gender} with {hair_length} {hair_style} {hair_color} hair, {skin_tone} skin"`
- Manter `steps: 1000`, `lora_rank: 16`, `learning_rate: 0.0004`.

Se a extração Gemini falhar (timeout/erro), cair de volta para `autocaption: true` e logar — não quebra o treino.

---

## Etapa 3 — `supabase/functions/_shared/portraitPrompts.ts`

**3.1 Negative prompt anti-anatomia** (`STUDIO_NEGATIVE`):
```
, outdoor, street, natural daylight, trees, buildings, sky, park, beach, low quality, blurry, deformed face, extra fingers, asymmetric eyes, extra arms, extra hands, three hands, four hands, mutated hands, deformed hands, extra limbs, missing limbs, fused fingers, disfigured, malformed, duplicate, two heads, cloned face, bad anatomy
```

**3.2 Reforço de gênero no negative** (gerado dinamicamente em `buildPortraitPrompt`):
- Se `gender === "woman"`: append `, man, beard, mustache, masculine features` ao negative.
- Se `gender === "man"`: append `, woman, feminine features, makeup, lipstick` ao negative.

**3.3 Injeção dos traços físicos extraídos no prompt:**

Adicionar parâmetro opcional `physicalTraits` em `BuildPromptParams`. Quando presente, injetar uma frase logo após `[gender]`:
```
USR<id> woman with long wavy brown hair and olive skin, brown eyes, ...
```

Isso ancora os traços contra deriva do LoRA, mesmo com `lora_scale` alto.

**3.4 Duplicação de gênero**: trocar `[gender]` por `{gender} portrait of a {gender}` para reforçar o token (técnica conhecida em Flux para evitar troca de gênero).

---

## Etapa 4 — `supabase/functions/generate-portrait/index.ts`

**4.1 Inference tuning:**
- `lora_scale: 0.95` (era 0.85)
- `guidance_scale: 3.5` (era 3.0)
- `num_inference_steps: 40` (era 35)

**4.2 Carregar `physical_traits`** ao buscar o training:
```ts
.select("id, lora_weights_url, trigger_word, status, physical_traits")
```

E passar para `buildPortraitPrompt({ ..., physicalTraits: training.physical_traits })`.

**4.3 Auditar figurinos** — adicionar log explícito por chamada:
```
[generate-portrait] call 1/3 background=neutro outfit="<texto exato>" hair="..." traits=<traits>
```

Para confirmar que `looks_completos[0|1|2]` está sendo usado e não caindo no fallback. Se o relatório tiver < 3 looks, o round-robin já cuida disso, mas o log vai expor o problema se existir.

**4.4 Garantia mínima de 3 figurinos distintos**: se `looks_completos.length < 3`, gerar variações sintéticas baseadas nas `pecas_chave` + descritores (`smart casual blazer`, `elegant blouse`, `structured outerwear`) para que cada chamada tenha figurino diferente, em vez de repetir o look 0.

---

## Etapa 5 — Deploy

Ordem de deploy:
1. Migration (`physical_traits` em `portrait_trainings`).
2. `portrait-train` (extração + caption_prefix).
3. `_shared/portraitPrompts.ts` (negative reforçado + injeção de traços).
4. `generate-portrait` (scales aumentadas + traits + logs).

Como você é a única testadora, depois do deploy basta:
1. Apagar o treino atual e refazer (gasta os 4 créditos ou usa o grátis mensal).
2. Gerar 3 retratos novos.
3. Validar fidelidade + 3 figurinos distintos nos logs.

---

## Garantias preservadas

- Estrutura de prompt por arquétipo (`ARCHETYPE_PROMPTS`) **não muda** — apenas recebe traços extras.
- 3 backgrounds (Neutro/Claro/Escuro) continuam.
- Round-robin de figurinos do relatório continua.
- Cobrança de crédito por imagem bem-sucedida continua.
- Fluxo de webhook + reembolso em falha continua.
- Sem campos novos no cadastro do usuário.

## Fora de escopo

- Re-extração de traços para usuários antigos (você confirmou: só você está testando).
- Mudança no UI de cadastro.
- Re-treino automático de LoRAs antigos.
- Mudança no modelo de inferência (continua `black-forest-labs/flux-dev-lora`).
