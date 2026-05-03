# Corrigir download no editor de posts

## Diagnóstico

No `src/pages/PostEditorPage.tsx` (linhas 1038–1085), `handleDownloadSlide` e `handleDownloadAll` têm três problemas que, combinados, produzem o sintoma "não baixa":

1. **Erros silenciados sem detalhe.** Os `try/catch` capturam tudo em um `toast` genérico ("Erro ao exportar imagem"), sem `console.error`. Não dá para diagnosticar a causa real.
2. **Anchor não anexada ao DOM.** `link.click()` sem `document.body.appendChild(link)` é ignorado em alguns navegadores (notadamente Firefox e versões recentes do Chrome quando o `download` aponta para `dataURL` grande). Isso causa "click silencioso" — nenhum download é disparado e nenhum erro é lançado.
3. **CORS taints o canvas.** Overlays e imagens vindas de URLs assinadas do Supabase (`portrait-outputs`, `user-uploads`) e da Pexels não vêm com `crossOrigin="anonymous"` setado nos `<img>` dentro do `PostCanvas`. Isso "tainta" o canvas e faz `html2canvas` lançar `SecurityError` em `toDataURL`/`toBlob`. Como o catch é silencioso, parece que o botão "não funciona".

## O que fazer

### 1. `src/pages/PostEditorPage.tsx` — endurecer os handlers de download

- Logar o erro (`console.error`) e mostrar `err.message` no toast para visibilidade.
- Anexar o `<a>` ao `document.body` antes do `click()` e remover depois.
- Trocar `dataURL` por `Blob` + `URL.createObjectURL` no slide único (mais confiável para PNGs grandes).
- Passar `useCORS: true`, `allowTaint: false` e `backgroundColor: null` no `html2canvas` (já tem useCORS, garantir os outros).
- Em `handleDownloadAll`, se um slide falhar, continuar os demais e reportar quantos falharam em vez de abortar tudo.

### 2. `src/components/post-editor/PostCanvas.tsx` — habilitar CORS nas imagens

Garantir `crossOrigin="anonymous"` em todos os `<img>` renderizados no canvas (overlays, foto principal, ícones recoloridos via `<img>` SVG). Sem isso, `html2canvas` não consegue ler pixels e o canvas fica tainted.

### 3. Verificar fontes externas

Se o canvas usa Google Fonts ou similares, `html2canvas` pode estourar CORS na hora de inlinar. Não é o gatilho mais comum aqui (fontes vêm do CSS, não como recursos no canvas), mas vale checar console após a melhoria #1.

## Como validar

1. Abrir o editor com um post sem foto → "Baixar PNG" deve baixar.
2. Adicionar uma imagem de overlay (galeria/retrato) → "Baixar PNG" deve continuar funcionando.
3. No carrossel, "Baixar todos (ZIP)" deve gerar zip com todos os slides.
4. Se algum erro restar, agora aparecerá com mensagem específica no toast e no console — passo a passo a partir daí.

## Arquivos a editar

- `src/pages/PostEditorPage.tsx` (handlers `handleDownloadSlide`, `handleDownloadAll`)
- `src/components/post-editor/PostCanvas.tsx` (atributo `crossOrigin` nas `<img>`)
