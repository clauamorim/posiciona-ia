## Objetivo

Forçar o deploy real de `process-content-generation-job` (com os `_shared/*` que ela usa), confirmar via evidência que o eixo de assunto passou a rodar, e explicar por que o código de 22/06 nunca chegou em produção sozinho.

## Passos

1. **Redeploy explícito** de `process-content-generation-job`. Edge functions gerenciadas pelo Lovable fazem bundling de todo o grafo de imports (`_shared/editorialSubjects.ts`, `_shared/patternSignature.ts`, `_shared/embeddings.ts`, `_shared/editorialSanitize.ts`, etc.) no momento do deploy — não é necessário deployar cada `_shared` isoladamente, ele vem junto por transitividade.

2. **Verificação por evidência (sem esperar geração natural)**:
   - Pedir permissão para disparar uma geração de teste na conta `vinicius@posiciona.ia.br` (ou você mesmo cria a próxima semana pela UI) para exercitar o caminho.
   - Após a geração, buscar nos logs a linha `[editorial-subject] week=… user=… subjects={…}` — se aparecer, o código novo está rodando.
   - Query no banco na semana recém-gerada confirmando `feed.subject_tag` não-nulo em cada dia e `subject_tags_by_day` presente no objeto da semana em `reports.editorial_weeks`.

3. **Reportar em conjunto**: o log `[editorial-subject]` capturado + o snapshot da semana com `subject_tag` preenchido. Se o log aparecer mas `subject_tag` vier vazio, é bug de prompt (o Opus não está devolvendo o campo) — investigar aí; não é problema de deploy.

4. **Explicação do gap 22/06 → hoje**: descrever no relatório final o que sei sobre o modelo de deploy do Lovable para edge functions (quando dispara sozinho, quando exige ação explícita), para você calibrar a rotina depois de cada push em `supabase/functions/`. Se eu não tiver certeza sobre alguma parte do mecanismo, digo explicitamente "não sei" em vez de inventar — foi exatamente esse tipo de afirmação sem verificar que gerou o problema atual.

## Critério de sucesso

- Log `[editorial-subject]` aparece na próxima geração pós-deploy.
- `subject_tag` não-nulo em todos os dias de feed da semana gerada.
- `subject_tags_by_day` presente no objeto da semana.
- Relatório curto sobre o mecanismo de deploy, com os limites do que sei declarados.

## O que NÃO entra

- Plano dos agentes (Pesquisador de Pautas Sonnet + Curador Anti-Repetição Haiku) — só depois dessa confirmação.
- Ajustes de granularidade do `subject_tag` — só faz sentido discutir com 2+ semanas de dados reais.
- Qualquer alteração de código ou schema.
