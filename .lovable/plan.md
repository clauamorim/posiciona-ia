## Plano: Créditos flexíveis para geração de retratos

### 1. Backend — `supabase/functions/generate-portrait/index.ts`

- Trocar checagem `totalCredits < GENERATE_COST_CREDITS` por `totalCredits < 1`.
- Calcular `requestedCount = Math.min(totalCredits, 3)` logo após obter `totalCredits`.
- Substituir o loop fixo `BACKGROUND_VARIATIONS.length` (=3) por `requestedCount` iterações.
- `pickPosesForLooks(family, recentlyUsedPoses, Math.max(0, requestedCount - 1))` — só pega poses para os looks 1+ (look 0 é headshot sem pose).
- `pickOutfits(family, profCategory, recentlyUsedOutfits, requestedCount)` — pega exatamente N figurinos.
- Cobrança proporcional: `charge = Math.min(requestedCount, finalPortraits.length)` (já existe lógica similar; ajustar para usar `requestedCount` em vez de `GENERATE_COST_CREDITS`).
- Mensagem de erro de créditos insuficientes: "Geração requer pelo menos 1 crédito de retrato. Você tem 0."
- Redeploy da função `generate-portrait`.

### 2. Frontend — `src/pages/PortraitGenerator.tsx`

- Computar `requestedCount = Math.min(totalPortraitCredits, 3)`.
- Botão de gerar habilitado quando `totalPortraitCredits >= 1` (em vez de `>= 3`).
- Texto dinâmico do botão: `"Gerar ${requestedCount} retrato${requestedCount > 1 ? 's' : ''} (${requestedCount} crédito${requestedCount > 1 ? 's' : ''})"`.
- Mensagem de "créditos insuficientes" ajustada para "Você precisa de pelo menos 1 crédito de retrato".
- Manter lógica de exibição: a UI já itera sobre `portraits[]` retornado, então 1 ou 2 retratos serão renderizados naturalmente.

### 3. Item "lovable.dev" no prompt de download

- **Sem alteração de código.** A caixa "Permitir downloads de **lovable.dev**" só aparece dentro do iframe de preview do editor Lovable. Em produção (`posiciona.ia.br`), o navegador exibe apenas o domínio real.
- A caixa de "múltiplos downloads" já é mitigada pelo botão **"Baixar todos (.zip)"** existente, que entrega um único arquivo.

### Arquivos editados
- `supabase/functions/generate-portrait/index.ts`
- `src/pages/PortraitGenerator.tsx`

### Sem alteração
- Schema, RLS, tabela `user_balances`, `credit_logs`, `portrait_generations`.
- Pipeline de download/upload paralelo, prompts, LoRA scale, guidance.
- Pool curado de figurinos e memória curta.
