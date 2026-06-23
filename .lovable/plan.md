## Problema

O botão **Baixar PDF** da Linha Editorial fica girando para sempre. A causa é a forma como a função `handleDownloadPDF` em `src/pages/EditorialPage.tsx` gera o PDF:

- Ela cria um container HTML invisível para cada semana e usa **html2canvas** (`scale: 2`, `windowWidth: 900`) para "fotografar" esse HTML, depois cola a imagem em um `jsPDF`.
- Esse fluxo é notoriamente lento e instável: o html2canvas precisa carregar fontes/CSS, e em telas/conteúdos grandes ele frequentemente trava silenciosamente sem lançar erro — exatamente o sintoma "botão girando para sempre, nada acontece".
- O conteúdo da Linha Editorial é **100% texto** (tema, legenda, CTA, conteúdo, roteiro, stories). Não há imagens. Renderizar via html2canvas é desperdício de complexidade e a fonte do bug.

## Solução

Reescrever `handleDownloadPDF` usando a **API nativa de texto do jsPDF** (sem html2canvas). O PDF passa a ser gerado direto via comandos `pdf.text()`, `pdf.rect()`, `pdf.setFont()` etc.

Benefícios:
- Geração quase instantânea (milissegundos vs. dezenas de segundos).
- PDF muito menor (texto vetorial em vez de imagem JPEG).
- Texto selecionável e pesquisável dentro do PDF.
- Acaba com o "trava para sempre".
- Mantém o mesmo botão, mesmo nome de arquivo (`posiciona-linha-editorial.pdf`), mesma estrutura visual (capa + uma seção por semana com Dia, Tema, Legenda, CTA, Conteúdo, Roteiro, Stories).

## Layout do novo PDF

```text
┌─────────────────────────────────┐
│ Linha Editorial                 │  ← capa (título + subtítulo
│ N semanas de conteúdo           │     com nº de semanas)
├─────────────────────────────────┤
│ Semana 1                        │  ← cabeçalho de semana
│                                 │
│  ── Dia 1 · Post ───────────    │
│  Tema do dia                    │
│  Legenda: ...                   │
│  CTA: ...                       │
│  Conteúdo:                      │
│    • card 1                     │
│    • card 2                     │
│  Roteiro (se reels): ...        │
│  Stories:                       │
│    • frame 1                    │
│                                 │
│  ── Dia 2 · Reels ─────────     │
│  ...                            │
└─────────────────────────────────┘
```

Cada dia ocupa um bloco de texto contínuo; quebra de página automática quando `y` ultrapassa a margem inferior. Mantém:
- Filtro por semanas (`filterKeys`) — continua funcionando.
- `cleanText` para remover marcações.
- Toast de erro em caso de falha.
- O state `downloadingPDF` (spinner) — agora resolvido em ~1s.

## Detalhes técnicos

Arquivo único alterado: `src/pages/EditorialPage.tsx`, função `handleDownloadPDF` (linhas 856–1001).

- Remove imports dinâmicos de `html2canvas`.
- Mantém `import("jspdf")` dinâmico (lazy).
- Usa A4 portrait, margens 15mm, fonte Helvetica (embutida no jsPDF, sem precisar de fontes externas — evita o problema das fontes Cormorant/Inter que o jsPDF não conhece).
- Helper `addText(text, opts)` que faz `pdf.splitTextToSize` e quebra de página automática.
- Helper `addDayBlock(day, dayIndex)` que escreve um dia inteiro.
- Loop pelas semanas filtradas, com `pdf.addPage()` entre semanas.

## Sobre o modo de seleção

Você mencionou que "não aparece a opção de selecionar as semanas". Isso é separado deste bug — o modo de seleção aparece após clicar no botão **"Selecionar semanas"** (ícone ao lado de "Baixar PDF" no topo da Linha Editorial). Se quiser, posso investigar isso depois numa mensagem separada — para esta correção foco apenas em destravar o download.