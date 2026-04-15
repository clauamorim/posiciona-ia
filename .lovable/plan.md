

# Plano: Revisão Visual e de Consistência Completa — Posiciona

Este plano abrange a refatoração visual, UX e de consistência de toda a aplicação. A lógica de negócio permanece intacta. O trabalho será dividido em fases para garantir controle e qualidade.

---

## Fase 1: Design System e Fundação Visual

### 1.1 Utilitário de limpeza de texto (pós-processamento)
- Criar `src/lib/textCleanup.ts` com funções para:
  - Remover markdown bruto (`**texto**` → texto em negrito via JSX, `*texto*` → itálico)
  - Corrigir pontuação dupla (`.,`, `..`, `, ,`, espaços extras)
  - Renderizar texto limpo como componente React (`<CleanText>`)
- Aplicar nos outputs de StoryBrand, Linha Editorial e Arquétipos

### 1.2 Tokens visuais e design system
- Atualizar `src/index.css`:
  - Ajustar variáveis da área logada para tons levemente tonalizados (não branco puro)
  - Background workspace: `hsl(250, 15%, 96%)` em vez de `hsl(40, 10%, 95%)`
  - Cards com fundo levemente mais quente/profundo
  - Manter landing page intacta
- Padronizar em `button.tsx`:
  - Garantir altura mínima de toque (44px no mobile)
  - Reforçar contraste nos estados outline e ghost
  - Estados disabled claramente distintos dos ativos

### 1.3 Componentes compartilhados
- Criar `src/components/ui/section-header.tsx` — título + subtítulo padronizado
- Criar `src/components/ui/stat-card.tsx` — card de métrica/crédito reutilizável
- Criar `src/components/ui/empty-state.tsx` — estado vazio padronizado
- Criar `src/components/CleanText.tsx` — renderizador de texto limpo (markdown → JSX)

---

## Fase 2: Sidebar e Navegação Mobile

### 2.1 DashboardLayout — Sidebar mobile
- Aumentar área de toque para mínimo 44px por item (`py-3` em vez de `py-2`)
- Aumentar padding geral da sidebar
- Destacar item ativo com fundo sólido `bg-sidebar-primary` + borda lateral
- Separar visualmente navegação principal de ações secundárias (contato, sair)
- Adicionar `pb-8` no rodapé para margem de segurança da barra nativa
- Tornar a sidebar mais premium (gradiente sutil no topo, logo com mais presença)

---

## Fase 3: Landing Page

### 3.1 Ajustes de conversão
- Reduzir `py-16 md:py-20` para `py-12 md:py-16` nas seções mobile (~25% menos padding)
- Botão "Ver como funciona": trocar para `border-landing-purple text-landing-purple` com hover claro
- Seção de entregáveis: destacar 3 principais (Arquétipos, StoryBrand, Calendário) com borda/cor diferenciada, compactar os demais
- Plano "Autoridade Total": adicionar badge "Mais completo", fundo levemente diferenciado
- CTA final: trocar "Criar minha conta agora" por "Começar meu posicionamento agora"
- WhatsApp: ajustar para `bottom-20` no mobile para não cobrir CTAs

### 3.2 Seção de demonstração (oculta)
- Criar seção entre "Como funciona" e "Entregáveis" com `hidden` por padrão
- Estrutura: título, subtítulo, container para vídeo OU carrossel de prints, CTA
- Flag `const SHOW_DEMO_SECTION = false` para ativar depois
- Responsiva e preparada para ambos formatos

---

## Fase 4: Página Sobre

- Aumentar foto para `w-44 h-44 md:w-56 md:h-56`
- No mobile, dar mais presença à foto (centralizada, sem compressão)
- Mover menção a "Ciência da Computação" para mais cedo no fluxo
- Adicionar bloco de destaque visual (pullquote) entre seções de texto
- Reduzir densidade dos parágrafos com melhor espaçamento

---

## Fase 5: Dashboard

- Fundo do header de boas-vindas com gradiente sutil roxo→transparente
- Card "Próximo passo": aumentar destaque, borda primary mais forte, ícone maior
- Card de créditos: redesenhar com `stat-card` padronizado, substituir "Regenerações" por "Ajustes de conteúdo"
- Stepper de jornada: redesenhar com linha conectora visual, ícones maiores, status mais claro
- Cards de entregas: hover mais marcado, status com badge colorido
- Sugestão contextual: transformar em card sutil com borda dourada em vez de link solto

---

## Fase 6: Questionários

### 6.1 Questionário do Negócio
- Redesenhar stepper: linha de progresso horizontal com etapa atual destacada em roxo
- Aumentar protagonismo do campo atual (fundo levemente diferenciado)
- CTA "Próximo" sempre dominante, "Anterior" ghost
- Remover numeração escolar dos campos, usar labels mais limpos
- Melhorar card do campo com bordas sutis e foco visual

