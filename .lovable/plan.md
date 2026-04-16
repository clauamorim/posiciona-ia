

# Ajustes na Landing Page e Aplicação do Posiciona

## Escopo

6 mudanças: seção de demonstração com screenshots, bloco futuro de comparação de retratos, botão WhatsApp dourado, e-mail de suporte nas áreas de ajuda, títulos/legendas, responsividade.

---

## 1. Copiar screenshots para o projeto

Copiar os 5 screenshots selecionados para `src/assets/demo/`:
- `DashBoard.png`
- `Questionario_arquetipos.png`
- `Arquétipos.png`
- `Narrativa_Marca.png`
- `Linha_Editorial.png`

## 2. Ativar e popular a seção de demonstração (linhas 285-309)

- Mudar `SHOW_DEMO_SECTION` para `true` (linha 22)
- Substituir o conteúdo da seção de demonstração por:
  - Titulo: "Veja o Posiciona por dentro"
  - Subtítulo: "Do diagnóstico à estratégia, da narrativa ao conteúdo: veja como a plataforma organiza seu posicionamento na prática."
  - Carrossel horizontal premium com os 5 screenshots importados via ES6, cada um com legenda:
    1. "Dashboard estratégico"
    2. "Diagnóstico guiado"
    3. "Resultado de posicionamento"
    4. "Narrativa da marca"
    5. "Linha editorial pronta"
  - Implementar carrossel com navegação por setas e indicadores de dots
  - Imagem principal com borda sutil, rounded-xl, sombra
  - Responsivo: no mobile, imagem ocupa largura total com scroll horizontal ou swipe
  - CTA "Começar meu posicionamento agora" mantido abaixo

## 3. Bloco futuro de comparação de retratos

Inserir logo após a seção de demonstração, uma nova section com:
- Título: "Da foto base ao retrato de marca"
- Subtítulo: "Compare a imagem original com versões geradas pelo Posiciona para o seu posicionamento."
- Layout de comparador slider com divisor arrastável (placeholder com gradiente e ícone, sem imagens reais)
- Microcopy: "Deslize para comparar"
- Sem imagens — apenas a estrutura pronta, com estado visual elegante (não vazio/quebrado)
- Usar placeholders com ícones (Camera/Image) e texto discreto indicando "Foto original" e "Retrato Posiciona"

## 4. Botão flutuante WhatsApp (linhas 511-523)

Substituir o botão atual por:
- Fundo `#C9A84C`, hover `#E2C06A`
- Ícone WhatsApp cor `#0D0B1A`
- Mobile: 56x56px, desktop: 60x60px, ícone 24/26px
- `bottom: calc(20px + env(safe-area-inset-bottom))`, `right: 20px`
- Remover `animate-pulse` e verde padrão
- Sombra sutil, transição 0.2s ease, active scale(0.97)
- aria-label mantido
- Tooltip discreto no desktop ("Fale no WhatsApp")

## 5. E-mail de suporte nas áreas de ajuda

Substituir `contato@posiciona.ia.br` por `suporte@posiciona.ia.br` em contextos de ajuda/suporte:
- `src/pages/HelpPage.tsx` — adicionar rodapé com link para suporte@posiciona.ia.br
- `src/components/LegalPageLayout.tsx` — trocar para suporte@ no texto de suporte
- `src/pages/TermosDeServico.tsx` — trocar "Contato geral e suporte" para suporte@
- `src/pages/PoliticaDePrivacidade.tsx` — trocar a linha de "Contato geral e suporte" para suporte@

Manter `contato@` no footer da landing (é contato geral, não suporte) e nos edge functions (Stripe).

## 6. Arquivos a alterar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/LandingPage.tsx` | Ativar demo, carrossel de screenshots, bloco comparador, botão WhatsApp |
| `src/pages/HelpPage.tsx` | Adicionar rodapé com suporte@posiciona.ia.br |
| `src/components/LegalPageLayout.tsx` | Trocar contato@ por suporte@ |
| `src/pages/TermosDeServico.tsx` | Trocar contato@ por suporte@ |
| `src/pages/PoliticaDePrivacidade.tsx` | Trocar contato@ por suporte@ |
| `src/assets/demo/` | 5 screenshots copiados |

