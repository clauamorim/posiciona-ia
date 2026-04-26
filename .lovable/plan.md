## Objetivo
Após o usuário clicar em "Gerar imagem por IA" no editor de posts, abrir uma segunda janela com 5 estilos visuais nomeados em português. O estilo selecionado fica destacado, e o texto (em inglês, invisível ao usuário) correspondente é concatenado ao prompt enviado ao Gemini. Nenhum outro fluxo é alterado.

## Mapeamento dos estilos (frontend)

Criar um catálogo central com `id`, `label` (PT, visível) e `directive` (EN, oculto):

| ID | Label (PT) | Directive (EN, oculto) |
|---|---|---|
| `minimal` | Minimalista | Clean design, white background, single accent color, sans-serif typography, lots of white space, no clutter, corporate but approachable |
| `editorial-luxury` | Editorial Luxo | High-end editorial aesthetic, dark background, gold or cream accents, elegant serif typography, sophisticated and exclusive feel |
| `vibrant-modern` | Moderno Vibrante | Bold colors, dynamic composition, gradient accents, modern sans-serif, energetic and youthful, Instagram-native aesthetic |
| `human-warm` | Humano e Acolhedor | Warm tones, organic textures, approachable design, rounded elements, friendly typography, trust-building aesthetic |
| `technical-authority` | Autoridade Técnica | Data-driven look, structured layout, navy or dark green palette, precise typography, conveys expertise and credibility |

## Mudanças

### 1. `src/components/post-editor/inspector/ImageGalleryPanel.tsx`
- Substituir o `AlertDialog` atual ("Gerar imagem por IA") por um fluxo de duas etapas usando o mesmo `AlertDialog`/`Dialog`:
  - **Etapa 1 (já existente):** input de descrição + botão "Continuar" (em vez de "Gerar"). Estado novo: `aiStep: "prompt" | "style"`.
  - **Etapa 2 (nova):** grid responsivo de 5 cards (1 col mobile, 2-3 cols desktop) com label PT, ícone sutil e mini-preview estilizado (gradiente/cor que evoca o estilo). Card selecionado recebe `border-primary`, fundo `bg-primary/5` e ícone `Check`, alinhado ao padrão visual já usado em `StyleSelectionModal.tsx` (referência interna). Botões: "Voltar" e "Gerar (1 crédito)".
- Estado adicional: `selectedAiStyle: AIStyleId | null`. Reset ao fechar o diálogo.
- O directive **NUNCA** é exibido — apenas armazenado para envio.
- Em `handleAIConfirm`, passar `aiStyleDirective` (string EN) para `generateAIImage`.
- Tema escuro premium das diretrizes visuais (`bg-card`, `border-border`, sem fundos brancos).

### 2. `src/lib/postAutoLayout.ts`
- `generateAIImage(opts)`: adicionar campo opcional `aiStyleDirective?: string`.
- Repassar como `aiStyleDirective` no body de `supabase.functions.invoke("fetch-post-image", ...)`.

### 3. `supabase/functions/fetch-post-image/index.ts`
- Aceitar `aiStyleDirective?: string` no body.
- Passar para `generateWithAI(subject, mainMessage, format, nonce, aiStyleDirective)`.
- Em `generateWithAI`, quando presente, **concatenar** ao prompt como bloco extra antes da regra de "NO TEXT", ex.:
  ```
  Style direction: ${aiStyleDirective}.
  ```
  Não substitui as regras existentes (composição limpa, sem texto, sem rostos dominantes, etc.) — apenas soma orientação estética.
- Logar `aiStyleDirective` (truncado) para auditoria.

### 4. Nenhuma alteração em
- `StyleSelectionModal.tsx` (estilo de **layout** do post — coisa diferente).
- Pipeline de Pexels / busca de imagens.
- Débito de crédito, toasts de sucesso/erro, persistência na galeria.
- `generatorVersion.ts` (não afeta conteúdo já gerado).

## UX
- O usuário vê apenas os nomes em português e a prévia visual de cada estilo.
- O estilo selecionado fica claramente destacado (borda primary, check, leve fundo).
- Clicar em "Voltar" mantém o prompt digitado.
- Se o usuário fechar o diálogo, ambos os estados (prompt e estilo) são resetados.
- Selecionar um estilo é **obrigatório** para habilitar "Gerar (1 crédito)" — garante intenção explícita.

## Arquivos editados
- `src/components/post-editor/inspector/ImageGalleryPanel.tsx`
- `src/lib/postAutoLayout.ts`
- `supabase/functions/fetch-post-image/index.ts` (deploy automático)
