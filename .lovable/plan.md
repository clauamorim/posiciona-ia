## Correção de truncamento em relatórios estratégicos

### Problema
O relatório gerado via Claude trunca o último campo do JSON porque `max_tokens: 6000` não cobre toda a resposta (figurino + editorial + símbolos + identidade visual expandidos excedem o limite).

### Solução
Ajustar os parâmetros da chamada `callClaude` em `supabase/functions/process-report-generation-job/index.ts` (linhas 449–455):

```text
max_tokens: 6000  → 10000
timeoutMs: 140000 → 180000
```

### Impacto
- Evita truncamento em novas gerações
- Relatórios já truncados no banco **não** são corrigidos retroactivamente — requerem regeneração manual

### Passos
1. Editar `supabase/functions/process-report-generation-job/index.ts`
2. Substituir os valores nos parâmetros de `callClaude`
3. Reimplementar a edge function