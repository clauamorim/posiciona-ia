

## Plano: Rebranding para "Posiciona" + novas funcionalidades

### 1. Renomear ArcheBrand → Posiciona

**Arquivos afetados:** `index.html`, `src/pages/LandingPage.tsx`, `src/pages/Login.tsx`, `src/pages/Signup.tsx`, `src/components/DashboardLayout.tsx`, `src/pages/Report.tsx`, `src/pages/admin/AdminUsers.tsx`

- Substituir todas as ocorrências de "ArcheBrand" por "Posiciona"
- Atualizar meta tags no `index.html`

---

### 2. Admin: excluir usuário e confirmar e-mail manualmente

**Arquivos afetados:** `src/pages/admin/AdminUsers.tsx`, nova edge function `supabase/functions/admin-manage-user/index.ts`

- Criar edge function `admin-manage-user` que usa `supabase.auth.admin.deleteUser()` e `supabase.auth.admin.updateUserById()` (para confirmar e-mail via `email_confirmed_at`)
- Requer validação de que o chamador é admin (via `has_role`)
- Adicionar botões na tabela de usuários: ícone de lixeira (excluir com confirmação) e ícone de e-mail (confirmar e-mail)
- Exibir indicador de e-mail confirmado/pendente na lista

---

### 3. Cadastro: campo WhatsApp + objetivo principal

**Arquivos afetados:** `src/pages/Signup.tsx`, migration SQL para adicionar colunas na tabela `profiles`

- Adicionar colunas `whatsapp` (text, nullable) e `main_goal` (text, nullable) à tabela `profiles`
- Adicionar campo de WhatsApp com máscara/placeholder e dropdown "Objetivo principal" com as opções:
  - Atrair novos clientes/pacientes
  - Construir autoridade na minha área
  - Aumentar minha visibilidade no Instagram
  - Me diferenciar da concorrência
  - Manter presença ativa sem perder tempo
  - Outro
- Salvar ambos no `profiles` após signup

---

### 4. Login: botão de voltar à página inicial

**Arquivo:** `src/pages/Login.tsx`

- Adicionar link/botão "← Voltar à página inicial" que navega para `/`

---

### 5. Linha editorial: "Gerar novo" post individual

**Arquivos afetados:** `src/pages/EditorialPage.tsx`, nova edge function `supabase/functions/regenerate-single-post/index.ts`

- Criar edge function que recebe o formato desejado, todos os posts existentes (para evitar repetição) e gera UM novo post
- Na UI, adicionar botão "Gerar novo" em cada card de dia na linha editorial
- O post gerado substitui o atual no array da semana correspondente
- Consome 1 crédito de regeneração (`regeneration_credits` de `user_balances`)

---

### 6. Upload de logos/fotos no editor de posts

**Arquivos afetados:** `src/components/post-editor/PostCanvas.tsx`, `src/components/post-editor/PostToolbar.tsx`, `src/pages/PostEditorPage.tsx`

- Adicionar na toolbar seção "Imagens" com botões para upload de logo e foto
- Imagens carregadas via `<input type="file">` e convertidas para data URL
- No PostCanvas, renderizar as imagens como elementos arrastáveis/redimensionáveis (com position absolute dentro do canvas 1080x1080)
- Usar estado no PostEditorPage para gerenciar lista de imagens sobrepostas (posição x, y, largura, altura)

---

### 7. Elementos gráficos para as artes

Existem bibliotecas de ícones/shapes que podem ser usadas diretamente:
- **Lucide React** (já instalada) para ícones vetoriais
- **SVG shapes/decorações** podem ser embutidos como componentes React

**Recomendação:** usar os ícones Lucide já disponíveis como elementos gráficos inseríveis no post (setas, estrelas, círculos, etc.). Para elementos mais elaborados (molduras, texturas, patterns), seria necessário cadastrar SVGs customizados. Posso implementar um seletor de elementos gráficos Lucide na toolbar do editor.

---

### 8. Validar fontes dos arquétipos vs fontes do report

**Arquivo:** `supabase/functions/generate-report/index.ts`

- Atualizar o prompt do `generate-report` para incluir um mapeamento explícito de fontes recomendadas por arquétipo, garantindo que o campo `typography` do relatório use fontes do Google Fonts alinhadas ao arquétipo primário
- Adicionar no prompt regras como: "Herói → Oswald/Montserrat", "Amante → Playfair Display/Cormorant", etc.

---

### Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Editar | 7+ arquivos para renomear ArcheBrand → Posiciona |
| Criar | `supabase/functions/admin-manage-user/index.ts` |
| Criar | `supabase/functions/regenerate-single-post/index.ts` |
| Migração | Adicionar `whatsapp`, `main_goal` em `profiles` |
| Editar | `src/pages/Signup.tsx` (campos novos) |
| Editar | `src/pages/Login.tsx` (botão voltar) |
| Editar | `src/pages/EditorialPage.tsx` (botão gerar novo) |
| Editar | `src/pages/admin/AdminUsers.tsx` (excluir + confirmar email) |
| Editar | `src/components/post-editor/*` (upload imagens) |
| Editar | `supabase/functions/generate-report/index.ts` (fontes por arquétipo) |

