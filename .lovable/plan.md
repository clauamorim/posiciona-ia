# Pele realista nos retratos — abordagem em 2 fases

## Diagnóstico

O problema **não está nos prompts** nem nos parâmetros que ajustamos nas últimas iterações. As últimas 40+ tentativas falharam pelo mesmo motivo:

- **`FLUX-dev` (modelo base atual) tem viés conhecido para pele cerosa/plástica.** Adicionar 30+ tokens de "skin pores", "subsurface scattering" etc. no prompt traz retorno decrescente — o modelo não tem essa textura no treinamento base.
- **O LoRA da cliente foi treinado em selfies** que tipicamente já têm filtro de beleza nativo do celular. O modelo aprendeu "rosto liso" como parte da identidade. Quanto mais reforçamos a identidade, mais plástica a pele.

A solução é trocar de modelo base e refazer o LoRA — não continuar empilhando ajustes.

## Fase 1 — Reverter (sem custo de crédito)

Antes de qualquer código, você reverte as 3 últimas mensagens via aba **History** no topo do chat. Isso devolve `portraitPrompts.ts` e `generate-portrait/index.ts` ao estado anterior (parâmetros: 35 steps, guidance [2.6/3.0/3.4], FACE_REALISM 0.40, LoRA da cliente 0.90/0.95/1.00).

```text
<lov-actions>
  <lov-open-history>Abrir histórico</lov-open-history>
</lov-actions>
```

Sem isso, qualquer mudança nova entra por cima de código que já não está alinhado.

## Fase 2 — Migração para FLUX 1.1 Pro Ultra (raw mode)

### Por que esse modelo

`black-forest-labs/flux-1.1-pro-ultra` em `raw=true` é hoje o modelo do Replicate com melhor pele "fotográfica não-retocada" para retratos editoriais. É o que estúdios usam para evitar o look "AI plástico" do FLUX-dev. Aceita LoRAs treinados no formato FLUX-dev (mesmo formato que já usamos), então o **pipeline de treino existente continua válido** — só precisa rodar 1 retreino com o dataset atual da cliente.

### Mudanças no código

**`supabase/functions/generate-portrait/index.ts`**
- Trocar `MODEL` de `lucataco/flux-dev-multi-lora` para `black-forest-labs/flux-1.1-pro-ultra`.
- Adicionar parâmetro `raw: true` (essencial — esse é o modo que desliga o "beauty filter" interno do FLUX).
- Remover o 2º LoRA (`Canopus-LoRA-Flux-FaceRealism`) — em raw mode ele atrapalha mais do que ajuda. Stack volta a ser **só o LoRA da cliente**.
- `pickLoraScale`: voltar para 0.90 / 0.95 / 1.00 (raw mode tolera escalas mais altas sem distorcer).
- `GUIDANCE_VARIATIONS`: `[2.5, 3.0, 3.5]` (raw mode pede guidance ligeiramente maior).
- `NUM_INFERENCE_STEPS`: 30 (Pro Ultra é mais eficiente, não precisa de 40).
- Manter aspect_ratio 3:4, output_format png, upload pro Storage exatamente como hoje.

**`supabase/functions/_shared/portraitPrompts.ts`**
- **Cortar `QUALITY_SUFFIX` em 70%.** Em raw mode, prompt curto = melhor pele. Manter só: `editorial portrait, raw photograph, natural skin texture, fujifilm pro 400h film, sharp focus on eyes`.
- **Cortar `STUDIO_NEGATIVE_BASE` em 60%.** Manter só os bloqueios estruturais que importam: assimetria facial, mãos deformadas, beauty filter, plastic skin, CGI. Remover toda a lista de "frequency separation", "dermal smoothing", etc. — desnecessário em raw mode.
- Remover lógica condicional de cabelo grisalho (raw mode não exagera idade do mesmo jeito; se reaparecer, voltamos).

**`supabase/functions/portrait-train/index.ts`** — sem mudança de código. O trainer continua produzindo LoRAs FLUX-dev compatíveis com o novo modelo de inferência.

### Retreino necessário

Cada cliente que já tem LoRA precisa de **1 retreino** para o LoRA pegar a gramática visual do raw mode. Custo previsível, 1 vez só. Após o retreino, todas as gerações futuras saem com pele realista sem queimar mais crédito iterando prompt.

Para validar antes de propagar: você roda 1 retreino na sua própria conta de teste e gera 3 retratos. Se a pele estiver boa, libera para clientes finais e faz retreino delas conforme demanda.

### Atualização da memória

Atualizar `mem://funcionalidades/retratos-marca` para refletir: novo modelo base, raw mode, prompts reduzidos, retreino obrigatório uma vez por cliente.

## O que NÃO vai mudar

- Pool de figurinos (`outfitPool.ts`)
- Lógica de poses e mãos escondidas
- Lógica de arquétipos/famílias
- Sistema de créditos pay-per-download
- Qualquer UI, rota, fluxo de checkout
- Storage buckets, RLS, persistência de versões

## Custo estimado de validação

- 1 retreino (sua conta): ~3-5 min, 1 ciclo de treino no Replicate
- 3 retratos de teste: 1 geração de pacote (mesmo custo de crédito atual)

Se a pele não melhorar substancialmente nos 3 retratos de teste, a gente para e reavalia — sem você gastar mais 40 créditos tentando.
