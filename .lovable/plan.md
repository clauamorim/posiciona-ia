## Diagnóstico

Os retratos **foram gerados com sucesso** (3 imagens, ~3 min cada). Os logs confirmam:

```
08:41:50  fal-krea-lora succeeded latency=172.4s
08:41:53  fal-krea-lora succeeded latency=176.3s
08:41:57  fal-krea-lora succeeded latency=180.1s
08:42:00  uploaded background=neutro/claro/escuro
08:42:02  Http: connection closed before message completed  ← timeout 504
```

A função levou **~185s totais** e o edge runtime mata em **150s**. Resultado: imagens prontas no Storage, mas o cliente recebeu erro, não foi cobrado, e nada foi salvo em `portrait_generations`.

### Causa raiz

1. **Krea+LoRA no Fal é mais lento que esperado**: ~170-180s por imagem (vs ~30s no Replicate flux-dev).
2. Estamos chamando `fal.run/...` (endpoint **síncrono** — espera o resultado bloqueado). Mesmo em paralelo, somos limitados pela imagem mais lenta.
3. Edge function tem teto de 150s.

A migração simplificou prompt/parâmetros mas a inferência Krea ficou **6x mais lenta** que o pipeline anterior — só descobrimos rodando.

## Opções de correção

**Opção A — Async via fila Fal + polling (recomendado).** Trocar `fal.run/` (sync) por `queue.fal.run/` (async): a função enfileira os 3 jobs (instantâneo, ~2s), salva `portrait_generations` com status `processing` e os 3 `request_id`, e devolve resposta em <5s. Front faz polling. Quando todos prontos, baixa, sobe no Storage e marca `ready`. Vantagens: nunca mais estoura timeout, suporta retratos mais lentos no futuro, UX mostra progresso real. Custo: 1 nova função `portrait-poll` + nova coluna `status` em `portrait_generations`.

**Opção B — Reduzir tempo do Krea.** Cair `num_inference_steps` de 28 → 20 (~30% mais rápido, ~120s) e gerar só **2 retratos** por chamada em vez de 3 (cobre 2 créditos, dispara segunda chamada se quiser 3). Cabe no timeout. Trade-off: qualidade ligeiramente menor + UX pior (2 cliques pra 3 retratos).

**Opção C — Modelo mais rápido.** Trocar `fal-ai/flux-krea-lora` por `fal-ai/flux-lora` (FLUX dev sem Krea, mais rápido ~40s). Volta o problema da pele plástica que motivou toda a migração — não recomendo.

## Recomendação

**Opção A** — é a única correção definitiva. Krea é lento por design (modelo BFL anti-IA roda mais cálculos), e qualquer crescimento de qualidade futura vai bater nesse teto. Async + polling resolve de vez.

## Plano detalhado (Opção A)

### 1. Banco

Adicionar em `portrait_generations`:
- `status` text NOT NULL DEFAULT `'ready'` (legado: `'processing'`, `'ready'`, `'failed'`)
- `fal_request_ids` jsonb DEFAULT `'[]'` (lista de request_ids da Fal pra polling)
- `prompts_meta` jsonb DEFAULT `'[]'` (outfits, poses, backgrounds — pra reconstruir o resultado)

### 2. `generate-portrait/index.ts`

- Submeter os 3 jobs em paralelo via `POST queue.fal.run/fal-ai/flux-krea-lora` → recebe `request_id` em ~1s cada.
- Inserir `portrait_generations` com `status: 'processing'`, salvando `fal_request_ids` e `prompts_meta`.
- **Não cobra crédito ainda** (cobrança só quando ficar pronto, igual hoje).
- Devolve `{ generation_id, status: 'processing', estimated_seconds: 180 }`.

### 3. Nova função `portrait-poll`

Recebe `generation_id`. Para cada `fal_request_id`:
- `GET queue.fal.run/.../requests/<id>/status` — se algum ainda em `IN_QUEUE`/`IN_PROGRESS`, devolve `{ status: 'processing', progress: x/3 }`.
- Quando todos `COMPLETED`: busca resultado, baixa, sobe no Storage, atualiza `portrait_generations` com `portraits`, `status: 'ready'`, cobra créditos, registra `credit_logs`. Devolve URLs assinadas.

### 4. `PortraitGenerator.tsx`

Após o POST inicial, se vier `status: 'processing'`:
- Mostra progresso "Gerando retratos… (~3 min)" com barra/contador.
- Faz `portrait-poll` a cada 8s até `status: 'ready'` ou `'failed'` (timeout client-side: 6 min).
- Renderiza retratos quando prontos. Mesma UX final.

### 5. Recuperação do erro atual

A geração de hoje (`a45b4b0a-d3ab-4c88-8503-10857f1e0fcb`) tem 3 imagens no Storage mas nenhum `portrait_generations`. Vou:
- Criar registro `portrait_generations` apontando pros 3 paths já existentes.
- Cobrar os 3 créditos retroativamente (com nota explicativa em `credit_logs`).

Você não precisa pagar de novo nem ficar sem os retratos.

## Validação

1. Rodar geração de teste no preview → ver toast "Gerando retratos…" + polling visível em network.
2. Confirmar resposta em <5s no POST inicial.
3. Confirmar 3 retratos aparecendo após ~3min.
4. Verificar `portrait_generations` tem status `ready` e cobrança aplicada.
5. Verificar geração recuperada aparece no histórico.

## Risco

Médio. Mexe em fluxo crítico. Mitigação: manter código atual em comentário até validar, e testar com 1 retrato antes de partir pros 3.
