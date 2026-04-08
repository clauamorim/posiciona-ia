

# Gerar Sempre 5 Retratos (independente da qtd de selfies)

## Lógica

Atualmente: 1 selfie → 1 retrato. O usuário quer: qualquer qtd de selfies → sempre 5 retratos com variações de estilo/cenário.

## Alterações

### `supabase/functions/generate-portrait/index.ts`
- Alterar o loop: ao invés de iterar sobre cada selfie, gerar **5 retratos no total**
- Se o usuário enviou 1 selfie, usar essa mesma selfie 5 vezes com prompts variados
- Se enviou mais de 1, distribuir as 5 gerações entre as selfies (ex: 2 selfies → 3+2, 3 selfies → 2+2+1)
- Criar 5 variações de prompt: "studio lighting", "outdoor natural light", "editorial magazine style", "corporate headshot", "artistic/creative portrait"
- Retornar `{ portraits: string[] }` com 5 itens

### `src/pages/PortraitGenerator.tsx`
- Atualizar texto do botão para "Gerar 5 Retratos" (fixo, sem depender da qtd de selfies)
- Atualizar mensagem de progresso: "Gerando retrato X de 5..."
- Grid de resultados mostra sempre até 5 retratos

## Arquivos alterados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/generate-portrait/index.ts` | Gerar sempre 5 retratos com variações de prompt |
| `src/pages/PortraitGenerator.tsx` | Atualizar UI para refletir 5 retratos fixos |

