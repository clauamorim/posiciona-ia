

## Plano: Habilitar modo de teste Stripe e validar fluxo end-to-end

### Decisão
Você concorda em colocar o Stripe em modo test agora. Vou usar a **Opção A** (criar produtos via API) — mais seguro, rápido e rastreável. No final, eu reverto tudo para live mode quando você me pedir.

### Garantia de reversão
Antes de qualquer mudança, vou:
1. Listar todos os `stripe_price_id` atuais (live) na tabela `plans` e nos arquivos hardcoded.
2. Salvar esse mapeamento num bloco no topo deste plano (e numa nota de tarefa) para reverter sem erro.

Quando você me disser "voltar para produção", eu:
- Restauro a `STRIPE_SECRET_KEY` para `sk_live_...` (você cola novamente).
- Reverto cada `stripe_price_id` para o valor live original.
- Removo/atualizo o webhook de teste se necessário.

### Etapas

**1. Snapshot dos price_ids live (antes de mexer)**
- Leio `plans` no banco e os mapas hardcoded em `extras-checkout`, `portrait-pack-checkout`, `upgrade-checkout`.
- Documento aqui: `plan slug → live price_id`.

**2. Trocar a chave secreta**
- Você ativa **Test mode** no [dashboard Stripe](https://dashboard.stripe.com), vai em **Developers → API keys** e copia a `sk_test_...`.
- Eu abro o modal seguro para você colar.

**3. Criar produtos e preços test via API**
- Crio no Stripe (test) os mesmos produtos com mesmos valores e intervalos:
  - Planos recorrentes (Essencial, Profissional, Estúdio — slugs reais que eu vou levantar do banco).
  - Pacotes de retrato (one-time).
  - Semana extra (one-time).
  - Upgrades (se forem produtos separados).
- Atualizo `plans.stripe_price_id` na tabela e os mapas hardcoded nas edge functions com os novos `price_test_...`.

**4. Configurar o webhook em test mode**
- No dashboard Stripe (test mode) → **Developers → Webhooks**, você adiciona endpoint apontando para a mesma URL do `stripe-webhook` atual:
  `https://opmheegtmdjqwrfkdboq.supabase.co/functions/v1/stripe-webhook`
- Eventos: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`, `customer.subscription.updated`.
- Você copia o novo **signing secret** (`whsec_test_...`) — eu abro modal para atualizar `STRIPE_WEBHOOK_SECRET`.

**5. Testar end-to-end (eu te oriento na hora)**
Cartões de teste:
- Sucesso: `4242 4242 4242 4242` (qualquer CVC, validade futura).
- Recusado: `4000 0000 0000 0002`.
- 3D Secure: `4000 0027 6000 3184`.

Fluxos a validar (escolheremos juntos quais cobrir — sugiro começar pelos 3 críticos):
- ☐ Assinatura nova de plano.
- ☐ Upgrade entre planos.
- ☐ Compra de semana extra.
- ☐ Compra de pack de retratos.
- ☐ Cupom (se aplicável).

A cada teste eu verifico:
- Logs do `stripe-webhook` (recebeu o evento?).
- Tabelas `subscriptions`, `user_balances`, `credit_logs` (créditos liberados?).
- UI do dashboard (refletiu corretamente?).

**6. Reversão para live (quando você decidir)**
- Você cola `sk_live_...` no modal.
- Eu restauro todos os `stripe_price_id` para os live originais.
- Você reativa o webhook live (ou confirma que ele continua ativo) e cola o `whsec_live_...`.

### Avisos importantes
- Enquanto estivermos em test mode, **nenhum pagamento real funciona** no app em produção (`posiciona.ia.br`). Idealmente faça o teste numa janela em que isso seja aceitável.
- Os clientes que tentarem pagar nesse intervalo vão para o "espelho" de teste e não geram receita.
- Sugiro fazer o teste agora à noite ou em horário de baixo tráfego.

### Arquivos afetados (durante o teste)
| Arquivo | Mudança temporária |
|---------|--------------------|
| Tabela `plans` (DB) | `stripe_price_id` → versão test |
| `supabase/functions/extras-checkout/index.ts` | mapa de price_ids → versões test |
| `supabase/functions/portrait-pack-checkout/index.ts` | mapa de price_ids → versões test |
| `supabase/functions/upgrade-checkout/index.ts` | mapa de price_ids → versões test |
| Secret `STRIPE_SECRET_KEY` | `sk_live_...` → `sk_test_...` |
| Secret `STRIPE_WEBHOOK_SECRET` | live → test |

Tudo será revertido no fim. Sem mudanças em schema, lógica de créditos, UI ou cálculo de cobrança — só os identificadores e a chave.

### Próxima ação
Aprove esse plano e eu já começo pela **Etapa 1** (snapshot dos price_ids live) antes de te pedir a `sk_test_...`.

