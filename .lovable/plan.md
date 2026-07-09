## Problema

O Google mostra o ícone padrão do Lovable nos resultados de busca do Posiciona, apesar de já termos `public/favicon.png` (o coração colorido do Posiciona) referenciado no `index.html`.

## Causa

O Google, ao rastrear o site, tenta primeiro `https://posiciona.ia.br/favicon.ico` (convenção). Como não existe esse arquivo no projeto, a hospedagem devolve um `favicon.ico` padrão do Lovable (verifiquei: `GET /favicon.ico` responde 200 com `content-type: image/vnd.microsoft.icon`). Esse `.ico` "genérico" ganha da nossa tag `<link rel="icon" href="/favicon.png">` para o Google Search, que prefere o `.ico` na raiz.

Além disso, o `favicon.png` atual é 1088×1088 — pesa 543 KB e não tem versão pequena otimizada, o que também prejudica o rendering do favicon em algumas superfícies.

## O que fazer

1. **Gerar `public/favicon.ico` a partir do logo Posiciona** (o mesmo do `favicon.png`), com múltiplos tamanhos embutidos (16, 32, 48). Isso força a hospedagem a servir o nosso ícone em `/favicon.ico` em vez do default do Lovable.
2. **Gerar um `public/favicon-32.png`** (32×32) otimizado, para reduzir peso quando o browser/Google usar o PNG.
3. **Atualizar `index.html`** para declarar explicitamente os dois formatos e tamanhos:
   ```html
   <link rel="icon" href="/favicon.ico" sizes="any" />
   <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
   <link rel="icon" type="image/png" sizes="192x192" href="/favicon.png" />
   <link rel="apple-touch-icon" href="/favicon.png" />
   ```
4. Publicar e, no dia seguinte, submeter a home no **URL Inspection** do Search Console pedindo reindexação — para acelerar a atualização do favicon no Google.

## Aviso importante ao usuário

O Google faz cache do favicon por **semanas**. Mesmo depois do deploy correto, o ícone antigo pode continuar aparecendo nos resultados de busca por um tempo até o crawler revisitar. Não é bug do código.

## Detalhes técnicos

- Uso Python/PIL (já disponível no sandbox) para converter `public/favicon.png` em `.ico` multi-size, sem depender de ferramentas externas.
- Não mexo em `og-image.png` (é o preview social, coisa diferente do favicon).
- Não altero rotas, hospedagem nem qualquer código React — só arquivos em `public/` e as tags `<link rel="icon">` do `index.html`.
