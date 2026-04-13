

## Plano: OG tags + remover emoji + SEO

### 1. Corrigir preview do WhatsApp (OG tags)

O WhatsApp usa as meta tags `og:image`, `og:title` e `og:description` do `index.html`. Atualmente a `og:image` aponta para um screenshot antigo (que mostra a tela de login com logo do Lovable).

**Ações:**
- Copiar o logo do Posiciona para `public/og-image.png` (versão maior, ideal 1200x630px — vou gerar uma imagem OG com fundo escuro + logo centralizado + texto "Posiciona")
- Atualizar `og:image` e `twitter:image` no `index.html` para apontar para a URL publicada dessa imagem
- Confirmar que `og:title` = "Posiciona" e `og:description` = texto mais estratégico

### 2. Remover emoji 👋 do Dashboard

No `src/pages/Dashboard.tsx` linha 107, remover o `👋` de:
```
Olá, {profile?.full_name || "Usuário"} 👋
```

### 3. SEO — aparecer no Google

- Adicionar `<link rel="sitemap">` apontando para um `public/sitemap.xml`
- Criar `public/sitemap.xml` com as URLs públicas (landing, login, signup)
- O `robots.txt` já permite todos os crawlers
- Melhorar a `meta description` para algo mais descritivo e com palavras-chave
- Adicionar `lang="pt-BR"` no `<html>`

### Arquivos editados
- `index.html` — OG tags, lang, meta description
- `public/og-image.png` — nova imagem OG (gerada via script)
- `public/sitemap.xml` — novo
- `src/pages/Dashboard.tsx` — remover 👋

