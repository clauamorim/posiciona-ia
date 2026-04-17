
## Análise

Olhando o `DashboardLayout.tsx` (linhas 220-228): o header mobile JÁ é sticky (`sticky top-0 z-30`). Então o problema real não é falta de sticky — é que talvez ele esteja sendo coberto, ou que falta o botão "voltar ao topo". Vou confirmar com a EditorialPage.

Pontos a verificar:
- O header mobile sticky já existe e funciona — confirmar que não há `overflow` em algum container pai que quebre o `position: sticky`
- A `EditorialPage` é a mais longa — verificar se tem wrappers que impedem o sticky

## Plano

**1. Confirmar/reforçar o header sticky mobile no `DashboardLayout`**
   - O header já é sticky, mas vou garantir que o container pai (`main`) não tenha `overflow-x-hidden` quebrando o sticky scroll vertical no mobile. Solução: trocar para `overflow-x-clip` (mantém clip horizontal sem afetar sticky).
   - Aumentar levemente o backdrop blur para sensação premium quando rola conteúdo embaixo.

**2. Criar componente `BackToTopButton`** (`src/components/BackToTopButton.tsx`)
   - Visível só em mobile (`lg:hidden`)
   - Aparece após scroll > 600px (com fade-in suave via `transition-opacity`)
   - Position: `fixed bottom-6 right-4 z-40`, respeitando `env(safe-area-inset-bottom)`
   - Visual: botão circular 44x44px (toque acessível), `bg-card/90 backdrop-blur border border-border`, ícone `ChevronUp` em `text-muted-foreground`
   - Ação: `window.scrollTo({ top: 0, behavior: 'smooth' })`
   - Discreto, sem texto, integrado ao tema dark premium

**3. Integrar globalmente**
   - Adicionar `<BackToTopButton />` dentro do `<main>` no `DashboardLayout`, antes do conteúdo final
   - Assim TODAS as páginas autenticadas (incluindo Linha Editorial, Relatório, Histórico, etc.) ganham o botão automaticamente, sem precisar editar página por página

**Não faz sentido:** bottom action bar fixo (já temos sidebar acessível via hamburger no header sticky — adicionar barra inferior duplicaria navegação e poluiria).

## Arquivos afetados
- `src/components/DashboardLayout.tsx` — ajuste sutil no header mobile + integração do botão
- `src/components/BackToTopButton.tsx` — novo componente

Solução leve (~40 linhas de código novo), zero dependências, aplicada uma vez e funciona em todas as páginas longas.
