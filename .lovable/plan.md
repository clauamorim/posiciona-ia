

## Onde estão as imagens IA / Unsplash hoje

As fotos que você usa em posts (Unsplash escolhida na busca, IA gerada, ou foto que veio do template automático) são salvas, ao clicar em **"Salvar design"**, no banco `user_gallery_assets` e no bucket `user-uploads`. Cada item guarda:

- `source`: `unsplash`, `ai` ou `upload`
- `attribution`: créditos do fotógrafo (Unsplash)
- `is_logo`: se é a logo da marca

**Mas hoje você só consegue ver essa galeria de dentro do editor**, no painel lateral direito, em duas situações:

1. Painel **"Imagem"** (quando uma foto está selecionada) → seção **"Suas imagens salvas"** no topo, antes da busca do Unsplash.
2. Painel **"Adicionar elemento"** → aba **"Galeria"** → botão **"Suas imagens"**.

Não existe ainda uma página dedicada fora do editor (ex: em `/my-designs` ou no menu lateral) onde você veja todas as suas fotos salvas, com filtros por origem (IA / Unsplash / Upload) e poder excluir/reaproveitar.

---

## Pacote de correções 6 — Galeria pessoal de imagens

### 1. Nova página `/my-gallery`
- Nova rota acessível pelo menu lateral (`DashboardLayout`) com o nome **"Minha galeria"**.
- Lista todas as imagens de `user_gallery_assets` do usuário em grid responsivo (4:5 e quadrado conforme a foto), ordenadas por mais recentes.
- Filtros no topo: **Todas | Geradas por IA | Unsplash | Uploads | Logos**.
- Cada card mostra:
  - Miniatura.
  - Badge da origem (IA / Unsplash / Upload).
  - Crédito do fotógrafo quando for Unsplash.
  - Botões: **Usar em novo post**, **Baixar**, **Excluir**.

### 2. Reaproveitamento direto
- Botão **"Usar em novo post"** abre o editor (`/post-editor?fromGallery=ASSET_ID`) já com a imagem inserida como overlay de foto no canvas em branco (4:5 padrão).
- O `PostEditorPage` recebe o parâmetro, busca o asset, monta um overlay `type=photo` cobrindo o canvas e segue o fluxo normal.

### 3. Atalho no editor
- No painel **"Imagem"** dentro do editor, adicionar um link **"Ver toda a galeria"** que leva para `/my-gallery` em nova aba (sem perder o design em edição).

### 4. Indicador visual de salvamento
- Ao clicar em "Salvar design" no editor, mostrar no toast: *"Design salvo. X foto(s) adicionada(s) à sua galeria."* quando houver fotos novas vindas de IA/Unsplash.

### Arquivos editados
- `src/pages/MyGalleryPage.tsx` (novo).
- `src/App.tsx` (rota `/my-gallery`).
- `src/components/DashboardLayout.tsx` (item de menu "Minha galeria").
- `src/components/post-editor/inspector/ImageGalleryPanel.tsx` (link "Ver toda a galeria").
- `src/pages/PostEditorPage.tsx` (suporte ao parâmetro `?fromGallery=ID`, toast com contagem).

### Resultado esperado
- Você passa a ter um lugar fixo no menu para revisitar tudo que já gerou ou salvou.
- Pode reusar uma foto IA em outro post sem precisar gerar de novo (e sem gastar crédito).
- Pode limpar a galeria removendo o que não interessa mais.

