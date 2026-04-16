

# Plano: Correções no editor de posts

## Causas raiz

**1. Seleção de texto não mostra opções (fonte/cor/parágrafo)**
- `PostCanvas` cria text boxes com IDs `"text-title"` e `"text-body"`, mas `PostEditorPage` testa `selectedTextId === "title"` / `"body"` (sem prefixo). Resultado: `selectedKind` é sempre `null` → painel "Elemento selecionado" mostra apenas a dica vazia.
- CTA: handler `handleCtaPointerDown` faz `setSelectedTextId(null)` em vez de `"cta"`. CTA nunca é selecionável no inspector.
- Numeração de slide: idem — emite `null`, nunca `"slideNumber"`.

**2. Cor de ícones/molduras não muda**
- `SelectionPanel` chama `props.onRecolorElement(c)` quando o usuário escolhe cor de um ícone selecionado, mas `PostEditorPage` **nunca passa** `onRecolorElement` para o `PostToolbar`. Prop fica `undefined`, controle some.

**3. Botão "Salvar" não aparece e designs não persistem**
- `PostToolbar` só renderiza o botão Salvar se receber `onSaveDesign`. `PostEditorPage` nunca passa essa prop. Não existe nenhuma lógica que insira em `user_designs`.

**4. Botão Layout aparenta não funcionar**
- O wiring está correto (`onLayoutChange={setLayout}`), mas o `PostCanvas` só recalcula posições uma única vez por mudança de layout via `lastLayout.current`, e como os text boxes preservam posição editada, o efeito visual fica imperceptível em alguns casos. Vou garantir que o reset de layout sempre reposicione, e que o botão visual tenha estado ativo claro.

**5. Ordem do menu lateral**
- `footerItems` em `DashboardLayout` está: Meus Designs → Plano e Créditos → Histórico → Ajuda. Usuário quer Histórico logo abaixo de Meus Designs.

---

## Mudanças

### A) Corrigir seleção contextual (`PostEditorPage.tsx`)
Mapear os IDs reais que o canvas emite:
```ts
if (selectedTextId === "text-title") selectedKind = "title";
else if (selectedTextId === "text-body") selectedKind = "body";
else if (selectedTextId === "cta") selectedKind = "cta";
else if (selectedTextId === "slideNumber") selectedKind = "slideNumber";
```

### B) CTA e numeração selecionáveis (`PostCanvas.tsx`)
- `handleCtaPointerDown`: trocar `setSelectedTextId(null)` por `setSelectedTextId("cta")`.
- Drag do número do slide: idem, emitir `"slideNumber"` em vez de `null`.
- Adicionar `onClick` no nó do CTA e do número que emita o ID correspondente.

### C) Recolor de ícones/molduras (`PostEditorPage.tsx`)
Implementar e passar `onRecolorElement`:
```ts
const handleRecolorElement = (color: string) => {
  if (!selectedImageId) return;
  const overlay = overlayImages.find(o => o.id === selectedImageId);
  if (!overlay || overlay.type !== "element") return;
  // Re-decode SVG, swap currentColor/fill, re-encode
  const decoded = atob(overlay.src.split("base64,")[1] || "");
  const recolored = decoded.replace(/(fill|stroke)="[^"]*"/g, (m, attr) =>
    m.includes('"none"') ? m : `${attr}="${color}"`
  );
  handleUpdateOverlay(overlay.id, { src: `data:image/svg+xml;base64,${btoa(recolored)}` });
};
```
Passar `onRecolorElement={handleRecolorElement}` ao `PostToolbar`.

### D) Salvar designs em `user_designs` (`PostEditorPage.tsx` + `PostToolbar`)
- Adicionar botão "Salvar design" (já existe no `PostToolbar` se `onSaveDesign` for passado).
- `handleSaveDesign`: capturar thumbnail (html2canvas do canvas atual @ scale 0.3) + serializar todo o estado num objeto `state` e fazer upsert em `user_designs` por `(user_id, week_index, day_index)` se não houver `?design=ID`, ou update se houver.
- Na carga inicial (`useEffect`), se `searchParams.get("design")` existir, fazer SELECT da row e hidratar todos os states a partir de `state` JSONB.
- Toast de sucesso. Sem auto-save por enquanto (MVP — manual save evita complicação).

### E) Layout button: garantir efeito visível (`PostCanvas.tsx`)
- No `useEffect` que escuta mudança de `layout`, sempre reposicionar todos os text boxes (remover o `lastLayout.current` short-circuit e em vez disso resetar para as novas posições calculadas).
- Mantém edição de posição manual depois — só reposiciona quando layout muda explicitamente.

### F) Reordenar footer (`DashboardLayout.tsx`)
```ts
const footerItems = [
  { label: "Meus Designs", href: "/my-designs", icon: Layers },
  { label: "Histórico", href: "/history", icon: History },
  { label: "Plano e Créditos", href: "/choose-plan", icon: CreditCard },
  { label: "Ajuda", href: "/help", icon: HelpCircle },
];
```

---

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/pages/PostEditorPage.tsx` | Corrigir mapping de `selectedKind` para IDs reais (`text-title`, `text-body`); adicionar `handleRecolorElement` + passar prop; adicionar `handleSaveDesign` + passar `onSaveDesign`; carregar design por `?design=ID` |
| `src/components/post-editor/PostCanvas.tsx` | Emitir `"cta"` e `"slideNumber"` no pointer down; sempre reposicionar text boxes ao mudar layout |
| `src/components/DashboardLayout.tsx` | Reordenar `footerItems` (Histórico após Meus Designs) |

Sem mudanças de schema (tabelas `user_designs` e `user_gallery_assets` já existem). Sem mudanças em geração de relatório, créditos ou Stripe.

