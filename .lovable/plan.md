# Plano: Vulnerabilidades em jspdf e html2pdf.js

## Diagnóstico

- **jspdf `^4.2.1`** já é a versão **mais recente publicada** (lançada em 2026-03-17). Não existe versão corrigida upstream para os avisos listados (LFI/Path Traversal, HTML Injection em new window, ReDoS, AcroForm injection, etc.). Não há "atualizar" possível hoje.
- **html2pdf.js `0.10.2`** tem versão nova `0.14.0` que corrige o XSS apontado no aviso GHSA-w8x4-x68c-m6fc.
- Uso de jspdf no projeto (`src/lib/pdfExport.ts`, `EditorialPage.tsx`, `InstagramAnalysis.tsx`, `HistoryPage.tsx`): apenas `new jsPDF(...)`, `addImage`, `text`, `save`. **Nenhum uso de** `loadFile`, `openInWindow`, `addJS`, `AcroForm`, FreeText, BMP/GIF decoder com input do usuário — que são os vetores das advisories críticas/altas. Conteúdo passado vem de dados internos do app (relatórios, posts gerados), não de URLs/arquivos externos arbitrários.

## Ações

### 1. Atualizar html2pdf.js para 0.14.0
Resolve o aviso de XSS de severidade alta. Mudança mínima de versão; API compatível com nosso uso atual (apenas import default e chamada simples).

```
bun add html2pdf.js@^0.14.0
```

### 2. Marcar avisos do jspdf como ignorados (com justificativa)
Como não há patch upstream e nosso uso não atinge as APIs vulneráveis, vamos:

- Marcar `vulnerable_dependencies_critical` (jspdf) como **ignorado** com razão: "jspdf 4.2.1 é a versão mais recente publicada; não há patch upstream. Uso restrito a `new jsPDF()`, `addImage`, `text`, `save` com dados internos. Nenhum uso de `loadFile`, `openInWindow`, `addJS` ou AcroForm — vetores das advisories LFI/HTML-Injection não são acionáveis."
- Marcar `vulnerable_dependencies_high` (parte jspdf) com justificativa similar; manter html2pdf.js retirado do escopo após o update.
- Marcar `vulnerable_dependencies_medium` (jspdf + DOMPurify transitivo) com mesma justificativa.

### 3. Atualizar security memory
Registrar que o uso de jspdf é limitado a render interno para que scans futuros não reabram o item até existir versão corrigida upstream.

### 4. Monitoramento
Quando o jspdf publicar versão > 4.2.1 com correções, reaplicar o scan e atualizar.

## Validação

- Após `bun add`, abrir páginas que exportam PDF (Relatório, Editorial, Instagram, História) e confirmar que o download continua funcionando.
- Rodar novo scan de segurança para confirmar que apenas o item residual de jspdf permanece, agora documentado como aceito.
