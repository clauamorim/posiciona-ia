
## Diagnóstico

O problema principal não é que a reanálise “gerou errado” — é que ela provavelmente **nem substituiu a análise atual**.

Encontrei uma inconsistência clara no fluxo:

1. **A reanálise reseta apenas `version = 1`**
   - `src/pages/BusinessQuestionnaire.tsx`
   - `src/pages/ArchetypeQuestionnaire.tsx`

   Hoje o código faz:
   - `reports.update(...).eq("user_id", user.id).eq("version", 1)`

   Se o usuário já teve regenerações/reanálises antes, a análise ativa pode estar em `version 2`, `3`, `4`...
   Nesse caso, o crédito é consumido, mas a versão atual continua intacta.

2. **A página `Results.tsx` pula a regeneração se existir qualquer relatório concluído**
   - Ela busca o último relatório com `status = "completed"` e, se encontrar, faz `setStage("done")` e retorna.
   - Ou seja: mesmo depois de usar crédito, o app pode continuar usando um relatório antigo já concluído.

3. **A janela de arquétipos continua lendo conteúdo antigo**
   - As características, marcas e personalidades já estão renderizadas em `Results.tsx`.
   - Se elas não aparecem, o mais provável é que o app esteja mostrando um relatório antigo, sem essas novas chaves.

4. **StoryBrand, linha editorial e relatório continuam “iguais” pelo mesmo motivo**
   - As melhorias recentes só aparecem se uma nova geração realmente acontecer.
   - Como o fluxo está reaproveitando um relatório antigo, os erros persistem visualmente.

5. **Os PDFs já estão sendo enviados para as análises**
   - `generate-report`
   - `generate-content-week`
   - `regenerate-single-post`

   Então o problema não parece ser “os PDFs não estão sendo usados”, e sim que **a reanálise não está chegando a disparar uma nova geração efetiva da estratégia atual**.

---

## Plano de correção

### 1. Corrigir o reset da reanálise
**Arquivos:**
- `src/pages/BusinessQuestionnaire.tsx`
- `src/pages/ArchetypeQuestionnaire.tsx`

**Alteração:**
- Em vez de resetar sempre `version = 1`, buscar o **relatório mais recente do usuário**.
- Resetar esse relatório atual:
  - `status: "pending"`
  - `content: null`
  - `error_message: null`
  - `editorial_weeks: []`

Isso garante que a análise ativa seja realmente invalidada.

---

### 2. Corrigir a lógica da `Results.tsx`
**Arquivo:**
- `src/pages/Results.tsx`

**Alteração:**
- Parar de buscar “qualquer relatório completed”.
- Passar a buscar o **relatório mais recente, independente do status**.
- Só pular a geração se **o relatório mais recente** estiver realmente:
  - `completed`
  - e com `content` válido

Se o mais recente estiver `pending`, `error` ou vazio:
- disparar `generate-report`
- atualizar esse fluxo como a nova análise válida

Também vou ajustar para não criar lógica confusa com versões antigas ficando como referência principal.

---

### 3. Corrigir o bloqueio do questionário de arquétipos
**Arquivo:**
- `src/pages/ArchetypeQuestionnaire.tsx`

**Alteração:**
- Hoje ele trava se existir qualquer relatório concluído.
- Vou mudar para considerar apenas o **estado da análise atual**.

Assim, depois de usar crédito de reanálise, o questionário realmente fica coerente com o novo ciclo.

---

### 4. Corrigir o Dashboard para refletir a análise atual
**Arquivo:**
- `src/pages/Dashboard.tsx`

**Alteração:**
- Fazer o dashboard olhar para o **relatório mais recente**, não para qualquer completed.
- Se a reanálise estiver em andamento ou pendente, mostrar isso corretamente.
- Evitar que StoryBrand / Linha Editorial / Relatório apareçam como “prontos” só porque existe um relatório antigo.

---

### 5. Ajustar estados de espera nas páginas estratégicas
**Arquivos:**
- `src/pages/Report.tsx`
- `src/pages/StoryBrand.tsx`
- `src/pages/EditorialPage.tsx`

**Alteração:**
- Tratar `pending` e `generating` como estados reais de processamento da nova análise.
- Evitar mensagens enganosas do tipo “complete os questionários” quando, na verdade, a reanálise já foi iniciada.

---

## Resultado esperado depois da correção

Após usar um crédito de reanálise:

1. a análise atual será realmente invalidada;
2. o `/results` vai gerar uma nova estratégia em vez de reaproveitar uma antiga;
3. StoryBrand e linha editorial voltarão a ser regenerados;
4. o relatório passará a refletir as correções recentes;
5. a janela de arquétipos deverá finalmente mostrar:
   - características
   - marcas
   - personalidades

---

## Arquivos envolvidos

- `src/pages/BusinessQuestionnaire.tsx`
- `src/pages/ArchetypeQuestionnaire.tsx`
- `src/pages/Results.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/Report.tsx`
- `src/pages/StoryBrand.tsx`
- `src/pages/EditorialPage.tsx`

---

## Observação técnica

Não vejo necessidade de mudança no banco para isso.  
O problema parece ser de **lógica de versionamento e seleção do relatório ativo** no frontend.

