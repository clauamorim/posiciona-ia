

# Plano: Corrigir Dashboard — próximo passo e duplicatas

## Problemas identificados

1. **"Gerar linha editorial" aparece como próximo passo** mesmo quando a linha editorial já foi gerada automaticamente. A variável `hasEditorial` verifica `editorial_weeks` no relatório, mas a geração automática pode não estar sendo detectada corretamente.

2. **"Linha Editorial" e "Conteúdos" são a mesma coisa** — ambos apontam para `/editorial`. Aparecem duplicados na jornada e nas entregas.

## Solução

### Arquivo: `src/pages/Dashboard.tsx`

1. **Melhorar detecção de editorial**: Além de checar `editorial_weeks` no relatório, verificar também a tabela de conteúdos gerados (se existir) para garantir que a editorial gerada automaticamente seja reconhecida.

2. **Unificar "Conteúdos" e "Linha Editorial"**: Remover o item duplicado "Conteúdos" tanto da lista `journeySteps` (progresso da jornada) quanto da lista de "Entregas disponíveis", mantendo apenas "Linha Editorial".

3. **Corrigir lógica do próximo passo**: Após unificar, o `getNextStep()` não mostrará mais "Gerar linha editorial" quando `hasEditorial` for `true`, pulando direto para retratos.

### Arquivo: `src/components/DashboardLayout.tsx`

4. **Remover item duplicado "Conteúdos" do menu lateral**: No grupo "Produção", o item "Conteúdos" (que aponta para `/editorial`) é redundante com "Linha Editorial" no grupo "Estratégia". Remover o item duplicado.

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Dashboard.tsx` | Remover "Conteúdos" duplicado da jornada e entregas |
| `src/components/DashboardLayout.tsx` | Remover "Conteúdos" duplicado do menu lateral |

