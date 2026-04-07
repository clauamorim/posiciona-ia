

# Editor Visual de Posts para Instagram

## O que será construído

Um editor visual integrado ao relatório onde o usuário pode ver previews dos posts (únicos e carrosséis) já estilizados com as cores, fontes e tom de voz da marca, editar os textos diretamente, e baixar as imagens prontas para postar no Instagram.

---

## Arquitetura

```text
Report.tsx
  └─ Botão "Ver Posts Visuais" em cada card editorial
       └─ /post-editor/:reportId/:weekIndex/:dayIndex
            ├─ PostEditorPage.tsx (página principal)
            ├─ PostCanvas.tsx (componente de renderização 1080x1080)
            ├─ CarouselEditor.tsx (navegação entre slides)
            └─ PostToolbar.tsx (controles de edição)
```

---

## Funcionalidades

1. **Preview visual em tamanho Instagram** — Posts renderizados em 1080×1080px (escalados para caber na tela), usando as cores da paleta do relatório como fundo, destaques e texto
2. **Texto editável** — O usuário clica no texto do post/slide e edita diretamente (contentEditable)
3. **Navegação de slides** — Para carrosséis, setas para navegar entre slides com indicador de posição
4. **Templates automáticos** — Layouts pré-definidos aplicados com base no formato (post único, slide de abertura, slide de conteúdo, slide de CTA)
5. **Download individual** — Baixar cada slide/post como imagem PNG via html2canvas
6. **Download do carrossel completo** — Baixar todos os slides de uma vez como ZIP

---

## Implementação técnica

### 1. Instalar dependências
- `html2canvas` — para converter o HTML/CSS do post em imagem PNG
- `jszip` — para empacotar múltiplos slides em um ZIP

### 2. Nova página `PostEditorPage.tsx`
- Rota: `/post-editor` com parâmetros via query string (reportId, week, day)
- Carrega o relatório do banco, extrai o dia selecionado e a paleta de cores
- Renderiza o canvas do post com os dados da `card_copy` e `caption`
- Estado local para textos editados (não salva no banco por enquanto)

### 3. Componente `PostCanvas.tsx`
- Container de 1080×1080px escalado via `transform: scale()` para caber no viewport
- Fundo usando a cor primária da paleta do relatório
- Texto renderizado com as fontes sugeridas (Google Fonts via link dinâmico)
- Layouts por tipo:
  - **Post único**: título centralizado + copy do card + CTA na parte inferior
  - **Carrossel - Slide 1 (capa)**: título grande + tema do dia
  - **Carrossel - Slides intermediários**: numeração + texto do slide
  - **Carrossel - Último slide**: CTA com destaque visual
- Textos com `contentEditable` para edição direta no canvas

### 4. Componente `CarouselEditor.tsx`
- Navegação entre slides com setas e indicador (1/5, 2/5...)
- Cada slide renderizado pelo PostCanvas com dados diferentes
- Botão "Baixar este slide" e "Baixar todos"

### 5. Componente `PostToolbar.tsx`
- Trocar cor de fundo entre as 5 cores da paleta
- Alternar layout (centralizado, topo, dividido)
- Botão de download PNG
- Botão de reset (voltar ao texto original da IA)

### 6. Integração com Report.tsx
- Adicionar botão "Criar Post Visual" em cada card editorial (para posts e carrosséis)
- O botão navega para `/post-editor?week=0&day=0`

### 7. Rota no App.tsx
- Adicionar rota protegida `/post-editor`

---

## Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| `src/pages/PostEditorPage.tsx` | Nova página — editor visual |
| `src/components/post-editor/PostCanvas.tsx` | Componente de renderização do post |
| `src/components/post-editor/CarouselEditor.tsx` | Navegação de slides do carrossel |
| `src/components/post-editor/PostToolbar.tsx` | Barra de ferramentas |
| `src/pages/Report.tsx` | Adicionar botão "Criar Post Visual" nos cards |
| `src/App.tsx` | Adicionar rota `/post-editor` |
| `package.json` | Adicionar html2canvas e jszip |

---

## Detalhes técnicos

- O canvas usa HTML/CSS puro (não Canvas API) para facilitar edição e estilização com Tailwind
- A escala é calculada como `Math.min(containerWidth / 1080, containerHeight / 1080)`
- O html2canvas captura o elemento DOM na resolução original (1080×1080) para export de alta qualidade
- Google Fonts são carregadas dinamicamente via `<link>` no head baseado na tipografia do relatório
- O estado editado fica local (useState) — versão futura pode salvar no banco
- Para carrosséis, cada slide é um PostCanvas independente com dados diferentes do array `card_copy`

