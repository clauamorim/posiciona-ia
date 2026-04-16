

# Correções e Melhorias no Editor e Questionário (atualizado)

O pedido contém 10 problemas distintos. Segue o plano consolidado.

---

## 1–9: Mantidos conforme plano anterior

Os itens 1 a 9 permanecem inalterados (questionário sem valor default, anti-reload Alt+Tab no questionário/editor/retratos, barras hardcoded, upload de imagens com galeria, cor customizada no gradiente, remoção de fundo, camadas, markdown na editorial e copy no editor).

---

## 10. Botões de numeração do carrossel (ex: 1/6) editáveis e removíveis

**Problema:** O canvas renderiza um badge circular fixo no canto superior direito mostrando `slideNumber/totalSlides` (ex: "1/6"). Esse elemento não é editável nem removível pelo usuário.

**Solução:**
- Adicionar um toggle no toolbar (seção de carrossel ou seção geral) para exibir/ocultar o badge de numeração dos slides.
- Tornar o badge arrastável no canvas, similar ao CTA — o usuário pode reposicionar livremente.
- Permitir editar cor de fundo, cor do texto e tamanho do badge via controles no toolbar.
- Nova prop `showSlideNumber` (boolean, default true) e `slideNumberPosition` (x, y) no `PostCanvas` e `CarouselEditor`.
- State gerenciado em `PostEditorPage.tsx`.

**Arquivos:** `src/components/post-editor/PostCanvas.tsx`, `src/components/post-editor/PostToolbar.tsx`, `src/components/post-editor/CarouselEditor.tsx`, `src/pages/PostEditorPage.tsx`

---

## Resumo de arquivos alterados

| Arquivo | Mudanças |
|---------|----------|
| `src/pages/ArchetypeQuestionnaire.tsx` | Sem valor default 3, flag anti-reload |
| `src/pages/PostEditorPage.tsx` | Flag anti-reload, compressão antes do remove-bg, copy limpo, cor gradiente customizada, funções de camada, estado do badge de numeração |
| `src/pages/PortraitGenerator.tsx` | Persistência de estado contra Alt+Tab |
| `src/contexts/AuthContext.tsx` | Evitar loading state em refresh de sessão |
| `src/components/post-editor/PostCanvas.tsx` | Remover barras hardcoded, z-index por posição no array, badge de numeração editável/arrastável/removível |
| `src/components/post-editor/PostToolbar.tsx` | Remover upload logo, galeria de imagens, cor customizada no gradiente, botões de camada, toggle e controles do badge de numeração |
| `src/components/post-editor/CarouselEditor.tsx` | Passar novas props do badge de numeração |
| `src/pages/EditorialPage.tsx` | Voltar asteriscos na exibição, copy dos cards usa texto pós-`**` |
| `src/lib/textCleanup.ts` | Helper para extrair texto após bloco bold |
| `supabase/functions/remove-background/index.ts` | Melhorar tratamento de erros e prompt para fundos claros |

