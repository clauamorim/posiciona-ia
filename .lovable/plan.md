

## Recuperar treino existente sem retreinar

### Diagnóstico confirmado
- Treino `b7b2cf05` está `ready` no banco
- LoRA está viva no Replicate (`clauamorim/posiciona-usr481caf41d4da`, version `5644794c...`)
- O campo `lora_weights_url` salvou o identificador `owner/name:hash` em vez da URL `.tar` pública
- O modelo `flux-dev-lora` precisa da URL `.tar` direta (ex: `https://replicate.delivery/.../trained_model.tar`) — por isso falha com "Failed to download tarball"

### Solução (sem retreinar)

**1. Edge function nova `portrait-fix-weights` (one-shot)**
- Lê todos os `portrait_trainings` com `status='ready'` cujo `lora_weights_url` não começa com `https://`
- Para cada um, faz `GET https://api.replicate.com/v1/trainings/<replicate_training_id>` autenticado
- Extrai `output.weights` (a URL `.tar` real) da resposta
- Atualiza `lora_weights_url` no banco com a URL correta
- Retorna o número de registros corrigidos

**2. Webhook corrigido (`portrait-webhook/index.ts`)**
- Trocar a prioridade: `lora_weights_url: weights || version` → garante que treinos novos salvem a URL `.tar`

**3. Espaçamento entre chamadas (`generate-portrait/index.ts`)**
- `await new Promise(r => setTimeout(r, 1200))` entre as 3 chamadas sequenciais
- Evita 429 enquanto seu Replicate tem <$5 de crédito (rate limit reduzido a 6/min com burst 1)

### Fluxo de validação após fix
1. Eu deploy as 3 funções
2. Chamo `portrait-fix-weights` 1 vez (corrige seu treino atual em ~2s)
3. Você clica "Gerar 3 retratos" na tela `/portraits`
4. Os 3 retratos voltam (Neutro/Claro/Escuro) usando a LoRA já treinada — sem custo de retreino, sem crédito reembolsado

### Sem mudanças
- Tabela `portrait_trainings`
- Bucket `portrait-inputs`
- UI `/portraits`
- Lógica de créditos
- Treino existente permanece válido

### Detalhes técnicos
- A Replicate API expõe `GET /v1/trainings/<id>` retornando o mesmo payload do webhook, incluindo `output.weights` permanente
- A função `portrait-fix-weights` exige autenticação (não é pública); só admin ou o próprio usuário pode chamar
- Após esse fix one-shot, ela pode ser apagada — mas vou deixar disponível caso outros treinos antigos apareçam
- O warning de console sobre `forwardRef` em `PortraitPreviewDialog`/`BackToTopButton`/`Badge` é cosmético e não afeta o fluxo — fora do escopo desta correção

