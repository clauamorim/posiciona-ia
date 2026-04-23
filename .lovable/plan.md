

## Editor de posts: seleção de estilo antes de abrir + galeria Unsplash

Adiciono ao plano de correções já aprovado um novo fluxo de **seleção de estilo inicial** e uma **galeria de imagens** dentro do editor.

## 1. Modal "Escolha o estilo do post" (antes de abrir o editor)

Ao clicar em qualquer post na Linha Editorial, antes de abrir `/post-editor`, aparece um modal com 3 opções visuais (cards grandes com preview):

| Opção | O que entrega | Custo |
|---|---|---|
| **Minimalista** | Fundo degradê da paleta da marca, sem foto. Logo + tipografia + bloco decorativo. | Grátis |
| **Com foto (Unsplash)** | Fundo com foto do Unsplash relacionada ao tema. Logo + tipografia sobreposta. | Grátis |
| **Com foto IA** | Fundo gerado por IA Gemini, personalizado ao tema. Logo + tipografia sobreposta. | 1 crédito de regeneração |

- Cada card mostra um **preview real** (thumb do Unsplash já buscada via `fetch-post-image` em background quando o modal abre, e um placeholder estilizado para IA até o usuário confirmar).
- Botão "Pular e abrir editor vazio" no rodapé.
- A escolha é salva no draft (`initial_style: "minimal" | "unsplash" | "ai"`) para que ao reabrir o post, o estilo seja respeitado.

## 2. Galeria Unsplash dentro do editor

Adiciono uma nova aba no painel "Adicionar elementos" chamada **"Banco de imagens"**:

- Campo de busca livre (palavra-chave personalizável; default = tema do post).
- Grid com 12 thumbnails do Unsplash (carrega 12 por página, botão "Ver mais").
- Clique em uma thumb → substitui o fundo atual do canvas.
- Botão **"Gerar com IA"** abaixo da grade — abre prompt customizável (default = tema do post) e cobra 1 crédito ao confirmar.
- Atribuição automática do fotógrafo aparece no banner Unsplash (já planejado).

A edge function `fetch-post-image` recebe um novo modo:
- `mode: "single"` (atual) → retorna 1 imagem.
- `mode: "gallery"` (novo) → retorna até 12 imagens do Unsplash com metadata de cada fotógrafo.

## 3. Tudo continua editável

Independente do estilo escolhido (minimal, Unsplash ou IA), o canvas vem com:
- Logo posicionada (com fundo removido automaticamente — já planejado).
- Tipografia + bloco decorativo do template.
- Texto do dia (título, corpo, CTA).
- Paleta de cores aplicada.

E o usuário pode arrastar, trocar texto, redimensionar, mudar fonte, recolorir, etc.

## Arquivos afetados (somando ao plano anterior)

**Novos**:
- `src/components/post-editor/StyleSelectionModal.tsx` — modal com 3 opções.
- `src/components/post-editor/inspector/ImageGalleryPanel.tsx` — galeria Unsplash + botão IA.

**Editar**:
- `src/pages/EditorialPage.tsx` — abrir modal de estilo antes de navegar para o editor.
- `src/pages/PostEditorPage.tsx` — receber `initial_style` via query/state e aplicar no `buildAutoLayout`.
- `src/lib/postAutoLayout.ts` — aceitar parâmetro `style: "minimal" | "unsplash" | "ai"` e retornar layout correspondente.
- `src/components/post-editor/inspector/AddElementPanel.tsx` — adicionar nova aba "Banco de imagens".
- `supabase/functions/fetch-post-image/index.ts` — suportar `mode: "gallery"` retornando até 12 imagens.

## Mantém todas as correções já aprovadas

Todos os 6 fixes anteriores continuam:
1. Logo sempre com fundo removido.
2. Bloco decorativo com tamanho mínimo visível.
3. Banner de atribuição Unsplash (auto-dismiss 5s).
4. "Trocar imagem" funcional (bg vai para o início do renderOrder).
5. Grade com cor adaptativa.
6. Cobrança de IA só quando o usuário confirmar.

## Fora do escopo

- Salvar imagens favoritas do Unsplash em uma galeria pessoal.
- Filtros avançados (cor dominante, orientação) na galeria.
- Histórico de prompts de IA usados.

