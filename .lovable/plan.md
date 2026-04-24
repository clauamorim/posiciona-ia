## Melhorias de fidelidade do retrato + variação de figurino do relatório

### Problemas a corrigir
1. Proporções faciais distorcidas (overfitting do LoRA + lora_scale alto)
2. Fundos externos vazando do treino (fotos de treino externas → modelo aprendeu cenário também)
3. **3 retratos saíram com o mesmo figurino** (geração usava sempre `pecas_chave[0..3]`)

### Solução

**1. Variação de figurino vinda do relatório (`_shared/portraitPrompts.ts`)**

O relatório já entrega `figurino.looks_completos` — um array com 3 looks prontos, cada um com `nome`, `pecas[]` e `ocasiao`. Vou usar exatamente esses 3 looks, um por background:
- Look 0 → fundo Neutro
- Look 1 → fundo Claro
- Look 2 → fundo Escuro

Nova função `buildOutfitTextForLook(figurino, lookIndex)`:
- Lê `figurino.looks_completos[lookIndex].pecas` (3-5 peças)
- Junta as peças em uma string natural em inglês passada para `[outfit]`
- Fallback: se não houver `looks_completos` (relatórios antigos com só 1 look), volta a usar `pecas_chave + cores_roupa` como hoje
- `[hair]` e `[makeup]` continuam vindo de `figurino.cabelo` e `figurino.maquiagem_grooming` (iguais nos 3 looks)

Em `generate-portrait/index.ts`: passar `lookIndex = backgroundIndex` para `buildPortraitPrompt`.

**2. Treino menos agressivo (`portrait-train/index.ts`)**
- `steps: 1500` → `1000`
- `lora_rank: 16` (fixo, antes não estava setado)
- `caption_dropout_rate: 0.05` (ajuda generalização)
- Reduz overfitting → rosto mais fiel, menos distorcido

**3. Inferência mais equilibrada (`generate-portrait/index.ts`)**
- `lora_scale: 1.0` → `0.85` (deixa o prompt influenciar mais, evita rosto "borrado")
- `guidance_scale: 2.5` → `3.0` (segue melhor o prompt de fundo de estúdio)

**4. Reforço de estúdio nos prompts (`_shared/portraitPrompts.ts`)**
- Adicionar ao início de cada prompt: `professional photography studio, controlled studio lighting,`
- Adicionar ao negative de todos: `outdoor, street, natural daylight, trees, buildings, sky, park, beach, low quality, blurry, deformed face, extra fingers, asymmetric eyes`
- Combate o vazamento de cenários externos das fotos de treino

**5. Aviso pré-upload no treino (`PortraitGenerator.tsx`)**
Antes do botão "Treinar", checklist visual com 4 itens:
- Fotos com fundo neutro/limpo (parede, estúdio caseiro)
- Iluminação clara e uniforme, rosto bem visível
- Sem óculos escuros, máscara ou chapéu cobrindo o rosto
- Variedade de expressões e ângulos (frente, perfil, sorrindo, sério)

### Para validar
Como o LoRA atual foi treinado com fotos externas, ele já carrega esse "viés de cenário". O ajuste de `lora_scale` + negative prompts vai reduzir bastante, mas para fidelidade máxima recomendo retreinar com selfies em fundo neutro depois de testar.

Sequência:
1. Aplico todas as 5 mudanças
2. Você clica "Gerar 3 retratos" com o LoRA atual → vai vir cada look com peças diferentes do relatório, fundo de estúdio reforçado, rosto melhor proporcionado
3. Se ainda houver vazamento de fundo externo, retreina com fotos novas (1 grátis no mês corrente, ou 4 créditos)

### Sem mudanças
- Tabela `portrait_trainings`, créditos, webhook, UI da galeria de retratos
- Os 12 prompts oficiais por arquétipo (apenas prefixo de estúdio + negatives reforçados)
- Custo/cobrança de treino e geração
