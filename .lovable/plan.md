

# Plano: Corrigir PDF do Relatório + Adicionar PDF na Linha Editorial

## Problema 1: PDF do Relatório com layout quebrado

O `html2pdf.js` usa `html2canvas` internamente que tem limitações com CSS moderno (gradients, backdrop, rounded corners, grid layouts). Os problemas típicos:
- Cores de fundo de seções (`bg-muted/30`) podem não renderizar
- Paleta de cores com `aspect-square` pode quebrar
- `pagebreak` com `avoid-all` causa páginas em branco ou corte

**Correção em `Report.tsx`:**
- Melhorar config do `html2pdf.js`: usar `pagebreak: { mode: ["css"] }` com classes `break-inside-avoid` nos cards/sections
- Aumentar `scale` para 2.5 para melhor qualidade
- Adicionar `backgroundColor: "#f5f3ef"` (cor do background do tema) no html2canvas para evitar fundo branco
- Adicionar `letterRendering: true` para melhor texto
- Esconder sidebar/layout wrapper — usar `reportRef` apenas no conteúdo interno
- Adicionar classe `print:` CSS para ajustes de impressão (margens, padding)
- Adicionar `data-hide-pdf` nos botões de ação e esconder durante captura

## Problema 2: PDF da Linha Editorial

**Correção em `EditorialPage.tsx`:**
- Adicionar `useRef` para o container de conteúdo
- Adicionar botão "Baixar PDF" no header (ao lado do título)
- Implementar `handleDownloadPDF` usando mesma técnica do Report
- Expandir todos os `Collapsible` antes da captura e restaurar depois
- Esconder botões de ação dos cards durante captura
- Configurar `pagebreak` para evitar cortar cards no meio

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/Report.tsx` | Melhorar config html2pdf, adicionar break-inside-avoid, fix background |
| `src/pages/EditorialPage.tsx` | Adicionar botão PDF + handler com expansão de collapsibles |
| `src/index.css` | Adicionar utilitários de print CSS |

