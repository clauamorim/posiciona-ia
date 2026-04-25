## Diagnóstico honesto

Olhando as 3 novas imagens, identifiquei **3 problemas** com causas distintas:

### 1. Maquiagem pesada vem do LoRA, não do prompt
Mesmo com `natural minimal makeup, no heavy contouring` + negative `heavy makeup`, **todas** as 3 imagens têm cílios pesados, smoky eye, batom marcado. Isso significa: **o LoRA aprendeu a maquiagem das selfies como parte da identidade**. O modelo "acha" que make pesada **é você**. Nenhum prompt vence esse aprendizado profundo.

### 2. Pele suavizada também está embutida no LoRA
Os tokens pró-textura (`visible skin pores`, `unretouched`, `raw photograph`, `subtle film grain`) perdem para o que o LoRA decorou. Se as selfies foram tiradas com filtro de beleza nativo do celular, o LoRA aprendeu pele lisa como característica facial.

### 3. Proporções faciais infladas
Rosto mais redondo, queixo perdido, maxilar suavizado — sintoma clássico de **lora_scale alto demais** combinado com selfies majoritariamente **frontais em close**. O modelo só "sabe" te renderizar de frente; quando pede outro ângulo ou enquadramento mais aberto, ele "estica" o rosto frontal aprendido.

### 4. O prompt ainda está inflado vs. o manual
- **Manual que funcionou**: ~12 tokens (`TOK woman, portrait of a wise and authoritative professional, calm confident gaze, soft Rembrandt lighting, deep dark background, dark blazer, no smile, contemplative expression, fine skin pores, hair pulled back, photorealistic, shot on Sony A7, 85mm f/1.4, shallow depth of field`).
- **Nosso atual**: ~30 tokens (prefix + framing + archetype template + traits + outfit + makeup + hair + suffix + negatives gigantes).

Cada token a mais **dilui o peso** dos tokens críticos de textura.

---

## O plano: "Modo Manual Puro" + diagnóstico

### Mudança 1 — Prompt mínimo (`_shared/portraitPrompts.ts`)

Reescrever `buildPortraitPrompt` para gerar exatamente a mesma estrutura do manual que funcionou:

```
{TRIGGER} {gender}, {archetype_essence}, {hair_descriptor}, {outfit_descriptor}, {QUALITY_SUFFIX}
```

**Cortes:**
- ❌ Remover `STUDIO_PREFIX` (`"professional portrait, "`) — redundante com o template do arquétipo.
- ❌ Remover `framing.instruction` injetado no meio (`tight head and shoulders crop, hands out of frame`) — vamos colocar isso só nos looks 1 e 2 (bust/chest-up). No look 0 (close-up) é o default natural do retrato.
- ❌ Remover `traitPhrase` longa (`with X hair, Y skin with visible pores and natural texture, Z eyes`) → reduzir a só `{hair_color} {hair_length} hair`. Pele e olhos saem (o LoRA já sabe disso).
- ❌ Remover `[makeup]` placeholder e a linha que injeta `natural minimal makeup` — não funciona, só ocupa espaço. Vai pro **negative** apenas.
- ❌ Remover `hand_pose` longo dos templates dos arquétipos (não há mãos no frame nos looks 0/1, e no look 2 a pose vai ficar implícita pelo crop).

**Templates dos arquétipos enxugados ainda mais.** Exemplo:

Antes (Sábio): `"USR[id] [gender], calm contemplative expression, soft Rembrandt lighting, deep dark background, [outfit], [hair], [makeup], slight head tilt, thoughtful gaze, no smile"`

Depois (Sábio): `"calm contemplative expression, soft Rembrandt lighting, deep dark background, no smile"`

(O trigger, gender, hair, outfit e quality suffix são montados pelo builder, não pelo template.)

**Reduzir QUALITY_SUFFIX** para a versão exata do manual (que funcionou): `"fine skin pores, photorealistic, shot on Sony A7, 85mm f/1.4, shallow depth of field"`

Eliminar os tokens "agressivos" que estávamos jogando (`visible skin pores`, `unretouched skin`, `raw photograph`, `natural skin imperfections`, `subtle film grain`) — eles não estão funcionando E estão diluindo. Voltar à fórmula do manual.

**Reduzir negative** para os 6 itens críticos: `"plastic skin, beauty filter, smoothed skin, heavy makeup, deformed face, deformed hands"`. Cortar `instagram filter, retouched skin, glossy skin, porcelain skin, asymmetric eyes, multiple people, watermark, low quality, blurry` (ruído desnecessário).

