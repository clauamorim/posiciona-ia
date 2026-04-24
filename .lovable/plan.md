

## Diagnóstico definitivo do 402 do Replicate

### O que vou fazer
1. **Validar o token diretamente contra a API do Replicate** chamando `https://api.replicate.com/v1/account` com o token que está atualmente salvo no secret `REPLICATE_API_TOKEN`. Isso me devolve o nome da conta — comparo com `clauamorim` para confirmar se é o token certo que está no servidor.
2. **Disparar uma chamada de teste mínima** ao modelo `flux-kontext-apps/multi-image-kontext-pro` direto da edge function, com log do request_id e da resposta completa do Replicate (não só do status).
3. **Inspecionar a resposta de erro completa** — o Replicate inclui um campo `detail` com a razão real (ex: "no payment method on file", "credits expired", "model requires verified account", "insufficient credit on this org").
4. Com essa informação, te aponto exatamente o que ajustar na conta do Replicate (adicionar payment method, verificar conta, trocar de org, etc.) ou re-colar o token corretamente.

### O que NÃO vou fazer
- Não vou mudar nenhuma lógica do frontend (a remoção do toast de fallback já foi acordada e fica para depois).
- Não vou trocar o modelo Flux antes de entender por que o 402 persiste.
- Não vou pedir token novo agora — primeiro confirmo se o que está salvo é realmente o `r8_6uJ...`.

### Arquivos afetados
- `supabase/functions/generate-portrait/index.ts` — adicionar logs detalhados temporários da resposta do Replicate (status, headers, corpo completo, request_id). Sem mudança de lógica.

### Próximo passo após o teste
Dependendo do resultado:
- **Se a API do Replicate retornar conta diferente de `clauamorim`** → o secret está desatualizado, te peço para colar o token novamente no fluxo seguro.
- **Se retornar `clauamorim` mas der 402** → te oriento exatamente o que falta na conta (provavelmente payment method ou verificação), com base no `detail` do erro.
- **Se passar e gerar a imagem** → problema era cache; remove os logs extras e seguimos para a remoção do toast.

### Validação
Você gera 1 retrato em `/portraits` enquanto eu observo os logs. Em até 2 minutos eu te digo o motivo exato do 402.

