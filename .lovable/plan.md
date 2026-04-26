Pelos prints, o problema principal é que o texto visual do card está recebendo uma versão longa, muito parecida com a legenda do Instagram. Isso deixa o card ilegível e repetitivo. A melhor solução é separar claramente as funções:

- Card: texto curto, visual, escaneável.
- Legenda: desenvolvimento completo da ideia, fora da imagem.

Plano proposto:

1. Criar uma camada de “copy visual” para o editor
   - Antes de preencher o canvas, o sistema vai normalizar `card_copy` para texto de card.
   - Para post único: limitar a uma versão curta, com gancho + insight, sem repetir a legenda inteira.
   - Para carrossel: cada slide deve ficar enxuto e independente; se algum slide vier longo demais, será compactado automaticamente.

2. Remover eco da legenda quando abrir o editor
   - Ajustar `PostEditorPage.tsx`, onde hoje o editor inicializa `editedTexts` diretamente de `day.card_copy` ou `day.caption`.
   - Evitar que `caption` vire corpo do card quando `card_copy` estiver ausente ou inadequado.
   - Implementar heurística para detectar quando `card_copy` é praticamente igual à legenda e substituir por uma versão resumida.

3. Reforçar a geração futura na IA
   - Atualizar os prompts das funções de geração de linha editorial e regeneração de post para instruir explicitamente:
     - `card_copy` nunca deve repetir a legenda.
     - `card_copy` deve ser texto de arte/card, curto.
     - `caption` deve conter o desenvolvimento completo.
   - Definir limites práticos:
     - Post único: aproximadamente 12 a 24 palavras no card.
     - Carrossel: aproximadamente 8 a 20 palavras por slide, com exceção moderada para slides explicativos.

4. Sanitizar conteúdo gerado antes de salvar
   - Ampliar `editorialSanitize.ts` para compactar `card_copy` excessivo e reduzir repetição direta com `caption`.
   - Preservar a legenda completa no campo correto.
   - Manter compatibilidade com conteúdos já gerados.

5. Melhorar a experiência no editor
   - Se um card ainda estiver longo, aplicar uma redução inicial de tamanho de fonte e/ou caixa de texto mais adequada, mas sem depender disso como solução principal.
   - O foco será corrigir a origem textual, não apenas “espremer” texto no layout.

Resultado esperado:

- Cards visualmente limpos e com texto curto.
- Legenda completa continua disponível abaixo do editor para copiar.
- Novas gerações e regenerações passam a vir com separação correta entre copy de card e legenda.
- Conteúdos antigos ficam menos problemáticos ao abrir no editor, porque a camada de normalização reduz repetições evidentes.

Detalhes técnicos:

- Arquivos principais:
  - `src/pages/PostEditorPage.tsx`
  - `src/lib/textCleanup.ts` ou novo helper em `src/lib/editorialCardCopy.ts`
  - `supabase/functions/process-content-generation-job/index.ts`
  - `supabase/functions/regenerate-single-post/index.ts`
  - `supabase/functions/_shared/editorialSanitize.ts`
- Não será necessário alterar banco de dados.
- Não será necessário perder ou apagar legendas existentes.