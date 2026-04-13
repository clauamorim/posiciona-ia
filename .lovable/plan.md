

## Plano: Substituir ícone Sparkles pelo logo Posiciona + favicon

### O que será feito

1. **Copiar a imagem** para `src/assets/posiciona-logo.png` (para uso em componentes React) e `public/favicon.png` (para favicon)

2. **Substituir o ícone Sparkles** pelo logo em todos os locais onde aparece ao lado de "Posiciona":

| Arquivo | Local |
|---------|-------|
| `src/components/DashboardLayout.tsx` | Sidebar (linha 81) e header mobile (linha 142) |
| `src/pages/LandingPage.tsx` | Header (linha 115) e selo do hero (linha 169) |
| `src/pages/Login.tsx` | Cabeçalho do card (linha 52) |
| `src/pages/Signup.tsx` | Cabeçalho do card (linha 67) |

Em cada local: substituir `<Sparkles className="..." />` por `<img src={posicionaLogo} alt="Posiciona" className="h-5 w-5" />` (ajustando tamanho conforme contexto).

3. **Atualizar favicon** em `index.html`: adicionar `<link rel="icon" href="/favicon.png" type="image/png">` e remover `public/favicon.ico` se existir.

### Arquivos editados
- `src/assets/posiciona-logo.png` (novo — cópia do upload)
- `public/favicon.png` (novo — cópia do upload)
- `src/components/DashboardLayout.tsx`
- `src/pages/LandingPage.tsx`
- `src/pages/Login.tsx`
- `src/pages/Signup.tsx`
- `index.html`

