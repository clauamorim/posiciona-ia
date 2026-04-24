## Resolver 429 Throttled na geração dos 3 retratos

### Causa
Conta Replicate com <$5 USD tem limite de 6 req/min com burst 1. O delay atual de 1.2s entre chamadas é insuficiente — a 2ª e 3ª chamadas falham com `429 Throttled`, por isso só 1 retrato é entregue.

### Mudanças

**1. `supabase/functions/generate-portrait/index.ts`**
- Aumentar delay entre as 3 chamadas sequenciais: `1200ms` → `11000ms` (respeita 6 req/min)
- Adicionar retry automático em caso de 429: detectar `create-429` no `reason`, aguardar `30000ms` e tentar novamente 1 vez
- Manter cobrança proporcional (apenas retratos bem-sucedidos)

**2. `src/pages/PortraitGenerator.tsx`**
- Atualizar mensagem de loading: "Gerando seus 3 retratos... Isso leva cerca de 1 minuto."
- Reflete o tempo real (~35s geração + 22s de espaçamento + retries eventuais)

### Resultado esperado
- Os 3 retratos voltam consistentemente (Neutro/Claro/Escuro), cada um com look diferente do relatório
- Tempo total: ~50-70s
- Sem necessidade de adicionar crédito no Replicate (mas $5+ removeria essas restrições e permitiria voltar para delays curtos)

### Sem mudanças
- Lógica de créditos, banco, prompts, treino existente, UI da galeria
