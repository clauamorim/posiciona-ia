

# Plano: Correções e Melhorias no Editor de Posts, Relatório e Retratos

## Problemas e Soluções

### 1. Capas de Reels
**Novo recurso.** Adicionar opção de formato "Capa de Reels" (1080x1920, vertical) ao editor. Novo seletor de formato no toolbar (Post 1:1, Capa de Reels 9:16). Ajustar `PostCanvas` para renderizar em 1080x1920 quando selecionado.

**Arquivos:** `PostEditorPage.tsx`, `PostCanvas.tsx`, `PostToolbar.tsx`

### 2. PDF do Relatório não reflete a tela
O `html2pdf.js` foi adicionado mas pode não estar funcionando corretamente. Verificar e corrigir a implementação do `handleDownloadPDF` em `Report.tsx` — garantir que o `reportRef` está no container correto, configurar margens e escala adequadas, e esconder elementos interativos (botões) durante a captura.

**Arquivo:** `Report.tsx`

### 3. Cor customizada de ícones não funciona
O `elementColor` é aplicado apenas no momento de criação do ícone (via `iconToDataUrl`). Trocar a cor após inserir não re-renderiza o SVG. Solução: ao mudar `elementColor` com um elemento selecionado, re-gerar o `src` do overlay com a nova cor. Adicionar botão "Aplicar cor ao selecionado" ou auto-aplicar.

**Arquivos:** `PostToolbar.tsx`, `PostEditorPage.tsx`

### 4. Barras e molduras — troca de cor e cor customizada
Mesmo problema do item 3. As barras SVG são rasterizadas na cor original. Adicionar seção de cor no painel de barras/molduras idêntica à dos ícones, e permitir re-colorir elementos selecionados.

**Arquivos:** `PostToolbar.tsx`, `PostEditorPage.tsx`

### 5. Barras não redimensionam
O redimensionamento usa `shiftKey` para forçar proporção, mas o comportamento padrão (sem Shift) também está proporcional. Corrigir: sem Shift, permitir redimensionamento livre em todas as 8 alças. Com Shift, manter proporção apenas nos cantos.

**Arquivo:** `PostCanvas.tsx` — ajustar lógica no `handleMouseMove` do resize.

### 6. Redimensionamento só proporcional
Mesmo fix do item 5. Atualmente o código aplica proporção fixa. Inverter: livre por padrão, proporcional com Shift.

### 7. Caixas de texto independentes
Adicionar botão "Nova caixa de texto" no toolbar. Criar `TextBox` adicional no canvas com controles de cor, cor customizada, transparência e redimensionamento. Cada caixa tem seu próprio conteúdo editável.

**Arquivos:** `PostToolbar.tsx`, `PostCanvas.tsx`, `PostEditorPage.tsx`

### 8. Layout — remover ou melhorar
O botão Layout (centered/top/split) modifica posições iniciais dos text boxes, mas como os boxes só inicializam uma vez (`textBoxesInitialized`), mudar layout depois não surte efeito. Solução: ao trocar layout, re-posicionar os text boxes existentes para as posições padrão do novo layout, ou remover o botão e deixar o usuário arrastar livremente.

**Arquivo:** `PostCanvas.tsx`

### 9. Novas versões de relatório não aparecem no histórico
A query em `HistoryPage.tsx` já busca todos os relatórios. O problema é que ao regenerar, o sistema faz `update` no relatório existente (versão 1) em vez de criar uma nova row. Solução: ao regenerar, criar novo registro com `version + 1` em vez de atualizar o existente.

**Arquivos:** `Report.tsx` (handleRegenerate), `HistoryPage.tsx`

### 10. Evitar fundos brancos nos retratos
Atualizar o prompt em `generate-portrait/index.ts`. Remover `STUDIO_STYLES` com "Pure white background". Substituir por instruções explícitas: "Never use plain white backgrounds. Use textured, toned, or gradient backdrops with subtle lighting variations."

**Arquivo:** `supabase/functions/generate-portrait/index.ts`

### 11. Arrastar retrato do painel não funciona
O clique em retrato chama `handleAddPortrait` que cria o overlay corretamente. O problema é provavelmente que as imagens de retrato são URLs externas e o CORS impede a renderização. Verificar se `useCORS: true` está na tag `img` e se `crossOrigin="anonymous"` está presente.

**Arquivo:** `PostCanvas.tsx` — adicionar `crossOrigin="anonymous"` nas tags `<img>` de overlays.

### 12. Remover fundo de retratos/imagens + transparência
Adicionar botão "Remover fundo" no painel do elemento selecionado. Usar API de IA (Lovable AI gateway) para processar a imagem e retornar versão sem fundo. Opacidade já existe — garantir que funciona para todos os elementos.

**Arquivos:** `PostToolbar.tsx`, `PostEditorPage.tsx`, nova edge function `remove-background/index.ts`

### 13. PNG exportado fica com escala errada
O `handleDownloadSlide` restaura o `transform` original após captura, mas o `transformOrigin` muda para "center center" quando deveria voltar ao original. Corrigir: salvar e restaurar `transformOrigin` também. Além disso, garantir que a captura usa `width: 1080, height: 1080` fixos.

**Arquivo:** `PostEditorPage.tsx`

---

## Arquivos Afetados

| Arquivo | Itens |
|---------|-------|
| `src/components/post-editor/PostCanvas.tsx` | 5, 6, 7, 8, 11, 13 |
| `src/components/post-editor/PostToolbar.tsx` | 1, 3, 4, 7, 12 |
| `src/pages/PostEditorPage.tsx` | 1, 3, 4, 7, 13 |
| `src/pages/Report.tsx` | 2, 9 |
| `src/pages/HistoryPage.tsx` | 9 |
| `supabase/functions/generate-portrait/index.ts` | 10 |
| `supabase/functions/remove-background/index.ts` | 12 (nova) |

## Ordem de implementação

| Fase | Itens | Foco |
|------|-------|------|
| 1 | 5, 6, 8, 13 | Correções de redimensionamento e exportação |
| 2 | 3, 4, 11 | Cores de elementos e CORS |
| 3 | 2, 9 | PDF e histórico de relatórios |
| 4 | 7, 1 | Caixas de texto e capas de reels |
| 5 | 10, 12 | Retratos (prompt e remoção de fundo) |

