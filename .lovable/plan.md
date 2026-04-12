

## Plano: 3 correções — caixas de texto, cor de fundo custom, qualidade dos retratos

### 1. Caixas de texto não são selecionáveis/redimensionáveis

**Problema:** As caixas de texto (`contentEditable` `<p>` e `<h1>`) são elementos inline do canvas — não são tratadas como overlay images. Os handles de resize e a lógica de drag só se aplicam a `overlayImages`. As caixas de texto ficam fixas no layout e não podem ser movidas nem redimensionadas.

**Solução:** Transformar cada bloco de texto (título e corpo) em elementos overlay posicionáveis e redimensionáveis, como as imagens. Isso requer:
- Adicionar um tipo `"text"` ao sistema de overlays existente, com propriedades extras (`text`, `fontSize`, `fontWeight`, etc.)
- Quando o post é carregado, criar overlays de texto a partir do título e corpo
- Os overlays de texto usam os mesmos handles de resize e drag que as imagens
- O texto é editável via duplo-clique (contentEditable ativado ao entrar no modo edição)

**Alternativa mais simples (recomendada):** Fazer os `<p>` e `<h2>` ficarem dentro de `<div>` com resize CSS (`resize: both; overflow: auto`) e tornar o container clicável/arrastável. Isso não requer refatoração do sistema de overlays — apenas adicionar CSS de resize e um wrapper com drag.

| Arquivo | Ação |
|---------|------|
| `src/components/post-editor/PostCanvas.tsx` | Envolver textos em containers com `resize: both` e drag handles |

### 2. Cor de fundo personalizada (além da paleta)

**Problema:** O seletor de cor de fundo (`Cor de fundo` na toolbar) só mostra as cores da paleta. Não há opção para cor custom.

**Solução:** Adicionar um `<input type="color">` ao lado das cores da paleta (mesmo padrão já usado na "Cor do texto"). Requer:
- Adicionar prop `onCustomBgColorChange` ou reutilizar `onBgChange` com um valor custom
- Adicionar state `customBgColor` no `PostEditorPage`
- Quando o usuário escolhe cor custom, usar essa cor em vez da paleta

| Arquivo | Ação |
|---------|------|
| `src/components/post-editor/PostToolbar.tsx` | Adicionar `<input type="color">` na seção "Cor de fundo" + prop para cor custom |
| `src/pages/PostEditorPage.tsx` | Adicionar state `customBgColor` e lógica para usar cor custom no canvas |

### 3. Qualidade dos retratos — melhorar realismo

**Problema:** O modelo `gemini-3.1-flash-image-preview` prioriza velocidade sobre qualidade. O prompt é muito longo e pode confundir o modelo.

**Soluções combinadas:**
- **Trocar modelo** para `google/gemini-3-pro-image-preview` que produz qualidade superior (conforme documentação)
- **Simplificar o prompt** — remover instruções redundantes e focar nas 3 regras mais críticas: (1) preservar identidade exata, (2) foto real de estúdio, (3) vestimenta estratégica. Prompts mais curtos e diretos tendem a gerar resultados melhores
- **Colocar as referências ANTES do texto** no array de content, para que o modelo processe as imagens primeiro

| Arquivo | Ação |
|---------|------|
| `supabase/functions/generate-portrait/index.ts` | Trocar modelo para `gemini-3-pro-image-preview`, simplificar prompt, reordenar content (imagens primeiro) |

### Resumo

| Arquivo | Alterações |
|---------|-----------|
| `src/components/post-editor/PostCanvas.tsx` | Texto redimensionável com CSS `resize: both` + drag |
| `src/components/post-editor/PostToolbar.tsx` | Input color custom para cor de fundo |
| `src/pages/PostEditorPage.tsx` | State para cor de fundo personalizada |
| `supabase/functions/generate-portrait/index.ts` | Modelo pro, prompt simplificado, imagens primeiro |

