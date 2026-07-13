## Objetivo

Aumentar a granularidade do `subject_tag` para capturar o EIXO ARGUMENTATIVO / TESE do post (o que o post AFIRMA), não só o território temático concreto (documento, caso, instrumento). Ataca a repetição observada nas semanas 10–12, em que 3 teses reaparecem sob rótulos nominalmente distintos.

Ajuste é 100% de prompt em `supabase/functions/_shared/editorialSubjects.ts`. Sem mudança de schema, infra ou outras funções.

## Diagnóstico que motiva o ajuste

Teses que vazaram apesar do `subject_tag` distinto:
- "Por onde começo a análise / ordem de leitura antes do edital" — S10D1 (`auto-avaliacao-judicial`) + 7 ocorrências anteriores.
- "A análise depende do perfil do investidor / briefing primeiro" — S12D2 (`briefing-perfil-investidor`) + ocorrências prévias.
- "Mito de segurança institucional / leilão de banco não é seguro por si só" — S12D3 (`leilao-caixa-garantia-institucional`) + variações anteriores.

Padrão: o `subject_tag` atual descreve o OBJETO do post (documento, órgão, instrumento) — mas dois posts sobre objetos diferentes podem defender a MESMA tese. É esse eixo que precisa entrar no tag.

## Mudança no prompt (única alteração)

Reescrever `renderSubjectAxisBlock` em `supabase/functions/_shared/editorialSubjects.ts`:

1. **Redefinir `subject_tag`**: identificador da TESE/EIXO ARGUMENTATIVO (o que o post AFIRMA), não do OBJETO tratado. Kebab-case, 3–5 palavras.

2. **Exemplos antes/depois** (advocacia de leilão), para o LLM não escorregar:
   - ❌ `auto-avaliacao-judicial` → ✅ `ordem-de-leitura-pre-lance`
   - ❌ `briefing-perfil-investidor` → ✅ `analise-depende-do-perfil-cliente`
   - ❌ `leilao-caixa-garantia-institucional` → ✅ `mito-de-seguranca-institucional-desmentido`

3. **Regra de derivação explícita**:
   - "Qual é a AFIRMAÇÃO central do post? (não o objeto que ele analisa)"
   - "Se dois posts sobre objetos diferentes defendem a mesma afirmação, têm o mesmo `subject_tag` e violam a rotação."

4. **Calibração anti-abstração** (contrapeso importante — reduz risco de retry excessivo e de teses forçadas):
   - Instrução explícita: "A tese deve ser ESPECÍFICA do nicho, não uma máxima genérica de negócios. `depende-do-contexto`, `tudo-tem-risco`, `analise-caso-a-caso` NÃO são teses válidas — são platitudes."
   - "Se você não consegue encontrar 4 teses genuinamente distintas para a semana, é aceitável repetir OBJETO (documento/caso) desde que a AFIRMAÇÃO seja distinta — o eixo que rotaciona é a tese, não o objeto."
   - Regra do teste do contrário: "Uma tese válida é uma afirmação que alguém razoável poderia discordar. Se a negação da tese soa absurda, ela é genérica demais."

5. **Reforço no bloco de rotação**: rótulo passa a ser "TESES JÁ DEFENDIDAS RECENTEMENTE (proibidas)" e frase muda para "escolha TESES ainda não defendidas".

6. **Ajuste em `renderSubjectRetryInstructions`**: "reescreva com uma TESE diferente — não basta trocar o objeto/documento/caso, a afirmação central precisa mudar".

Nada muda em: `normalizeSubject`, `collectRecentSubjects`, `validateWeekSubjects`, `getPostSubject`, `SUBJECT_ROTATION_WEEKS`, persistência, ou `process-content-generation-job/index.ts`.

## Deploy e verificação

1. Redeploy explícito de `process-content-generation-job` (traz `editorialSubjects.ts` por transitividade).
2. Você gera semanas 13 e 14 pela UI.
3. Eu puxo e reporto em conjunto:
   - **Tags novas**: `subject_tag` de cada dia das semanas 13 e 14.
   - **Teste das 3 teses de controle**: checagem manual se "ordem de leitura", "depende do perfil" ou "mito de segurança institucional" reaparecem sob rótulo distinto.
   - **Taxa de retry**: contar quantos `retry_triggered=true` (violação de assunto) apareceram nas gerações das semanas 13–14 vs. semanas 10–12 (baseline: 0/3 no lote 10–12). Puxar dos logs `[editorial-subject]` do `process-content-generation-job`.
   - **Qualidade das teses novas**: leitura manual pra flagar teses genéricas/forçadas (as platitudes que a instrução 4 tenta evitar).

## Critério de sucesso

- Nenhuma das 3 teses de controle reaparece nas 8 novas gerações.
- `subject_tag` descreve AFIRMAÇÃO, não OBJETO.
- Taxa de retry por violação de assunto continua baixa (≤1 retry no total das 2 semanas) — se subir muito acima do baseline 10–12, sinal de que a definição de tese ficou rígida demais e precisa calibrar.
- Nenhuma tese lida como platitude genérica ("depende do caso", "analise antes de decidir" etc.).

## Critérios de falha e próximo passo

- **Se teses de controle vazarem** apesar do ajuste → avançar para o Curador Semântico (Haiku sobre `match_post_embeddings`) do plano em espera.
- **Se retry disparar em excesso ou teses ficarem forçadas** → calibrar de volta a definição (afrouxar a exigência de "afirmação" ou permitir mais reuso de eixo dentro da semana), antes de partir pro Curador.

## O que NÃO entra

- Plano dos agentes Claude (Pesquisador Sonnet + Curador Haiku) — em espera até resultado das semanas 13–14.
- Qualquer mudança de schema, migração ou de outras edge functions.
- Mudança na janela de rotação (segue em 4 semanas).
