

# Fix: Mostrar valor correto no modal de upgrade

## Problema
O `PreCheckoutModal` de upgrade mostra o preço cheio do plano (ex: R$ 497 para Autoridade Total), mas o valor real cobrado é complementar/proporcional. O Stripe calcula corretamente, mas o modal induz erro.

## Cenários de upgrade

| De → Para | Dentro de 7 dias | Após 7 dias |
|-----------|------------------|-------------|
| Semana (R$197) → Presença (R$297) | R$ 100 (único) | R$ 297/mês (assinatura normal) |
| Semana (R$197) → Autoridade (R$497) | R$ 300 (único) | R$ 497/mês (assinatura normal) |
| Presença (R$297) → Autoridade (R$497) | Proporcional via Stripe (sem checkout page) | — |

## Solução

### 1. Ajustar o modal de upgrade em `ChoosePlan.tsx`

Para upgrades a partir do Semana de Conteúdo, calcular o preço exibido:
- **Dentro de 7 dias**: mostrar o valor com desconto (preço do plano destino - 197). Ex: "R$ 100" ou "R$ 300", com descrição "Valor complementar (R$ 197 já descontados)" e billing "one_time"
- **Após 7 dias**: mostrar o preço cheio como assinatura recorrente normal

Para isso, usar a data de criação da subscription (já disponível no contexto via `subscription`) para determinar se está dentro dos 7 dias.

### 2. Upgrade Presença → Autoridade

Este caso usa `proration_behavior: "always_invoice"` diretamente no Stripe (sem redirect para checkout page). O modal deve informar: "A diferença será cobrada proporcionalmente na sua próxima fatura" em vez de mostrar um preço fixo.

### 3. Ajustar `PreCheckoutModal`

Adicionar prop opcional `description` para exibir texto contextual como "Valor complementar (R$ 197 já descontados)" ou "Cobrado proporcionalmente".

### Arquivos alterados
- `src/pages/ChoosePlan.tsx` — lógica de cálculo do preço de upgrade e descrição contextual
- `src/components/PreCheckoutModal.tsx` — já suporta `description`, apenas garantir que está sendo usado

