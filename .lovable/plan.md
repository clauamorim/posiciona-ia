

# Correções e Melhorias no Editor e Questionário

O pedido contém 8 problemas distintos. Segue o plano consolidado.

---

## 1. Questionário de Arquétipos: iniciar sem nenhuma opção marcada

**Problema:** Todas as perguntas iniciam com o valor `3` visualmente selecionado. Se o usuário concorda com `3` e clica nele, o sistema não registra porque o valor já é `3` no state — o `touchedIds` não é atualizado, impedindo o cálculo final.

**Solução:** Não inicializar `answers` com valor `3` para perguntas não respondidas. Usar `undefined` como valor padrão para perguntas novas. Os botões mostrarão nenhum selecionado até o clique. Ajustar a renderização para checar `answers[q.id] !== undefined`.

**Arquivo:** `src/pages/ArchetypeQuestionnaire.tsx`

---

## 2. Alt+Tab reseta o questionário de arquétipos para a primeira página

**Problema:** O `useEffect` que carrega perguntas/respostas depende de `[user]`. Quando a janela perde/recupera foco, o React pode re-renderizar e o `user` pode mudar de referência (e.g. refresh do token), causando re-execução do efeito e resetando `page` para 0.

**Solução:** Adicionar um `useRef` flag `loadedRef` para evitar recarregar dados se já foram carregados. O `useEffect` só executa a carga inicial uma vez.

**Arquivo:** `src/pages/ArchetypeQuestionnaire.tsx`

---

## 3. Alt+Tab reseta o editor de posts

**Problema:** Mesmo mecanismo — o `useEffect` em `PostEditorPage.tsx` que popula `editedTexts` e `editedTitle` depende de `[day]`. Se `day` muda de referência (re-fetch do report), os textos editados são sobrescritos.

**Solução:** Adicionar um `useRef` flag para evitar re-popular os textos uma vez que já foram inicializados pelo usuário.

**Arquivo:** `src/pages/PostEditorPage.tsx`

---

## 4. Barras horizontais no primeiro slide não são editáveis

**Problema:** No `PostCanvas.tsx`, o primeiro slide (cover) renderiza duas barras decorativas com `pointerEvents: "none"` (linhas 434-442). Esses elementos são fixos e não participam do sistema de overlay.

**Solução:** Remover as barras decorativas hardcoded do cover slide. Se o usuário quiser barras, pode adicioná-las via a seção "Barras e molduras" do toolbar (SVG_ELEMENTS).

**Arquivo:** `src/components/post-editor/PostCanvas.tsx`

---

## 5. Upload de imagens em vez de logo + galeria

**Problema:** Atualmente há "Upload Logo" e "Upload Foto" separados. O pedido é remover "Upload Logo" e manter apenas "Upload Imagens", e exibir as imagens enviadas em uma galeria dentro da toolbar.

**Solução:**
- Remover a lógica de `LOGO_STORAGE_KEY` e o botão "Upload Logo" / "Trocar Logo"
- Renomear "Upload Foto" para "Upload Imagem"
- Manter as imagens adicionadas visíveis como uma galeria reutilizável na sessão (as imagens do overlay já ficam na lista `overlayImages` — basta adicionar uma seção mostrando as imagens já carregadas para reutilização)
- Adicionar seção "Imagens adicionadas" que mostra thumbnails das imagens photo/logo no overlay para re-inserção

**Arquivo:** `src/components/post-editor/PostToolbar.tsx`

---

## 6. Cor customizada para segunda cor do gradiente

**Problema:** Atualmente a segunda cor do gradiente só pode ser escolhida da paleta. Não há opção de cor personalizada.

**Solução:** Adicionar um input `type="color"` ao lado dos botões da paleta na seção "2ª cor" do gradiente, similar ao que já existe em outras seções. Introduzir uma nova prop `customGradientColor2` e state em `PostEditorPage.tsx`. Se definida, usa essa cor em vez de `palette[gradientColor2Index]`.

**Arquivos:** `src/components/post-editor/PostToolbar.tsx`, `src/pages/PostEditorPage.tsx`

---

## 7. Remoção de fundo com erro

**Problema:** A função `remove-background` usa o modelo `google/gemini-3.1-flash-image-preview` para gerar imagens. O modelo pode falhar ou não retornar imagem em alguns casos. Logs não mostram erros recentes, então pode ser um problema intermitente ou de tamanho/tipo de imagem.

**Solução:**
- Comprimir a imagem antes de enviar (usar `compressImage` de `imageUtils.ts`) para reduzir payload
- Melhorar mensagens de erro no frontend para orientar o usuário
- Adicionar retry automático (1 tentativa extra)

**Arquivos:** `src/pages/PostEditorPage.tsx`, `supabase/functions/remove-background/index.ts`

---

## 8. Função de camadas (trazer para frente, enviar para trás)

**Problema:** Não existe controle de z-order para os elementos overlay. A ordem depende da posição no array `overlayImages`.

**Solução:** Adicionar botões "Trazer para frente" e "Enviar para trás" na seção "Elemento selecionado" do toolbar. Esses botões reordenam o item selecionado dentro do array `overlayImages`. No canvas, renderizar usando o índice do array como z-index relativo.

**Arquivos:** `src/components/post-editor/PostToolbar.tsx`, `src/pages/PostEditorPage.tsx`, `src/components/post-editor/PostCanvas.tsx`

---

## 9. Markdown `**texto**` na Linha Editorial e copy no editor

**Problema:** A IA gera conteúdo com `**texto**` (markdown bold) nos campos `card_copy`, `theme`, `caption`, etc. Na Linha Editorial, esses asteriscos aparecem literalmente. No Editor de Posts, o texto com `**` é copiado como está.

**Solução:**
- Na `EditorialPage.tsx`: usar `cleanMarkdown()` de `textCleanup.ts` para limpar os textos antes de exibir (theme, caption, card_copy, cta, script)
- No `PostEditorPage.tsx`: a função `handleCopyCaption` deve copiar o texto limpo (sem `**`), usando `cleanMarkdown()`
- No `PostCanvas.tsx`: o texto renderizado já vem de `editedTexts` — garantir que ao inicializar, os textos passem por `cleanMarkdown()`

**Arquivos:** `src/pages/EditorialPage.tsx`, `src/pages/PostEditorPage.tsx`

---

## Resumo de arquivos alterados

| Arquivo | Mudanças |
|---------|----------|
| `src/pages/ArchetypeQuestionnaire.tsx` | Sem valor default 3, flag anti-reload |
| `src/pages/PostEditorPage.tsx` | Flag anti-reload, compressão antes do remove-bg, copy limpo, cor gradiente customizada, funções de camada |
| `src/components/post-editor/PostCanvas.tsx` | Remover barras hardcoded, z-index por posição no array |
| `src/components/post-editor/PostToolbar.tsx` | Remover upload logo, galeria de imagens adicionadas, cor customizada no gradiente, botões de camada |
| `src/pages/EditorialPage.tsx` | Limpar markdown nos textos exibidos |
| `supabase/functions/remove-background/index.ts` | Melhorar tratamento de erros |

