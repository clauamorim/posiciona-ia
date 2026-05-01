# Refinamento do Pipeline de Retratos

Aplicar ajustes pontuais nos prompts e parâmetros de inferência para reforçar realismo de pele, reduzir distorções faciais e tratar corretamente cabelos grisalhos. Nenhum outro fluxo, componente ou estilo visual será modificado.

## Mudanças

### 1. `supabase/functions/_shared/portraitPrompts.ts`

**a) Substituir `QUALITY_SUFFIX` (linha 21-22)** pelo novo bloco fornecido, que adiciona descritores de microrelevo de pele, translucência, subsurface scattering e troca o grain de "kodak portra" por "fujifilm pro 400h" + "photographic skin grain".

**b) Substituir `STUDIO_NEGATIVE_BASE` (linha 25-26)** pelo novo bloco, que adiciona bloqueios para tom de pele alaranjado/amarelado, "warm skin cast", borrões dérmicos e efeito de "frequency separation".

### 2. `supabase/functions/generate-portrait/index.ts`

**a) Parâmetros globais:**
- `NUM_INFERENCE_STEPS`: 35 → **40**
- `FACE_REALISM_SCALE`: 0.40 → **0.30**
- `GUIDANCE_VARIATIONS`: `[2.6, 3.0, 3.4]` → **`[2.6, 3.0, 3.1]`**

**b) Função `pickLoraScale` (escalas do LoRA da cliente):**
- ≤ 12 selfies: 0.90 → **0.82**
- 13–20 selfies: 0.95 → **0.88**
- > 20 selfies: 1.00 → **0.95**

**c) Tratamento condicional para cabelo grisalho:**

O campo no banco é `physical_traits.hair_color` (não existe `hair_descriptor`). A detecção será feita lendo `(training as any).physical_traits?.hair_color` e fazendo match case-insensitive contra `gray`, `grey`, `silver` ou `white`.

Quando positivo, antes da chamada de `buildPortraitPrompt`, calcular sufixos:
- Positivo a anexar: `, natural salt-and-pepper highlights, not fully gray`
- Negativo a anexar: `, fully gray hair, white hair, elderly appearance`

Esses sufixos serão concatenados ao `built.prompt` e `built.negative` retornados pelo builder, antes de enviar ao `callFluxLora`. Isso evita alterar a assinatura de `buildPortraitPrompt` e mantém o tratamento isolado em `generate-portrait/index.ts`, conforme pedido.

### 3. Deploy e validação

- Deploy da edge function `generate-portrait`.
- Solicitar ao usuário que rode 1 geração (3 retratos) para validação visual antes de liberar para usuários finais.

## Não será alterado

- Pool de figurinos, poses, lógica de arquétipos/famílias.
- Modelo (`flux-dev-multi-lora`), versão, LoRA de realismo (apenas a escala muda).
- Nenhum componente de UI, rota, fluxo de créditos ou layout.
- `portraitPrompts.ts` só recebe a substituição das duas constantes — nenhuma função é tocada.

## Observação técnica

O usuário descreveu o campo como `hair_descriptor`, mas o schema real do treino (`portrait-train/index.ts`) usa `hair_color` dentro de `physical_traits`. Vou usar `hair_color` para fazer o match — semanticamente equivalente ao que foi pedido.
