

## Plano: Correções no editor, histórico, ajuda e melhorias de UX

### 1. Histórico: dados não carregam sem reload

**Problema:** Os dados são buscados uma única vez no `useEffect` com dependência `[user]`. Quando o usuário navega para a página, o `user` já está definido e não muda, então a busca já deveria funcionar. Provável causa: o componente está sendo montado antes do `user` estar disponível, e quando `user` chega os dados carregam, mas ao navegar entre páginas via React Router o componente pode não remontar.

**Correção em `HistoryPage.tsx`:**
- Adicionar `key={location.pathname}` ou usar `useCallback` para refetch
- Adicionar estado `loading` com progress bar (`Progress`) enquanto os dados carregam
- Usar `Skeleton` ou `Progress` component durante carregamento

---

### 2. Progress bar durante carregamento

**Arquivos:** `HistoryPage.tsx`, `Report.tsx`, `EditorialPage.tsx`, `InstagramAnalysis.tsx`
- Adicionar estado `loading` e exibir `<Progress value={...} />` animado enquanto dados/análises carregam
- Usar progress indeterminado (animação de pulso) para operações sem percentual exato

---

### 3. Menu "Ajuda" com pesquisa e tópicos

**Novo arquivo:** `src/pages/HelpPage.tsx`
**Editar:** `DashboardLayout.tsx` (adicionar item "Ajuda" ao menu)
- Criar página com campo de pesquisa e accordion com tópicos principais:
  - O que são Arquétipos de Marca
  - Como funciona o StoryBrand
  - Como usar a Linha Editorial
  - Como editar posts
  - Análise do Instagram
  - Retratos de Marca
  - Créditos e planos
- Filtrar tópicos pela pesquisa do usuário
- Ícone: `HelpCircle`

---

### 4. Editor de posts: delete, redimensionar overlay

**Editar:** `PostCanvas.tsx`, `PostEditorPage.tsx`
- Adicionar estado `selectedImageId` para rastrear elemento selecionado (clique seleciona)
- Ao pressionar `Delete`/`Backspace`, remover o elemento selecionado do array `overlayImages`
- Adicionar handles de redimensionamento (cantos) no elemento selecionado
- Implementar `onImageResize` callback (já existe na interface mas não está implementado)

---

### 5. Logo persistente na toolbar

**Editar:** `PostToolbar.tsx`, `PostEditorPage.tsx`
- Quando o usuário faz upload de logo, salvar o `dataURL` em `localStorage` (chave `posiciona_user_logo`)
- Na toolbar, se já existe logo salva, mostrar thumbnail da logo na seção "Imagens" como elemento clicável (igual aos elementos gráficos)
- Mudar o texto do botão de "Upload Logo" para "Trocar Logo" quando já existe uma salva
- Clicar na thumbnail adiciona a logo ao canvas; clicar em "Trocar Logo" abre file picker

---

### 6. Remover "Slide X" da copy nos cards da linha editorial

**Editar:** `EditorialPage.tsx` linha 284-285
- Remover o `<Badge>Slide {idx + 1}</Badge>` que aparece ao lado de cada copy de carrossel
- Manter apenas o texto do slide sem numeração

---

### 7. Opções de fonte, tamanho, negrito, itálico no editor

**Editar:** `PostToolbar.tsx`, `PostCanvas.tsx`, `PostEditorPage.tsx`
- Adicionar seção "Tipografia" na toolbar com:
  - Dropdown de fontes (Google Fonts populares), com as fontes do relatório (`typography.display` e `typography.body`) no topo marcadas como "(Recomendada)"
  - Slider ou input de tamanho de fonte
  - Botões toggle para negrito e itálico
- Passar `fontSize`, `fontWeight`, `fontStyle`, `fontFamily` como props ao `PostCanvas`
- Aplicar estilos ao texto editável no canvas

---

### 8. Botão "Home" na tela de login e cadastro

**Editar:** `Login.tsx` — já tem "Voltar à página inicial", mover para o canto superior esquerdo
**Editar:** `Signup.tsx` — adicionar botão "Home" / ícone no canto superior esquerdo
- Usar ícone `Home` ou `ArrowLeft` posicionado fixo no topo esquerdo da tela, fora do card

---

### Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/pages/HistoryPage.tsx` (reload + progress bar) |
| Criar | `src/pages/HelpPage.tsx` (ajuda com pesquisa) |
| Editar | `src/components/DashboardLayout.tsx` (menu Ajuda) |
| Editar | `src/App.tsx` (rota /help) |
| Editar | `src/components/post-editor/PostCanvas.tsx` (delete, resize, tipografia) |
| Editar | `src/components/post-editor/PostToolbar.tsx` (logo persistente, tipografia, elementos) |
| Editar | `src/pages/PostEditorPage.tsx` (selected state, keyboard, font props) |
| Editar | `src/pages/EditorialPage.tsx` (remover "Slide X") |
| Editar | `src/pages/Login.tsx` (botão home no topo) |
| Editar | `src/pages/Signup.tsx` (botão home no topo) |

