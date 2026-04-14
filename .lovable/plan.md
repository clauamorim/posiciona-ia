

# Plano: WhatsApp na Landing Page + Botão "Gerar Capa" nos Reels

## 1. Ícone flutuante de WhatsApp na Landing Page

**Arquivo:** `src/pages/LandingPage.tsx`

- Adicionar um botão flutuante fixo (posição `fixed bottom-6 right-6`) com o ícone do WhatsApp (SVG inline, já que Lucide não tem ícone de WhatsApp).
- Cor verde do WhatsApp (`#25D366`), formato circular, com sombra e animação sutil de pulse.
- Link: `https://wa.me/5562994400707` abrindo em nova aba.
- `z-50` para ficar acima de todo conteúdo.

## 2. Botão "Gerar Capa" nos Reels da Linha Editorial

**Arquivo:** `src/pages/EditorialPage.tsx`

- Hoje o botão "Criar post" só aparece para formatos `carrossel` e `post` (linha 411).
- Adicionar condição para `reels`: quando `day.format?.toLowerCase() === "reels"`, mostrar botão "Gerar capa" que navega para o editor de posts no formato capa de reels (`/post-editor?week=${wi}&day=${di}&format=reels-cover`).

## Arquivos afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/LandingPage.tsx` | Adicionar botão flutuante WhatsApp |
| `src/pages/EditorialPage.tsx` | Adicionar botão "Gerar capa" para reels |

