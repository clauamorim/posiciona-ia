

## Plano: Corrigir status amarelo da Linha Editorial no menu lateral

### Causa
Em `DashboardLayout.tsx` (linha 61), `hasEditorial` verifica apenas `reportData.editorial_weeks`. Já em `Dashboard.tsx` (linhas 53-64), a lógica é mais completa: verifica `editorial_weeks` **OU** `content.editorial` (array dentro do JSON `content` do report).

Quando a linha editorial foi gerada e armazenada apenas em `content.editorial` (e não em `editorial_weeks`), o Dashboard mostra "Concluído" (verde) mas o sidebar mostra ponto amarelo (`in_progress`).

### Solução
Replicar no `DashboardLayout.tsx` a mesma lógica do `Dashboard.tsx`: considerar a linha editorial como concluída se houver `editorial_weeks` **ou** `content.editorial` com itens.

### Mudança

**`src/components/DashboardLayout.tsx`** (dentro do `useEffect` de carregamento):

```ts
const hasEditorialWeeks = !!(reportData?.editorial_weeks && (reportData.editorial_weeks as any[]).length > 0);
let hasContentEditorial = false;
if (reportData) {
  try {
    let c: any = reportData.content;
    if (typeof c === "string") c = JSON.parse(c);
    if (c && Array.isArray(c.editorial) && c.editorial.length > 0) {
      hasContentEditorial = true;
    }
  } catch {}
}
const hasEditorial = hasEditorialWeeks || hasContentEditorial;
```

E usar `hasEditorial` no setter de `journeyStatus["/editorial"]`.

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/DashboardLayout.tsx` | Considerar `content.editorial` além de `editorial_weeks` ao calcular status da Linha Editorial |

Sem mudanças de schema, geração, créditos ou Stripe.

