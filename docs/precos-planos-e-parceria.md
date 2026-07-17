# Preços, planos multi-perfil e parceria com agência

**Status:** recomendações registradas em 17/07/2026 — decisões finais são da Cláudia.
Complementa `docs/plano-multi-workspace.md` (arquitetura). Valores base: câmbio ~R$5,50;
custo de IA por perfil ativo ≈ R$20–30/mês (editorial Opus 4.7 ~R$4–5/semana, relatório
Sonnet 4.6 ~R$2, Gemini centavos); Stripe ~R$13; imposto conforme enquadramento.

## 1. Planos multi-perfil (workspaces)

Princípio: **os tiers multi têm TODAS as funcionalidades do Autoridade Total** — o que
escala entre planos é quantidade (perfis e créditos), nunca feature. Créditos são um
pool da conta (dono), consumidos por qualquer perfil. Billing continua por usuário
(`max_workspaces` no plano — ver plano de arquitetura, seção 8).

| Plano | Perfis | Preço/mês | Incluído por mês (pool) |
|---|---|---|---|
| Semana de Conteúdo | 1 | R$197 (único) | 1 ciclo, 3 ajustes (inalterado) |
| Presença Mensal | 1 | R$297 | 4 ciclos, 1 reanálise, 12 ajustes (inalterado) |
| Autoridade Total | 1 | R$497 | 4 ciclos, 2 reanálises, 5 retratos, 20 ajustes (inalterado) |
| **Posiciona Multi** | até 5 | **R$997** | 20 ciclos, reanálise 1×/perfil, 15 retratos, 60 ajustes |
| **Posiciona Agência** | até 10 | **R$1.697** | 40 ciclos, reanálise 1×/perfil, 30 retratos, 120 ajustes |
| Enterprise | 10+ | sob consulta | negociado |

Racional: 5×Autoridade = R$2.485 → Multi a R$997 é ~60% de desconto por volume; custo de
IA no pior caso (~R$150–200) coberto com folga. Não usar "perfis ilimitados" (modelo
GoHighLevel): o custo marginal por perfil ativo do Posiciona não é ~zero como o deles.

Todo plano (inclusive os de 1 perfil) ganha o seletor **marca pessoal × marca
institucional** sem custo extra — argumento de venda, não upsell.

## 2. Extras (créditos avulsos)

Hoje: semana extra R$87/77/67 conforme plano; packs de retratos 5/10/15 com desconto por
plano; ajustes não são vendidos avulsos. Extensão proposta:

- **Semana extra**: Multi R$57, Agência R$47 (mantém a régua descendente).
- **Retratos**: mesmos packs, tier de desconto estendido a Multi/Agência.
- **Novo — pacote de 10 semanas por R$447** (R$44,70/semana) para agências que estouram o pool.
- **Novo — pack de 20 ajustes por R$47** (hoje quem estoura fica sem saída; custo de IA ~centavos).
- Compra continua pendurada na conta do dono; crédito cai no pool.

## 3. Parceria com agência de tráfego (fechada em jul/2026)

Estrutura: agência entra com o serviço de gestão (sem fee fixo); **a mídia é paga pela
Cláudia**; agência recebe **30% do valor até o 3º mês** de cada cliente vindo dos
anúncios. No sentido inverso, Cláudia recebe 30% do 1º mês de clientes que contratarem a
agência via Posiciona (indicação dela vale R$450–900 em valor absoluto — favorável).

Leitura correta do acordo: os 30%×3 são **remuneração da gestão por performance** (em vez
de fee fixo de R$1,5–3k/mês). Margem fecha: no Presença, sobra ~R$146/mês (49%) nos meses
com comissão e ~79% do 4º mês em diante.

### Cláusulas a formalizar por escrito (1 página)

1. **Base de cálculo**: 30% sobre o valor **efetivamente recebido** (líquido de taxa do
   meio de pagamento; reembolsos, chargebacks e inadimplência fora).
2. **Escopo**: comissão só sobre a assinatura — extras, retratos e packs avulsos fora.
3. **Condição**: comissão paga apenas enquanto o cliente estiver ativo e pago
   (cancelou no mês 2, comissão para).
4. **Atribuição**: cupom ou link rastreado, janela definida (ex.: compra em até 30 dias).
5. **Orçamento de mídia**: teto mensal definido pela Cláudia, com revisão conjunta do
   CPA a cada mês.

### Guardrails de CPA (mídia é da Cláudia → o CPA decide tudo)

| CPA de mídia por assinante | Leitura |
|---|---|
| até ~R$300 | Saudável — payback em 2–3 meses; LTV líquido ~R$1.100 (retenção ~6 meses) |
| R$300–440 | Limite — R$440 é o que sobra nos 3 primeiros meses do Presença após comissão+custos |
| acima de R$440 | Parar e renegociar (comissão para 1 mês ou % menor) ou trocar criativo/público |

Começar com orçamento pequeno (R$1,5–3k de teste), medir CPA real, renegociar com dados
antes de escalar. Nesta configuração (mídia da Cláudia), 3 meses de comissão foi
generoso — renegociação futura tem argumento.

### Canal de anúncios × plano de entrada (R$197)

O R$197 único é arriscado no canal pago: 197 − R$59 de comissão − ~R$40 de custos ≈
R$98 antes da mídia — CPA acima de ~R$100 dá prejuízo se o cliente não fizer upgrade.
Recomendação: campanhas apontam para os planos recorrentes; se o R$197 entrar como isca,
medir taxa de upgrade em 7 dias (o desconto de R$197 no upgrade já existe no produto).

## 4. Benchmarks (analisados em 17/07/2026)

- **GoHighLevel** (gohighlevel.com): referência do modelo agência — US$97/mês (3
  sub-contas) e US$297/mês (sub-contas ilimitadas), white-label/SaaS mode em que a
  agência revende com a marca dela. Lições: (a) sub-conta = nosso workspace, modelo
  validado de mercado; (b) ilimitado só funciona com custo marginal ~zero — nossos tiers
  com teto + pool de créditos são a adaptação certa; (c) white-label para agências é
  candidato a diferencial do Enterprise no futuro (grande esforço, não agora).
- **RetratAÍ** (retrat.ai): concorrente direto do módulo Retratos — retratos
  profissionais por IA a partir de selfies, **também baseado nos 12 arquétipos**.
  R$697/ano (~R$58/mês, 50 retratos) e R$2.997/ano enterprise; âncora de marketing
  "retrato por menos de R$20". Lições: (a) valida o posicionamento arquétipos+imagem;
  (b) Posiciona não compete em preço-por-retrato — o retrato é parte do posicionamento
  completo (estratégia+editorial+stories), vender o conjunto; (c) atenção à âncora de
  ~R$20/retrato ao precificar packs avulsos.
