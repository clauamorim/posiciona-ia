

# Reestruturação da Navegação + Correção dos Cards de Carrossel

## Resumo

Reorganizar menu e páginas (Arquétipos, StoryBrand, Análises, Linha Editorial) + corrigir dimensões do canvas do editor visual que não renderiza corretamente o formato 1080x1080.

---

## 1. Menu lateral (`DashboardLayout.tsx`)

| Item | Rota | Ícone |
|------|------|-------|
| Dashboard | `/dashboard` | LayoutDashboard |
| Questionário do Negócio | `/business-questionnaire` | Building2 |
| Questionário de Arquétipos | `/archetype-questionnaire` | Brain |
| **Arquétipos** | `/results` | BarChart3 |
| **StoryBrand** | `/storybrand` | Target |
| **Análises** | `/report` | FileText |
| **Linha Editorial** | `/editorial` | Calendar |
| Histórico | `/history` | History |

## 2. Página Arquétipos (`Results.tsx`)
- Título → "Seus Arquétipos"
- Remover botão "Gerar Relatório com IA" e lógica `handleGenerateReport`

## 3. Questionário de Arquétipos (`ArchetypeQuestionnaire.tsx`)
- Botão final → "Calcular Arquétipos ✓"

## 4. Questionário do Negócio (`BusinessQuestionnaire.tsx`)
- Após finalizar, mostrar botão "Gerar StoryBrand" → chama edge function → navega para `/storybrand`

## 5. Nova página StoryBrand (`StoryBrand.tsx`)
- Diagrama SVG no estilo do print: círculos escuros com ícones brancos conectados por linhas em zigzag
- Fluxo: Personagem → Problema → Guia → Plano → Convida a Agir → bifurca em Sucesso / Fracasso
- Sem marca StoryBrand — apenas o diagrama do framework
- Abaixo, cards com conteúdo detalhado de cada elemento

## 6. Página Análises (`Report.tsx`)
- Título → "Suas Análises"
- Remover seção editorial inteira (linhas ~400-501): tabs de semanas, cards, botão gerar semana
- Manter: Arquétipos, Paleta, Tipografia, Tom de Voz, StoryBrand resumido, PDF

## 7. Nova página Linha Editorial (`EditorialPage.tsx`)
- Extrair seção editorial completa do Report.tsx
- Tabs de semanas, cards de dias, botão "Criar Post Visual"
- Botão "Gerar +7 dias" com lógica de créditos movida para cá

## 8. Rotas (`App.tsx`)
- `/storybrand` e `/editorial` como rotas protegidas

## 9. Correção do Canvas do Editor Visual (`PostCanvas.tsx`)

**Problema:** O container externo não tem dimensões fixas, então o `parentElement.clientHeight` retorna valores incorretos. O div de 1080x1080 escalado não reserva espaço correto no layout, causando overflow ou colapso.

**Correção:**
- Dar ao container externo uma dimensão fixa proporcional: `width` e `height` calculados como `1080 * scale`
- Usar `overflow: hidden` no container para evitar que o elemento de 1080px vaze
- Definir um tamanho mínimo razoável para o container (ex: `min-h-[500px]`)
- Usar `margin: auto` para centralizar o canvas escalado dentro do container com dimensões fixas

```text
Antes:
  <div class="flex items-center justify-center w-full">  ← sem altura definida
    <div style="width:1080; height:1080; scale(0.4)">    ← ocupa 1080px no layout

Depois:
  <div style="width: 1080*scale; height: 1080*scale">    ← reserva espaço correto
    <div style="width:1080; height:1080; scale(X); origin: top left">
```

---

## Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| `src/components/DashboardLayout.tsx` | Atualizar menu |
| `src/pages/Results.tsx` | Renomear, remover geração |
| `src/pages/ArchetypeQuestionnaire.tsx` | Texto do botão |
| `src/pages/BusinessQuestionnaire.tsx` | Botão "Gerar StoryBrand" |
| `src/pages/StoryBrand.tsx` | Criar — diagrama SVG + cards |
| `src/pages/Report.tsx` | Renomear "Análises", remover editorial |
| `src/pages/EditorialPage.tsx` | Criar — editorial extraído |
| `src/components/post-editor/PostCanvas.tsx` | Corrigir dimensões do canvas |
| `src/App.tsx` | 2 novas rotas |

