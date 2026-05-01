## Migração para Nano Banana Pro

Substituir o motor Fal.ai (Krea + LoRA) por **Nano Banana Pro** (`google/gemini-3-pro-image-preview`) via Lovable AI Gateway. O Nano Banana Pro recebe as selfies de referência diretamente em cada geração (sem treino), preservando identidade com fidelidade muito superior, pele natural, sem o viés de "envelhecimento" do Krea.

### O que muda para a usuária

- O card "Estúdio Pessoal" some da página `/portraits`.
- Em vez disso, aparece um card **"Suas referências"**: pedimos 3 a 5 selfies (frontal, lateral, sorrindo, luz natural). Sem espera de 20min, sem custo de treino — as selfies ficam guardadas e são reutilizadas em toda geração.
- O botão "Gerar retratos" funciona igual: 1 crédito por retrato, até 3 por geração (Neutro/Claro/Escuro).
- Tempo de geração esperado: ~40–80s (vs. ~3min do Fal). E você só é cobrada quando o retrato sai pronto.

### Fluxo técnico novo

```text
[Usuária envia 3-5 selfies]
        ↓
[portrait-references upload] → bucket portrait-inputs/{user_id}/ref_*.jpg
        ↓ grava metadata em portrait_references
[Usuária clica "Gerar"]
        ↓
[generate-portrait v2] → Lovable AI Gateway
   model: google/gemini-3-pro-image-preview
   messages: [
     { system: identidade + estilo + arquétipo + figurino + pose + fundo },
     { user: text + 3-5 image_url (selfies) }
   ]
        ↓ resposta síncrona (~40-80s/imagem)
[upload portrait-outputs + cobra 1 crédito por imagem entregue]
        ↓
[grava em portrait_generations e exibe]
```

### Mudanças no banco

Nova tabela `portrait_references` (selfies persistentes da usuária):
- `user_id`, `file_path` (no bucket `portrait-inputs`), `is_active`, `position` (ordem)
- RLS: usuária CRUD nas próprias; admin lê tudo.

`portrait_trainings` **mantida intacta** no banco (dados antigos preservados, só some da UI).

`portrait_generations` ganha coluna opcional `engine` (`'fal' | 'gemini'`) para distinguir histórico legado vs novo. `fal_request_ids` continua opcional (não usado no novo motor).

### Mudanças nas Edge Functions

1. **Nova `portrait-references`** — upload/listagem/deleção das selfies (substitui o papel do `portrait-train` na UI).
2. **`generate-portrait` reescrita** — chama Lovable AI Gateway com Nano Banana Pro, envia selfies como `image_url` (data URL), recebe imagem(ns) base64, sobe no bucket, cobra créditos só pelos sucessos. Síncrona — não usa mais fila.
3. **`portrait-poll`** — desativada/removida (não tem mais polling).
4. **`portrait-train`, `portrait-webhook`, `portrait-fix-weights`, `portrait-recover`** — mantidas no repo mas sem chamadas (legado).

### Mudanças na UI (`PortraitGenerator.tsx`)

- Remover renderização do card "Estúdio Pessoal" (todo o bloco entre linhas ~456–566), incluindo dialog de treino (linhas ~646+).
- Novo card **"Suas referências"**: dropzone para 3-5 selfies, lista com previews e botão de excluir individual; mostra contagem `n/5`. Persiste imediatamente no upload.
- Card "Gerar retratos" passa a depender de `references.length >= 3` em vez de `hasReadyStudio`.
- Microcopy:
  - Título: *"Suas referências"*
  - Subtítulo: *"Envie de 3 a 5 selfies nítidas (frontal, lateral e sorrindo, luz natural). Elas guiam a fidelidade do seu rosto em cada geração."*
  - Botão: *"Gerar 3 retratos (3 créditos)"*

### Compensação e tratamento do legado

- A usuária que já tinha `portrait_trainings.status = 'ready'` no Fal: na primeira visita à página `/portraits` após o deploy, exibir banner discreto: *"Atualizamos o motor de retratos para uma versão mais fiel. Suas selfies anteriores foram migradas — confira em 'Suas referências'."* — extrair as imagens do ZIP de treino antigo (bucket `portrait-inputs`) e popular `portrait_references` automaticamente via migration/script.
- Crédito de cortesia: **+3 retratos extras** para a usuária 481caf41 testar o novo motor sem custo.

### Prompt do Nano Banana Pro

System prompt enfatiza:
- *"preserve exact facial identity, age, ethnicity, and hair from the reference images"*
- *"natural skin texture with visible pores; no smoothing, no age regression, no aging"*
- *"editorial portrait, soft studio lighting, ambient depth"*

User content combina: descrição do arquétipo, figurino, pose de mãos, fundo (3 variações), proporção retrato 4:5 + as N selfies como `image_url`.

### Custos / risco

- Nano Banana Pro é o modelo de imagem mais caro do gateway, mas **só cobra quando entrega**. Sem mais "queima" como no Fal.
- Sem custo de treino mensal.
- Identidade muito mais fiel (testes internos da Google mostram preservação superior em retratos com referências múltiplas).
- Plano B: se Nano Banana Pro estiver indisponível, fallback automático para Nano Banana 2 (`google/gemini-3.1-flash-image-preview`).

### Resumo de arquivos

- **Novo**: `supabase/functions/portrait-references/index.ts`, migration para `portrait_references` + coluna `engine` + script de migração de selfies legadas.
- **Reescrito**: `supabase/functions/generate-portrait/index.ts`, `supabase/functions/_shared/portraitPrompts.ts` (novo builder Gemini).
- **Editado**: `src/pages/PortraitGenerator.tsx` (remove card de treino, adiciona card de referências), tipo `portrait_references` em `types.ts` (auto-gerado).
- **Sem mudança/legado**: `portrait-train`, `portrait-poll`, `portrait-webhook`, `portrait-recover`, `portrait-fix-weights`.
