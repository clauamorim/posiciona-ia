

## Atualizar `REPLICATE_API_TOKEN`

Vou disparar o fluxo seguro de atualização do secret `REPLICATE_API_TOKEN` para você colar o token novo gerado no Replicate.

### O que vai acontecer
1. Abro o modal de update do secret `REPLICATE_API_TOKEN`.
2. Você cola **apenas** o token (começa com `r8_`, sem `Bearer`, sem aspas, sem espaços).
3. O secret é atualizado no ambiente das edge functions imediatamente — sem deploy, sem mudança de código.

### Antes de colar o token
- Logue em [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens) **na mesma conta** que tem o cartão em [replicate.com/account/billing](https://replicate.com/account/billing).
- Clique em **Create token**, dê um nome (ex: `posiciona`) e copie o valor inteiro.

### Validação após atualizar
- Gere um retrato de teste em `/portrait`.
- Resultado esperado: retrato gerado **sem** o toast de "provedor principal indisponível".
- Se ainda cair no fallback, eu consulto os logs da `generate-portrait` para ver a nova razão (deve mudar de `replicate-create-401` para outra coisa, ou desaparecer).

### Arquivos
Nenhum. É só atualização de secret.

