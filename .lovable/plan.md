

# Plano: Corrigir Report, StoryBrand, Editorial e Arquétipos

## Diagnóstico

Encontrei **4 problemas raiz** nos logs e no código:

### 1. Stack overflow no `fetchReferencePdfs` (causa principal)
Os logs das edge functions mostram:
```
RangeError: Maximum call stack size exceeded at fetchReferencePdfs
```
A linha `btoa(String.fromCharCode(...new Uint8Array(arrayBuf)))` estoura a pilha de chamadas quando o PDF é grande (o spread `...` passa milhões de bytes como argumentos). Isso afeta `generate-report`, `generate-content-week` e `regenerate-single-post`.

### 2. Conteúdo do relatório armazenado como string JSON (double-encoded)
O conteúdo do relatório no banco está como `jsonb_typeof = 'string'` em vez de `'object'`. O `parseReportContent` deveria lidar com isso, mas a `EditorialPage.tsx` (linha 69) faz cast direto sem parsing: `reportData?.content as Record<string, any>`, então `storybrand` e `tone_of_voice` nunca são encontrados.

### 3. Página de Arquétipos (`/results`) não exibe características
A `Results.tsx` só mostra scores e ranking — não tem código para exibir `characteristics`, `brands` e `people`.

### 4. Dashboard não detecta editorial do relatório
O Dashboard (linha 49) só verifica `editorial_weeks` (semanas extras), ignorando `content.editorial` (semana 1 gerada com o relatório).

---

## Solução

### Arquivo 1: `supabase/functions/generate-report/index.ts`
- Substituir `btoa(String.fromCharCode(...new Uint8Array(arrayBuf)))` por encoding chunked (loop de 8KB)

### Arquivo 2: `supabase/functions/generate-content-week/index.ts`
- Mesma correção do base64 chunked

### Arquivo 3: `supabase/functions/regenerate-single-post/index.ts`
- Mesma correção do base64 chunked

### Arquivo 4: `src/pages/EditorialPage.tsx`
- Na linha 69, usar `normalizeReportContent(reportData?.content)` em vez de cast direto, para que `storybrand` e `tone_of_voice` sejam extraídos corretamente do conteúdo que está como string

### Arquivo 5: `src/pages/Results.tsx`
- Buscar report content e extrair dados dos arquétipos (characteristics, brands, people) do LLM
- Exibir na seção do Top 3: badges de características, marcas de referência e personalidades

### Arquivo 6: `src/pages/Dashboard.tsx`
- Melhorar detecção de editorial: também verificar se `content.editorial` existe (usando `normalizeReportContent` para parsear o conteúdo)

### Arquivo 7: `src/pages/Report.tsx`
- Adicionar log de debug temporário caso `isStructuredReport` seja false, para diagnosticar se há um caso edge de parsing não tratado

| Arquivo | Alteração |
|---------|-----------|
| 3 edge functions | Fix base64 encoding (chunked) |
| EditorialPage.tsx | Parsear content antes de acessar storybrand |
| Results.tsx | Exibir características, marcas e personalidades |
| Dashboard.tsx | Detectar editorial no content do relatório |
| Report.tsx | Garantir parsing robusto |

