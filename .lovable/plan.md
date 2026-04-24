

## Resolver "provedor principal indisponível" — comprar créditos no Replicate

### Diagnóstico
O erro mudou de `401 Unauthenticated` para `402 Insufficient credit`. Isso significa:
- Token está correto e autenticado
- A conta Replicate associada ao token **não tem saldo**
- Replicate **não cobra automaticamente** o cartão por uso — você precisa comprar créditos antecipadamente (modelo pré-pago)

### O que você precisa fazer (fora do Lovable)
1. Acessar [replicate.com/account/billing](https://replicate.com/account/billing#billing)
2. Confirmar que está logado **na mesma conta** onde gerou o `REPLICATE_API_TOKEN`
3. Em **"Billing"**, comprar créditos (mínimo costuma ser US$ 10)
   - Opcional: ativar **"Auto-recharge"** para recarregar automaticamente quando o saldo cair abaixo de um limite (evita cair no fallback Gemini de novo)
4. Aguardar 1-2 minutos após a compra para o saldo propagar

### O que vou fazer no código (após sua confirmação)
Nada. **Não há mudança de código necessária** — o sistema já está correto:
- Flux é chamado primeiro
- Em caso de falha (incluindo 402), cai automaticamente no Gemini
- O contador de créditos do usuário é debitado normalmente em ambos os casos

A correção é 100% na sua conta do Replicate.

### Validação
Após comprar os créditos:
1. Você gera 1 retrato de teste em `/portraits`
2. Resultado esperado: retrato gerado **sem** o aviso de "provedor principal indisponível"
3. Se ainda aparecer o aviso, eu consulto os logs novamente — a razão deve ter mudado de `replicate-create-402` para outra coisa (ou desaparecer)

### Custo de referência
- `multi-image-kontext-pro`: ~US$ 0,04 por retrato
- US$ 10 de crédito = ~250 retratos
- Auto-recharge recomendado em US$ 5 → +US$ 10

### Observação sobre o fallback
Enquanto o Replicate estiver sem crédito, o sistema continua funcionando via Gemini (fallback) — só que o resultado tem a qualidade visual inferior que motivou a troca para Flux. Comprar crédito resolve definitivamente.

