

## Plano: Corrigir exibição do relatório (JSON cru em vez de formatado)

### Problema
A página de Análises está exibindo o JSON bruto do relatório. Isso acontece porque o campo `content` do Supabase pode vir como string JSON em vez de objeto já parseado. A verificação `isStructured` na linha 57 falha quando `content` é uma string, fazendo o fallback exibir o conteúdo como texto.

### Solução
Adicionar parsing seguro do `content` antes da verificação `isStructured`:

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Report.tsx` | Adicionar `JSON.parse()` com try/catch caso `content` seja string. Garantir que `content` seja sempre objeto antes do check `isStructured` |

**Código afetado (linha ~56):**
```typescript
// Antes
const content = report?.content;

// Depois  
const rawContent = report?.content;
const content = typeof rawContent === "string" ? (() => { try { return JSON.parse(rawContent); } catch { return rawContent; } })() : rawContent;
```

Isso é uma correção de 1 linha que resolve o problema sem alterar nenhuma outra lógica.

