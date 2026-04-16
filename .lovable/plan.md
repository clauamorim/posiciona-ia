

## Plano: Modal de pré-visualização para retratos gerados

### Causa
Atualmente os retratos são exibidos apenas como thumbnails pequenos no `aspect-square` dos cards (PortraitGenerator e Histórico → Retratos), com botão de download abaixo. Não há como inspecionar o retrato em tamanho grande antes de baixar.

### Solução
Criar um componente reutilizável `PortraitPreviewDialog` (modal/lightbox) que:
- Abre ao clicar em qualquer thumbnail de retrato.
- Mostra a imagem em tamanho grande, centralizada, com fundo escuro semi-transparente.
- Oferece ações no rodapé do modal: **Baixar** e **Fechar**.
- Suporta navegação entre múltiplos retratos quando aplicável (setas ‹ ›, teclas ←/→, contador "1 de N").
- Visual premium: bordas suaves, sem distração, imagem com `object-contain` e altura máxima ~80vh.

Não incluir "Usar no editor" agora — não há fluxo existente de portrait→editor (seria nova feature). Anotar como próximo passo sugerido.

---

### Componente novo

**`src/components/PortraitPreviewDialog.tsx`** (novo)
- Props: `open`, `onOpenChange`, `portraits: string[]`, `initialIndex`, `onDownload?: (url: string, index: number) => void`, `downloading?: boolean`, `downloadHint?: string` (ex: "1 crédito será debitado").
- Usa `Dialog` do shadcn com `DialogContent` em `max-w-4xl` e fundo `bg-card`.
- Imagem em `<img className="max-h-[75vh] w-auto mx-auto object-contain rounded-lg" />`.
- Setas laterais quando `portraits.length > 1` (ChevronLeft / ChevronRight).
- Listener de teclado (←, →, Esc) via `useEffect`.
- Rodapé: contador centralizado + botão "Baixar" à direita (ícone Download).

### Integrações

**`src/pages/PortraitGenerator.tsx`**
- Adicionar state `previewIndex: number | null`.
- Tornar a imagem do thumbnail clicável (`cursor-zoom-in`, `onClick={() => setPreviewIndex(i)}`).
- Adicionar overlay sutil com ícone de "Expandir" no hover.
- Renderizar `<PortraitPreviewDialog>` no fim, ligando `onDownload` ao `downloadPortrait` existente (mantém débito de crédito).
- Manter botão "Baixar" abaixo do card (não remover — apenas tornar a preview o caminho natural).

**`src/pages/HistoryPage.tsx`** (aba Retratos)
- Achatar a lista de portraits em `flatPortraits: { url, createdAt, key }[]` para permitir navegação linear no preview.
- Tornar thumbnail clicável → abre preview no índice correto.
- Manter botão de download existente no hover.
- `onDownload` no preview chama o `downloadPortrait` local (sem cobrança — já foi pago na geração).

---

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/components/PortraitPreviewDialog.tsx` | Novo componente lightbox reutilizável |
| `src/pages/PortraitGenerator.tsx` | Thumbnail clicável + integrar preview; passa `downloadPortrait` |
| `src/pages/HistoryPage.tsx` | Thumbnail clicável + integrar preview na aba Retratos |

Sem mudanças de schema, edge functions, créditos ou Stripe. A lógica de débito de crédito permanece em `downloadPortrait` (PortraitGenerator), apenas reaproveitada pelo botão dentro do modal.

