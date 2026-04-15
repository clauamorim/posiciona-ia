

# Plano Atualizado: Revisão Visual e de Consistência Completa — Posiciona

Única alteração em relação ao plano anterior: na Fase 13.2, a renomeação "StoryBrand" → "Narrativa da Marca" agora **preserva** a palavra "StoryBrand" na frase "Sua jornada StoryBrand aplicada ao posicionamento" na página `/storybrand` (`src/pages/StoryBrand.tsx`).

---

## Fases 1–7: Concluídas

Sem alterações.

---

## Fase 8: Narrativa da Marca (StoryBrand)

- Collapsible por bloco (fechado: ícone + título + primeira frase truncada)
- `<CleanText>` em todos os textos
- Botão copiar discreto (ícone inline)
- Resumo executivo com fundo mais marcado

---

## Fase 9: Linha Editorial

- Diferenciação visual por formato (carrossel/reels/post)
- Estados fechado/expandido
- Borda lateral colorida por formato
- Upsell "+7 dias" com card dourado
- **Bug fix: corrigir erro ao clicar em "+7 dias"** — verificar `data?.error` além de `error` no retorno de `supabase.functions.invoke`, e tratar `data.editorial` undefined

---

## Fase 10: Instagram Analysis

- Estado vazio redesenhado com instruções claras
- Upload aspiracional, botão ativo visualmente

---

## Fase 11: Retratos de Marca

- Layout mobile em coluna única, upload premium, stat-card para saldo

---

## Fase 12: Editor de Posts

- Preview protagonista e sticky, controles em grupos recolhíveis

---

## Fase 13: Renomeação Global e Correções Transversais

### 13.1 "regeneração/regenerações" → "ajustes de conteúdo"
Arquivos: `LandingPage`, `ChoosePlan`, `EditorialPage`, `HelpPage`, `AdminUsers`, Stripe.

### 13.2 "StoryBrand" → "Narrativa da Marca" (labels visíveis)
Arquivos: `DashboardLayout`, `LandingPage`, `ChoosePlan`, `SobrePage`, `HelpPage`, `Results`, `HistoryPage`, `StoryBrand.tsx`.

**Exceção:** manter "StoryBrand" na frase **"Sua jornada StoryBrand aplicada ao posicionamento"** em `StoryBrand.tsx` (subtítulo da página). Apenas o título principal da página muda para "Narrativa da Marca".

Não alterar: chaves de dados, reportParser, queries, edge functions, rotas.

### 13.3 Frase hero da landing — incluir retratos
"...entrega estratégia, calendário, conteúdo pronto para publicar e retratos de marca..."

### 13.4 Cards de entregáveis — bordas consistentes
Todos com `border-landing-border/40`, destacados apenas via ring/fundo.

### 13.5 Retratos no Histórico não carregam
`loading="lazy"` + fallback `onError` em `HistoryPage.tsx`.

---

## Ordem de execução

1. Fases 1–7 — concluídas
2. Fase 8 → 9 (com bug fix +7 dias) → 10
3. Fase 11 → 12
4. Fase 13 (renomeação global + correções transversais)

