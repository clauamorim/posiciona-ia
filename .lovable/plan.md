

## Plano: Gerar StoryBrand automaticamente após cálculo dos arquétipos

### Problema

O fluxo atual exige que o usuário volte manualmente à página do Questionário do Negócio para clicar "Gerar StoryBrand". Isso é confuso — o botão só aparece lá, mas o usuário já avançou para Results.

Fluxo atual:
```text
Business Q → Archetype Q → Results (dead end)
                              ↑ usuário precisa voltar ao Business Q para gerar
```

### Solução

Mover a geração do StoryBrand para a página **Results** (`src/pages/Results.tsx`). Após calcular e salvar os arquétipos, exibir um botão "Gerar StoryBrand" (ou disparar automaticamente). Após geração bem-sucedida, redirecionar para `/storybrand`.

Fluxo corrigido:
```text
Business Q → Archetype Q → Results → gera StoryBrand → /storybrand
```

### Implementação

**Arquivo: `src/pages/Results.tsx`**
- Após salvar os scores e top 3 archetypes, verificar se já existe um report `completed`
- Se não existir, exibir botão "Gerar Estratégia StoryBrand" (com ícone Sparkles e loading)
- A lógica de geração é a mesma que está em `BusinessQuestionnaire.handleGenerateStoryBrand`: busca o business questionnaire, profile niche, top archetypes, invoca `generate-report`, salva o resultado
- Após sucesso, bloqueia ambos os questionários (business e archetype) e redireciona para `/storybrand`
- Se já existir report completo, mostrar botão "Ver StoryBrand" que navega para `/storybrand`

**Arquivo: `src/pages/BusinessQuestionnaire.tsx`**
- Remover o bloco de "Gerar StoryBrand" (linhas ~230-268) pois a geração agora acontece em Results
- Manter o fluxo de submissão que navega para `/archetype-questionnaire`

### Detalhes técnicos
- A função `generate-report` já recebe `{ business, niche, archetypes }` — nada muda no backend
- O bloqueio dos questionários (`status: "locked"`) continua sendo feito após geração bem-sucedida
- Se o report já existe com status `completed`, o botão muda para "Ver StoryBrand" evitando regeneração acidental

