

## Análise

**Problema atual no `PostEditorPage.tsx`:**
- Layout `lg:grid-cols-[1fr_280px]`: abaixo de 1024px, o `PostToolbar` empilha embaixo do canvas como uma coluna longa contendo TODAS as seções (Documento, Elemento Selecionado, Adicionar, Ações)
- O usuário precisa rolar a página inteira pra acessar qualquer controle, e dentro do painel ainda precisa rolar mais
- Já existe `<Drawer>` (vaul) e `<Sheet>` no projeto — não precisa adicionar dependências
- Já existe `useIsMobile()` em `src/hooks/use-mobile.tsx` (breakpoint 768px)

**Insight chave:** O `PostToolbar` já está estruturado em 4 seções (`<DocumentPanel/>`, `<SelectionPanel/>`, `<AddElementPanel/>`, ações) — basta apresentá-las contextualmente em mobile, sem mexer na lógica interna delas.

## Plano

**1. Novo componente `MobileEditorBar`** (`src/components/post-editor/MobileEditorBar.tsx`)
- Barra de ação fixa na base (`fixed bottom-0`, respeitando `env(safe-area-inset-bottom)`), visível só em mobile (`md:hidden`)
- 5 ícones grandes (touch targets ≥44px): **Selecionado**, **Texto**, **Adicionar**, **Documento**, **Baixar**
- Tab "Selecionado" mostra badge dinâmico do tipo selecionado (Título, Corpo, CTA, Imagem, Ícone, Caixa, Nº slide) — fica desabilitada quando nada está selecionado
- Tap em qualquer tab abre um `<Drawer>` (bottom sheet vaul, já estilizado dark premium) com APENAS aquela seção
- Botão Baixar é direto, sem drawer
- Visual: `bg-card/95 backdrop-blur-md border-t border-border`, ícones em `text-muted-foreground` com ativo em `text-primary`

**2. Drawer contextual (`MobileEditorDrawer`)** dentro do mesmo arquivo
- Bottom sheet com altura `max-h-[75vh]`, scrollável internamente via `overflow-y-auto`
- Header com título da seção + botão fechar
- Conteúdo: renderiza condicionalmente o sub-painel pertinente (`DocumentPanel`, `SelectionPanel`, `AddElementPanel`) reusando os mesmos componentes do toolbar desktop — zero duplicação de lógica
- Auto-abre o drawer "Selecionado" quando o usuário toca num elemento no canvas (UX contextual): efeito que dispara em `selectedKind` mudar de `null` pra algo, só no mobile

**3. Atualizar `PostEditorPage.tsx`**
- Detectar mobile via `useIsMobile()`
- Em mobile:
  - Esconder o `<PostToolbar>` desktop (`hidden md:block` no wrapper)
  - Trocar grid de `lg:grid-cols-[1fr_280px]` pra: mobile = single column, canvas centralizado e prioritário; desktop mantém `md:grid-cols-[1fr_280px]` (baixar breakpoint de lg pra md já dá ganho extra)
  - Renderizar `<MobileEditorBar>` como filho direto do `DashboardLayout`
  - Adicionar `pb-20` no container principal pra não ter conteúdo coberto pela barra fixa
- Em desktop: comportamento atual 100% preservado

**4. Pequeno ajuste no `PostToolbar.tsx`**
- Exportar os 3 sub-componentes diretamente do `PostToolbar` ou só reusar imports diretos no novo componente (preferir imports diretos pra simplicidade)
- Não mexer no `PostToolbar` em si — continua sendo o componente desktop

## Estrutura visual mobile (ASCII)

```text
┌──────────────────────────┐
│  Header (sticky)         │
├──────────────────────────┤
│                          │
│       CANVAS             │
│       (focado)           │
│                          │
├──────────────────────────┤
│  Legenda Instagram       │
└──────────────────────────┘
┌──────────────────────────┐ ← fixed bottom bar
│ ◐  Aa   ＋   ⚙   ⤓      │
│ Sel Texto Add Doc Baixar │
└──────────────────────────┘

Tap em qualquer tab → bottom sheet sobe com só aquela seção
```

## Arquivos afetados
- **Novo:** `src/components/post-editor/MobileEditorBar.tsx` (~150 linhas)
- **Editado:** `src/pages/PostEditorPage.tsx` — adiciona `useIsMobile`, condicional de visibilidade, padding-bottom
- Zero mudanças em `SelectionPanel`, `DocumentPanel`, `AddElementPanel`, `PostCanvas`, `CarouselEditor`

**Resultado:** mobile vira app-like (canvas + barra de ações estilo Canva/Figma mobile), desktop intocado, premium e leve.

