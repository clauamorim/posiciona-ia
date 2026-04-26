Vou corrigir a causa real: existem dois fluxos diferentes chamados “estilo”. A alteração anterior foi feita no painel interno de troca de imagem, mas o problema relatado acontece antes de entrar no editor, na janela “Minimalista / Com foto / Com foto IA”. Hoje, ao escolher “Com foto IA”, o app navega direto para o editor com `style=ai`, e o auto-layout começa a gerar a imagem imediatamente, sem pedir o estilo visual.

Plano de correção:

1. Separar claramente os dois tipos de escolha
   - Manter a primeira janela como escolha do tipo de post:
     - Minimalista
     - Com foto
     - Com foto IA
   - Quando o usuário escolher “Com foto IA” e clicar em “Abrir com este estilo”, não navegar ainda para o editor.
   - Abrir uma segunda janela obrigatória para escolha do estilo visual da IA.

2. Adicionar a segunda janela no fluxo correto
   - Na própria `StyleSelectionModal`, incluir um passo/janela de seleção com:
     - Minimalista
     - Editorial Luxo
     - Moderno Vibrante
     - Humano e Acolhedor
     - Autoridade Técnica
   - O estilo selecionado ficará destacado visualmente.
   - Só depois da seleção o app navegará para o editor e iniciará a geração.

3. Passar o estilo visual até a geração inicial
   - Ao confirmar o estilo visual, adicionar um parâmetro na navegação, por exemplo `aiVisualStyle=minimal`.
   - No `PostEditorPage`, ler esse parâmetro e repassar a diretiva correspondente para `buildAutoLayout`.
   - Em `buildAutoLayout`, quando `style === "ai"`, repassar essa diretiva para `generateAIImage`.
   - A imagem inicial gerada por IA passará a receber o texto invisível correto no prompt do Gemini.

4. Evitar geração sem escolha de estilo
   - Se o usuário chegar ao editor com `style=ai` sem um estilo visual válido, usar um fallback seguro ou impedir a geração automática até que o estilo seja definido.
   - O objetivo é eliminar o comportamento atual de “clicou em Com foto IA e já começou a gerar”.

Arquivos que serão ajustados:
- `src/components/post-editor/StyleSelectionModal.tsx`
- `src/pages/EditorialPage.tsx`
- `src/pages/PostEditorPage.tsx`
- `src/lib/postAutoLayout.ts`

Resultado esperado:
- Clique em “Com foto IA” na primeira janela.
- Clique em “Abrir com este estilo”.
- Abre uma segunda janela com os 5 estilos visuais.
- Usuário seleciona um estilo visual.
- Só então o editor abre e a imagem IA começa a ser gerada com o estilo escolhido concatenado ao prompt.