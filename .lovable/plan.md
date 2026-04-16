

# Plano: Refatoração do editor de posts + persistência de mídia e designs

## Parte 1 — Refatoração do sidebar (Inspector contextual)

**Problema:** `PostToolbar.tsx` (1002 linhas) repete controles de cor para título, corpo, CTA, número do slide, ícones, molduras e textbox. O usuário rola muito e há paletas duplicadas.

**Solução — 3 zonas fixas:**

1. **Documento** (sempre visível, compacto): Formato (1:1/Reels), Cor de fundo + gradiente, Layout, Numeração de slides (carrossel), botão "Resetar".
2. **Elemento selecionado** (aparece só quando algo está selecionado):
   - **Título principal**: fonte, tamanho, cor — controles atuais migrados pra cá quando `selectedTextId === "title"`.
   - **Corpo de texto**: fonte, tamanho, peso, itálico, alinhamento, cor — quando body está selecionado.
   - **CTA**: texto, tamanho, cor de fundo, cor do texto, ordem de camada.
   - **Número do slide**: tamanho, cor de fundo, cor do texto.
   - **Imagem/foto**: opacidade, remover fundo, ordem de camada.
   - **Ícone/SVG**: cor, opacidade, ordem de camada.
   - **Caixa de texto livre**: cor texto, cor fundo, tamanho, ordem de camada.
   - **Sem seleção**: dica curta "Selecione um elemento para editar".
3. **Adicionar elemento** (em tabs compactas para reduzir altura):
   - Tabs: `Texto | Upload | Galeria | Retratos | Ícones | Molduras`
   - "Cor de novos elementos" aparece **uma vez só** dentro das tabs Ícones/Molduras (como default global).

**Implementação:** refatorar `PostToolbar.tsx` em 3 sub-componentes em `src/components/post-editor/inspector/`:
- `DocumentPanel.tsx`
- `SelectionPanel.tsx` (com switch interno por tipo de seleção)
- `AddElementPanel.tsx` (com `Tabs` do shadcn)

`PostEditorPage.tsx` precisa expor `selectedTextId` mais granularmente (já tem `selectedTextId` para títulos, falta diferenciar "title" vs "body"). Adicionar estado `selectedElementKind: "title" | "body" | "cta" | "slideNumber" | null` derivado das seleções existentes.

**Resultado:** sidebar ~50% menor, sem paletas repetidas, edição contextual.

---

## Parte 2 — Persistir uploads do usuário na Galeria

**Problema:** uploads vão para `uploadedImages` (sessionStorage). Some entre sessões e entre dias diferentes.

**Solução:**
- Criar bucket `user-uploads` (privado, leitura/escrita só para o owner).
- Criar tabela `user_gallery_assets` (user_id, name, file_path, created_at) com RLS por owner.
- Quando usuário faz upload via "Upload Imagem":
  1. Comprimir (já existe `compressImage`)
  2. Upload pro bucket `user-uploads/{user_id}/{uuid}.{ext}`
  3. Insert em `user_gallery_assets`
  4. Adicionar como overlay no canvas (comportamento atual)
- Tab "Galeria" do inspector mostra **duas seções**: "Minhas imagens" (do usuário) + "Galeria Posiciona" (admin, atual).

**Migration necessária:** nova tabela + bucket + policies.

---

## Parte 3 — Deletar imagens da Galeria pessoal

- Ícone trash no hover de cada miniatura em "Minhas imagens".
- Confirm dialog ("Excluir esta imagem?").
- Ao confirmar: `DELETE` em `user_gallery_assets` + `storage.remove()`.
- Refresh da lista local.
- **Não remove instâncias já colocadas** no canvas (overlays já usam o data URL/URL pública carregada — continuam funcionando até o usuário sair).

---

## Parte 4 — Deletar retratos do histórico

**Problema:** RLS atual de `portrait_generations` não permite DELETE para o usuário (só admin).

**Solução:**
- Migration: adicionar policy `Users can delete own portraits` em `portrait_generations`.
- Em `HistoryPage.tsx` aba Retratos: trash icon no hover de cada miniatura.
- Confirm dialog. Ao confirmar:
  - Se a row tem só esse retrato no array `portraits`: delete row inteira.
  - Se tem múltiplos: update removendo só aquele índice do JSONB.
- Refresh lista.
- "Meus Retratos" no editor recarrega da tabela quando aberto.

---

## Parte 5 — Salvar e listar designs criados

**Solução MVP:**

**Nova tabela** `user_designs`:
- `id`, `user_id`, `title` (auto: "Dia X — Tema"), `week_index`, `day_index`
- `thumbnail` (text — data URL PNG ~300px gerado via html2canvas no save)
- `state` (jsonb — payload completo do `EditorDraft` atual)
- `created_at`, `updated_at`
- RLS: owner-only CRUD.

**Comportamento:**
- Botão "Salvar design" no editor (ao lado de Baixar PNG): captura thumbnail + serializa estado completo → upsert por `(user_id, week_index, day_index)` ou cria novo se usuário clicar "Salvar como novo".
- Auto-save silencioso a cada mudança (debounced 5s) atualizando `updated_at` se já existe um design para aquele dia.

**Nova página** `/my-designs` (link no sidebar inferior, perto de "Histórico"):
- Grid de cards: thumbnail + título + "editado há X" (ordenado por `updated_at` desc).
- Agrupamento leve: "Hoje", "Esta semana", "Mais antigos".
- Ações por card: **Abrir** (navega `/post-editor?week=X&day=Y&design=ID` — carrega state da row), **Duplicar** (insert nova row com copy do state), **Excluir** (delete + confirm).

**Em `PostEditorPage.tsx`:** se `?design=ID` presente, hidrata estado a partir da row; senão usa fluxo atual (sessionStorage draft).

**Imagens grandes:** o `state` contém data URLs base64. Para evitar rows muito grandes, fazer upload de `overlayImages` que sejam data URLs > 100KB para `user-uploads/designs/{design_id}/{overlay_id}.png` e guardar URL no JSONB. Reutiliza bucket da Parte 2.

---

## Arquivos

**Novos:**
- `src/components/post-editor/inspector/DocumentPanel.tsx`
- `src/components/post-editor/inspector/SelectionPanel.tsx`
- `src/components/post-editor/inspector/AddElementPanel.tsx`
- `src/pages/MyDesignsPage.tsx`
- 1 migration (tabela `user_gallery_assets`, tabela `user_designs`, bucket `user-uploads`, RLS, policy de delete em `portrait_generations`)

**Modificados:**
- `src/components/post-editor/PostToolbar.tsx` → vira shell que monta os 3 painéis
- `src/pages/PostEditorPage.tsx` → load/save de design via query param, integração com `user_gallery_assets`, controle `selectedElementKind`
- `src/pages/HistoryPage.tsx` → botão excluir retrato
- `src/components/DashboardLayout.tsx` → item "Meus Designs" no footer
- `src/App.tsx` → rota `/my-designs`

Sem mudanças em geração de relatório, créditos ou Stripe.

