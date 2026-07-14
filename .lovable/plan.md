# Encerramento da investigação de anti-repetição — revisado

Aprovado o encerramento com as duas correções que você apontou. Este plano incorpora:

1. **Thresholds calibrados intactos** (0.92/0.93). A curva 0.88/0.90 que eu propus contradizia a calibração com pares reais (DISTINCT max=0.9212) e a justificativa "menos retries" estava invertida — threshold mais baixo bloqueia mais, não menos. Cancelado.
2. **Conclusão honesta sobre B1**. Cache checada agora: `advogado::leilões` tem 3 pautas vigentes e o usuário só queimou 1 nos últimos 56 dias — ou seja, sobrariam 2 pautas, mas B1 devolveu 0. Isso significa que a query B1 está com bug (provavelmente nos filtros de concept-group saturado ou tag pré-retry). **H5 não foi testada** — nem por cache vazia, nem por material ausente, mas por bug de filtro. Removemos B1 mesmo assim como simplificação, mas registrado corretamente.

## Passo 1 — Alargar janela de rotação de tese pra 12 semanas

Único ajuste de calibração:
- `SUBJECT_ROTATION_WEEKS: 4 → 12` em `_shared/editorialSubjects.ts`.
- **Thresholds adaptativos permanecem inalterados** (0.90 <10w, 0.92 <20w, 0.93 20w+) — calibrados com pares reais, não mexer.

Efeito esperado: janela de teses proibidas triplica; conteúdo genuinamente distinto continua passando; repetições sub-3-meses passam a ser rejeitadas com o mesmo teto de similaridade que já está validado.

## Passo 2 — Remover complexidade morta do retry

Em `process-content-generation-job/index.ts`:
- Remover bloco `PAUTAS FRESCAS DISPONÍVEIS` e a query em `market_trends_cache`. **Motivo registrado no código como comentário:** "Removido em S19 — H5 (material novo reduz thesis_sim) não foi testada de forma limpa: query B1 devolveu 0 mesmo com 2 pautas vigentes disponíveis na cache do usuário, indicando bug nos filtros extras. Simplificação vale a pena; se H5 for retomada no futuro, começar por auditar a query, não por assumir que o mecanismo é inerte."
- Remover bloco `RESTRIÇÕES DURAS DESTA SEMANA` — violations idênticas semana após semana (S18 e S19 byte-a-byte iguais) provam que o modelo ignora esse tipo de restrição textual no retry corretivo.
- Remover 2º retry Sonnet inteiro — nunca executou por causa do time-budget; manter só o 1º retry Opus.
- Remover instrumentação `[dedup-retry-2]` e `pauta_fresca_usada` — não há mais o que instrumentar.

Manter:
- `[dedup-retry]` com `old_tag / new_tag / tag_changed / old_thesis_sim / new_thesis_sim / generic_post_sim` — único log que informou algo útil nesta investigação.
- 1 retry Opus com prompt enxuto: proibição de tag anterior + tese anterior. Nada mais.
- `editorial-diversity` como validador pós-geração (ele continua funcionando como registro/telemetria; só deixa de tentar influenciar o retry).

## Passo 3 — Corrigir o bug de medida `pre=0.000`

Na S19, days 2 e 3 tiveram `pre=0.000`, o que não é similaridade zero real — é embedding não medido antes do retry. Isso vem sujando a análise há semanas e sem esse fix o Sinal 1 continua ilegível independentemente de qualquer outra mudança.

Auditar em `process-content-generation-job/index.ts` o ponto onde `preRetrySimByDay[day]` é populado. Provavelmente só é setado quando o gatilho do retry é similaridade genérica; quando o gatilho é tag ou tese, o pré-retry não roda a medida genérica. Fix: sempre medir `preRetrySim` pra todos os dias que entram em retry, independente do gatilho.

## Deploy e evidência

1. Aplicar as 3 mudanças.
2. `supabase.deploy_edge_functions(["process-content-generation-job"])`.
3. Puxar `booted` timestamp posterior ao deploy — não só OK do tool.
4. Reportar pronto e você gera a S20.

## Critério de aceite da S20

1. `[dedup-retry] pre` válido (não-zero) em 100% dos dias que entraram em retry.
2. Nenhum `time-budget-exceeded` (porque só existe 1 retry agora).
3. Janela de rotação de tese olhando 12 semanas — validável na lista `TESES JÁ DEFENDIDAS RECENTEMENTE` do prompt.
4. Thresholds 0.90/0.92/0.93 mantidos (evidência: log `adaptive-threshold`).

Se leitura manual da S20 ainda flagar repetições relevantes contra o histórico inteiro, a conversa vira "esse tipo de conteúdo evergreen jurídico tem taxa-base X% de repetição percebida — aceitamos" — não mais debug de mecanismo.

## Fora de escopo

- Não mexer em `getAdaptiveDedupThreshold` — thresholds calibrados ficam.
- Não gerar N+1 candidatos.
- Não tocar em `editorialPillars.ts`, `editorialDiversity.ts` (como validador), nem no 1º Opus.
- Não auditar/consertar a query B1 agora — remoção é a decisão; futura retomada de H5 começa por auditar essa query, registrado no comentário do código.
- Sem backfill.

## Arquivos afetados

- `supabase/functions/_shared/editorialSubjects.ts` — `SUBJECT_ROTATION_WEEKS: 4 → 12`.
- `supabase/functions/process-content-generation-job/index.ts` — remover B1/C/D; corrigir `preRetrySimByDay`; comentário registrando por que B1 saiu.
