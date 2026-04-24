

## Correção — Flux gera rosto genérico em vez de preservar identidade

### Diagnóstico
O Flux **funcionou** (logs mostram `provider=flux status=succeeded`), mas o retrato gerado tem rosto totalmente diferente da pessoa nas selfies. Causa raiz no código atual de `generate-portrait/index.ts`:

1. **`flux-kontext-pro` não é o modelo certo para preservação de identidade facial.** O Kontext Pro é um modelo de **edição contextual genérica** — ele aceita uma imagem de referência mas não foi treinado para "manter este rosto exato". Ele tende a interpretar a imagem como inspiração de estilo/composição e gera um rosto novo plausível.
2. **Apenas 1 selfie é enviada.** O código pega a "melhor" selfie via `pickBestSelfieIndex` e descarta as outras 4. Modelos de identidade real precisam de múltiplas referências do mesmo rosto.
3. **`prompt_upsampling: false` + prompt longo** — o Flux Kontext recebe um prompt de ~40 linhas falando de iluminação, figurino, lente, etc. Isso dilui o sinal de "preserve o rosto" e o modelo prioriza o resto do prompt (estúdio, 85mm, etc.), gerando uma pessoa nova.

O Gemini Nano Banana, com as 5 selfies juntas, performava melhor justamente porque é um modelo multimodal que olha várias referências e o prompt de "edição" é levado mais a sério.

### Solução proposta — trocar para um modelo Replicate com preservação de identidade real

Opção recomendada: **`flux-kontext-apps/multi-image-kontext-pro`** (ou equivalente focado em identidade), que aceita **múltiplas imagens de referência da mesma pessoa** e foi otimizado para manter o rosto consistente. Alternativa forte: **`zsxkib/flux-pulid`** ou **`fofr/face-to-many-kontext`** — todos no Replicate, todos cobram o cartão que você já cadastrou.

Vou implementar o seguinte:

1. **Trocar o endpoint do Replicate** de `black-forest-labs/flux-kontext-pro` para um modelo de preservação de identidade que aceita múltiplas selfies como `input_images`.
2. **Enviar todas as 5 selfies** (não só a "melhor") como referências de identidade.
3. **Encurtar e reorganizar o prompt** para o Flux: priorizar "same face as reference images" no topo, mover descrição de iluminação/figurino para o final.
4. **Manter o fallback Gemini** intacto para o caso de o novo modelo falhar.
5. **Remover a função `pickBestSelfieIndex`** (não é mais usada — todas as selfies vão).
6. **Logar qual modelo foi chamado** para facilitar debug futuro.

### Arquivo afetado
- `supabase/functions/generate-portrait/index.ts` — única alteração. Sem mudança em frontend, banco, ou contagem de créditos.

### Validação após deploy
- Você gera 1 retrato de teste em `/portraits`.
- Resultado esperado: rosto **reconhecível** como a mesma pessoa das selfies, em fundo de estúdio, com o figurino do relatório.
- Se o rosto ainda vier diferente, eu testo o segundo modelo da lista (PuLID) sem precisar de nova aprovação de plano.

### Custo
Os modelos de identidade no Replicate custam tipicamente entre **US$ 0,03 e US$ 0,06 por imagem** (faixa parecida com Kontext Pro). Continua cobrado direto no cartão que você cadastrou — sem créditos manuais.

### Decisão que preciso de você
Confirmar se posso aplicar essa correção usando **`multi-image-kontext-pro`** como primeira opção (mantém o estilo Flux que você queria, mas com identidade real). Se preferir já testar outro modelo, me diz qual.

