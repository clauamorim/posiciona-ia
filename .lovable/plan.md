## Problema

Quando o usuário está em `/results` e a IA está gerando o relatório:

1. **Sair da janela trava a UI** — a `useEffect` de Results inicia o polling, mas o flag `cancelled` apenas impede `setState`. Ao voltar, o `useEffect` reexecuta o fluxo inteiro do zero (incluindo `setStage("calculating")`) e fica preso em "Calculando arquétipos…" porque há um job em andamento que não está sendo "retomado" — apenas reenfileirado (idempotente, mas a UI nunca progride se algo no caminho falhar silenciosamente).
2. **Logout não funciona** — `signOut()` é chamado mas as Promises pendentes do polling (`supabase.functions.invoke("get-report-generation-job")`) continuam rodando em loop. Como após o signOut o token some, o invoke começa a falhar e o `continue` do loop nunca quebra. A navegação para `/login` é interrompida porque o componente Results ainda está vivo, e o `ProtectedRoute` re-redireciona enquanto o estado de auth oscila.
3. **Reabrir o navegador mostra tela em branco** — sem nada renderizado (nem header). Indica que o `AuthContext` ou alguma query inicial está pendente "para sempre" (sem timeout), travando todo o app.

## O que mudar

### 1. Results.tsx — retomar polling em vez de reiniciar

- Persistir `jobId` ativo no banco (na própria linha de `reports`, coluna `active_job_id text`) ou consultar `report_generation_jobs` por `report_id` + status `queued/processing` ao montar.
- Na entrada do `useEffect`:
  - Se `latestReport.status === "completed"` → renderizar e parar (já é feito).
  - Se existir job ativo para o relatório → pular `setStage("saving")` e os upserts/insert; ir direto para `setStage("generating_report")` e iniciar polling no `jobId` existente.
  - Só executar o caminho "criar job novo" quando não houver job ativo nem relatório concluído.
- Adicionar `AbortController` real: passar `signal` no `supabase.functions.invoke` (via fetch interno não suporta — então envolver com `Promise.race` contra um sinal de cancelamento) e quebrar o loop imediatamente quando `cancelled === true`.

### 2. Logout robusto

- Em `AuthContext.signOut`, antes de `supabase.auth.signOut()`, despachar um `CustomEvent("app:signout")` no `window` para que componentes com loops de polling possam abortar.
- Em Results, escutar esse evento e setar `cancelled = true` + sair do loop.
- Após `signOut`, fazer `navigate("/login", { replace: true })` no `DashboardLayout` (forçar navegação para não depender do redirect do `ProtectedRoute`).

### 3. Tela branca ao reabrir

- Em `AuthContext`, garantir que `setIsLoading(false)` aconteça mesmo se a inicialização demorar — adicionar `setTimeout(() => setIsLoading(false), 8000)` como fail-safe no `useEffect` inicial, e cancelar se a sessão chegar antes.
- Em `App.tsx` (ou onde está o `Suspense`), adicionar fallback visível mínimo (loader) em vez de tela preta, para que o usuário não veja "skeleton invisível".
- Verificar se há `ProtectedRoute` que renderiza `null` enquanto `isLoading` — substituir por um loader.

### 4. UX do estado "gerando"

- Mostrar mensagem clara: "Continuamos gerando sua estratégia em segundo plano. Você pode sair e voltar quando quiser." com botão "Ir para Dashboard".
- No Dashboard, se houver job ativo, exibir banner "Estratégia em geração — ver progresso" com link para `/results`.

## Detalhes técnicos

Arquivos a editar:
- `src/pages/Results.tsx` — retomar job existente, abort no signout.
- `src/contexts/AuthContext.tsx` — disparar evento de signout, fail-safe de loading.
- `src/components/DashboardLayout.tsx` — forçar `navigate("/login")` após signOut.
- `src/components/ProtectedRoute.tsx` — loader visível em vez de null.
- `src/pages/Dashboard.tsx` — banner "geração em andamento" (opcional, mas evita o usuário ficar preso só na tela de Results).

Sem migração de schema obrigatória — usamos a tabela `report_generation_jobs` existente para descobrir o jobId ativo via `report_id`.

## Fora do escopo

- Mudar a arquitetura de jobs (já é assíncrona e correta).
- Refatorar o worker `process-report-generation-job`.