## Diagnóstico

Pelos retratos enviados, o problema já não parece ser só qualidade das selfies. Há três pontos no fluxo atual que ainda favorecem erros:

1. Os looks 2 e 3 continuam definidos como `waist-up` com `hands visible naturally in frame`, mesmo depois de termos tentado esconder mãos. Isso manda sinais conflitantes para o modelo.
2. Algumas poses ainda pedem braços cruzados, mãos no bolso ou objeto nas mãos. Mesmo quando o texto diz “fingers hidden”, o modelo ainda precisa desenhar mãos/pulsos/braços e pode deformar.
3. A combinação `lora_scale` alto + prompt muito pesado de roupa/pose/corpo pode preservar melhor o rosto, mas piorar corpo e anatomia quando o treino foi feito com selfies próximas.

## Mudança proposta

### 1. Mudar o gerador para retratos editoriais sem mãos visíveis
**Arquivo:** `supabase/functions/_shared/portraitPrompts.ts`

- Trocar os enquadramentos dos 3 looks para evitar corpo inteiro/meio corpo:
  - Neutro: close-up / cabeça e ombros.
  - Claro: busto editorial / peito e ombros.
  - Escuro: retrato 3/4 curto, cortado acima da cintura, com mãos fora do frame.
- Remover a instrução `hands visible naturally in frame`.
- Remover poses com mãos no bolso, braços cruzados e objetos segurados.
- Substituir por variações seguras de postura sem mãos:
  - ombros levemente angulados;
  - braços fora do enquadramento;
  - mãos abaixo do corte;
  - composição editorial cropped.
- Reforçar no prompt positivo: `hands completely out of frame`, `no visible hands`, `cropped above waist`.
- Manter no negative prompt os termos contra dedos/mãos deformadas.

### 2. Reduzir complexidade de roupa/corpo para preservar anatomia
**Arquivo:** `supabase/functions/_shared/portraitPrompts.ts`

- Reduzir o peso do outfit de `1.2` para algo mais discreto, como `1.05` ou texto sem peso explícito.
- Evitar instruções de acessórios segurados ou roupas que induzam mãos/braços complexos.
- Priorizar “retrato profissional editorial” em vez de look corporal completo.

### 3. Recalibrar LoRA para rosto sem “puxar” distorções do treino
**Arquivo:** `supabase/functions/generate-portrait/index.ts`

- Ajustar `lora_scale` para um intervalo mais seguro:
  - até 12 selfies: `0.84–0.88`
  - 13 a 20 selfies: `0.88–0.92`
- Reduzir `guidance_scale` para algo como `[3.0, 3.2, 3.4]`.
- Manter a resolução 3:4, mas gerar retratos mais fechados para reduzir área anatômica de risco.

### 4. Registrar logs melhores para validar a próxima geração
**Arquivo:** `supabase/functions/generate-portrait/index.ts`

- Logar o tipo de enquadramento, `lora_scale`, `guidance_scale` e se a geração está em modo “hands out of frame”.
- Isso ajuda a confirmar que a função publicada está usando o prompt novo.

## Resultado esperado

- Menos distorção de mãos, porque elas deixam de ser parte do enquadramento.
- Melhor proporção corporal, porque o modelo não precisa inventar tronco/braços completos.
- Rosto mais estável, sem forçar tanto o LoRA a ponto de puxar deformações das selfies.
- Retratos mais próximos de foto profissional de perfil/editorial: rosto, cabelo, ombros e parte superior do busto.

## Fora de escopo por enquanto

- Não retreinar automaticamente o LoRA.
- Não trocar o modelo Replicate agora.
- Não gerar variações de corpo inteiro ou meia altura até estabilizarmos rosto/proporção.

Depois de aprovado, implemento essa rodada e publico a função de geração novamente.