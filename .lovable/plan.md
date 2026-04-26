# Eliminar o "Conteúdo a definir" — retry automático do Estágio A

## Diagnóstico confirmado pelos logs
Job `bd5835d9...` (último "+7 dias"):
- Claude devolveu `stop_reason: "end_turn"` (resposta completa, NÃO truncada)
- Mas trouxe apenas **3 dos 4 posts** pedidos (faltou o Dia 1)
- O scanner balanceado recuperou os 3 corretamente
- O sistema preencheu o Dia 1 com placeholder "Conteúdo a definir" para não falhar o job inteiro

A causa é variabilidade natural do modelo: às vezes ele "esquece" um item da lista mesmo recebendo instrução clara. Uma segunda tentativa do mesmo prompt quase sempre traz os 4 completos.

## Mudanças propostas

### 1. `supabase/functions/process-content-generation-job/index.ts` — retry automático do Estágio A
- Após a primeira chamada ao Claude no Estágio A, contar quantos dos 4 dias esperados (`FEED_DAYS = [1, 3, 5, 7]`) foram entregues.
- **Se faltar 1 ou mais posts E a resposta NÃO foi truncada** (`stop_reason !== "max_tokens"`), disparar **uma única retentativa** do Estágio A com o mesmo prompt, atualizando a mensagem de progresso para *"Refinando seus posts de feed (ajuste fino)…"*.
- Mesclar o resultado da retentativa com o primeiro: para cada dia faltante, usar o post da retentativa se houver; manter os posts que já vieram corretos na primeira chamada (não desperdiçar conteúdo bom).
- Se mesmo após o retry ainda faltar algum dia, manter o comportamento atual (placeholder "Conteúdo a definir") como rede de segurança — o job não falha.
- Se a primeira resposta veio truncada, manter o caminho atual (scanner parcial + placeholder se necessário) — retry não ajuda nesse caso, pois o problema é tamanho, não esquecimento.

### 2. Reforço leve do prompt do Estágio A (`buildFeedSystemPrompt`)
- Adicionar uma linha curta no final, antes do bloco de frameworks: *"CHECKLIST FINAL ANTES DE RESPONDER: você está retornando exatamente 4 objetos no array, um para cada dia [1, 3, 5, 7]? Confirme antes de enviar."*
- Pequeno custo, ajuda a reduzir a frequência do retry ser necessário.

## Custo e UX
- Caso comum (4 posts já vêm na primeira): **zero custo extra**, zero latência extra.
- Caso raro (faltou item): **+10–20s** de latência e ~1 chamada Claude extra. Usuário vê "Refinando…" e recebe os 4 posts completos sem placeholder.
- Crédito continua sendo cobrado uma única vez por ciclo semanal (já está reservado antes do Estágio A).

## Fora de escopo
- Não vou mexer no caminho de truncamento real (`max_tokens`) — já está coberto pela mudança anterior.
- Não vou adicionar auto-regeneração silenciosa pós-job (Opção 3) — o retry inline é mais simples e cobre o caso real observado.
- Sem mudanças no frontend.

## Arquivos a editar
- `supabase/functions/process-content-generation-job/index.ts`
