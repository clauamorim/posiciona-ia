

# Plano: Ocultar Galeria de Imagens no Editor de Posts

Comentar/ocultar temporariamente a seção "Galeria" no `PostToolbar.tsx` (linhas 751-792).

### Arquivo: `src/components/post-editor/PostToolbar.tsx`

- Envolver o bloco `{/* Gallery Assets */}` (linhas 751-792) com `{false && (...)}`  para ocultá-lo sem perder o código
- Isso mantém todo o código intacto para reativar facilmente no futuro

| Arquivo | Alteração |
|---------|-----------|
| `src/components/post-editor/PostToolbar.tsx` | Ocultar seção da galeria com `{false && ...}` |

