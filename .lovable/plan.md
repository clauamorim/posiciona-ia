
Objetivo: ajustar legibilidade e corrigir de vez o fluxo da logo, com foco em três pontos que continuam visíveis no editor atual.

1. Aumentar a fonte do corpo do texto
- Revisar os `bodySlot.fontSize` em `src/lib/postTemplates.ts` para subir o tamanho-base dos textos nos templates `minimal` e `cover` (square e reels), sem empurrar o bloco para baixo.
- Ajustar também a sugestão automática em `src/lib/postAutoLayout.ts` para que o editor já abra com esse tamanho maior.
- Em `src/components/post-editor/PostCanvas.tsx`, manter um fallback mínimo mais alto para o corpo quando o valor não vier do template.

2. Fazer a sombra sob o texto ficar maior e mais parecida com a referência
- Em `src/components/post-editor/PostCanvas.tsx`, substituir a sombra curta atual por um tratamento de legibilidade em duas camadas quando houver foto de fundo:
  - sombra/halo local maior atrás do bloco de texto;
  - `text-shadow` mais amplo e suave no próprio texto.
- O halo local ficará ancorado na caixa real do texto (principalmente título e corpo), com blur maior e largura suficiente para cobrir o texto inteiro, seguindo a referência enviada.
- Manter o degradê global inferior, mas reduzir sua função para apoio geral; a leitura principal passará a depender do halo localizado atrás do texto, não apenas do gradiente no rodapé.

3. Corrigir a logo que está ficando com fundo verde
- O problema principal está no fluxo de upload e remoção de fundo em `src/components/post-editor/inspector/AddElementPanel.tsx`: quando a função `remove-background` devolve a imagem com fundo verde para chroma key, esse verde está sendo salvo direto em alguns caminhos.
- Unificar a lógica de chroma key para que toda imagem retornada pela remoção de fundo passe obrigatoriamente por conversão de verde para transparência antes de:
  - salvar no storage;
  - atualizar `user_gallery_assets`;
  - inserir a imagem no canvas.
- Reaproveitar a mesma rotina de chroma key já existente em `src/lib/postAutoLayout.ts` / `src/pages/PostEditorPage.tsx`, evitando três comportamentos diferentes para a mesma ação.
- Após upload de nova logo, marcação como logo, ou remoção manual de fundo, invalidar o cache com `clearLogoCache(user.id)` para impedir que a sessão continue exibindo uma versão antiga.

4. Endurecer a validação da logo processada
- Em `src/lib/postAutoLayout.ts`, após processar a logo, validar se ainda existem grandes áreas verdes sólidas nas bordas.
- Se o arquivo ainda estiver com chroma key visível, não tratá-lo como “logo pronta”; forçar novo processamento ou manter a original fora do cache até obter transparência real.
- Isso evita repetir o caso do fundo azul-marinho que acabou trocado por verde sólido.

5. Arquivos que serão ajustados
- `src/components/post-editor/PostCanvas.tsx`
- `src/lib/postTemplates.ts`
- `src/lib/postAutoLayout.ts`
- `src/components/post-editor/inspector/AddElementPanel.tsx`
- `src/pages/PostEditorPage.tsx`

6. Resultado esperado
- O corpo do texto abrirá maior e mais legível.
- A sombra atrás do texto ficará mais ampla, suave e próxima da referência enviada.
- A logo não ficará mais com fundo verde após remoção de fundo.
- Logos novas ou reprocessadas aparecerão transparentes também após troca de conta, reload e nova montagem automática.

Detalhes técnicos
- Ajuste visual principal: aumentar `bodySlot.fontSize` e elevar o fallback de `bodyFontSize`.
- Legibilidade: criar uma camada localizada de sombra/blur atrás dos text boxes em vez de depender só do gradiente de base.
- Correção da logo: aplicar chroma key antes de persistir qualquer PNG devolvido por `remove-background`, e limpar cache de sessão após atualização da logo.
