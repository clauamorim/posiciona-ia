

## Trocar para `flux-kontext-apps/professional-headshot`

### Diagnóstico
PuLID-Flux está com `id_weight: 1` mas mesmo assim o resultado parece "renderizado" — pele plástica, rosto idealizado. É um efeito conhecido do Flux quando combinado com adapters de identidade fortes: o modelo "limpa demais" o rosto.

O `flux-kontext-apps/professional-headshot` é um **app oficial do Replicate** sob o `flux-kontext-apps/`, desenhado especificamente para uma tarefa: pegar uma foto sua e devolver um headshot profissional, mantendo os traços. Não é um adapter genérico — é um app focado.

### Schema do modelo (confirmado na doc oficial)

Inputs:
- `input_image` (string, uri) — sua selfie. **Aceita apenas 1 imagem.**
- `gender` ("none" | "male" | "female") — controla o gênero.
- `background` ("neutral" | outros presets) — fundo.
- `aspect_ratio` (default "match_input_image").
- `output_format` (default "png").
- `seed` (int, opcional).
- `safety_tolerance` (0-2).

Não aceita `prompt` livre. Toda a "direção criativa" vem de `gender` + `background`.

### Implicações para o produto
- **Não usaremos mais `studioStyle` randômico** (5 variações de luz/fundo) — o modelo controla isso internamente via `background`.
- **Não usaremos `wardrobeLine` do figurino** — o modelo não aceita prompt. O figurino do relatório deixa de influenciar o retrato neste motor. Se o usuário quiser variação visual, o controle disponível é o parâmetro `background`.
- **A "Opção de figurino" (Look 1/2/3) na UI vai mapear para `background` diferente**, não mais para variação de roupa. Vou renomear para "Variação de fundo" no frontend.

### Mudanças

**1. `supabase/functions/generate-portrait/index.ts`**
- Substituir constante `PULID_MODEL = "bytedance/flux-pulid"` por `HEADSHOT_MODEL = "flux-kontext-apps/professional-headshot"`.
- Como é um app oficial, chamar via endpoint dedicado:
  - `POST /v1/models/flux-kontext-apps/professional-headshot/predictions`
  - Body: `{ input: {...} }` — sem precisar resolver versão.
- Remover `resolvePulidVersion` e cache associado.
- Substituir `generateWithPulidFlux` por `generateWithHeadshot`:
  - `input_image`: a maior das selfies (única que o modelo aceita).
  - `gender`: derivado do `profiles.gender` (Feminino → "female", Masculino → "male", outros → "none").
  - `background`: mapeado a partir do índice da variação selecionada (3 valores fixos: "neutral", "white", "black" — confirmados nos exemplos da doc).
  - `aspect_ratio`: "1:1".
  - `output_format`: "png".
  - `safety_tolerance`: 2.
  - `seed`: aleatório.
- Manter polling, download, conversão para data URL base64, fallback Gemini, débito de crédito, log em `credit_logs`, persistência em `portrait_generations`.
- Atualizar string do provider para `"professional-headshot"` no log e payload.
- Remover toda a montagem de `studioStyle` e `wardrobeLine` na geração principal (ainda usadas só no fallback Gemini).

**2. `src/pages/PortraitGenerator.tsx`**
- Renomear "Opção de figurino" → "Variação de fundo".
- Renomear "Look 1 / Look 2 / Look 3" → "Neutro / Claro / Escuro".
- Atualizar texto auxiliar para refletir que o controle agora é do fundo, não do figurino.
- Manter o resto do fluxo (upload, preview, créditos, download) intacto.

**3. Sem mudanças**
- Schema do banco.
- Fluxo de checkout / créditos.
- Histórico persistente.
- Frontend de upload.

### Custo
- `flux-kontext-apps/professional-headshot`: ~US$ 0,04 por retrato (Kontext pro).
- Latência esperada: 8-12s.

### Validação
Você gera 1 retrato em `/portraits` com o gênero correto no perfil. Logs esperados:
```
[portrait] calling replicate model=flux-kontext-apps/professional-headshot gender=female background=neutral
[portrait] provider=professional-headshot status=succeeded latency=~10s
```
Resultado visual esperado: traços preservados (não idealizados), pele com textura natural, fundo profissional, enquadramento de headshot.

### Plano B
Se o `professional-headshot` ainda não atingir o nível desejado, próximas opções são:
- `flux-kontext-apps/portrait-series` — gera várias poses do mesmo rosto a partir de 1 selfie. Útil para variedade.
- Voltar para fine-tuning com LoRA (treina uma vez, gera infinito) — mudança maior de UX.

