

# Fix: Edge Function timeout na geração da 3a semana

## Diagnóstico

A chamada da 3a semana retornou **500 após 61 segundos**. As 2 primeiras semanas funcionaram (95-97s com status 200). Causas prováveis:

1. **PDFs de referência recarregados a cada chamada** — até 5 PDFs são baixados do storage, convertidos para base64, e enviados ao Gemini em cada geração. Isso consome ~20-30s do tempo da função e infla o payload.
2. **Payload do cliente desnecessariamente grande** — `previousWeeks` envia o conteúdo completo de todas as semanas anteriores, mas a edge function só usa `theme` e `format` para o resumo.
3. **Race condition nos créditos** — leitura e escrita não-atômica do saldo.

## Correções

### 1. Edge Function (`generate-content-week/index.ts`)

- **Limitar PDFs a partir da semana 2**: A marca já foi contextualizada na semana 1. Para semanas subsequentes, pular os PDFs de referência (o StoryBrand e tom de voz já fornecem o contexto necessário).
- **Receber apenas resumo do cliente**: Aceitar `previousWeeks` mas extrair apenas `day`, `theme` e `format` no servidor (já faz isso, mas o payload de rede é grande desnecessariamente).
- **Deduction atômica de créditos**: Usar `weekly_cycles: balanceData.weekly_cycles - 1` com uma cláusula `.gt("weekly_cycles", 0)` para evitar negativos.
- **Adicionar console.error** antes do return 500 para facilitar debugging futuro.
- **Aumentar tolerância**: Adicionar retry simples (1 tentativa extra) caso a API do Gemini falhe.

### 2. Cliente (`EditorialPage.tsx`)

- **Enviar apenas resumos**: Em vez de enviar `allWeeks` completo (com legendas, scripts, card_copy), enviar apenas `theme` e `format` de cada dia para reduzir o payload de rede.

### Arquivos alterados
- `supabase/functions/generate-content-week/index.ts`
- `src/pages/EditorialPage.tsx`

