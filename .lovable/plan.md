## Diagnóstico

A implementação anterior usa **um único `Dialog`** que troca o conteúdo interno via `aiStep` (`"prompt"` → `"style"`). Quando o usuário clica em **Continuar**, o dialog não fecha e abre outro — apenas o conteúdo dentro do mesmo modal muda. Por isso a percepção foi de que "o dialog não abriu".

O pedido original diz literalmente: _"aparecer **outra janela** com uma seleção de estilos visuais"_. A solução correta é separar em **dois dialogs independentes**.

## Mudanças (apenas em `src/components/post-editor/inspector/ImageGalleryPanel.tsx`)

### 1. Substituir o estado `aiStep` por dois flags independentes
- Remover `aiStep`.
- Adicionar `aiStyleOpen: boolean` (controla a segunda janela).
- `aiPromptOpen` continua existindo e controla apenas a primeira janela.

### 2. Renderizar dois `<Dialog>` separados

**Dialog 1 — Prompt (já existe, simplificado):**
- Mostra apenas o input de descrição.
- Botões: **Cancelar** e **Continuar**.
- Ao clicar em **Continuar**:
  - `setAiPromptOpen(false)` (fecha a primeira janela)
  - `setAiStyleOpen(true)` (abre a segunda janela)
  - Mantém `aiPrompt` preservado para a próxima etapa.

**Dialog 2 — Seleção de estilo (novo, separado):**
- Header: "Escolha o estilo visual".
- Grid responsivo com os 5 cards (Minimalista, Editorial Luxo, Moderno Vibrante, Humano e Acolhedor, Autoridade Técnica) — mantém o visual já implementado (preview gradient + accent + Check ao selecionar + `border-primary`).
- Botões: **Voltar** (fecha esta janela e reabre a anterior preservando o prompt) e **Gerar (1 crédito)** (chama `handleAIConfirm`, que já está pronto).

### 3. Resets
- Função `closeAiDialog()`: fecha **ambas** as janelas e zera `selectedAiStyle`.
- Função `openAiDialog()`: abre apenas a primeira janela e zera `selectedAiStyle`.
- Função `goToStyleStep()`: fecha a 1ª e abre a 2ª.
- Função `backToPromptStep()`: fecha a 2ª e reabre a 1ª.

### 4. Bloqueio durante geração
- Enquanto `generatingAI === true`, `onOpenChange` da segunda janela ignora tentativa de fechar (mesmo padrão atual).

## O que NÃO muda
- `src/lib/aiImageStyles.ts` — catálogo já está correto.
- `src/lib/postAutoLayout.ts` — assinatura com `aiStyleDirective` já está pronta.
- `supabase/functions/fetch-post-image/index.ts` — concatenação de `Style direction` no prompt já está deployada.
- Lógica de débito de crédito, toasts, salvamento na galeria.
- Estética premium dark (`bg-card`, `border-border`, `border-primary` no selecionado).

## Resultado esperado
O usuário clica em **Gerar imagem por IA** → abre janela 1 (prompt) → digita e clica em **Continuar** → janela 1 fecha e janela 2 abre com os 5 estilos → seleciona um (fica destacado com borda primary + check) → clica em **Gerar (1 crédito)** → imagem é gerada com o directive concatenado ao prompt do Gemini, invisível ao usuário.
