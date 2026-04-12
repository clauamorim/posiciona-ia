

## Plano: Domínio customizado, correções no editor e fluxo de reanálise

### 1. Domínio customizado posiciona.ia.br

Isso precisa ser feito manualmente no painel do projeto:
- Ir em **Project Settings → Domains → Connect Domain**
- Inserir `posiciona.ia.br`
- Configurar os registros DNS (A record apontando para `185.158.133.1` e TXT `_lovable`) no registrador do domínio `.ia.br`
- Aguardar propagação DNS (até 72h)

**Isso NÃO requer mudança de código** -- é uma configuração na interface do Lovable.

---

### 2. Fotos uploadadas não aparecem no canvas

**Problema:** As `overlayImages` são gerenciadas no `PostEditorPage` e passadas para o `PostCanvas` via props, mas no `CarouselEditor` as overlay images NÃO são passadas. Além disso, o `CarouselEditor` não aceita `overlayImages` como prop.

**Correção:**
- Adicionar props `overlayImages`, `onImageMove`, `onImageResize` no `CarouselEditor`
- Passar essas props do `PostEditorPage` para o `CarouselEditor`
- No `PostCanvas`, garantir que as imagens overlay são renderizadas corretamente (já estão no código, mas verificar se `html2canvas` captura elas com `useCORS: true`)

---

### 3. Elementos gráficos para as artes

**Problema:** A toolbar tem upload de logo/foto mas não tem seletor de elementos gráficos (ícones/shapes).

**Implementação:**
- Adicionar seção "Elementos" na `PostToolbar` com grid de ícones Lucide populares (setas, estrelas, coração, check, aspas, etc.)
- Ao clicar num ícone, renderizar seu SVG como `OverlayImage` no canvas (converter SVG para data URL)
- Reutilizar o mesmo sistema de arraste já existente

---

### 4. Botão "Gerar novo" abaixo do "Criar Post"

**Correção em `EditorialPage.tsx`:**
- Reorganizar os botões no card: "Criar Post" primeiro (acima), "Gerar novo" segundo (abaixo)
- Atualmente estão lado a lado com `flex gap-2`; mudar para `flex-col`

---

### 5. Refazer análise com créditos + desabilitar edição dos questionários

**Lógica atual:** Os questionários têm status `draft`/`submitted`/`locked`. Quando locked, não podem ser editados.

**Nova lógica:**
- Questionários ficam **sempre desabilitados para edição** após ter um report completo (comportamento `locked` atual)
- Adicionar botão "Refazer análise" visível quando há report completo, mostrando créditos de reanálise disponíveis (`reanalysis_credits`)
- Ao clicar "Refazer análise", mostrar dialog com duas opções:
  1. **"Editar questionários existentes"** → desbloqueia os questionários para edição, consome 1 crédito de reanálise
  2. **"Refazer do zero"** → limpa todas as respostas, consome 1 crédito de reanálise
- Após editar/refazer, o usuário pode submeter novamente para gerar nova estratégia

**Arquivos afetados:**
- `src/pages/BusinessQuestionnaire.tsx` — adicionar botão "Refazer análise" e dialog
- `src/pages/ArchetypeQuestionnaire.tsx` — mesma lógica
- `src/pages/Dashboard.tsx` — mostrar opção de reanálise se report existe

---

### Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/post-editor/CarouselEditor.tsx` (passar overlay images) |
| Editar | `src/components/post-editor/PostToolbar.tsx` (adicionar elementos gráficos) |
| Editar | `src/pages/PostEditorPage.tsx` (passar overlays ao carousel) |
| Editar | `src/pages/EditorialPage.tsx` (reordenar botões) |
| Editar | `src/pages/BusinessQuestionnaire.tsx` (refazer análise + desabilitar edição) |
| Editar | `src/pages/ArchetypeQuestionnaire.tsx` (mesma lógica de reanálise) |

