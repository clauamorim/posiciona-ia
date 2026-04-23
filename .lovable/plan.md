

## Editor que entrega posts prontos — confirmado para implementação

Vou prosseguir com o plano apresentado. Resumo abrangendo todos os pontos confirmados:

### 1. Templates fixos (8 no total)
- 4 templates para formato quadrado (1080×1080) e 4 para reels (1080×1920).
- Tipos: **Capa**, **Conteúdo**, **Visual minimalista**, **CTA final**.
- Escolha determinística por `(weekIndex + dayIndex + slideIndex)` — reabrir o mesmo post sempre dá o mesmo layout.
- Definidos em código (`src/lib/postTemplates.ts`) — sem necessidade de cadastro manual.

### 2. Imagens de fundo: Unsplash + IA fallback
- Edge function `fetch-post-image` busca no Unsplash usando palavras-chave do tema.
- Se Unsplash não tiver resultado relevante, usa Gemini Nano Banana para gerar.
- Cache em tabela `post_background_cache` para evitar repagar IA pelo mesmo tema.
- **Custos**: Unsplash = grátis; IA = 1 crédito de regeneração com aviso prévio.
- Requer secret `UNSPLASH_ACCESS_KEY` (chave gratuita em https://unsplash.com/developers).

### 3. Logos com checkbox no upload
- Coluna nova `is_logo BOOLEAN` em `user_gallery_assets`.
- Modal de upload com checkbox "Esta imagem é minha logo".
- Sistema escolhe automaticamente a logo de melhor contraste com o fundo do template.
- Suporte a múltiplas logos (versão clara/escura).

### 4. Montagem inicial automática
- Ao abrir `/post-editor?week=X&day=Y` sem draft salvo, o editor já carrega:
  - Template apropriado.
  - Fundo do Unsplash (sem custo).
  - Logo do usuário (se houver).
  - Paleta da marca, tipografia, posições do template.
- Banner sutil: "Montagem inicial gerada. Personalize como quiser."
- Tudo permanece 100% editável (arrastar, trocar texto, redimensionar, recolorir, excluir).

### 5. Guias de edição no canvas
- Snap-guides dinâmicos ao arrastar (centro horizontal/vertical, alinhamento com outros elementos).
- Réguas opcionais nas bordas (toggle).
- Coordenadas X,Y e tamanho W×H exibidos no elemento selecionado.
- Grade de fundo opcional (toggle).
- Atalhos: setas movem 1px, Shift+setas movem 10px.

## Arquivos a serem afetados

**Frontend (novos)**
- `src/lib/postTemplates.ts` — definição dos 8 templates.
- `src/lib/postAutoLayout.ts` — orquestra template + imagem + logo.

**Frontend (editados)**
- `src/pages/PostEditorPage.tsx` — chama auto-layout na primeira abertura, banner, botão "Trocar imagem".
- `src/components/post-editor/PostCanvas.tsx` — snap-guides, réguas, coordenadas, grid, atalhos.
- `src/components/post-editor/inspector/AddElementPanel.tsx` — checkbox "É minha logo" no upload + badge Logo na galeria.
- `src/components/post-editor/PostToolbar.tsx` — toggles para guias/grade/réguas e botão "Trocar imagem de fundo".

**Backend (novos)**
- `supabase/functions/fetch-post-image/index.ts` — Unsplash + fallback IA + cache.

**Banco**
- Migração: `is_logo BOOLEAN DEFAULT false` em `user_gallery_assets`.
- Migração: tabela `post_background_cache (theme_hash TEXT PK, image_url TEXT, source TEXT, created_at TIMESTAMPTZ)`.

**Secret novo**
- `UNSPLASH_ACCESS_KEY` (será solicitado via tool antes do uso).

## Custos resumidos para o usuário

| Ação | Custo |
|---|---|
| Abrir post montado pronto | Grátis |
| Trocar imagem por outra do Unsplash | Grátis |
| Gerar imagem por IA | 1 crédito de regeneração |
| Editar texto, mover, recolorir, etc. | Grátis |

## Fora do escopo

- Galeria de templates customizáveis pelo admin (fase 2).
- Geração automática de carrossel inteiro com layouts variados via IA.
- Seleção manual de qual logo usar (sistema escolhe pela melhor combinação).

## Próximos passos quando aprovar default mode

1. Solicitar `UNSPLASH_ACCESS_KEY` via tool de secret (necessário antes de implementar a edge function).
2. Criar migração SQL (`is_logo` + `post_background_cache`).
3. Implementar templates, auto-layout e edge function.
4. Atualizar UI (canvas, toolbar, painel de upload).

