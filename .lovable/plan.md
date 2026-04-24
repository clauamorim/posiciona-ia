

## Retratos com LoRA — prompts oficiais por arquétipo (atualização do plano)

Confirmo: vou usar **exatamente** os 12 prompts e seus negativos como você enviou, sem reescrever, sem otimizar, sem traduzir. As regras de substituição também serão aplicadas exatamente como descritas.

### Substituição dos marcadores (regras finais)

- `USR[id]` → `USR` + `user.id` completo (UUID inteiro, sem truncar). Ex: `USRf3a2c1b0-1234-5678-9abc-def012345678`
- `[gender]` → `woman` (Feminino) | `man` (Masculino) | sem substituição se outro/null (remove o marcador limpando vírgula dupla)
- `[outfit]` → `reports.content.figurino` (texto consolidado: peças-chave + cores se disponível)
- `[hair]` → `reports.content.figurino.penteado` **só se mulher**; senão remove
- `[makeup]` → `reports.content.figurino.maquiagem` **só se mulher**; senão remove

Após substituições, função de limpeza:
- Remove sequências `, ,` → `,`
- Remove `,  ` → `, `
- Remove espaços duplos
- Remove vírgula órfã antes de quebra de linha

### 3 chamadas sequenciais (1 retrato por look)

A geração de "3 retratos" faz 3 chamadas ao Replicate, uma por background:

1. **Neutro** — prompt do arquétipo **sem nenhuma alteração no fundo** (mantém a descrição original de "textured studio background...")
2. **Claro** — substitui a frase de fundo do arquétipo pela linha:
   `warm light textured studio background, soft warm tones`
3. **Escuro** — substitui a frase de fundo do arquétipo pela linha:
   `dark moody textured studio background, deep shadow tones`

A "frase de fundo" é identificada por regex como o trecho que começa em palavra-chave de fundo (ex: `dark textured studio background...`, `warm dark textured studio background...`, etc.) até a próxima vírgula que precede `[outfit]`. Caso o regex falhe em algum arquétipo, fallback é prepend da nova frase de fundo + manter a original (registrado em log para ajuste).

Cada chamada usa o `negative_prompt` do arquétipo correspondente, **inalterado** nos 3 looks.

### Mapeamento arquétipo → prompt

Arquivo novo `supabase/functions/_shared/portraitPrompts.ts` exporta:

```ts
export const ARCHETYPE_PROMPTS: Record<ArchetypeName, { prompt: string; negative: string }> = {
  "Governante": { prompt: "...", negative: "..." },
  "Sábio": { ... },
  "Cuidador": { ... },
  "Criador": { ... },
  "Herói": { ... },
  "Explorador": { ... },
  "Inocente": { ... },
  "Cara-comum": { ... },
  "Mago": { ... },
  "Amante": { ... },
  "Rebelde": { ... },
  "Bobo-da-corte": { ... },
};
```

Os nomes são os mesmos já usados em `user_top_archetypes.archetype_name` (ver `src/lib/archetypes.ts`). Lookup é direto pelo nome do arquétipo primário (`rank=1`).

### Resto do plano permanece como aprovado

- LoRA treinada uma vez por usuário via `ostris/flux-dev-lora-trainer` (1500 steps, lr 0.0004, autocaption true, batch 1)
- Treino: 1 grátis por mês para assinaturas mensais; extra = 4 créditos de retrato
- Geração: 3 retratos (Neutro/Claro/Escuro), 3 créditos de retrato, 1 linha em `portrait_generations`
- Webhook público (`verify_jwt = false`) com token HMAC na querystring
- Tabela nova `portrait_trainings`, bucket `portrait-inputs` (privado)
- Etapa 1 (validação técnica): backend completo + UI mínima na `/portraits`
- Etapa 2 (após sua validação visual): UI premium polida
- Histórico antigo intacto, fluxo single-shot atual será removido após validação

### Parâmetros de geração no Replicate

Modelo de inferência: `black-forest-labs/flux-dev-lora` com `extra_lora` apontando para `output.weights` do treino.

Por chamada:
```
prompt: <prompt do arquétipo com substituições + ajuste de fundo>
negative_prompt: <negative do arquétipo>
num_outputs: 1
aspect_ratio: "3:4"
guidance_scale: 2.5
num_inference_steps: 35
lora_scale: 1.0
output_format: "png"
seed: <random>
```

### Secret necessário

- `WEBHOOK_SECRET` — string aleatória 32+ chars (vou pedir via `add_secret` no início da implementação)

### Validação no checkpoint Etapa 1

Você vai:
1. Treinar 1 LoRA real (consome o grátis ou 4 créditos)
2. Aguardar ~20 min
3. Clicar "Gerar 3 retratos" → verificar que os 3 looks vêm com prompts diferentes apenas no fundo, e que o seu rosto está fiel

Se aprovado, parto para Etapa 2 (UI completa).