### Mudança 2 — Lora scale agressivamente baixo (`generate-portrait/index.ts`)

```ts
function pickLoraScale(selfiesCount: number): number {
  if (selfiesCount <= 12) return 0.70;  // era 0.80
  if (selfiesCount <= 20) return 0.75;  // era 0.85
  return 0.78;                           // era 0.88
}
```

**Justificativa**: a 0.80–0.88 o LoRA está "dominando" e sobrescrevendo a textura/anatomia natural do FLUX base. A 0.70–0.78 deixamos o modelo base respirar — perde-se um pouco de fidelidade facial mas ganha-se textura, anatomia e proporções corretas. É o trade-off que faz sentido AGORA porque o gargalo é qualidade, não identidade.

### Mudança 3 — Variar guidance num range maior

Atual: `[2.5, 2.7, 2.9]`. Trocar por `[2.5, 3.0, 3.5]` para ter um look mais "fotográfico documental" (2.5), um equilibrado (3.0) e um mais "definido" (3.5). Assim você vê na prática qual valor funciona melhor e podemos fixar na próxima iteração.

### Mudança 4 — Logging do prompt completo

No log atual cortamos com `.slice(0, 500)`. Vamos logar **prompt completo** (sem truncar) e a **contagem de tokens** (split por vírgula) pra você poder colar exatamente no Replicate UI e comparar 1:1.

### Mudança 5 — Diagnóstico das selfies (read-only, sem retreino ainda)

Adicionar um log no início de `generate-portrait` que conta:
- Quantas selfies foram usadas no treino atual.
- Quais traits foram extraídos (o `physical_traits.skin_tone` etc).

Isso não muda nada na geração, mas **permite decidir** se vale a pena retreinar.

---

## O que NÃO muda

- Trigger word real do treino.
- Aspect ratio 3:4 @ 1MP.
- Steps 35.
- Pool de outfits por profissão (mantido).
- Memória curta de poses/outfits.
- Estratégia hands-out-of-frame (apenas removemos a frase explícita do prompt — o crop em 3:4 + chest-up já garante).

---

## Decisão sobre retreino — depois desta rodada

Se mesmo com **prompt mínimo + lora_scale 0.70-0.78** a maquiagem continuar pesada e a pele suavizada, **a única solução é retreinar com selfies melhores**. Critérios pra um dataset bom:

1. **15-25 selfies** (mais não é melhor — pode rigidificar).
2. **Sem maquiagem ou maquiagem mínima** (sem cílios postiços, sem batom marcado, sem contorno).
3. **Sem filtro de beleza nativo do iPhone/Samsung** — usar app tipo "ProCam" ou modo RAW. Tirar com luz natural de janela.
4. **Variação de ângulos**: 50% frontais, 25% perfil 3/4 esquerdo, 25% perfil 3/4 direito.
5. **Variação de enquadramento**: 50% close (rosto), 30% busto, 20% 3/4 do corpo.
6. **Variação de expressão**: sorriso aberto, sorriso fechado, neutro, sério.
7. **Boa iluminação lateral** em pelo menos metade (luz de janela é ideal).

Mas **antes de pedir esse esforço**, vamos rodar uma rodada com o "Modo Manual Puro" — pode ser que resolva 80% sem retreino.

---

## Resultado esperado

- Pele com mais textura visível (não 100%, mas perceptivelmente menos lisa).
- Maquiagem mais discreta (lora_scale baixo permite o FLUX base atenuar o que o LoRA aprendeu).
- Proporções faciais mais corretas (queixo, maxilar, formato do rosto).
- Iluminação mais cinematográfica (com guidance 3.5 num dos looks).
- Aspecto fotográfico documental, próximo do manual.

## Risco

- **Perda de fidelidade facial em ~10-15%** (lora_scale 0.70 vs 0.85). Mitigação: o trigger continua puxando identidade; só perdemos detalhes "decorados" do dataset (que é justamente o que queremos).
- **Look 0 sem `headshot crop` explícito** pode vir um pouco mais aberto. Mitigação: o aspect 3:4 + ausência de outras instruções de framing tendem a default close-up.

## Reversibilidade

100% reversível — só 2 arquivos editados (`_shared/portraitPrompts.ts` e `generate-portrait/index.ts`).