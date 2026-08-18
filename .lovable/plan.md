# O que é esse e-mail

A Stripe avisa que, desde **15/08/2026 16:05 UTC**, as 10 últimas tentativas de entregar eventos ao endpoint `.../functions/v1/stripe-webhook` falharam ("other errors" = resposta fora da faixa HTTP 200-299). Se não for resolvido, a Stripe **para de enviar eventos em 24/08/2026 16:05 UTC**.

Impacto prático: pagamentos e assinaturas continuam acontecendo na Stripe, mas o app pode deixar de provisionar plano/créditos automaticamente (compras novas, renovações, upgrades, packs de retrato).

## O que já verifiquei

- O endpoint está no ar e responde (não é função removida ou fora do ar).
- O código atual do webhook está correto: valida a assinatura com `constructEventAsync` e devolve 200 quando o evento é processado.
- Em qualquer erro, a função devolve **400** — que é exatamente o que a Stripe classifica como falha. Não consegui ainda ver o log da função (o painel de logs voltou vazio), então a causa exata ainda não está confirmada.

Causa mais provável (a confirmar): o **segredo de assinatura** (`STRIPE_WEBHOOK_SECRET`) no projeto não corresponde ao segredo do endpoint configurado hoje na Stripe — o que acontece quando o endpoint é recriado/alterado no painel da Stripe. Nesse caso toda entrega falha com erro de assinatura, exatamente no padrão "todas falham a partir de uma data".

## Plano

1. **Diagnóstico com evidência**: consultar os logs da função e o histórico de entregas do webhook na Stripe (via API) para ler a mensagem de erro real das 10 tentativas. Isso separa "assinatura inválida" de "erro dentro de um handler específico".
2. **Se for assinatura**: atualizar o segredo `STRIPE_WEBHOOK_SECRET` com o signing secret atual do endpoint na Stripe e redeployar a função.
3. **Se for erro em um handler**: corrigir o handler que está lançando exceção.
4. **Endurecer o webhook** (independente da causa): passar a responder **200** para erros de processamento interno (mantendo 400 apenas para assinatura inválida) e registrar a falha em log, para que um bug pontual nunca mais derrube o endpoint inteiro nem faça a Stripe desativá-lo.
5. **Reprocessar** os eventos perdidos desde 15/08 (reenvio pelo painel da Stripe ou provisionamento manual dos clientes afetados) e conferir se alguma compra ficou sem plano/créditos.
6. **Validar**: enviar um evento de teste e confirmar 200 + log de processamento.

## Preciso de você

Para o passo 2 eu precisarei do **signing secret** do endpoint (começa com `whsec_...`), que aparece no painel da Stripe em Developers > Webhooks > o endpoint > "Signing secret". Peço no momento certo, depois do diagnóstico.
