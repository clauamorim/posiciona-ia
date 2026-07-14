# Anti-repetição semanal — investigação encerrada (S20, 2026-07-14)

Encerrada com validação humana da S20 contra o histórico inteiro (S1–S19). Zero clones literais de tese na semana; um eco de território ("segundo leilão não é barganha", 7ª visita ao cluster) com argumento genuinamente novo (seleção adversa). Contraste com a S17 pré-consertos (4/4 dias com repetição real, incluindo Tema 1.134 reusado por inteiro) confirma que a stack corrigida funciona.

## Causas raiz identificadas e resolvidas

1. **Deploy defasado** (pré-S16): produção rodava versão anterior à introdução de `validateWeekSubjects`/`subject_tag`. Redeploy explícito de `process-content-generation-job`.
2. **Base de embeddings vazia** (pré-S16): `finalVectorByDay` era shadowed em escopo interno, embeddings nunca persistiam. Fix de escopo + backfill de 60 embeddings (S1–S15) com `created_at` preservado da data original do relatório.
3. **Granularidade errada do `subject_tag`** (pré-S13): tag descrevia o OBJETO (documento, órgão, caso), não a TESE. Redefinido para kebab-case 3–5 palavras representando a AFIRMAÇÃO central; retries agora recebem proibição explícita da tag anterior.
4. **Thresholds descalibrados** (pré-S16): ajustados com pares reais — repetições confirmadas têm sim ≥ 0.9243, distintos ≤ 0.9212. Curva final adotada: 0.90 (<10w) / 0.92 (<20w) / 0.93 (20w+).
5. **Bug de medida `pre=0.000`** (S17–S19): `preRetrySim` só era populado quando o gatilho era similaridade genérica. Fix: sempre embeddar pré-retry todos os dias violando, qualquer que seja o gatilho.
6. **Complexidade morta no retry** (S18–S19): 2º retry Sonnet nunca executou (time-budget), bloco de "restrições duras" era ignorado byte-a-byte, B1 (pautas frescas) tinha bug de filtro. Todos removidos; retry ficou com 1 chamada Opus enxuta.

## Estado final dos mecanismos

- **Rotação de tese:** janela de 12 semanas (`SUBJECT_ROTATION_WEEKS=12` em `_shared/editorialSubjects.ts`). Ampliada de 4 na S19.
- **Retry:** 1 chamada Opus com proibição de subject_tag anterior + tese anterior; sem 2º retry, sem pautas frescas injetadas, sem restrições duras textuais.
- **Thresholds adaptativos:** 0.90 / 0.92 / 0.93 (calibrados com pares reais, não mexer).
- **Instrumentação mantida:** `[dedup-retry] old_tag/new_tag/tag_changed/old_thesis_sim/new_thesis_sim/generic_post_sim` e `[semantic-dedup] post-retry pre=X post=Y`.
- **`editorial-diversity`:** validador pós-geração de forma/pilar/concept-groups (registro/telemetria); não influencia mais o retry.

## Evidência da S20 (critérios de aceite)

1. `pre` válido em 100% dos dias em retry (0.920, 0.943, 0.950, 0.923) — fix confirmado.
2. Zero `time-budget-exceeded`.
3. Rotação olhando 12 semanas — `matched_week=12, 13, 16` confirmam.
4. Threshold 0.92 aplicado corretamente (`history=19 threshold=0.92`).
5. `tag_changed=true` em 4/4 dias; `new_thesis_sim < old_thesis_sim` em 4/4.
6. Leitura humana: zero clones literais; 1 eco de território com argumento novo (D3, sim=0.929); 2 ecos de molde retórico cobertos por outros validadores.

## Política de taxa-base aceitável

Conteúdo evergreen de nicho jurídico tem ~15–20 teses-mestre. Eco de território (mesmo cluster) com **argumento genuinamente novo** é aceitável e faz parte do custo natural desse tipo de conteúdo — não é bug do sistema. A cadência real (1 semana/semana em vez de 20 em dias) dilui esses ecos ainda mais.

**Só reabrir esta investigação se voltar a aparecer clone literal de tese** (mesmo objeto + mesmo argumento + mesma conclusão, como o Tema 1.134 reusado em S17D4 contra S2D3). Ecos com ângulo novo não contam.

## Fora do escopo desta investigação (são feature, não correção)

- Pesquisador de pautas quentes (agente Sonnet independente puxando trends do nicho).
- Curador anti-repetição em tempo real usando embeddings semânticos como agente Haiku.
- Geração de N+1 candidatos por post com escolha via embedding.
- Auditoria/conserto da query B1 (`market_trends_cache` com filtros extras) — se H5 for retomada, começar por aí.
