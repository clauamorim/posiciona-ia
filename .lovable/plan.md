## Diagnóstico

Olhei a imagem dos 3 retratos gerados e o pipeline. A usuária aparece **claramente envelhecida** — pele mais marcada, traços mais maduros, cabelo grisalho marcante — vs. o que o LoRA deveria reproduzir das selfies.

### Causas (em ordem de impacto)

1. **Prompt sem âncora etária.** O builder hoje monta `{trigger} woman, {arquétipo}, {hair}, {outfit}, editorial portrait...`. Não existe nenhum token de idade. O Krea tem viés forte para gerar "mulher madura/sofisticada" quando o contexto é `editorial portrait + authoritative + Governante + coat camel + advogada`. Sem nada puxando pra idade real, ele defaulta pra ~50-60 anos.

2. **`extractPhysicalTraits` não captura idade.** O schema só tem hair/skin/eye. Mesmo se quiséssemos injetar idade no prompt, ela não está armazenada. As selfies têm essa informação mas a estamos jogando fora.

3. **Hair descriptor pode reforçar envelhecimento.** Se Gemini classificou cabelo como `grey` ou `white` nas selfies (caso a pessoa tenha alguns fios brancos), o prompt fica `medium grey hair` — o Krea então generaliza pra "senhora grisalha completa". Vi exatamente isso no retrato 1 e 3.

4. **Termo "sophisticated/authoritative" no template Governante** combinado com lente 50mm + DOF raso + luz dura → estética que o modelo associa a maturidade. Reforça o efeito.

5. **LoRA scale 1.0 fixo.** Se a identidade está fraca (poucas selfies, ou selfies muito variadas em idade), 1.0 pode não ser suficiente pra "puxar" o rosto real contra o viés de envelhecimento do prompt.

## Recomendação

**Combinação de 3 correções**, na ordem de quem dá mais retorno:

### Correção A — Capturar e injetar idade (essencial)

Estender `PhysicalTraits` com:
- `apparent_age_range`: `"20s" | "30s" | "40s" | "50s" | "60s+"` (faixas, não número exato — Gemini é mais confiável assim)
- `hair_has_grey`: `boolean` (separar "tem alguns fios brancos" de "cabelo todo grisalho")

Atualizar `extractPhysicalTraits` para pedir esses campos. Atualizar `buildPortraitPrompt` para incluir token de idade no início:

```
{trigger} woman in her 30s, {arquétipo}, ...
```

E ajustar hair descriptor: se `hair_has_grey=true` mas `hair_color != grey`, escrever `"medium dark brown hair with subtle grey strands"` em vez de classificar tudo como grey.

### Correção B — Negative prompt anti-envelhecimento

Adicionar ao `STUDIO_NEGATIVE_BASE`:
```
, aged skin, deep wrinkles, sagging skin, elderly, much older than reference, fully grey hair (when not actually grey)
```

### Correção C — Subir LoRA scale para 1.05-1.1

Krea+LoRA tolera bem scale levemente acima de 1.0 — puxa identidade com mais força contra o viés do prompt. Não passar de 1.15 (deforma o rosto).

### O que NÃO vou mexer

- Templates de arquétipo (Governante etc.) — o problema não é o estilo, é a falta de âncora etária.
- Modelo/parâmetros do Fal — Krea entrega boa pele, o problema é semântico no prompt.
- Pipeline async — está funcionando.

## Plano detalhado

### 1. Migração DB

Não precisa. `physical_traits` já é `jsonb`, basta adicionar campos novos no objeto.

### 2. `_shared/portraitPrompts.ts`

- Estender `interface PhysicalTraits` com `apparent_age_range?` e `hair_has_grey?` (opcionais pra não quebrar treinos antigos).
- Em `buildPortraitPrompt`:
  - Mapear `apparent_age_range` → token: `"20s"` → `"in her 20s"`, `"30s"` → `"in her 30s"`, etc.
  - Default se ausente: `"in her 30s"` (faixa segura — Krea tende a envelhecer, não rejuvenescer demais).
  - Concatenar no genderToken: `${triggerWord} ${genderToken} ${ageToken}`.
  - Refinar `hairDescriptor`: se `hair_has_grey` e cor base não é grey/white, usar `"${length} ${color} hair with some grey strands"`.
- Adicionar termos anti-envelhecimento no `STUDIO_NEGATIVE_BASE`.

### 3. `portrait-train/index.ts`

- Atualizar prompt de `extractPhysicalTraits` para pedir os 2 campos novos.
- Atualizar schema no JSON e validação.
- Salvar tudo em `physical_traits` (já é jsonb, só estender o objeto).

### 4. `generate-portrait/index.ts`

- Subir `DEFAULT_LORA_SCALE` de `1.0` → `1.05`.

### 5. Recuperação para esta usuária

A geração atual já consumiu créditos? Olhando o log: `enqueued generation=9b75df68... jobs=3`. A função `portrait-poll` finalizou e cobrou. **Vou propor refazer a geração gratuitamente** após você aprovar o plano — adicionar 3 créditos de cortesia ao saldo + nota explicativa em `credit_logs`. Você dispara nova geração e os retratos saem na faixa etária correta.

Mas pra isso funcionar bem, **preciso re-extrair traits da training atual** (via uma chamada ao Gemini com as selfies já no Storage) ou pedir pra você refazer só a extração (sem refazer treino — usa o mesmo LoRA).

## Validação

1. Treino novo (de teste) → verificar `physical_traits.apparent_age_range` salvo corretamente.
2. Geração → verificar log do prompt: deve conter `"in her Xs"` e hair descriptor refinado.
3. Inspecionar 3 retratos → idade aparente compatível com selfies.
4. Caso de borda: usuária com cabelo realmente todo grisalho → não rejuvenescer artificialmente.

## Risco

Baixo-médio. Mudanças isoladas em prompt/schema. Treinos antigos continuam funcionando (campos opcionais → defaults seguros). Reversível: basta tirar o token de idade do builder.

## Pergunta antes de implementar

Você quer que eu também **re-extraia os traits da sua training atual** (sem refazer o treino — só roda Gemini de novo nas selfies que já estão no bucket) pra você gerar de novo já com a faixa etária correta? Ou prefere refazer o treino do zero?
