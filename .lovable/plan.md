

# Correções: Editor, Retratos e Persistência (atualizado)

## Causa raiz comum: AuthContext com closure stale

Em `AuthContext.tsx` linha 186, `session?.user?.id` vem do closure do `useEffect([])` — é sempre `null`. Então a verificação "mesmo usuário já hidratado" nunca funciona, e qualquer evento de autenticação (foco, alt+tab) dispara `setIsLoading(true)`, desmontando todas as páginas protegidas.

**Correção:** usar um `ref` para rastrear o user ID atual em vez de depender do state no closure.

---

## 1. AuthContext — corrigir closure stale

- Adicionar `sessionUserIdRef = useRef<string | null>(null)` sincronizado com `session`.
- Na linha 186, comparar `newSession.user.id` contra `sessionUserIdRef.current` em vez de `session?.user?.id`.
- Isso resolve o reset em **todas** as páginas protegidas (Editor, Retratos, Questionários).

## 2. Editor de Posts — persistência de rascunho

- Salvar estado completo do editor em `sessionStorage` (textos, cores, layout, overlays, imagens enviadas).
- Restaurar ao montar, antes da inicialização padrão.
- Imagens grandes: armazenar em `sessionStorage` com chave separada por imagem (evitar truncar com `__large__`).
- Reset do editor limpa o rascunho.

## 3. Editor de Posts — camadas

- Remover qualquer override de `z-index` por tipo ou seleção no `PostCanvas.tsx`.
- Todos os overlays renderizados com `zIndex` baseado exclusivamente no índice do array.
- Seleção destacada apenas por outline/handles.

## 4. Editor de Posts — galeria de uploads

- `uploadedImages` populado e restaurado a partir do rascunho.
- Exibido na seção "Imagens adicionadas" do toolbar.

## 5. Gerador de Retratos — persistência contra Alt+Tab

- Com a correção do AuthContext (item 1), o remount deixa de acontecer.
- Como camada extra de segurança: persistir em `sessionStorage` o estado crítico (selfies em base64, portraits gerados, look selecionado, diálogo aberto).
- Restaurar ao montar se houver dados salvos.

---

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `src/contexts/AuthContext.tsx` | Ref para user ID, corrigir closure stale |
| `src/pages/PostEditorPage.tsx` | Persistência de rascunho robusta |
| `src/components/post-editor/PostCanvas.tsx` | z-index unificado por índice do array |
| `src/components/post-editor/PostToolbar.tsx` | Galeria de uploads restaurada do draft |
| `src/pages/PortraitGenerator.tsx` | Persistência de estado em sessionStorage |

