## Objetivo
Inserir o snippet do Google Tag Manager fornecido pelo gestor de tráfego no `index.html` do projeto, respeitando a posição solicitada.

## Código a ser inserido
- **No `<head>`**, o mais alto possível (logo após o charset/viewport/favicon, antes das fontes e meta tags principais):
  ```html
  <!-- Google Tag Manager -->
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-NK2QSFMV');</script>
  <!-- End Google Tag Manager -->
  ```
- **Imediatamente após a tag de abertura `<body>`**, antes do `<div id="root"></div>`:
  ```html
  <!-- Google Tag Manager (noscript) -->
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NK2QSFMV"
  height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
  <!-- End Google Tag Manager (noscript) -->
  ```

## Arquivo a ser alterado
- `index.html`

## Não será alterado
- Nenhum outro arquivo do projeto.
- Nenhuma configuração de backend/Edge Function.

## Validação
- Verificar se o GTM `<script>` está presente no `<head>` e o `<noscript>` está dentro do `<body>` logo após a abertura.
- Garantir que o `id` GTM-NK2QSFMV permanece inalterado.