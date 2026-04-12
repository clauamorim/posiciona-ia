

## Plano: Reformulação Completa do Posiciona — UX, UI, Copy e Hierarquia Visual

Este é um redesign profundo que preserva toda a lógica funcional existente. Será executado em **4 fases sequenciais** para manter o app funcional durante todo o processo.

---

### FASE 1 — Fundação Visual e Shell do App

**Objetivo:** Estabelecer o novo sistema de design, tipografia, paleta e layout base.

**Arquivos editados:**

| Arquivo | Alteração |
|---------|-----------|
| `src/index.css` | Nova paleta (landing dark + app light), importar Cormorant Garamond + Inter, CSS variables para ambos ambientes |
| `tailwind.config.ts` | Adicionar tokens `landing-*` para background, texto, bordas do tema dark; ajustar cores do tema light interno |
| `src/components/DashboardLayout.tsx` | Refatorar sidebar com 5 grupos (Início, Diagnóstico, Estratégia, Produção, Conta) com separadores visuais; header mobile mais compacto (menos altura, menu+logo enxutos); reorganizar nav items conforme especificado |
| `src/App.tsx` | Sem alteração de lógica — apenas confirmar rotas existentes |

**Detalhes da sidebar:**
- Grupo 1: Dashboard
- Grupo 2: Questionário do Negócio, Questionário de Arquétipos
- Grupo 3: Arquétipos, StoryBrand, Análises, Análise do Instagram, Linha Editorial
- Grupo 4: Conteúdos (editorial), Retratos de Marca
- Grupo 5: Histórico, Plano e Créditos (link para /choose-plan), Ajuda
- Rodapé: email + Sair mais refinado
- Cor sidebar: `#111627`
- Header mobile: ~40px altura, sem duplicação

---

### FASE 2 — Landing Page Pública (Dark Premium Editorial)

**Objetivo:** Reconstruir a landing com StoryBrand aplicado, visual dark premium, tipografia editorial.

**Arquivo editado:** `src/pages/LandingPage.tsx`

**Estrutura completa:**

1. **Header** — Logo, nav links (Como funciona, Resultados, Planos, FAQ, Entrar), CTA "Criar conta". Mobile: menu hamburger elegante
2. **Hero** — Selo badge, headline "Você já é referência...", subheadline, 2 CTAs, linha de apoio. Tipografia Cormorant Garamond para títulos
3. **Seção Problema** — "Quando sua presença digital não acompanha..." com 4 itens curtos
4. **Seção Plano** — 3 etapas com ícones e textos conforme especificado
5. **Seção Por que usar** — 4 blocos curtos
6. **Seção Prova Concreta** — Mockups visuais com previews plausíveis (cards estilizados simulando arquétipos, StoryBrand, calendário, posts, retratos)
7. **Planos** — 3 cards com hierarquia forte, badge "Mais escolhido" no Presença Mensal
8. **FAQ** — Accordion dark com 7 perguntas reais
9. **CTA Final** — Headline emocional + botão + texto de apoio
10. **Footer** — Minimalista

**Paleta landing:** `#0B0820` bg, `#F6F1EA` texto, `#7A4DE8` roxo, `#C9A54C` dourado, `#2B2348` bordas

---

### FASE 3 — Dashboard e Páginas Internas (Light Premium Workspace)

**Objetivo:** Redesenhar dashboard orientado à jornada e refinar todas as páginas internas.

**Arquivos editados:**

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Dashboard.tsx` | Reconstruir com: (1) Hero interno com subtítulo dinâmico, (2) Card "Seu próximo passo" contextual, (3) Card Plano redesenhado, (4) Créditos com nomenclatura nova e microtexto, (5) Jornada visual em 7 etapas com status, (6) Cards de entregas disponíveis, (7) Histórico recente |
| `src/pages/Results.tsx` | Melhorar apresentação visual. Cabeçalho com data e ações. Top 3 com cards sofisticados (papel na marca, forças, riscos, aplicação, tom de voz). Ranking completo preservado |
| `src/pages/StoryBrand.tsx` | Texto como principal (não diagrama). Resumo executivo no topo. 9 blocos com ícone + título + texto + botão copiar. Aplicação prática + próximo passo no final |
| `src/pages/Report.tsx` | Padrão de página estratégica: cabeçalho forte, resumo executivo, conteúdo principal, aplicação prática, próximo passo |
| `src/pages/EditorialPage.tsx` | Tabs de semana melhores. Visão resumida por dia. Badges de formato (post/reels/carrossel). Botões: Criar post, Copiar legenda, Ver roteiro. Menos texto por bloco |
| `src/pages/BusinessQuestionnaire.tsx` | Melhorar cabeçalho, progresso, microcopy ("Revisar respostas" em vez de "Editar"), estado bloqueado premium |
| `src/pages/ArchetypeQuestionnaire.tsx` | Mesmas melhorias de microcopy e estado bloqueado |
| `src/pages/InstagramAnalysis.tsx` | Padrão de página estratégica |
| `src/pages/ChoosePlan.tsx` | Reestilizar com visual light premium |

**Paleta interna:** `#F5F4F1` fundo, `#FBFAF7` cards, `#6E3FE6` roxo ação, `#2E9B63` verde status, `#E6E0D9` bordas

---

### FASE 4 — Editor, Retratos, Histórico, Ajuda e Refinamentos Finais

**Arquivos editados:**

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/PostEditorPage.tsx` | Cabeçalho com título+semana+tipo+voltar. Melhor agrupamento de ferramentas. Botão "Baixar imagem" / "Exportar PNG" |
| `src/components/post-editor/PostToolbar.tsx` | Reorganizar ferramentas em grupos visuais com melhores labels e espaçamento |
| `src/pages/PortraitGenerator.tsx` | Cabeçalho refinado. Card de saldo premium. Upload com melhor explicação. Diferenciação clara gerar vs refinar. Galeria mais bonita |
| `src/pages/HistoryPage.tsx` | Melhorar hierarquia, visual dos itens, status, ação principal |
| `src/pages/HelpPage.tsx` | Visual consistente, tópicos organizados, respostas mais profundas |

---

### Regras transversais

- **Nenhuma lógica funcional será alterada** — questionários, bloqueios, reanálises, créditos, geração, editor, retratos permanecem idênticos
- **Mobile-first real** — todos os layouts testados para 390px
- **Microcopy** — "Revisar respostas", "Acessar relatório", "Ver estratégia", "Continuar jornada", "Criar conteúdo", "Refinar retrato", "Atualizar análise"
- **Consistência** — Landing = porta de entrada premium (dark). App = estúdio estratégico (light)
- **Tipografia** — Cormorant Garamond só na landing e destaques premium internos; Inter como base em todo o app

### Ordem de execução

Devido ao tamanho, recomendo executar **uma fase por vez**. Começamos pela Fase 1 (fundação + shell), depois Fase 2 (landing), Fase 3 (dashboard + páginas internas), e Fase 4 (editor + retratos + refinamentos).

