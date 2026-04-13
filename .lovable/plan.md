

# Plano Consolidado — Todas as Ações Pendentes

Este plano unifica a lógica comercial (já parcialmente implementada) com todas as melhorias solicitadas.

---

## Parte A — Lógica Comercial (já implementada via Stripe + edge functions + frontend)

Items 1-5 do plano anterior (Stripe prices, migração, edge functions, frontend de planos/cupons/upgrade) **já foram executados**. Revisar e corrigir bugs encontrados durante testes.

---

## Parte B — Correções e Melhorias

### B1. Planos e Créditos — mostrar créditos na página
**`src/pages/ChoosePlan.tsx`** — Quando o usuário já tem plano, exibir seção com saldos (ciclos, retratos, regenerações) além dos cards de plano.

### B2. Dashboard — corrigir label de regenerações
**`src/pages/Dashboard.tsx`** — Alterar "regenerações de retrato" para "regenerações de posts" (são posts da linha editorial, não retratos).

### B3. Abater crédito na primeira geração editorial
**`src/pages/EditorialPage.tsx`** + **`generate-content-week`** — A primeira semana editorial deve consumir 1 `weekly_cycle`, igual às seguintes.

### B4. Corrigir erro ao clicar "+7 dias" pela terceira vez
**`src/pages/EditorialPage.tsx`** — Remover update duplicado de `weekly_cycles` no frontend (a edge function já abate). Após a chamada, apenas `refreshSubscription()`.

### B5. Figurino — adicionar Sapatos
**`supabase/functions/generate-report/index.ts`** + **`src/pages/Report.tsx`** — Incluir campo `sapatos` no prompt da IA e renderizar card de sapatos no relatório.

### B6. Editor de Posts — fonte, tamanho e cor do título
**`PostEditorPage.tsx`**, **`PostToolbar.tsx`**, **`PostCanvas.tsx`** — Novos estados `titleFontFamily`, `titleFontSize`, `titleColor` separados do corpo. Seção "Título" no toolbar.

### B7. Editor de Posts — edição do botão CTA
**`PostEditorPage.tsx`**, **`PostToolbar.tsx`**, **`PostCanvas.tsx`**, **`CarouselEditor.tsx`** — Novos estados: `ctaText`, `ctaBgColor`, `ctaTextColor`, `ctaFontSize`, `ctaPosition` (x,y arrastável). Seção "Botão CTA" no toolbar com input de texto, seletores de cor, slider de tamanho. CTA arrastável no canvas.

### B8. Editor de Posts — expandir ícones e molduras
**`PostToolbar.tsx`** — Adicionar mais ícones lucide (Lightbulb, Gift, Camera, Coffee, Smile, etc.) e mais SVG elements (moldura dupla, cantos arredondados, separador com losango, etc.).

### B9. Editor de Posts — painel de retratos gerados
**`PostToolbar.tsx`**, **`PostEditorPage.tsx`** — Buscar `portrait_generations` do usuário. Seção "Meus Retratos" no toolbar com miniaturas. Clicar adiciona como overlay.

### B10. Editor de Posts — tamanho e cores de ícones/barras/molduras
**`PostToolbar.tsx`**, **`PostCanvas.tsx`** — Ao selecionar overlay SVG/ícone, exibir controles de cor (paleta + customizada) e tamanho (slider). Re-renderizar SVG com nova cor.

### B11. Aba Arquétipos — não recalcular quando já gerado
**`src/pages/Results.tsx`** — Verificar se já existe relatório `completed`. Se sim, pular direto para exibição sem mostrar barra de progresso.

### B12. Download do relatório com formatação da tela
**`src/pages/Report.tsx`** — Usar `html2canvas` + `html2pdf.js` para gerar PDF estilizado igual à tela, em vez do jsPDF com texto puro.

### B13. Signup — link sobrepondo header no mobile
**`src/pages/Signup.tsx`** — Ajustar posicionamento do botão "Página Inicial" para não conflitar com o header em telas pequenas.

### B14. Histórico — salvar e acessar relatórios anteriores
**`src/pages/HistoryPage.tsx`** — Criar rota `/report/:id` ou dialog para visualizar relatório específico (não apenas o último).

### B15. Menu — trocar "Análises" por "Relatório"
**`src/components/DashboardLayout.tsx`** + **`src/pages/Report.tsx`** — Renomear label e título.

### B16. Questionário do Negócio — tooltips de ajuda
**`src/pages/BusinessQuestionnaire.tsx`** — Adicionar ícone `?` (HelpCircle) ao lado de cada campo com popover explicativo.

### B17. Admin — mais dados na tabela de usuários
**`src/pages/admin/AdminUsers.tsx`** — Adicionar colunas: saldos, validade do plano, análises Instagram, semanas editoriais.

---

## Ordem de implementação

| Fase | Itens | Foco |
|------|-------|------|
| 1 | B2, B13, B15 | Correções rápidas de labels e layout |
| 2 | B3, B4, B11 | Correções de lógica e bugs |
| 3 | B1, B14, B16, B17 | UI/UX e funcionalidades de suporte |
| 4 | B5, B12 | Figurino e exportação PDF |
| 5 | B6, B7, B8, B9, B10 | Melhorias do editor de posts |

---

## Arquivos afetados (resumo)

| Arquivo | Itens |
|---------|-------|
| `src/pages/Dashboard.tsx` | B2 |
| `src/pages/Signup.tsx` | B13 |
| `src/components/DashboardLayout.tsx` | B15 |
| `src/pages/Report.tsx` | B12, B15 |
| `src/pages/EditorialPage.tsx` | B3, B4 |
| `src/pages/Results.tsx` | B11 |
| `src/pages/ChoosePlan.tsx` | B1 |
| `src/pages/HistoryPage.tsx` | B14 |
| `src/pages/BusinessQuestionnaire.tsx` | B16 |
| `src/pages/admin/AdminUsers.tsx` | B17 |
| `supabase/functions/generate-report/index.ts` | B5 |
| `src/pages/PostEditorPage.tsx` | B6, B7, B9 |
| `src/components/post-editor/PostToolbar.tsx` | B6, B7, B8, B9, B10 |
| `src/components/post-editor/PostCanvas.tsx` | B6, B7, B10 |
| `src/components/post-editor/CarouselEditor.tsx` | B7 |

