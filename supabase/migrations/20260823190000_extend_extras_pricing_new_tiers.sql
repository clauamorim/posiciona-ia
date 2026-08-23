-- ============================================================================
-- Estende os preços de extras (packs de retrato) pros planos Dupla/Multi/
-- Agência — sem isso, quem assina esses planos não consegue comprar
-- avulso (portrait-pack-checkout/index.ts não acha price pro slug e falha
-- com "Pack has no Stripe price configured").
--
-- Dupla/Multi/Agência herdam "tudo do Autoridade Total", inclusive o melhor
-- preço em extras — reaproveita o mesmo Price ID já usado pro
-- autoridade_total em vez de criar produto novo na Stripe só pra cobrar o
-- mesmo valor (semana extra já resolvido em código, sem precisar de SQL).
--
-- Aplicação: MANUAL no SQL editor do Lovable Cloud. Idempotente.
-- ============================================================================

update public.portrait_packs
set stripe_price_ids = stripe_price_ids
  || jsonb_build_object(
       'dupla', stripe_price_ids->>'autoridade_total',
       'multi', stripe_price_ids->>'autoridade_total',
       'agencia', stripe_price_ids->>'autoridade_total'
     )
where stripe_price_ids ? 'autoridade_total';
