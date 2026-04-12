

## Plano: E-mail em português, consistência de arquétipos, elementos gráficos avançados

### 1. E-mail de confirmação em português + redirect para login

**Problema:** O e-mail de confirmação usa o template padrão (em inglês). Também o `emailRedirectTo` aponta para `/` em vez de `/login`.

**Solução:**
- Configurar templates de e-mail customizados usando o sistema de e-mail integrado do Lovable Cloud (scaffold auth email templates)
- Traduzir todos os templates (signup, recovery, magic-link, etc.) para português brasileiro
- Alterar `emailRedirectTo` em `Signup.tsx` para `window.location.origin + "/login"`
- Aplicar branding do Posiciona (cores, nome) aos templates

---

### 2. Arquétipos consistentes entre "Arquétipos" e "Análises"

**Problema:** A página Results calcula os arquétipos client-side e salva em `user_top_archetypes`. A página Report mostra `content.archetypes` que vem do LLM (generate-report), que pode gerar nomes/ordens diferentes.

**Solução em `Report.tsx`:**
- Na seção "Seus Arquétipos de Marca", buscar os dados de `user_top_archetypes` em vez de usar `content.archetypes`
- Manter `content.archetypes` apenas para as descrições/aplicações, mas forçar os **nomes** e **ranking** a virem da tabela `user_top_archetypes`
- Isso garante que ambas as páginas mostram os mesmos arquétipos na mesma ordem

---

### 3. Mais elementos gráficos + transparência + gradiente

**Arquivos:** `PostToolbar.tsx`, `PostCanvas.tsx`, `PostEditorPage.tsx`

**Novos elementos gráficos:**
- Adicionar barras horizontais/verticais (SVGs customizados: barra fina, barra grossa, linha decorativa)
- Adicionar molduras (frame retangular, frame circular, cantos decorativos)
- Adicionar separadores e ornamentos (ondulado, pontilhado, divider decorativo)
- Implementar como SVGs inline convertidos para data URL (mesmo pattern dos ícones Lucide)

**Transparência para fotos e logos:**
- Adicionar propriedade `opacity` ao tipo `OverlayImage`
- Quando um overlay está selecionado, mostrar slider de opacidade na toolbar (0% a 100%)
- Aplicar `style={{ opacity }}` no elemento do canvas
- Callback `onImageOpacityChange` no PostEditorPage

**Gradiente para fundos:**
- Adicionar opção "Gradiente" na seção de cores da toolbar
- Permitir selecionar duas cores da paleta para criar gradiente (linear)
- Adicionar seletor de direção do gradiente (horizontal, vertical, diagonal)
- Aplicar `background: linear-gradient(...)` no canvas em vez de `backgroundColor`

---

### Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Scaffold | Templates de auth email (via ferramenta integrada) |
| Editar | `src/pages/Signup.tsx` (emailRedirectTo → /login) |
| Editar | `src/pages/Report.tsx` (buscar arquétipos de user_top_archetypes) |
| Editar | `src/components/post-editor/PostToolbar.tsx` (elementos, transparência, gradiente) |
| Editar | `src/components/post-editor/PostCanvas.tsx` (opacity, gradiente fundo) |
| Editar | `src/pages/PostEditorPage.tsx` (estado opacity, gradiente) |

