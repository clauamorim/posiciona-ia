## Objetivo

Eliminar o aspecto **suavizado/aerografado** dos retratos atuais e alcançar a textura de pele com poros visíveis do retrato manual de referência. Atacar 3 vetores que estão empurrando o Flux para "modo revista": palavra `editorial`, maquiagem pesada injetada, e ausência de tokens positivos pró-textura.

## Diagnóstico (comparação visual)

| Aspecto | Retrato manual (bom) | Retratos atuais (suavizados) |
|---|---|---|
| Poros | Visíveis em testa, nariz, queixo | Quase invisíveis, pele "lisa" |
| Maquiagem | Discreta, natural | Pesada (cílios, contorno, batom marcados) |
| Iluminação | Rembrandt lateral clara | Mais frontal, menos volume |
| Vibe geral | Fotográfica/documental | Magazine/glossy |

Causas no nosso pipeline:
1. **`STUDIO_PREFIX` contém "editorial"** — palavra-âncora que empurra Flux pra estética glossy.
2. **`buildMakeupText` injeta maquiagem detalhada** — competindo com poros e simulando filtro de beleza.
3. **Faltam tokens positivos pró-textura** no início do prompt. Só temos negativos (fracos no Flux).
4. **Trait phrase (`with X skin`)** sem qualificador — Flux interpreta como pele uniforme.

## Mudanças propostas

### 1. `supabase/functions/_shared/portraitPrompts.ts`

**a) Trocar `STUDIO_PREFIX`** — remover "editorial":
```ts
// Antes:
const STUDIO_PREFIX = "professional editorial portrait, ";
// Depois:
const STUDIO_PREFIX = "professional portrait, ";
```

**b) Reforçar `QUALITY_SUFFIX`** com tokens fortes pró-textura:
```ts
// Antes:
const QUALITY_SUFFIX = "fine skin pores, natural skin texture, photorealistic, shot on Sony A7, 85mm f/1.4, shallow depth of field";
// Depois:
const QUALITY_SUFFIX = "visible skin pores, unretouched skin, natural skin imperfections, fine facial detail, raw photograph, photorealistic, shot on Sony A7, 85mm f/1.4, shallow depth of field, subtle film grain";
```
Mudanças-chave: `visible skin pores` (mais forte que "fine"), `unretouched`, `natural skin imperfections`, `raw photograph`, `subtle film grain` — todos puxam o modelo pra fora do modo retoque.

**c) Reforçar `STUDIO_NEGATIVE_BASE`** com termos cosméticos:
```ts
const STUDIO_NEGATIVE_BASE = ", plastic skin, beauty filter, smoothed skin, airbrushed, retouched skin, instagram filter, heavy makeup, glossy skin, porcelain skin, deformed hands, extra fingers, deformed face, asymmetric eyes, multiple people, watermark, low quality, blurry";
```
Adições: `retouched skin`, `instagram filter`, `heavy makeup`, `glossy skin`, `porcelain skin`.

**d) Ajustar trait phrase** para incluir qualificador de textura:
```ts
// Antes:
traitPhrase = `, with ${t.hair_length} ${t.hair_style} ${t.hair_color} hair, ${t.skin_tone} skin, ${t.eye_color} eyes`;
// Depois:
traitPhrase = `, with ${t.hair_length} ${t.hair_style} ${t.hair_color} hair, ${t.skin_tone} skin with visible pores and natural texture, ${t.eye_color} eyes`;
```

### 2. `supabase/functions/generate-portrait/index.ts` — desligar maquiagem detalhada

**a) Stop injeção de maquiagem pesada**: trocar `buildMakeupText(figurino)` por string vazia (deixa o LoRA produzir makeup natural). Alternativa mais conservadora: trocar por uma versão minimalista (`"natural minimal makeup"`).

```ts
// Antes:
const makeup = buildMakeupText(figurino);
// Depois:
const makeup = effectiveGender === "woman" ? "natural minimal makeup, no heavy contouring" : "";
```

(Nota: `effectiveGender` precisa ser calculado aqui também — pegar de `training.physical_traits?.gender ?? gender`.)

Justificativa: no manual de referência você não pediu maquiagem nenhuma, e o resultado ficou natural. Forçando "natural minimal" + negative `heavy makeup`, garantimos que o LoRA pare de produzir cílios postiços/contorno marcado.

**b) Manter outros parâmetros como estão** (steps 35, guidance 2.5–2.9, lora_scale 0.80–0.88).

### 3. Validação

- Deploy de `generate-portrait`.
- Gerar uma rodada nova.
- Comparar com a referência manual: deve aparecer mais textura, makeup mais sutil, vibe mais documental.
- Se ainda estiver suave: aumentar peso do `visible skin pores` movendo pro **início** do prompt (antes do trigger), em vez do sufixo.

## O que NÃO muda

- Estratégia hands-out-of-frame.
- Sistema de pool de outfits por profissão.
- Memória curta de poses/outfits.
- Trigger word real do treino.
- Steps 35, guidance 2.5–2.9, lora_scale 0.80–0.88.
- Aspect ratio 3:4, 1MP.
- Não precisa retreinar LoRA.

## Risco e mitigação

- **Risco**: tokens "unretouched, raw photograph" podem trazer aparência amadora demais. Mitigação: `subtle film grain` + manter "shot on Sony A7, 85mm f/1.4" como âncora profissional.
- **Risco**: remover "editorial" pode reduzir percepção de "estúdio profissional". Mitigação: o `STUDIO_PREFIX` ainda diz "professional portrait" + cada arquétipo tem "studio background" no template.
- **Risco**: maquiagem mínima pode parecer "sem make" demais em looks claros (Inocente, Cuidador). Mitigação: usar `"natural minimal makeup"` em vez de string vazia — o LoRA produz make leve naturalmente para mulheres.
- **Reversível**: 2 arquivos, mudanças localizadas.

## Resultado esperado

Retratos com textura de pele visível (poros, leve brilho zonal natural), maquiagem discreta, vibe fotográfica documental — alinhado com o retrato manual de referência. Mantém os 3 looks (Neutro/Claro/Escuro), iluminação por arquétipo, identidade facial via LoRA.