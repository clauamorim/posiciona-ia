

## Pacote 11 (revisado) — Retratos com Flux Kontext Pro (Replicate) + fallback Gemini

### Esclarecimentos importantes

**1. Figurino vem do relatório do usuário (sem mudança).**
A função já lê `figurino.pecas_chave` e `figurino.cores_roupa` do `reports.content` (último relatório `completed`) e monta a linha de roupa no prompt. Esse comportamento é mantido **igual** no caminho Flux e no fallback Gemini. Inclusive o parâmetro `wardrobeVariation` continua rotacionando peças/cores quando o usuário gera variações.

**2. Como ficam as 5 selfies no Flux Kontext Pro.**
O Kontext Pro aceita **apenas uma `input_image`** por chamada — diferente do Gemini, que hoje recebe todas as selfies como contexto. Para não perder fidelidade, vou fazer o seguinte:

- **Pré-processamento no edge:** escolher **a selfie de melhor enquadramento facial** como `input_image` principal. Critério simples e barato (sem CV pesado): pegar a selfie de **maior resolução** entre as enviadas. Empate → a primeira (o usuário já é orientado a colocar a melhor primeiro).
- As demais selfies **não são descartadas**: viram **referências textuais de identidade** dentro do prompt do Flux. Como o Kontext Pro é guiado fortemente pela `input_image`, isso é o uso correto — múltiplas imagens jogadas juntas degradariam o resultado.
- **No fallback Gemini**, todas as 5 selfies continuam sendo enviadas como hoje (comportamento atual preservado).

### Provedor e fluxo

- **Replicate**, modelo `black-forest-labs/flux-kontext-pro`.
- Secret novo: **`REPLICATE_API_TOKEN`** (vou solicitar via `add_secret` antes de mexer no código).
- Chamada via API HTTP do Replicate com polling de `prediction.status` a cada 1.5s, timeout duro de 90s.
- Parâmetros: `prompt`, `input_image` (data URL da melhor selfie), `aspect_ratio: "1:1"`, `output_format: "jpg"`, `safety_tolerance: 2`, `prompt_upsampling: false`.
- Resposta convertida para `data:image/jpeg;base64,...` para uniformidade com o fluxo atual (igual ao Gemini).

### Fallback automático para Gemini (com aviso)

Cai para Gemini quando:
- Faltar `REPLICATE_API_TOKEN`.
- Resposta `!ok`, status `failed`/`canceled`, timeout de polling, erro de rede ou imagem vazia.

No fallback:
- Executa o caminho Gemini atual (Lovable AI Gateway, `google/gemini-3.1-flash-image-preview`) **com todas as 5 selfies**.
- Resposta inclui `used_fallback: true` e `provider: "gemini"`.
- Cliente exibe toast: *"Provedor principal indisponível. Geramos seu retrato com o motor reserva. A qualidade pode variar levemente."*

Sucesso normal pelo Flux: silencioso, sem toast extra.

### Créditos e histórico

- Débito de crédito (`portrait_credits_included` → `portrait_credits_extra`) e gravação em `portrait_generations` ocorrem **uma única vez**, depois da geração final bem-sucedida — independente do provedor.
- Se ambos falharem, **nada é debitado** (regra atual preservada).

### Resposta da edge function

```json
{
  "portrait": "data:image/jpeg;base64,...",
  "style_index": 2,
  "provider": "flux" | "gemini",
  "used_fallback": false | true
}
```

### Logs

`console.log` no edge:
- `[portrait] provider=flux status=succeeded latency=Xs`
- `[portrait] flux failed reason=... → falling back to gemini`

Sem expor o token nos logs.

### Arquivos editados

- `supabase/functions/generate-portrait/index.ts` — integração Replicate + fallback Gemini + resposta enriquecida.
- `src/pages/PortraitGenerator.tsx` — toast informativo quando `used_fallback === true`.

### Pré-requisito

- Adicionar **`REPLICATE_API_TOKEN`** (obtido em replicate.com/account/api-tokens). Vou solicitar via `add_secret` assim que este plano for aprovado.

### Resultado esperado

- Retratos passam a ser gerados pelo **Flux Kontext Pro**, com a melhor selfie como referência principal e as demais como reforço textual de identidade.
- **Figurino do relatório continua sendo aplicado igual a hoje** (peças, cores, gênero, variação).
- Se o Replicate falhar, cai automaticamente para **Gemini com todas as 5 selfies** e avisa no toast.
- Crédito só é debitado quando há retrato real entregue.
- Nenhum outro fluxo de imagem (posts, capas, galeria) é afetado.

