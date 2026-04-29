## Adicionar seção de Depoimentos na Landing Page

### Onde inserir
Nova seção **"Depoimentos"** posicionada **logo após a seção "Veja o que o Posiciona entrega na prática"** (linha 580) e **antes de "Planos"** (linha 583).

Esse é o ponto ideal de prova social: o visitante acabou de ver os entregáveis e, antes de avaliar preço, lê a validação de quem já usou. Padrão consagrado em landing pages premium.

### Estilo visual (alinhado ao Dark Premium da landing)

- Fundo: `bg-landing-bg` (alterna com a faixa secundária dos planos logo abaixo, criando ritmo visual).
- Container: `max-w-6xl mx-auto`.
- Cabeçalho centralizado:
  - Eyebrow dourado em caps: **"Quem já usou"**.
  - Título serifado (Cormorant): *"Resultados que falam por si — em palavras de quem confiou no processo."* (com a parte itálica em `text-landing-gold`).
- Grid de 3 cards (`md:grid-cols-3`, empilha em mobile).
- Cada card:
  - Borda sutil `border-landing-border/40`, fundo `bg-landing-bg-secondary/30`, cantos `rounded-xl`, padding `p-6`.
  - Aspas decorativas grandes em dourado no topo (símbolo " em Cormorant Garamond, opacidade ~30%).
  - Texto do depoimento em Inter, `text-sm leading-relaxed text-landing-text/90`. **Sem foto** (mantém sobriedade editorial; evita o efeito "stock photo").
  - Linha divisória fina dourada (`w-8 h-px bg-landing-gold/50`) separando depoimento da assinatura.
  - Nome em Inter semibold + cargo em `text-xs text-landing-text-secondary`.
- Sem CTA dentro da seção (o CTA dos Planos vem logo abaixo).

### Tratamento dos textos
- Manter os depoimentos **na íntegra**, apenas com pequenos ajustes tipográficos (aspas curvas " ", traço em "Girlaydy Costa — Fotógrafa").
- O depoimento da Mariana é o mais longo. Duas opções:
  1. **Manter completo** nos 3 cards (cards de altura desigual, alinhados pelo topo). Recomendado — preserva profundidade e autoridade do depoimento mais técnico.
  2. Encurtar a versão exibida e mostrar "ler mais" expansível. Não recomendado nessa landing por adicionar interação desnecessária.

Recomendação: **opção 1**, com `items-start` no grid, deixando o card da Mariana naturalmente mais alto.

### Assinaturas finais
- Girlaydy Costa — Fotógrafa
- Júnior Sales — Gestor de tráfego
- Mariana Bertoldo — Estrategista de conteúdo

### Arquivos afetados
- `src/pages/LandingPage.tsx` — inserir nova `<section>` entre as linhas 580 e 583. Nenhum outro arquivo precisa ser modificado.

### Pergunta antes de implementar
Você prefere a **opção 1** (manter os 3 depoimentos na íntegra, cards de alturas levemente diferentes) ou prefere que eu **encurte** o da Mariana para os 3 ficarem visualmente equilibrados?