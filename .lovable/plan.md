# Plano: preparar o site para indexação correta no Google

Hoje o `sitemap.xml` e algumas meta tags ainda apontam para o domínio antigo da Lovable (`archetype-story-builder.lovable.app`). Isso confunde o Google e pode gerar conteúdo duplicado entre domínios. Vamos alinhar tudo ao domínio oficial **`https://posiciona.ia.br`**.

## O que será feito

### 1. Atualizar `public/sitemap.xml`
- Trocar todas as URLs de `archetype-story-builder.lovable.app` para `posiciona.ia.br`.
- Incluir as páginas públicas relevantes além de `/`, `/login` e `/signup`:
  - `/sobre`
  - `/ajuda`
  - `/termos-de-servico`
  - `/politica-de-privacidade`
  - `/choose-plan` (se for pública)
- Atualizar `<lastmod>` para a data atual em todas as entradas.

### 2. Atualizar `index.html` (meta tags sociais e SEO)
- Trocar `og:image` e `twitter:image` para usar `https://posiciona.ia.br/og-image.png`.
- Adicionar `<meta property="og:url" content="https://posiciona.ia.br/">`.
- Adicionar `<link rel="canonical" href="https://posiciona.ia.br/">` para reforçar o domínio oficial.
- Garantir `lang="pt-BR"` (já presente) e manter `meta description` sob 160 caracteres.

### 3. Reforçar `robots.txt`
- Adicionar a linha `Sitemap: https://posiciona.ia.br/sitemap.xml` ao final do arquivo, para que os crawlers descubram o sitemap automaticamente.

### 4. Orientações pós-implementação (sem código)
Depois que as mudanças forem publicadas (clicar em **Update** no Publish), vou te entregar um passo a passo curto para:
1. Cadastrar `posiciona.ia.br` no **Google Search Console** (verificação por DNS).
2. Enviar o sitemap em **Sitemaps → `https://posiciona.ia.br/sitemap.xml`**.
3. Solicitar indexação manual da home pela ferramenta **Inspeção de URL**.
4. Acompanhar a cobertura nos próximos dias.

## Fora do escopo
- Não vamos mexer em rotas privadas (Dashboard, Editor, Relatório) — elas não devem ser indexadas.
- Não vamos alterar conteúdo, layout ou copy da Landing Page.
- Não vamos adicionar Google Analytics / Search Console tag por enquanto (pode ser um próximo passo se você quiser).

## Arquivos afetados
- `public/sitemap.xml`
- `public/robots.txt`
- `index.html`
