Identifiquei o problema no preview: o template Governante salvo não tem `canvasWidth/canvasHeight`, mas ele foi criado como canvas 1080x1080. A correção anterior esticou só os overlays; os blocos de texto do template (`slideTextBoxes`) continuaram nas coordenadas antigas, então a composição ficou quebrada.

Plano de correção:

1. Em `PostEditorPage.tsx`, criar uma função única de normalização para templates legacy.
   - Base de origem: 1080x1080 quando o template não trouxer dimensões explícitas.
   - Destino: canvas atual (`1080x1350` para carrossel/feed, `1080x1920` para reels).

2. Aplicar a mesma escala não-uniforme em todos os elementos do template.
   - `overlayImages`: x, y, width, height.
   - `slideTextBoxes`: x, y, width, height de cada slide.
   - Isso mantém moldura, linha decorativa e textos no mesmo sistema de coordenadas.

3. Ajustar o SVG da moldura legacy Governante para não ficar apenas visualmente “esticado”.
   - Para elementos `tpl-frame-*`, regenerar/normalizar a moldura para o tamanho final quando possível, preservando o inset proporcional.
   - A moldura passa a ocupar corretamente a área interna do canvas final.

4. Garantir que templates carregados por `?design=...&fromTemplate=1` também passem pela mesma normalização.
   - Hoje o template global é normalizado, mas designs/templates salvos podem entrar sem recalcular.

5. Remover logs temporários depois da validação.
   - Manter o editor limpo e sem ruído no console.

Resultado esperado: ao abrir um post novo no Dashboard, a moldura Governante, a linha decorativa e os textos devem manter a mesma composição relativa, agora adaptada corretamente ao canvas vertical do carrossel.