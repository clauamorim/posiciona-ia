

# Plano: Dashboard Premium + Página Plano e Créditos Completa

## Resumo

Reorganizar o Dashboard para ser um centro de progresso (não uma vitrine comercial) e mover toda a venda para a página "Plano e Créditos".

---

## 1. Dashboard — Nova hierarquia

**Arquivo:** `src/pages/Dashboard.tsx`

A nova ordem dos blocos será:

1. **Saudação + estado contextual** — manter como está, com mensagens mais editoriais
2. **Próximo passo** — manter o card de ação principal (sem alterações)
3. **Plano atual + Créditos** — manter os dois cards lado a lado, aparência informativa
4. **Progresso da jornada** — mover para cima, logo após créditos
5. **Entregas disponíveis** — manter o grid de entregas
6. **Sugestão contextual discreta** (novo) — substituir os blocos grandes de upgrade e extras por uma única linha sutil:
   - Aparece **apenas** quando relevante (ex: 0 retratos, ciclos esgotados, plano inferior)
   - Texto tipo: "Quer ampliar seus recursos? Veja opções de upgrade e extras →"
   - Link para `/choose-plan`
   - Sem botões de compra, sem preços, sem destaque visual agressivo

**Remoções:**
- Bloco grande de upgrade (linhas 157-200) — removido do dashboard
- `<ExtrasSection />` (linha 265) — removido do dashboard
- Import de `ExtrasSection`, `ArrowUp`, `Loader2` — limpar
- Estado `loadingUpgrade` e função `handleUpgrade` — remover do dashboard (fica só no ChoosePlan)

---

## 2. Página "Plano e Créditos" — Concentrar a venda

**Arquivo:** `src/pages/ChoosePlan.tsx`

Adicionar à página existente (que já tem cards de planos, créditos e upgrade):

- **Seção de Extras** — importar e renderizar `<ExtrasSection />` abaixo dos cards de planos, para que semana extra e packs de retrato fiquem acessíveis aqui
- **Cupons** — manter o input de cupom existente
- **Descrição do plano atual vs superior** — adicionar um texto curto abaixo do card do plano atual resumindo os benefícios do próximo nível
- Envolver tudo com `<DashboardLayout>` para manter a sidebar (atualmente a página não tem sidebar)

---

## 3. Regras de exibição contextual no Dashboard

A sugestão discreta no dashboard aparece condicionalmente:

| Condição | Texto |
|----------|-------|
| Plano `semana_conteudo` e já usou o ciclo | "Seu ciclo de conteúdo foi utilizado. Amplie seus recursos →" |
| 0 retratos disponíveis | "Sem retratos disponíveis. Adquira mais na página de planos →" |
| 0 regenerações | "Suas regenerações acabaram. Veja opções para continuar →" |
| Plano inferior (não `autoridade_total`) | "Seu plano pode ser ampliado. Conheça as opções →" |
| Nenhuma condição ativa | Não exibe nada |

Nunca exibir se o usuário acabou de entrar e ainda tem todos os créditos intactos.

---

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/Dashboard.tsx` | Remover upgrade/extras, adicionar sugestão contextual sutil, reordenar blocos |
| `src/pages/ChoosePlan.tsx` | Adicionar `ExtrasSection`, envolver com `DashboardLayout`, melhorar layout |

