
# Plano: Variedade de poses de mãos + Upscale 2x

## Problema
1. Mãos saem em poses rígidas/estranhas (punhos cerrados, garras simétricas)
2. Resolução nativa do Flux é baixa (~896×1152, ~1MP)
3. Risco de monotonia se associarmos uma pose fixa por arquétipo

## Solução

### 1. Pool de poses por "família de arquétipos" (`_shared/portraitPrompts.ts`)
Criar `HAND_POSE_POOLS`: para cada uma das 4 famílias de arquétipos, definir 5–6 poses naturais e fotogênicas em inglês, prontas para o Flux:

- **Autoridade** (Governante, Herói, Mago): braços cruzados confiantes, mão no queixo pensativa, mão segurando lapela do blazer, mãos ao lado do corpo, uma mão no bolso da calça, mão levemente apoiada no quadril
- **Acolhimento** (Cuidador, Inocente, Cara-comum): mãos suavemente entrelaçadas à frente, uma mão sobre o coração, braços relaxados ao lado, mão segurando o pulso oposto, gesto aberto de palmas leves
- **Expressivo** (Criador, Amante, Bobo-da-corte): mão tocando levemente o queixo, mão passando pelo cabelo, gesto natural de conversa, uma mão no bolso casual, mão apoiada no rosto
- **Independente** (Sábio, Explorador, Rebelde): mãos no bolso da calça, braços cruzados relaxados, uma mão no bolso e outra ao lado, mão apoiada no quadril, polegar enganchado no bolso

Mapear cada arquétipo → família via `ARCHETYPE_FAMILY`.

### 2. Sorteio sem reposição por geração (`generate-portrait/index.ts`)
- No início do loop dos 3 looks: embaralhar (Fisher–Yates) o pool da família do arquétipo
- Aplicar `pool[0]`, `pool[1]`, `pool[2]` aos 3 retratos → garante 3 poses diferentes na mesma rodada

### 3. Memória curta entre regenerações
**Migração**: adicionar coluna `used_hand_poses` (JSONB, default `[]`) em `portrait_generations`.

Lógica em `generate-portrait`:
- Antes de embaralhar, buscar a última geração do usuário (`order by created_at desc limit 1`) e ler `used_hand_poses`
- Filtrar do pool as poses usadas na última rodada (se restarem ≥3 opções; senão, usar pool completo)
- Após gerar, gravar as 3 poses sorteadas em `used_hand_poses` da nova linha

### 4. Injeção no prompt (`_shared/portraitPrompts.ts`)
Estender `BuildPromptParams` com `handPose?: string` opcional. Quando presente, injetar logo após o outfit, com peso moderado:
```
, (hands: <pose>:1.2)
```
Peso 1.2 (não 1.4 como o outfit) para não competir com o figurino.

### 5. Reforço no negative prompt
Acrescentar a `STUDIO_NEGATIVE`:
```
clenched fists, stiff claw hands, symmetrical fist pose, hands floating awkwardly, tense rigid fingers
```

### 6. Variação de guidance_scale (`generate-portrait/index.ts`)
Variar entre os 3 retratos: `[3.0, 3.5, 4.0]` — diversifica interpretação geral além da pose.

### 7. Upscale 2x (`generate-portrait/index.ts`)
Após cada geração do Flux:
- Chamar `nightmareai/real-esrgan` com `scale=2`, `face_enhance=true`
- Resultado: ~1792×2304 px
- **Fallback resiliente**: se o upscale falhar (timeout/erro), manter a imagem original 1MP e logar warning — não bloqueia a entrega
- Aplicar nas 3 imagens em paralelo (`Promise.allSettled`) para não acumular latência

### 8. Logs de auditoria
Adicionar em `generate-portrait`:
- Pose escolhida por look
- Pool filtrado (após exclusão da memória)
- Status do upscale (sucesso/fallback) por imagem

## Arquivos afetados
- `supabase/functions/_shared/portraitPrompts.ts` — pools, mapping de família, injeção no prompt, negative reforçado
- `supabase/functions/generate-portrait/index.ts` — sorteio, leitura/escrita da memória, upscale 2x, variação guidance
- Nova migração — coluna `used_hand_poses` em `portrait_generations`

## Sem mudanças
- LoRA / treinamento (não precisa retreinar)
- UI / fluxo de download
- Custo de créditos