### 6.2 Questionário de Arquétipos
- **Trocar os 72 sliders por grupo de 5 botões (1 a 5)** em cada pergunta
  - Cada botão exibe o número (1–5) e ao ser clicado seleciona o score
  - Botão selecionado com fundo `bg-primary text-primary-foreground`, demais em `outline`
  - Manter labels descritivos abaixo: "Discordo totalmente" à esquerda, "Concordo totalmente" à direita
  - Área de toque mínima de 44px por botão, espaçamento equilibrado
  - Resulta em cards significativamente mais compactos que os sliders atuais
- Reduzir altura geral dos cards de pergunta (menos padding vertical)
- Melhorar barra de progresso (mais fina, com percentual)
- Reduzir espaçamento entre perguntas

---

## Fase 7: Arquétipos (Results)

- Reduzir altura dos cards Top 3 (menos padding, layout mais denso)
- Escala visual: primário maior, secundário médio, terciário menor
- Borda colorida lateral em vez de apenas topo
- Adicionar frase de insight por arquétipo (já vem do LLM, dar mais destaque)
- Ranking completo: agrupar top 3 separado dos demais, linhas alternadas

---

## Fase 8: StoryBrand / Narrativa de Marca

- Implementar modo resumido/expandido por bloco (Collapsible)
- Estado fechado: ícone + título + primeira frase (truncada)
- Estado aberto: conteúdo completo com `<CleanText>`
- Botão copiar: menor, inline, ícone apenas sem label
- Resumo executivo: card com fundo mais marcado, tipografia mais forte
- Aplicar `<CleanText>` em todos os textos para remover markdown bruto

---

## Fase 9: Linha Editorial

- Diferenciar visualmente carrossel/reels/post com cores e ícones mais marcados
- Estado fechado do card: dia + formato + tema (uma linha)
- Estado expandido: legenda, CTA, conteúdo completo
- Cards com borda lateral colorida por formato
- Ações agrupadas de forma mais limpa (ícones menores, agrupados)
- "Gerar +7 dias": transformar em card de upsell com fundo sutil e borda dourada

---

## Fase 10: Instagram Analysis

- Redesenhar estado vazio com ilustração e instruções claras
- Texto orientativo: "Envie um print da página principal do seu perfil mostrando bio, foto de perfil e os 9 primeiros posts."
- Área de upload mais aspiracional (borda tracejada, ícone grande, hover premium)
- Botão principal: garantir que pareça ativo (não desabilitado)
- Resultados: melhorar tabela/cards de análise

---

## Fase 11: Retratos de Marca

- Corrigir layout do título no mobile (coluna única)
- Bloco de saldo: redesenhar com stat-card
- Área de upload: borda tracejada premium, instruções visuais para selfies
- Cards de looks: mais visuais, com preview ou ícone representativo
- Tornar a experiência mais "estúdio de marca" e menos "uploader de arquivos"

---

## Fase 12: Editor de Posts

- Preview/canvas com mais protagonismo (maior, centralizado)
- Controles organizados em grupos recolhíveis (Collapsible)
- Preview sticky no desktop
- Paleta de cores mais coerente com a marca
- Navegação entre slides mais elegante
- Reduzir empilhamento vertical excessivo

---

## Arquivos principais afetados

| Arquivo | Mudança |
|---------|---------|
| `src/index.css` | Tokens visuais da área logada |
| `src/components/ui/button.tsx` | Altura mínima mobile, contraste |
| `src/components/DashboardLayout.tsx` | Sidebar mobile premium |
| `src/components/CleanText.tsx` | **Novo** — renderizador de texto limpo |
| `src/lib/textCleanup.ts` | **Novo** — utilitário de limpeza |
| `src/components/ui/section-header.tsx` | **Novo** — header padronizado |
| `src/components/ui/empty-state.tsx` | **Novo** — estado vazio padronizado |
| `src/pages/LandingPage.tsx` | Spacing, botões, planos, demo oculta, CTA |
| `src/pages/SobrePage.tsx` | Foto, hierarquia, pullquote |
| `src/pages/Dashboard.tsx` | Visual premium, créditos, stepper |
| `src/pages/BusinessQuestionnaire.tsx` | Stepper, campos, UX |
| `src/pages/ArchetypeQuestionnaire.tsx` | **Sliders → botões 1-5**, compactação, progresso |
| `src/pages/Results.tsx` | Cards top 3, ranking |
| `src/pages/StoryBrand.tsx` | Collapsible, CleanText, copiar discreto |
| `src/pages/EditorialPage.tsx` | Formato visual, estados, upsell |
| `src/pages/InstagramAnalysis.tsx` | Estado vazio, upload, instruções |
| `src/pages/PortraitGenerator.tsx` | Layout mobile, upload premium |
| `src/pages/PostEditorPage.tsx` | Preview protagonista, controles agrupados |

---

## Ordem de execução sugerida

1. Fase 1 (fundação) → 2 (sidebar) → 3 (landing) → 4 (sobre)
2. Fase 5 (dashboard) → 6 (questionários) → 7 (arquétipos)
3. Fase 8 (StoryBrand) → 9 (editorial) → 10 (Instagram)
4. Fase 11 (retratos) → 12 (editor)

Cada fase será implementada e pode ser verificada antes de avançar.

