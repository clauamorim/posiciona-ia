---
name: Diretrizes Visuais Premium Unificadas
description: Tema escuro unificado em toda a aplicação, mesma paleta da landing page. Sem fundos brancos/cinza.
type: design
---
## Paleta Unificada (Dark Premium)

A aplicação inteira usa tema escuro unificado com a landing page. ZERO fundos brancos ou cinza claro.

### Fundos
- Principal: #0D0B1A (--background: 252 60% 5%)
- Cards/painéis: #13102A (--card: 252 52% 11%)
- Inputs/campos: #1C1836 (--input/--secondary: 252 35% 15%)
- Bordas: #2E2A4A (--border: 256 30% 23%)

### Textos
- Primário: #FFFFFF
- Secundário: #A09CC0 (--muted-foreground: 252 28% 76%)
- Desabilitado: #5C5880 (--text-disabled: 256 20% 42%)

### Destaques
- Roxo CTA: #7C3AED (--primary: 263 84% 58%)
- Roxo hover: #6D28D9
- Dourado: #C9A84C (--gold: 42 52% 53%)
- Dourado hover: #E2C06A
- Verde concluído: #6EE7B7 (--success: 160 60% 67%)

### Tipografia
- Títulos (h1-h6): Cormorant Garamond, serif
- Corpo/labels/botões: Inter, sans-serif

### Estados visuais
- Pendente: text-disabled (#5C5880)
- Em andamento: text-warning (#C9A84C)
- Concluído: text-success (#6EE7B7)

### Regras
- Nenhum modal, drawer, tooltip, card com fundo branco
- Scrollbars estilizadas em dark
- Safari safe areas respeitadas (env(safe-area-inset-*))
- overflow-x: hidden global
