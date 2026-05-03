Plano de correção estrutural dos templates do editor:

1. **Criar uma normalização única para templates legados**
   - Em `PostEditorPage.tsx`, criar um helper que receba o `state` do design/template e o canvas atual (`1080×1350` ou `1080×1920`).
   - Se o template salvo não tiver `canvasWidth/canvasHeight`, tratar como legado `1080×1080` e converter tudo para o formato atual.
   - Aplicar a mesma normalização para:
     - template global automático por arquétipo;
     - design aberto por `?design=...`;
     - modelo aberto por `fromTemplate=1`.

2. **Corrigir molduras dos 12 arquétipos**
   - Os 12 templates globais estão salvos com moldura `x=60, y=60, width=960, height=960`, herdada do layout antigo.
   - A normalização deve transformar para o canvas 4:5 mantendo margens coerentes: `x=60`, `y=60`, `width=960`, `height=1230` em post vertical.
   - Para Reels, transformar proporcionalmente para `height=1800`.
   - Além da caixa externa, atualizar o SVG interno (`width`, `height`, `viewBox` e formas internas), para o desenho visual não continuar quadrado.

3. **Reposicionar elementos decorativos auxiliares**
   - Linhas horizontais e acentos verticais não devem apenas ser multiplicados cegamente pelo eixo Y.
   - Para cada overlay decorativo:
     - moldura: ocupar a área segura vertical do novo canvas;
     - linha decorativa inferior: ancorar perto da parte baixa da moldura, sem invadir botão/logo/texto;
     - acento vertical: manter proporção e posição dentro da moldura;
     - linhas/acréscimos internos do SVG: reescalar coordenadas internas para acompanhar o novo retângulo.
   - Isso cobre Governante, Explorador, Rebelde e os demais arquétipos com apenas moldura.

4. **Impedir regressão quando abre com foto**
   - Hoje o auto-layout com foto substitui parte do design e preserva outra parte, o que faz o template “voltar parcialmente” ao comportamento antigo.
   - Ajustar a mesclagem: quando um template de arquétipo já foi aplicado, o auto-layout só pode substituir o background/foto; os decorativos e caixas normalizados do template devem permanecer intactos.
   - Também normalizar os overlays preservados depois da entrada da foto, para não reintroduzir posições antigas.

5. **Salvar dimensões reais daqui para frente**
   - Ao salvar design/modelo, gravar `canvasWidth` e `canvasHeight` no `state`.
   - Assim novos modelos não serão interpretados como `1080×1080`.

6. **Validação no preview**
   - Testar com o template Governante do print e com pelo menos um template com acento/linha (`Explorador` ou `Rebelde`).
   - Conferir visualmente que seleção, moldura e elementos decorativos coincidem no canvas com foto e sem foto.