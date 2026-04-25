# Plano final — Qualidade do relatório + Controle de custo

## Objetivo
Voltar a usar o Claude Sonnet 4.5 para gerar relatório e linha editorial com profundidade real, mas garantindo **uma única chamada paga por tentativa** (sem retries automáticos, sem refinamentos paralelos).

## Causa raiz dos problemas atuais
1. **Relatório raso**: `process-report-generation-job` usa `buildDeterministicReport` (template fixo, sem IA) — coloquei isso como "safe mode" na iteração anterior pra parar o loop. É a razão dos 7 posts iguais e do conteúdo genérico.
2. **Cobranças duplicadas no Claude**: `process-content-generation-job` faz:
   - 1 retry automático em caso de falha (linha ~159)
   - Até 7 chamadas paralelas de "refinamento de leaks" (linhas ~190-230) usando `Promise.allSettled`
   Cada uma cobra tokens. Quando dá timeout, todas elas já foram cobradas.
3. **Aviso "atualizar semana"**: a `generator_version` muda a cada deploy do prompt — comportamento esperado, mas confuso.

## Mudanças

### 1. `supabase/functions/process-report-generation-job/index.ts`
- **Reativar Claude Sonnet 4.5** como caminho principal usando `callClaude` com:
  - `disableRetries: true` (1 chamada por tentativa, sem cobrança dupla)
  - `max_tokens: 6000` (reduz latência e risco de timeout)
  - `timeoutMs: 140000` (margem dentro do limite de 150s do worker em background)
- Manter `buildDeterministicReport` **apenas como fallback de última instância** se o Claude falhar. Marcar `is_fallback: true` no `result` pra UI sinalizar.
- Reusar prompt de relatório estratégico (StoryBrand + arquétipos + paleta + tom de voz) que já existia antes do safe mode — recuperar do histórico do arquivo.

### 2. `supabase/functions/process-content-generation-job/index.ts`
- **Remover o retry automático** do Claude (try/catch que chama duas vezes — linha ~159). Passar `disableRetries: true`.
- **Eliminar completamente o bloco de refinamento de leaks** (linhas ~190-230). A função `sanitizeWeek` local já remove rótulos de framework via regex — não precisa de IA pra isso. Isso elimina até 7 chamadas pagas extras por semana.
- Resultado: **1 chamada paga por semana**, sem exceção.

### 3. Reset de banco (sem custo Anthropic)
- Atualizar via migration:
  - `UPDATE reports SET status='pending', content=NULL, editorial_weeks='[]'::jsonb, error_message=NULL WHERE id='76e7997d-9ff3-4318-8093-945f9c125eb3'` (relatório atual da usuária)
  - `DELETE FROM report_generation_jobs WHERE report_id='76e7997d-9ff3-4318-8093-945f9c125eb3'`
  - `DELETE FROM content_generation_jobs WHERE report_id='76e7997d-9ff3-4318-8093-945f9c125eb3'`

### 4. UI — sem mexer no que já está bom
- Manter trava "pause após erro" em `Results.tsx` (sem retries automáticos no front).
- Adicionar pequeno banner em `Report.tsx` se `content.is_fallback === true`: *"Esta versão usa um modelo simplificado. Tente regenerar para usar a IA completa."* (sem custo adicional pra mostrar).

## Arquivos a editar
- `supabase/functions/process-report-generation-job/index.ts` (recuperar prompt Claude + remover safe mode como padrão)
- `supabase/functions/process-content-generation-job/index.ts` (remover retry + bloco de refinamento)
- `src/pages/Report.tsx` (banner de fallback)
- 1 migration SQL para reset do relatório atual

## Custo estimado por ciclo completo
- Relatório: ~$0.08–0.12 (uma chamada Claude Sonnet 4.5, ~6k tokens)
- 1 semana editorial: ~$0.05–0.08 (uma chamada, sem refinamento)
- **Total: ~$0.13–0.20 por geração completa**, sem cobranças paralelas ou de retry.

## Garantias
- Zero retries automáticos no Claude (nem no client, nem nos workers).
- Zero chamadas paralelas de refinamento.
- Se falhar: erro claro pra usuária + crédito do ciclo devolvido (lógica já existente) + sem reagendamento automático.
- Lovable: tudo aplicado em 1 build, sem idas e vindas.
