## Diagnóstico

Os 3 retratos falharam com **HTTP 404** do Replicate:

```
create-404: {"detail":"The requested resource could not be found."}
```

O endpoint atual no código:

```
POST https://api.replicate.com/v1/models/lucataco/flux-dev-multi-lora/predictions
```

Esse formato (`/v1/models/{owner}/{name}/predictions`) só funciona para **modelos oficiais** do Replicate (ex.: `black-forest-labs/flux-dev-lora`). O `lucataco/flux-dev-multi-lora` é um modelo da **comunidade** — precisa ser chamado pelo endpoint genérico `/v1/predictions` passando o **hash da versão**.

Confirmei via API:
- Modelo existe ✓
- `latest_version.id` = `ad0314563856e714367fdc7244b19b160d25926d305fec270c9e00f64665d352`
- 1.8M runs (modelo estável e ativo)

## Fix

Em `supabase/functions/generate-portrait/index.ts`, ajustar **apenas** a função `callFluxLora` para usar o endpoint correto da versão:

**Antes:**
```ts
const FLUX_LORA_MODEL = "lucataco/flux-dev-multi-lora";
// ...
fetch(`https://api.replicate.com/v1/models/${FLUX_LORA_MODEL}/predictions`, {
  body: JSON.stringify({ input }),
});
```

**Depois:**
```ts
const FLUX_LORA_MODEL = "lucataco/flux-dev-multi-lora"; // mantido só para logs
const FLUX_LORA_VERSION = "ad0314563856e714367fdc7244b19b160d25926d305fec270c9e00f64665d352";
// ...
fetch(`https://api.replicate.com/v1/predictions`, {
  body: JSON.stringify({ version: FLUX_LORA_VERSION, input }),
});
```

## O que NÃO muda

- Stack de 2 LoRAs (`hf_loras` + `lora_scales`) — já está correto, é o formato esperado pelo `flux-dev-multi-lora`.
- Prompts, negative, guidance, steps, escalas — tudo permanece como decidido.
- Treino, banco, créditos, storage, fluxo de download/upload — intocados.

## Verificação

Após o deploy, gerar uma rodada de teste e confirmar nos logs:
- `flux-multi-lora succeeded latency=...s loraStack=[client:0.78,realism:0.45]`
- 3 imagens chegam ao bucket `portrait-outputs`

Se algum 404/422 voltar, capturar o `detail` exato para ajustar o payload (campos esperados pela versão).

## Arquivos

- `supabase/functions/generate-portrait/index.ts` — única mudança real
- `.lovable/memory/funcionalidades/retratos-marca.md` — adicionar nota: "modelo chamado via `/v1/predictions` com version hash (modelo da comunidade)"