

## Trocar para `zsxkib/pulid-flux` (PuLID sobre Flux) e corrigir endpoint do Replicate

### Por que esse modelo
Estado da arte atual em preservação de identidade single-shot (sem treino prévio). Combina o algoritmo PuLID — que supera o InstantID em benchmarks de fidelidade facial — com a qualidade fotográfica do Flux.1-dev. Pele natural, sem o acabamento "plastificado" típico do InstantID/SDXL. Aceita 1 a 4 selfies de referência (usa todas para construir o embedding facial).

### Diagnóstico do erro atual
Logs mostram `404 The requested resource could not be found` ao chamar `POST /v1/models/zsxkib/instant-id/predictions`. Causa: esse endpoint só funciona para "official models" do Replicate. Modelos da comunidade (incluindo `zsxkib/instant-id` e `zsxkib/pulid-flux`) precisam ser chamados via `POST /v1/predictions` passando o hash da versão no body. Vou corrigir junto com a troca de modelo.

### Mudanças

**`supabase/functions/generate-portrait/index.ts`**

1. Substituir `INSTANT_ID_MODEL = "zsxkib/instant-id"` por `PULID_MODEL = "zsxkib/pulid-flux"`.

2. Buscar o hash da versão mais recente do PuLID-Flux na primeira chamada (cache em memória do worker):
   ```
   GET https://api.replicate.com/v1/models/zsxkib/pulid-flux
   → response.latest_version.id
   ```

3. Trocar a função `generateWithInstantId` por `generateWithPulidFlux`:
   - Endpoint: `POST /v1/predictions` (não mais `/v1/models/.../predictions`)
   - Body: `{ version: "<hash>", input: {...} }`
   - Inputs principais:
     - `main_face_image`: a maior selfie (referência principal)
     - `auxiliary_face_images`: até 3 selfies adicionais (PuLID-Flux suporta múltiplas refs para reforçar a identidade)
     - `prompt`: estilo de estúdio + figurino
     - `negative_prompt`: igual ao atual
     - `num_steps`: 20
     - `guidance_scale`: 4
     - `id_weight`: 1.05 (controla intensidade da preservação facial; 1.0-1.2 é o sweet spot)
     - `true_cfg`: 1
     - `width`: 1024, `height`: 1024
     - `output_format`: "jpg", `output_quality`: 95

4. Manter idêntico:
   - Polling (até 120s — Flux é um pouco mais lento)
   - Download da URL e conversão para data URL base64
   - Fallback para Gemini se PuLID falhar
   - Logs de diagnóstico (account-check, fingerprint, request-id, body em erros)
   - Débito de crédito, log em `credit_logs`, persistência em `portrait_generations`
   - Atualizar string do provider para `"pulid-flux"` no log e no payload de retorno

5. Atualizar prompt para PuLID:
   - Foco em cena, iluminação, figurino — a identidade vem das imagens de referência
   - Manter `studioStyle` e `wardrobeLine` exatamente como hoje

### Sem mudanças
- `PortraitGenerator.tsx` (frontend): payload de retorno mantém os mesmos campos (`portrait`, `provider`, `used_fallback`, `style_index`).
- Schema do banco: nenhuma migration.
- Outras edge functions: intactas.
- Preço de venda ao usuário: inalterado.

### Custo
- ~US$ 0,03 por retrato (Flux é mais caro que SDXL, mas qualidade muito superior)
- US$ 10 → ~330 retratos
- Margem permanece confortável

### Validação
Você gera 1 retrato em `/portraits`. Esperado nos logs:
```
[portrait] resolved pulid-flux version=<hash de 64 chars>
[portrait] calling replicate model=zsxkib/pulid-flux refs=N
[portrait] provider=pulid-flux status=succeeded latency=15-20s
```
Resultado visual: rosto **claramente reconhecível como você**, pele natural (não plastificada), fundo de estúdio do `studioStyle` sorteado, figurino do relatório. Sem fallback para Gemini.

### Plano B
Se PuLID-Flux ainda não atingir o nível desejado, próximo passo seria construir o fluxo de fine-tuning com LoRA (treina uma vez, gera infinitos retratos do mesmo rosto). É mudança maior — outro fluxo de UX (etapa de "treinamento" antes da primeira geração) e outro custo. Não bloqueia esta entrega.

