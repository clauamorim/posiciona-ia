## Problema

No mobile, o botão "Voltar ao topo" (seta para cima) sumiu visualmente porque está posicionado em `bottom: 1.5rem` e ficou coberto pela barra inferior `MobileBottomNav` (Início/Criar/Biblioteca/Conta), que é `fixed bottom-0` com ~64–72px de altura. No desktop o botão já está oculto (`lg:hidden`), então o sumiço só aparece no celular — exatamente o que a usuária reportou.

O FAB do Assistente já foi reposicionado para `bottom-20` justamente para ficar acima da barra; o `BackToTopButton` ficou para trás.

## Correção

Editar apenas `src/components/BackToTopButton.tsx`:

- Reposicionar verticalmente para ficar **acima do FAB do Assistente**, no mesmo lado direito (como antes), respeitando a barra inferior no mobile.
- Manter `lg:hidden` (desktop não tem `MobileBottomNav` e o botão já não aparecia lá).
- Novo `style.bottom`: `calc(9rem + env(safe-area-inset-bottom))` (≈ acima do FAB que está em `bottom-20` + ~56px de altura + folga).
- Manter `right-4`, mesma aparência (pill circular, ChevronUp).

Nada mais é alterado — sem mudanças em `MobileBottomNav`, `AssistantButton` ou no layout.

## Verificação

- Mobile: rolar mais de 600px em qualquer página com `DashboardLayout` (ex.: `/storybrand`, `/report`, `/editorial`) e confirmar que a seta aparece acima do botão roxo do Assistente, sem ser coberta pela barra inferior.
- Desktop: comportamento inalterado (botão segue oculto).