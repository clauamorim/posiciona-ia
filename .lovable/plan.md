

## Regeneração após atualizações da plataforma

A ideia é marcar o conteúdo antigo como "desatualizado" sempre que houver uma melhoria relevante no gerador, e permitir que o usuário regenere **sem custo** as semanas/posts afetados.

## Como vai funcionar

### 1. Versão do gerador (constante de código)
Crio uma constante `EDITORIAL_GENERATOR_VERSION` no código (ex: `"2026-04-23-v3"`). Toda vez que eu fizer correções relevantes nas edge functions de geração (prompt, parser, sanitização), incremento essa versão.

### 2. Marcar a versão usada em cada semana/post
- Ao gerar uma semana, salvo `generator_version` dentro de cada dia do array `editorial_weeks` e `content.editorial`.
- Conteúdos antigos (sem essa marca) são considerados desatualizados.

### 3. UI de aviso na Linha Editorial
Quando a aba/semana exibida tem conteúdo desatualizado:
- **Banner discreto no topo da semana**: "Esta semana foi gerada antes de melhorias na plataforma. Regenere sem custo para aplicar as correções (rótulos de framework removidos, textos mais limpos)."
- **Botão "Regenerar semana (grátis)"** ao lado do banner.
- **Em cada card de post desatualizado**: badge sutil "Desatualizado" + botão "Atualizar post (grátis)" — diferente do botão "Gerar novo" que cobra crédito.

### 4. Lógica de regeneração gratuita
- `regenerate-single-post` e `generate-content-week` recebem flag opcional `freeRegeneration: true`.
- Quando true, a edge function **pula a dedução de créditos** e exige que o post/semana original tenha `generator_version` ausente ou inferior à atual (verificação no backend pra evitar abuso).
- Substitui o conteúdo antigo no mesmo slot (mesma semana/dia) em vez de adicionar novo.

### 5. Aplicar também aos posts personalizados (Meus Designs)
Designs salvos em `user_designs` apontam para `week_index`/`day_index`. Quando o post-base é regenerado, o design fica defasado — vou exibir um aviso na página `/my-designs`: "O conteúdo-base deste design foi atualizado. [Recriar do zero]" (não sobrescrevo automaticamente o trabalho visual do usuário).

## Arquivos afetados

- `src/lib/generatorVersion.ts` (novo) — constante única de versão + helper `isOutdated(day)`.
- `supabase/functions/generate-content-week/index.ts` — injeta `generator_version` em cada dia gerado; aceita `freeRegeneration` + `replaceWeekIndex` para sobrescrever em vez de adicionar.
- `supabase/functions/regenerate-single-post/index.ts` — injeta `generator_version`; aceita `freeRegeneration` (pula dedução se versão antiga).
- `src/pages/EditorialPage.tsx` — banner por semana, badge por post, botões "Regenerar grátis", chamadas com flag.
- `src/pages/MyDesignsPage.tsx` — aviso quando o conteúdo-base foi atualizado depois do design.

## Detalhes técnicos (para referência)

- A versão do gerador fica **só no código**, não no banco. Isso permite incrementar sem migração — basta deploy.
- A edge function valida server-side: `if (freeRegeneration && oldDay.generator_version === CURRENT_VERSION) return 400`. Evita usuário burlar e regenerar grátis sem motivo.
- Conteúdo gerado antes desse sistema (sem `generator_version`) conta como desatualizado uma vez. Após a primeira regeneração gratuita, passa a contar como atualizado.

## Fora do escopo

- Notificação por e-mail informando que há regeneração disponível.
- Histórico de versões anteriores (substituição é destrutiva — usuário regenera, perde o anterior).
- Regenerar automaticamente todos os usuários em massa (deixo na mão do usuário pra não consumir recursos do Lovable AI sem necessidade).

