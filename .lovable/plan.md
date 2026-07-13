# Plano — destravar persistência de embeddings e validar guardrail semântico

## Contexto da descoberta

O bloco `[embed-persist]` (linha 2022+) **não** está numa condicional de partial-save — ele roda em todo caminho, sucesso ou falha. O que acontece é bug de escopo: `finalVectorByDay` é declarada com `const` dentro do `try` do dedup (linha 1322, escopo 1311–1977). Quando `[embed-persist]` referencia essa variável na linha 2029, ela já saiu de escopo → `ReferenceError` → `catch` externo engole silenciosamente → warning "erro pre-partial (ignorado)" aparece em toda geração, não só nas parciais.

Consequência: `post_embeddings` = 0 para o usuário, `match_post_embeddings` sempre retorna vazio, `topSim = 0` em todos os dias, guardrail semântico está desligado desde que o dedup v3 foi introduzido.

## Passo 1 — Fix de escopo + redeploy com confirmação

Em `supabase/functions/process-content-generation-job/index.ts`:

1. Adicionar `const finalVectorByDay = new Map<number, number[]>();` logo antes do `try` do dedup (por volta da linha 1305, junto de `dedupMeta` e `dedupFailedDays`).
2. Remover a redeclaração dentro do `try` (linha 1322). Manter apenas o loop que popula o Map.
3. Deploy explícito via `supabase.deploy_edge_functions(["process-content-generation-job"])`.
4. Confirmar deploy com `supabase.edge_function_logs` mostrando um novo `booted` timestamp após o deploy — não só a resposta do tool.

Sem outras alterações. Sem instrumentação adicional — o log `[embed-persist] upserted=N` já existe.

## Passo 2 — Backfill dos embeddings faltantes

Rodar `embed-backfill-partial` para o user `30da289f-ff6a-4d6b-af1f-3083d3c48d3c` (invocação via `supabase.curl_edge_functions` com service-role).

Critério de sucesso:
- `select count(*) from post_embeddings where user_id = '30da289f-…' and post_kind = 'feed'` retorna **≥ 55** (15 semanas × ~4 posts = 60, aceitando margem por posts sem theme/caption).
- Resposta do backfill lista `weeks_touched ≥ 14` e `errors: []`.

## Passo 3 — Semana 16 de controle

Usuário gera a semana 16 pela UI **sem qualquer mudança de prompt** (isolar variável: só a correção de escopo + base populada). Após a geração, coletar 3 evidências dos logs:

1. `[embed-persist] week=15 upserted=4` presente (não é warning "ignorado").
2. `[semantic-dedup] week=15 day=N pre=0.XXX` com `topSim > 0` em pelo menos 2 dos 4 dias — prova que `match_post_embeddings` está retornando resultados agora que a base tem 60 linhas.
3. Se algum dia bater similaridade ≥ threshold, `retry_triggered` volta a aparecer nos logs (métrica antes zerada porque `topSim` era sempre 0).

Se as 3 evidências passarem: guardrail semântico está vivo. Reporto ao usuário e paramos aqui.

Se `topSim` continuar 0 mesmo com base populada: existe segundo bug (parâmetros do RPC, dimensões do vetor, filtro de `since` etc.) — abrir sub-investigação antes de continuar.

## Passo 4 — Curador semântico (só após Passo 3 verde)

Detalhar em plano separado. Escopo previsto: agente Haiku 4.5 que roda **após** o dedup atual, lê `match_post_embeddings` com threshold mais baixo (0.72 vs 0.78) para pegar sobreposições de tese que hoje passam pelo threshold agressivo, e sugere reescrita direcionada apontando o post histórico específico. Reusa infra existente (`post_embeddings` + RPC), sem tabelas novas.

Sem começar nada disso antes do Passo 3 fechar.

## Fora de escopo

- Não mexer no dedup v3 nem em `editorialSubjects.ts` — o prompt de TESE calibrado em S13–15 continua igual.
- Não estornar créditos Anthropic gastos em rodadas passadas.
- Não backfillar `story_embeddings` (fluxo separado, sem sintoma).
