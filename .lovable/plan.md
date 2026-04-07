

# Plano Completo: Branding, Admin e Análise de Instagram

## 1. Remover branding Lovable

- **`index.html`**: Trocar todas as referências "Lovable App" por "ArcheBrand" e "Lovable Generated Project" por "Plataforma de posicionamento de marca". Remover `meta author` Lovable e `twitter:site @Lovable`.
- **Badge**: Usar ferramenta `set_badge_visibility` para esconder o badge "Edit with Lovable".

## 2. Criar usuário admin

- Criar conta `admin@admin.com` / `Jp040299#` via signup no app.
- Inserir role admin via SQL: `INSERT INTO user_roles (user_id, role) VALUES ('<id>', 'admin')`.
- **Nota de segurança**: Recomenda-se trocar a senha após o primeiro acesso.

## 3. Painel Admin aprimorado

### `AdminDashboard.tsx`
Adicionar métricas extras aos cards existentes:
- **Total de Créditos** (soma de `user_credits.balance`)
- **Semanas Editoriais** (contagem de relatórios com `editorial_weeks` não vazio)

Adicionar seção de **últimos relatórios gerados**: tabela com nome do usuário, data, status (últimos 10).

### `AdminUsers.tsx`
Adicionar colunas à tabela de usuários:
- **Créditos**: join com `user_credits` para mostrar saldo
- **Relatórios**: contagem de relatórios do usuário
- **Questionário**: badge indicando se `business_questionnaires.is_complete = true`

Adicionar ação de **editar créditos** (botão que abre dialog para alterar saldo).

## 4. Análise de Instagram via Firecrawl

### Pré-requisito: Conectar Firecrawl
Usar `standard_connectors--connect` com `connector_id: firecrawl` para injetar `FIRECRAWL_API_KEY` nas edge functions.

### Nova edge function `supabase/functions/analyze-instagram/index.ts`
1. Recebe `{ username }` e o `authorization` header para identificar o usuário
2. Chama Firecrawl API para scrape de `https://www.instagram.com/{username}/` com `formats: ['screenshot', 'markdown']`
3. Busca do banco: StoryBrand (`reports.content.storybrand`), top 3 arquétipos (`user_top_archetypes`), identidade visual (`reports.content.visual_identity`)
4. Envia tudo para Gemini 2.5 Pro via Lovable AI Gateway (modelo multimodal que aceita imagem)
5. Usa tool calling para retornar JSON estruturado com análise de: nome, bio, CTA, destaques, pins, aparência do feed, foto de perfil
6. Cada item tem campos: `current` (situação atual detectada) e `suggestion` (sugestão baseada em StoryBrand/arquétipos)

### Nova edge function `supabase/functions/firecrawl-scrape/index.ts`
Proxy simples para a API do Firecrawl, seguindo o padrão documentado.

### Novo helper `src/lib/api/firecrawl.ts`
Função `scrape()` que chama a edge function via `supabase.functions.invoke`.

### Nova página `src/pages/InstagramAnalysis.tsx`
- Campo de input para o @ do Instagram
- Botão "Analisar Perfil"
- Verificação de pré-requisito: usuário deve ter relatório com StoryBrand e arquétipos calculados. Se não tiver, mostra mensagem orientando a completar os questionários.
- Loading state durante a análise (~15-30s)
- Exibe o screenshot capturado do perfil
- Cards de resultado: Nome, Bio, CTA, Destaques, Pins, Feed, Foto de Perfil
- Cada card com layout "Situação Atual" vs "Sugestão"
- Fallback: se o Firecrawl falhar (Instagram bloqueou), mostra formulário manual para o usuário informar os dados

### Menu e Rotas
- **`DashboardLayout.tsx`**: Adicionar "Análise do Instagram" com ícone `Instagram` (lucide) entre "Linha Editorial" e "Histórico"
- **`App.tsx`**: Adicionar rota protegida `/instagram-analysis`

## Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| `index.html` | Trocar branding para ArcheBrand |
| `src/pages/admin/AdminDashboard.tsx` | Adicionar métricas de créditos e últimos relatórios |
| `src/pages/admin/AdminUsers.tsx` | Adicionar colunas de créditos, relatórios, edição de créditos |
| `supabase/functions/firecrawl-scrape/index.ts` | Criar — proxy Firecrawl |
| `supabase/functions/analyze-instagram/index.ts` | Criar — análise com IA multimodal |
| `src/lib/api/firecrawl.ts` | Criar — helper API |
| `src/pages/InstagramAnalysis.tsx` | Criar — página de análise com fallback manual |
| `src/components/DashboardLayout.tsx` | Adicionar menu item Instagram |
| `src/App.tsx` | Adicionar rota `/instagram-analysis` |

## Ordem de execução

1. Conectar Firecrawl (conector)
2. Remover branding Lovable (index.html + badge)
3. Criar usuário admin (signup + SQL)
4. Aprimorar painel admin (Dashboard + Users)
5. Criar edge functions (firecrawl-scrape + analyze-instagram)
6. Criar helper e página de análise do Instagram
7. Atualizar menu e rotas

