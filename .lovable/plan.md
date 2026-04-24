

## Trocar Flux Kontext por modelo com preservação de identidade facial

### Diagnóstico
Logs confirmam que o `REPLICATE_API_TOKEN` está correto (conta `clauamorim`), há saldo, e o Flux executou em 11.9s sem erro. **Problema agora é qualidade do modelo**, não infraestrutura.

`flux-kontext-apps/multi-image-kontext-pro` foi escolhido por suportar múltiplas imagens, mas:
- aceita no máximo 2 referências (descartou 2 das 4 selfies enviadas)
- é otimizado para edição contextual de cena, **não para preservação de rosto**
- resultado: rosto genérico em vez do rosto da pessoa

### Solução: trocar para modelo identity-preserving

Modelos do Replicate especializados em manter o rosto original:

| Modelo | Vantagem | Custo aprox. |
|---|---|---|
| `zsxkib/pulid` | Excelente em preservar traços, aceita 1+ refs, rápido | ~US$ 0,02 |
| `zsxkib/instant-id` | Padrão da indústria para identity-preserving, ótimo com prompts elaborados | ~US$ 0,02 |
| `fofr/face-to-many` | Estilizações controladas, rosto preservado | ~US$ 0,03 |

**Recomendação: `zsxkib/instant-id`** — é o mais maduro, tem melhor balanço entre fidelidade facial e liberdade de prompt (estilo de fundo, iluminação, figurino), e funciona bem com 1 selfie de referência (a melhor das 4).

### Mudanças

**`supabase/functions/generate-portrait/index.ts`**
- Substituir `FLUX_MODEL = "flux-kontext-apps/multi-image-kontext-pro"` por `INSTANT_ID_MODEL = "zsxkib/instant-id"`
- Trocar a função `generateWithFlux` por `generateWithInstantId`:
  - input principal: `image` (1 selfie — a maior/melhor das enviadas)
  - input opcional: `prompt` (estilo de estúdio + figurino)
  - parâmetros recomendados: `num_inference_steps: 30`, `guidance_scale: 5`, `ip_adapter_scale: 0.8`, `controlnet_conditioning_scale: 0.8`
- Manter exatamente a mesma lógica de polling, download e conversão para data URL
- Manter fallback para Gemini se InstantID falhar
- Manter logs de diagnóstico (account-check, token-fingerprint, request-id em erros)
- Atualizar mensagem de log de `provider=flux` para `provider=instant-id`

**Sem mudanças no frontend** — `PortraitGenerator.tsx` continua igual, payload de retorno mantém os mesmos campos (`portrait`, `provider`, `used_fallback`, `style_index`).

**Sem mudanças no schema de DB** — nada de migration.

### O que acontece com as outras selfies
InstantID usa 1 referência forte. Vou selecionar a maior selfie (proxy para "mais detalhada") da mesma forma que o código atual já faz com Flux. As demais ficam disponíveis para futuras variações se quiser, mas não são enviadas ao modelo nesta versão.

### Validação
Você gera 1 retrato em `/portraits` com a mesma seleção de selfies. Resultado esperado: rosto **reconhecivelmente seu**, em fundo de estúdio, com figurino do relatório. Latência similar (10-15s).

### Custo
- Antes (Flux Kontext Pro): ~US$ 0,04/retrato → ~250 retratos por US$ 10
- Depois (InstantID): ~US$ 0,02/retrato → ~500 retratos por US$ 10

### Plano B
Se InstantID ainda não atingir a qualidade desejada (raro, mas possível), próxima troca seria `zsxkib/pulid` ou combinação InstantID + face-swap pós-processamento. Não bloqueia a entrega atual.

