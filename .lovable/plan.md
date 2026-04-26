## Objetivo
Remover o número "7" da feature do pacote **Semana de Conteúdo**, alterando "7 conteúdos prontos para publicar" para "Conteúdos prontos para publicar" em todas as páginas que descrevem o pacote e também na descrição do produto correspondente no Stripe.

## Alterações no código

### 1. `src/pages/ChoosePlan.tsx` (linha 30)
Dentro do array `features` do plano `semana_conteudo`, substituir:
- Antes: `"7 conteúdos prontos para publicar"`
- Depois: `"Conteúdos prontos para publicar"`

### 2. `src/pages/LandingPage.tsx` (linha 52)
No bloco de features comerciais do plano Semana de Conteúdo, substituir:
- Antes: `"7 conteúdos prontos para publicar"`
- Depois: `"Conteúdos prontos para publicar"`

## Alteração no Stripe

### 3. Produto `prod_UIQtEybwt7nigo` ("Semana de Conteúdo")
Atualizar via `stripe_api_execute` (operação `PostProductsId`) o campo `description`:
- **Antes:** `"Diagnóstico inicial completo: arquétipos, narrativa de marca, análise de Instagram, 1 ciclo editorial de 7 dias com 7 conteúdos prontos. Pagamento único."`
- **Depois:** `"Diagnóstico inicial completo: arquétipos, narrativa de marca, análise de Instagram, 1 ciclo editorial de 7 dias com conteúdos prontos para publicar. Pagamento único."`

Nada será alterado no nome do produto, nos preços (`stripe_price_ids`) ou no produto separado `prod_UKX3WnVEKIbHUZ` ("Semana Extra de Conteúdo").

## Itens fora do escopo (não alterar)
- `src/pages/HelpPage.tsx` — texto explicativo da Linha Editorial, não é a descrição do pacote.
- `src/pages/TermosDeServico.tsx` — texto legal genérico.
- `src/pages/MyDesignsPage.tsx` — refere-se a artes salvas no editor.
- FAQ da `LandingPage.tsx` (linha 99) — resposta sobre formato dos conteúdos.

## Validação esperada
- A página `/choose-plan` mostra "Conteúdos prontos para publicar" no card do plano Semana de Conteúdo.
- A landing page mostra a mesma feature atualizada.
- O dashboard do Stripe reflete a nova descrição do produto Semana de Conteúdo.