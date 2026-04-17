
## Plano

**Contexto:** Usuário está em produção, com Price IDs `live` restaurados, mas `STRIPE_SECRET_KEY` ainda é `sk_test_...` — por isso o checkout falha. Precisa atualizar o secret para a versão `sk_live_...`.

**Bloqueio atual:** A chave secreta live não está visível no dashboard porque o Stripe só mostra uma vez na criação. Usuário precisa criar uma nova ou revelar a existente.

**Passos:**

1. **Usuário obtém a chave `sk_live_...` no Stripe Dashboard:**
   - Modo Live ativado (toggle "Test mode" desligado)
   - Developers → API keys → "Create secret key" (ou revelar a existente se possível)
   - Copiar imediatamente o valor `sk_live_...`

2. **Atualizar o secret no Lovable Cloud:**
   - Usar a ferramenta `stripe--update_stripe_secret_key` para abrir um modal seguro
   - Usuário cola a chave `sk_live_...` no modal
   - O secret `STRIPE_SECRET_KEY` é atualizado automaticamente nas Edge Functions

3. **Validar com compra real de teste:**
   - Tentar comprar um pacote de retratos ou plano
   - Verificar logs da edge function `extras-checkout` ou `stripe-checkout` para confirmar sucesso

4. **(Opcional) Adicionar validação defensiva:**
   - Edge functions podem detectar mismatch (chave `sk_test_` com Price `live`) e retornar erro claro em português, em vez do erro genérico do Stripe

**Sem mudanças de código necessárias** — só atualização do secret. Passo 4 é opcional e pode ficar para depois.
