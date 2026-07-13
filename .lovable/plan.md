# Passos A + B1 + C + D — retry com pauta fresca, restrições duras, Sonnet no 2º retry

## Escopo
Um único ciclo de edição em `supabase/functions/process-content-generation-job/index.ts` cobrindo os 4 passos aprovados. Sem tocar em prompts do 1º Opus, sem mexer em `editorialSubjects.ts`, sem tabelas novas.

## Passo A — Auditoria da instrumentação de tag (antes de qualquer edição)

Ler o bloco `[dedup-retry]` atual e confirmar 3 coisas:
1. O log `old_tag / new_tag / tag_changed` está no mesmo caminho que o log `old_thesis_sim / new_thesis_sim` que já apareceu no S18. Se não, mover pra lá.
2. `preRetryTagsByDay` está sendo populado **antes** do retry rodar (leitura do estado pré-retry), não sobrescrito pelo pós.
3. Comparar timestamp de `booted` da função vs. hora do meu último deploy da instrumentação. Se `booted` for anterior, o deploy anterior não pegou e o bloco de tag simplesmente não estava em produção.

Reporto o resultado dessa auditoria no chat *antes* de aplicar as edições dos Passos B/C/D — se descobrir que o log de tag nunca subiu, corrijo isso junto com o resto no mesmo commit.

## Passo B1 — Pauta rotacionada do banco no prompt de retry

Fontes já disponíveis, sem custo extra de LLM:
- `market_trends_cache` — trends do nicho já cacheadas.
- `used_market_trends` — o que o usuário já queimou.
- `subject_tag` do próprio histórico (via `post_embeddings.text_used` + tags recentes) — pra saber o que evitar.

Antes do retry de cada dia:
1. Query: pegar até 5 trends de `market_trends_cache` do nicho do usuário que **não** aparecem em `used_market_trends` do user_id nas últimas 8 semanas.
2. Filtrar as que caiam em concept_groups saturados (usa a mesma tabela de mapeamento que o `editorial-diversity` já usa) e as que compartilhem tag com o `preRetryTagsByDay[day]`.
3. Injetar as 2-3 sobreviventes no prompt do retry como bloco `PAUTAS FRESCAS DISPONÍVEIS`, com instrução: "escolha UMA destas pautas como âncora nova da tese; se nenhuma servir, invente uma tese fora dos clusters listados abaixo".

Se a query retornar zero pautas, o retry cai no caminho atual (sem bloco de pauta) — não bloqueia geração.

## Passo C — Sonnet 4.6 no 2º retry (Opus só no 1º)

Hoje: 1º Opus → 2º Opus → `time-budget-exceeded` mata o 2º antes dele terminar.

Mudança: 1º retry continua Opus (qualidade). 2º retry, se o 1º ainda falhar, chama Sonnet 4.6 com o mesmo prompt (incluindo B1 + D). Sonnet é ~3-4× mais rápido → cabe no budget de 90s existente sem alargar.

Ajustes:
- Manter budget de 90s (não subir).
- Trocar a chamada Opus do 2º retry por `anthropic/claude-sonnet-4-5` (mantendo temperature/max_tokens equivalentes; Sonnet aceita a mesma API).
- Logar `[dedup-retry-2] model=sonnet-4-5 duration=...` pra confirmar via evidência que rodou.

## Passo D — Fingerprint/diversidade como restrição dura no prompt do retry

Hoje o retry só sabe da tese anterior. Passa a receber, no mesmo prompt de retry (1º e 2º):

```
RESTRIÇÕES DURAS DESTA SEMANA:
- Fórmulas PROIBIDAS: [dicotomia_travessao, diferenca_entre, ...]
  (foram usadas nas últimas 3 semanas ou já apareceram em outro dia desta semana)
- Concept groups SATURADOS: [grupo_b_ticket, grupo_d_generico, ...]
  (não podem ser o tema central deste post)
- Named cases já usados em outros dias desta semana: [...]
```

Fonte: a mesma lógica que `editorial-diversity` já roda **depois** da geração (linha do log `[editorial-diversity]`). Extraio essa lógica pra rodar **antes** do retry também, pra alimentar o prompt. Sem duplicar código — vira uma função reutilizável.

## Deploy e evidência

Depois de aplicar tudo:
1. Salvar arquivo.
2. Chamar `supabase.deploy_edge_functions(["process-content-generation-job"])`.
3. Puxar `supabase.edge_function_logs` e mostrar o `booted` timestamp **posterior** ao deploy — não só a resposta OK do tool.
4. Só então reporto pronto e você gera a semana de controle.

## Métrica de sucesso da S19 (próxima geração)

Os mesmos 3 sinais + 2 novos:
1. `post<pre` em pelo menos 3/4 dias, com queda média ≥ 0.03.
2. `tag_changed=true` em 100% dos retries (agora observável).
3. Zero `time-budget-exceeded`.
4. **Novo:** `[dedup-retry] pauta_fresca_usada=true` em ≥ 2/4 dias com retry.
5. **Novo:** zero violações de `banned_formula_overuse` e `concept_group_overuse` no log `[editorial-diversity]`.

Se S19 vier vermelho nesses 5, aí sim faz sentido a conversa estrutural que você mencionou (taxa-base de repetição aceita, janela de rotação bem mais larga) — mas essa decisão fica pra depois da evidência.

## Fora de escopo

- Não mexer no 1º Opus nem em `editorialSubjects.ts`.
- Não subir budget de tempo.
- Não adicionar Sonnet como Pauta Researcher (B2 rejeitado).
- Não backfillar nada novo.
