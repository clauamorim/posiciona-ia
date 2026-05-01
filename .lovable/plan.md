## Diagnóstico

O treino na Fal **completou com sucesso** (você foi cobrado os ~$2.40), mas o nosso registro `portrait_trainings` continua `status: training` porque **o webhook nunca chegou**.

Evidências:
- `portrait-webhook` tem **zero logs** (nem 401, nem 403, nem erro) — Fal nem tentou chamar.
- `verify_jwt = false` já está configurado, então não é problema de auth.
- O treino existe no banco com `replicate_training_id = 019de2a1-0d3e-7b72-9539-f457a970833a` (request_id da Fal).

**Causa raiz:** no `portrait-train/index.ts` estamos passando o webhook via header HTTP (`"fal-webhook": webhookUrl`). A API da Fal Queue **não reconhece esse header** — o webhook precisa ir como **query param `?fal_webhook=<URL_ENCODED>`** na chamada de submit. Como não foi reconhecido, o job rodou em modo "fire and forget" e nunca nos avisou.

## Correção

### 1. `portrait-train/index.ts` — usar query param

Trocar:
```ts
const trainRes = await fetch(`https://queue.fal.run/${FAL_TRAINER_PATH}`, {
  method: "POST",
  headers: {
    Authorization: `Key ${FAL_KEY}`,
    "Content-Type": "application/json",
    "fal-webhook": webhookUrl,  // ❌ ignorado
  },
  body: JSON.stringify(trainBody),
});
```

Por:
```ts
const submitUrl = `https://queue.fal.run/${FAL_TRAINER_PATH}?fal_webhook=${encodeURIComponent(webhookUrl)}`;
const trainRes = await fetch(submitUrl, {
  method: "POST",
  headers: {
    Authorization: `Key ${FAL_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(trainBody),
});
```

Mesmo ajuste vale pra `generate-portrait/index.ts` (que também está usando o header errado, ou seja, as gerações também rodariam sem callback).

### 2. Recuperar o treino atual (`6d454014-...`) sem cobrar de novo

Como a LoRA já existe na Fal, podemos buscar o resultado direto pela API e gravar no banco — sem retreinar e sem novo custo. Duas opções:

**Opção A — recuperação manual via curl edge function (recomendado, 1 clique).** Adicionar uma função `portrait-recover` (ou uma rota dentro de `portrait-train`) que: pega `replicate_training_id`, faz `GET https://queue.fal.run/fal-ai/flux-lora-portrait-trainer/requests/<id>`, extrai `diffusers_lora_file.url`, e marca o treino como `ready`. Roda só pra esse training_id.

**Opção B — UI**: botão "Verificar treino na Fal" no `PortraitGenerator` quando `status === "training"` há mais de X minutos, chamando essa função.

Sugiro **Opção A primeiro** (resolve seu caso agora), e depois considerar B como melhoria.

### 3. Validação

1. Recuperar o treino atual via Opção A → confirmar `status: ready` e `lora_weights_url` populado.
2. Gerar um retrato pra validar o pipeline Krea + LoRA Fal end-to-end.
3. (Próximo treino que você fizer já usará a URL com `?fal_webhook=` corrigida e vai entregar callback automaticamente.)

## Risco

Baixo. A correção do query param é a forma documentada da Fal e já é o padrão do SDK oficial deles. A recuperação não cobra nada — é só um GET de status.
