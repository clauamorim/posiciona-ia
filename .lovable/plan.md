

# Plano: PDF do relatório legível + Bios Instagram dentro do limite

## Parte 1 — PDF do relatório: text-first, mais legível

### Causa
O PDF atual é gerado por `html2canvas` capturando as mesmas seções renderizadas na tela, com cards densos, fundos `bg-muted/30`, badges coloridos e grids de 3 colunas. Resultado: visualmente pesado, contraste ruim, parece um carrossel de Instagram, não um relatório.

### Solução
Criar um **layout dedicado para PDF** (escondido na tela, renderizado apenas durante export) usando HTML/CSS limpo + html2canvas. Mantém a UI atual da tela do relatório intacta. Esse layout ofertará: capa, sumário de arquétipos, paleta + tipografia, tom de voz, figurino, símbolos, narrativa StoryBrand — cada um como página de relatório formal.

#### Mudanças

**1. Novo componente: `src/components/report/ReportPdfDocument.tsx`**

Layout text-first, fundo branco/marfim claro `#FAF8F5`, texto `#1A1A2E`. Estrutura:

- **Capa**: título "Relatório de Posicionamento", nome do usuário (se disponível), data, linha decorativa fina.
- **Arquétipos**: cada arquétipo em bloco simples — título grande, descrição em parágrafo corrido, lista textual de marcas/personalidades. Sem cards escuros, sem gradientes.
- **Paleta**: única visualização decorativa preservada — swatches pequenos em linha com hex e uso embaixo em texto preto.
- **Tipografia & Estilo**: 2 colunas no máximo, parágrafo limpo.
- **Tom de Voz**: parágrafo + 3 listas inline (usar / evitar / evocar) sem badges coloridos pesados — apenas texto com bullets.
- **Figurino**: títulos `h3` + listas de bullets em coluna única ou 2 colunas.
- **Símbolos**: lista textual por arquétipo.
- **Narrativa StoryBrand**: 9 blocos em layout 2 colunas, cada bloco = título + parágrafo, sem ícones nem cards.

CSS inline: títulos `font-display` 22-28px peso 600 cor `#1A1A2E`, body 13-14px line-height 1.6 cor `#2D2D3A`, espaçamento generoso (24-32px entre seções), max 2 colunas em qualquer grid, sem `box-shadow`, sem `bg-muted`, bordas finas `1px solid #E8E2D8` apenas onde necessário.

Cada seção marcada com `data-pdf-section` para o `exportSectionBasedPDF` existente continuar funcionando.

**2. `src/pages/Report.tsx`**

- Adicionar div escondido `position: absolute; left: -9999px; top: 0; width: 900px;` que renderiza `<ReportPdfDocument content={content} archetypes={archetypeData} />`.
- `handleDownloadPDF` aponta `reportRef` para esse div escondido em vez do conteúdo visível.
- A tela visível continua exatamente como está (não muda UX da página).

**3. `src/lib/pdfExport.ts`**

- Mudar `bgColor` default para `#FAF8F5` (combinar com o novo layout).
- Sem outras mudanças — a função genérica continua válida.

### Resultado esperado
PDF legível, cores de texto fortes (`#1A1A2E` em fundo claro), espaçamento confortável, sem cards escuros, mantém paleta como único elemento visual. Funciona como entregável estratégico.

---

## Parte 2 — Bios Instagram dentro do limite (≤150 chars)

### Causa
A análise atual do Instagram retorna um array genérico `{ aspect, current, suggestion }` onde "Bio" é apenas um item, e a sugestão de bio é texto livre, frequentemente longa (200-300 chars).

### Solução
Adicionar um **campo dedicado `bio_options`** no schema da resposta da IA, com 3 opções validadas. Validar no backend após receber a resposta — se alguma exceder 150 chars, refazer a chamada com instrução de encurtar (até 2 retries). No frontend, exibir as 3 bios em cartões com contador de caracteres.

#### Mudanças

**1. `supabase/functions/analyze-instagram/index.ts`**

- Adicionar ao prompt sistema instrução explícita: "Para o aspecto Bio, gere 3 opções no campo `bio_options`, cada uma entre 130 e 145 caracteres, NUNCA mais de 150 (incluindo espaços e pontuação). Conte os caracteres antes de retornar."
- Adicionar ao tool schema:
  ```ts
  bio_options: {
    type: "array",
    minItems: 3, maxItems: 3,
    items: {
      type: "object",
      properties: {
        text: { type: "string", description: "Bio entre 130-145 chars, máx 150" },
        char_count: { type: "integer" },
        rationale: { type: "string", description: "Por que essa bio funciona" }
      },
      required: ["text", "char_count"]
    }
  }
  ```
- Pós-processamento: validar `text.length <= 150` para cada bio. Se alguma falhar:
  - Retry: chamar a IA novamente passando as bios inválidas e pedindo reescrita curta.
  - Máx 2 retries.
  - Se ainda falhar, truncar de forma inteligente (cortar na última palavra antes de 147 chars + "…") como fallback final.
- Retornar `{ analysis, bio_options }` no payload.

**2. `src/pages/InstagramAnalysis.tsx`**

- Estender o tipo: `type AnalysisItem` permanece; adicionar `type BioOption = { text: string; char_count: number; rationale?: string }`.
- Persistir `bio_options` no `instagram_analyses` dentro do mesmo JSONB `analysis` (campo extra `bio_options` — não muda schema, JSONB aceita). Atualmente já é `analysis: jsonb`, então só salvar como objeto `{ items: [...], bio_options: [...] }` ou manter array atual + adicionar campo separado dentro do mesmo insert. **Sem mudança de schema.**
- Renderizar bloco "Sugestões de Bio" no topo dos resultados: 3 cartões pequenos com a bio + contador (`145 / 150`) em verde, botão copy.
- Esconder o item "Bio" do array `analysis` ao renderizar (filtrar) para não duplicar.
- No PDF (jsPDF download local — função `downloadPDF`), incluir as 3 bios numeradas no início.

### Acceptance
- Sempre 3 bios.
- Toda bio exibida tem `text.length <= 150`.
- Contador visível confirma para o usuário.

---

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/report/ReportPdfDocument.tsx` (novo) | Layout dedicado text-first para export PDF |
| `src/pages/Report.tsx` | Renderiza ReportPdfDocument escondido; aponta export para ele |
| `src/lib/pdfExport.ts` | bgColor default `#FAF8F5` |
| `supabase/functions/analyze-instagram/index.ts` | Adiciona `bio_options` no schema + validação 150 chars + retry |
| `src/pages/InstagramAnalysis.tsx` | Renderiza bloco Bios com contador, atualiza tipo, inclui no PDF local |

Sem mudanças no schema do banco. Sem mudanças na lógica de geração do relatório estratégico.

