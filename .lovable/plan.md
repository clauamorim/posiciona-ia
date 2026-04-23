## Pacote único de correções do Editor de Posts

Implementação consolidada de 6 frentes em uma única passada, sem novas aprovações intermediárias.

### 1. Loading overlay para Unsplash e IA
- Em `PostEditorPage.tsx`, adicionar estado `initializingLayout` com mensagem dinâmica.
- Mostrar overlay com barra de progresso indeterminada cobrindo o canvas enquanto:
  - Unsplash busca a foto ("Buscando foto editorial...")
  - IA gera a imagem ("Gerando imagem com IA...")
  - Logo é processada ("Preparando logo...")
- Só liberar interação quando o layout estiver pronto.
- Em caso de erro, fechar overlay e mostrar toast claro (sem cair no minimalista por engano).

### 2. Caixa de texto semitransparente sobre foto
- Em `postAutoLayout.ts` e `PostCanvas.tsx`, quando houver foto de fundo (Unsplash ou IA):
  - Aplicar degradê vertical `linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0) 100%)` cobrindo os 45% inferiores.
  - Texto branco fixo com leve text-shadow para garantir contraste.
- Remover blocos sólidos antigos que cobriam a imagem.

### 3. Minimalista sempre completo + fallback decorado
- Em `postTemplates.ts` e `postAutoLayout.ts`, garantir que o estilo minimalista sempre receba:
  - Gradiente de fundo da paleta
  - Moldura interna sutil
  - Linha decorativa
  - Ornamento central
  - Slot de logo
- Se Unsplash ou IA falharem, cair no mesmo conjunto decorado (não em tela vazia).

### 4. Logo com transparência real
- Em `postAutoLayout.ts`, refatorar `fetchUserLogo`:
  - Buscar a logo `is_logo = true` mais recente (não a mais antiga).
  - Carregar a imagem em canvas e usar `getImageData` para verificar se há pixels com alpha < 255.
  - Se não houver transparência real, chamar a edge function `remove-background` automaticamente, atualizar `bg_removed = true` no banco e usar a versão tratada.
  - Cache em sessionStorage por user_id para evitar reprocessar a cada slide.
- No upload de logo (`AddElementPanel.tsx`), ao marcar `is_logo`, desmarcar as outras logos do mesmo usuário e gravar `bg_removed` corretamente após processar.

### 5. Débito de 1 crédito de regeneração por imagem IA
- Em `PostEditorPage.tsx`, no botão "Gerar com IA":
  - Antes de chamar: verificar `user_balances.regeneration_credits > 0`. Se zero, bloquear com toast e link para a página de planos.
  - Chamar a edge function de geração.
  - Só após receber a imagem com sucesso: decrementar `regeneration_credits` em `user_balances` e inserir registro em `credit_logs` (`credit_type = 'regeneration'`, `amount = -1`, `description = 'Geração de imagem IA no editor'`).
  - Em caso de falha, não debitar e mostrar erro.
  - Chamar `refreshSubscription()` do `AuthContext` para atualizar o saldo na UI.

### 6. Snap, Grade e tooltips
- Em `PostCanvas.tsx`, corrigir renderização da grade (sobreposição com 8% opacidade nas linhas a cada 40px).
- Em `PostToolbar.tsx` / `DocumentPanel.tsx`:
  - Adicionar tooltips explicativos:
    - **Grade**: "Mostra linhas-guia para alinhar elementos"
    - **Snap**: "Faz os elementos grudarem na grade ao mover"
    - **Réguas**: "Mostra réguas com coordenadas em pixels"
  - Mover toggle de "Snap" para dentro de um menu de configurações de canvas (ícone de engrenagem), mantendo "Grade" e "Réguas" visíveis na barra principal.

### Arquivos a modificar

- `src/pages/PostEditorPage.tsx`
- `src/components/post-editor/PostCanvas.tsx`
- `src/components/post-editor/PostToolbar.tsx`
- `src/components/post-editor/inspector/AddElementPanel.tsx`
- `src/components/post-editor/inspector/DocumentPanel.tsx`
- `src/lib/postAutoLayout.ts`
- `src/lib/postTemplates.ts`

### Banco de dados
- Nenhuma migração nova necessária. Usaremos colunas existentes: `user_balances.regeneration_credits`, `credit_logs`, `user_gallery_assets.bg_removed`, `user_gallery_assets.is_logo`.

### Resultado esperado
- Unsplash e IA não abrem mais como minimalista — mostram loading e só revelam quando o layout está pronto.
- Texto sobre foto fica sempre legível com degradê preto translúcido.
- Minimalista volta a ter gradiente, moldura, linha e ornamento.
- Logo entra transparente de verdade, sem precisar do botão manual.
- Cada geração IA bem-sucedida debita 1 crédito; falhas não cobram.
- Grade renderiza, Snap fica explicado e fora da barra principal.
