## Objetivo

Eliminar a aparência artificial dos retratos com foco em **(1) preservação fiel dos traços faciais** das selfies de referência (a face não pode ser distorcida ou idealizada) e **(2) textura visível no cabelo** (fios individuais, frizz natural, brilho realista).

## Diagnóstico

O prompt atual em `buildGeminiPortraitPrompt` (`supabase/functions/_shared/portraitPrompts.ts`) já tem um bloco de IDENTITY LOCK, mas dois problemas concretos persistem:

**1. Distorção facial em alguns retratos**
- O bloco IDENTITY LOCK vem entre vários outros blocos longos (pele, idade, etnia, cena), o que **dilui o peso semântico** do trava-identidade no Gemini.
- Não há instrução explícita para o modelo *comparar lado-a-lado* a face gerada com as referências durante a síntese.
- Não há instrução para tratar **a primeira referência como "ground truth"** caso as selfies tenham ângulos muito diferentes.
- Não há reforço contra "average face / generic AI face / morphed face" — exatamente o tipo de erro que produz distorção.

**2. Cabelo com aparência de bloco/peruca**
- O prompt **não menciona textura de cabelo em nenhum momento**: nem fios individuais, nem frizz, nem brilho irregular.
- A iluminação atual ("soft natural studio lighting") tende a achatar o cabelo.
- O `AVOID list` não bloqueia "helmet hair", "wig look", "plastic hair".

## Mudanças (apenas em `portraitPrompts.ts`, função `buildGeminiPortraitPrompt`)

### Bloco A — Reforço de preservação dos traços (ANTI-DISTORÇÃO)

1. **Mover IDENTITY LOCK para o topo absoluto** do prompt, logo depois da declaração de fotorrealismo, com cabeçalho em caps reforçado.
2. **Eleger a primeira selfie como referência primária**: instrução explícita "the first reference image is the primary identity reference; the other references are auxiliary angles".
3. **Lista granular do que copiar exatamente** (já existe parcial, expandir):
   - Distância entre olhos, simetria/assimetria natural, formato e posição das pálpebras
   - Comprimento e largura do nariz, ponta e narinas
   - Curvatura e largura da boca em repouso, formato dos lábios superior/inferior
   - Altura e largura da testa, posição da linha do cabelo
   - Estrutura óssea: maçãs do rosto, ângulo da mandíbula, queixo
   - Formato e ângulo das orelhas
4. **Instrução explícita anti-morphing**: "Do NOT average features across references. Do NOT create a generalized or idealized version. If references differ, anchor to the first reference."
5. **Reforçar o AVOID list** com termos específicos contra distorção:
   - "morphed face, averaged face, generic AI face, beautified face, idealized features, symmetrical face, different person, lookalike, instagram-model face, face that does not match the references"

### Bloco B — Textura natural no cabelo

6. **Bloco novo "HAIR TEXTURE LOCK"** logo após o bloco de pele:
   - Fios individuais visíveis na linha do cabelo, têmporas e nuca
   - Frizz natural e fios soltos (flyaway hairs)
   - Brilho irregular e realista (não uniforme, não plástico)
   - Preservar exatamente comprimento, cor, ondulação/cacheado/liso e densidade das referências
   - Cílios e sobrancelhas com fios individuais visíveis
7. **Refino de iluminação**: adicionar "subtle rim light on the hair to reveal individual strands and natural shine".
8. **Refino técnico**: trocar "fine film-like grain" por "fine 35mm film grain, sharp micro-detail on hair, lashes, eyebrows and skin pores".
9. **Ampliar AVOID list** com: "helmet hair, wig-like hair, plastic hair, painted hair, blocky hair, smooth uniform hair, lacquered hair, doll hair, missing flyaway hairs, fake hairline".

## Não muda

- Estrutura, parâmetros e contrato de retorno da função
- Lógica de outfits, poses, fundos e arquétipos
- Modelos usados (Nano Banana Pro como primário, Nano Banana 2 como fallback)
- Edge function `generate-portrait`, histórico, cobrança de créditos, persistência

## Validação

Após o ajuste, gerar 1 retrato de teste e verificar:
- Face bate com as selfies (sem morphing, sem "embelezamento")
- Linha do cabelo com fios soltos, brilho não uniforme
- Cílios e sobrancelhas com fios discerníveis
- Pele mantém poros e imperfeições já presentes hoje
