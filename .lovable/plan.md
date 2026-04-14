

# Plano: PDFs de Referência para a LLM + Galeria de Imagens PNG

## Resumo

Duas funcionalidades novas:
1. **PDFs de referência**: Admin cadastra PDFs que são enviados como contexto para a LLM ao gerar relatórios/análises.
2. **Galeria de imagens PNG**: Admin cadastra imagens que ficam disponíveis numa galeria para o usuário inserir nos posts.

## Viabilidade técnica

**PDFs para a LLM**: Sim, é possível. O modelo Gemini 2.5 Flash suporta entrada de documentos em base64. Os PDFs seriam armazenados no Supabase Storage, e ao chamar a LLM, o conteúdo seria incluído como parte da mensagem (base64 inline ou texto extraído). Há um limite prático de contexto (~1MB total de entrada), então PDFs muito grandes precisariam ter o texto extraído previamente.

**Galeria de PNGs**: Sim, totalmente possível. Imagens ficam no Storage, com uma tabela de metadados, e aparecem num painel de galeria dentro do editor de posts.

---

## 1. Infraestrutura de Storage

Criar dois buckets no Supabase Storage:
- `reference-pdfs` (privado) — PDFs de referência para a LLM
- `asset-gallery` (público) — Imagens PNG para os usuários

## 2. Tabelas novas (migration)

```sql
-- Metadados dos PDFs de referência
CREATE TABLE public.reference_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  file_path text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Metadados das imagens da galeria
CREATE TABLE public.gallery_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text DEFAULT 'geral',
  file_path text NOT NULL,
  thumbnail_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

RLS: SELECT para authenticated em ambas; INSERT/UPDATE/DELETE apenas para admins.

## 3. Painel Admin — Gerenciar PDFs

Nova página `src/pages/admin/AdminDocuments.tsx`:
- Lista de PDFs cadastrados com nome, descrição, tamanho, status ativo/inativo
- Upload de novos PDFs (max ~5MB cada para viabilidade com a LLM)
- Toggle ativar/desativar
- Excluir documento

Adicionar rota `/admin/documents` no `App.tsx` e link na navegação admin.

## 4. Painel Admin — Gerenciar Galeria

Nova página `src/pages/admin/AdminGallery.tsx`:
- Grid de imagens cadastradas com preview
- Upload de PNGs com nome e categoria
- Excluir imagem

Adicionar rota `/admin/gallery` no `App.tsx`.

## 5. Integrar PDFs nas chamadas da LLM

Nas edge functions `generate-report` e `analyze-instagram`:
- Buscar documentos ativos de `reference_documents`
- Baixar os PDFs do Storage
- Incluir como partes da mensagem ao Gemini (formato `inline_data` com mime_type `application/pdf` em base64)
- Limitar a ~3 PDFs ativos ou ~4MB total para não estourar contexto

## 6. Galeria no Editor de Posts

Em `PostToolbar.tsx`:
- Novo botão "Galeria" que abre um modal/popover
- Carrega imagens de `gallery_assets` onde `is_active = true`
- Ao clicar numa imagem, adiciona como `OverlayImage` no canvas (mesmo fluxo do upload manual)
- Categorias como filtro opcional

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| Migration SQL | Criar tabelas + buckets + RLS |
| `src/pages/admin/AdminDocuments.tsx` | Novo — CRUD de PDFs |
| `src/pages/admin/AdminGallery.tsx` | Novo — CRUD de imagens |
| `src/App.tsx` | Adicionar rotas admin |
| `src/components/DashboardLayout.tsx` | Links de navegação admin |
| `supabase/functions/generate-report/index.ts` | Incluir PDFs como contexto |
| `supabase/functions/analyze-instagram/index.ts` | Incluir PDFs como contexto |
| `src/components/post-editor/PostToolbar.tsx` | Botão galeria + modal |

