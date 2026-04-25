## Diagnóstico

Os logs já mostram que `buildOutfitTextForLook(figurino, i)` está enviando os 3 looks corretos (round-robin). O problema é que o Flux está **ignorando** o que recebe porque:

1. **Idioma misto** — o relatório envia peças em português (`vestido tubinho midi`, `trench coat camel`, `calça alfaiataria`). O Flux foi treinado predominantemente em inglês e degrada o entendimento de termos de moda em PT.
2. **Posição no prompt** — o `[outfit]` aparece tarde no template do arquétipo, depois de `expression`, `lighting`, `background`. Tokens posteriores têm menos peso na atenção do Flux.
3. **Falta de ênfase** — o Flux suporta sintaxe de peso `(token:1.3)`. Hoje o outfit é apenas uma frase no meio de muitas outras.
4. **Diluição** — listas com 4-5 peças + acessórios + materiais ficam longas demais; o Flux trava nas 2 primeiras palavras (geralmente "blazer" ou "blusa básica") e aplica sempre o mesmo blazer escuro.
5. **Sem negative específico do look** — quando o look 2 é um vestido, nada impede o Flux de colocar blazer (porque viu blazer no look 1 e nas selfies de treino).

## Plano de correção

### Etapa 1 — `supabase/functions/_shared/portraitPrompts.ts`

**1.1 Dicionário PT→EN para peças de moda**

Adicionar uma função `translateOutfitPieces(pecas: string[]): string[]` com mapa manual (regex case-insensitive) cobrindo as peças mais comuns dos relatórios:

```
vestido tubinho → sheath dress
vestido midi → midi dress
vestido longo → long dress
trench coat → trench coat
sobretudo → overcoat
blazer alfaiataria → tailored blazer
blazer estruturado → structured blazer
calça alfaiataria → tailored trousers
calça pantalona → wide-leg trousers
saia midi → midi skirt
saia lápis → pencil skirt
camisa de seda → silk shirt
blusa de seda → silk blouse
blusa básica → fitted top
camiseta básica → fitted t-shirt
cardigã → cardigan
malha → knit top
tricô → knitwear
casaco → coat
jaqueta → jacket
sapato scarpin → pointed-toe pumps
scarpin → pointed-toe pumps
sandália → sandals
bota → boots
mocassim → loafers
tênis → sneakers
```

Cores comuns: `bege → beige`, `caramelo → caramel`, `camelo → camel`, `marinho → navy`, `vinho → burgundy`, `terracota → terracotta`, `off-white → off-white`, `nude → nude`.

Tudo o que não bater no dicionário fica no original (Flux ainda tenta interpretar). Isso é seguro e incremental.

**1.2 Simplificar `buildOutfitTextForLook`**

- Reduzir de 5 peças para **3 "headline pieces"** (top + bottom + outer/shoes), removendo acessórios pequenos (cinto, brincos, bolsa pequena) que poluem o prompt.
- Aplicar o tradutor antes de juntar.
- Retornar string já no formato `wearing <peça1>, <peça2>, <peça3>` (com o verbo `wearing` embutido — o Flux ancora melhor).

**1.3 Reposicionar e dar peso ao outfit**

No template de cada arquétipo o `[outfit]` aparece depois de `expression`/`lighting`/`background`. Em vez de mexer nos templates (que são fixos por contrato), em `buildPortraitPrompt`:

- Após injetar os traços físicos (`with long wavy brown hair…`), injetar **antes de continuar com o resto do prompt** uma frase ancorada e com peso:
  `, (wearing <outfit>:1.4),`
- E **remover** a substituição de `[outfit]` no template original (substituir por string vazia) para não duplicar peças e não diluir a atenção.

Resultado: o outfit aparece **logo após** `USR<id>` + traços físicos, na zona de máxima atenção do Flux, e com peso 1.4.

**1.4 Negative prompt específico do look**

Adicionar parâmetro `outfitText` ao trecho que monta o negative em `buildPortraitPrompt`. Detectar palavras-chave e adicionar exclusões:

- Se o outfit contém `dress` → adicionar `, blazer, suit jacket, pants, trousers` ao negative.
- Se contém `cardigan` ou `knit` → adicionar `, blazer, suit jacket, formal suit`.
- Se contém `coat` ou `trench` → adicionar `, blazer underneath, suit`.
- Se contém `blazer` → adicionar `, dress, casual t-shirt, hoodie`.

Isso impede o Flux de "voltar" para o blazer escuro padrão das selfies de treino.

### Etapa 2 — `supabase/functions/generate-portrait/index.ts`

**2.1 Log do prompt final completo**

Hoje o log mostra apenas `outfit="..."`. Adicionar:

```
console.log(`[generate-portrait] FULL PROMPT call ${i+1}: ${built.prompt}`);
console.log(`[generate-portrait] FULL NEGATIVE call ${i+1}: ${built.negative}`);
```

Isso permite auditar (nos logs do Supabase) exatamente o que o Flux recebeu, caso ainda haja regressão.

**2.2 Sem outras mudanças** — `lora_scale 0.95`, `guidance_scale 3.5`, `num_inference_steps 40` continuam (já validados na rodada anterior).

### Etapa 3 — Validação

Após deploy, basta gerar 3 retratos novos (sem refazer treino — esta etapa não toca em LoRA nem em traços físicos). Os logs vão mostrar o prompt final por chamada, então conseguimos confirmar:

- Os 3 outfits aparecem traduzidos em inglês.
- Cada um aparece como `(wearing ...:1.4)` logo após os traços.
- Cada negative tem as exclusões corretas.

Se o Flux ainda colocar blazer onde devia ter vestido, o log expõe a regressão exata e ajustamos o peso (1.5/1.6) ou o dicionário.

## Garantias preservadas

- Templates por arquétipo (`ARCHETYPE_PROMPTS`) **não são editados** — só recebem o `[outfit]` esvaziado e o outfit é injetado antes via `buildPortraitPrompt`.
- 3 backgrounds (Neutro/Claro/Escuro) continuam.
- Round-robin de figurinos do relatório continua.
- Traços físicos extraídos continuam ancorados primeiro.
- Cobrança, retry 429, fallback de 1-2 imagens em caso de falha — tudo mantido.
- Sem mudança no treino e sem necessidade de refazer LoRA.

## Fora de escopo

- Não mexer em `portrait-train` (trait extraction segue como está).
- Não mexer no UI do relatório nem na geração do `figurino.looks_completos`.
- Não traduzir o relatório inteiro — só o subset de moda usado para o prompt.
