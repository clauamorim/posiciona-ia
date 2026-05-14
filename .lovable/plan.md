## Objetivo

Eliminar a monotemia e as fórmulas batidas de título da linha editorial, garantindo diversidade de pilares, temas centrais e padrões de título — tanto dentro de uma semana quanto entre semanas. A geração nunca trava por violação: ela tenta corrigir uma vez e segue.

## Mudanças

### 1. Nova tabela `used_title_patterns`

Migração para registrar, por post gerado:

- `user_id`, `report_id`, `week_index`, `day_index`
- `pillar` (text) — declarado pela LLM (ver §3)
- `title_formula` (text) — id detectado por heurística
- `title_anchors` (text[]) — `nome_proprio`, `ano`, `numero_nao_redondo`, `pergunta_com_dado`, `cena_especifica`
- `central_concepts` (text[]) — grupos: `grupo_a_autoridade`, `grupo_b_ticket`, `grupo_c_frequencia`, `grupo_d_generico`, `grupo_e_categoria`
- RLS: dono lê/insere; admin lê tudo; service_role gerencia.

### 2. Novo módulo `_shared/editorialDiversity.ts`

- `CONCEPT_GROUPS` — grupo → termos (regex word-boundary, case/acento-insensível).
- `BANNED_TITLE_FORMULAS` — as 10 fórmulas com regex + label.
- `PILLAR_IDS = ["caso_real","metodologia","critica_crenca","recorte_cliente","resultado_transformacional","livre"]`.
- `detectConceptGroups(text)`, `detectTitleFormula(title)`, `detectTitleAnchors(title)`.
- `renderPillarPlanBlock()` — descreve os 5 pilares + 2 livres, exige cobertura de 5 distintos nos 7 dias, "crítica a crença" no máximo 1x. Cita os exemplos do briefing (Havaianas 1994 ✅ / "Postar todo dia…" ❌) **uma única vez** aqui para não duplicar com §3.
- `renderDiversityBlock({ bannedFormulas, dampenedConcepts })` — bloco enxuto: lista os ids das fórmulas proibidas (label curto, sem exemplos longos) + grupos de conceito a evitar como TEMA CENTRAL nas últimas 2 semanas + regra "máx 2 posts por grupo nesta semana". Mantém token budget baixo.
- `validateWeekDiversity(posts)` → `{ ok, violations[] }` cobrindo:
  - >2 posts no mesmo grupo de conceito central,
  - fórmula proibida >1x na semana,
  - pilar duplicado (exceto `livre`, que pode repetir),
  - `critica_crenca` >1x.

### 3. Schema de saída da LLM

Adicionar campo obrigatório por post de feed:

```
"pillar": "caso_real" | "metodologia" | "critica_crenca" | "recorte_cliente" | "resultado_transformacional" | "livre"
```

A LLM declara o pilar que escolheu — não inferimos por heurística. Heurística cuida só de `title_formula`, `title_anchors`, `central_concepts`.

Se o JSON vier sem `pillar` ou com valor inválido, defaulta para `"livre"` e loga warn.

### 4. `process-content-generation-job/index.ts`

- Antes de chamar a LLM, carregar últimas 4 semanas de `used_title_patterns` do usuário; calcular:
  - `bannedFormulas` = qualquer fórmula usada nas últimas 2 semanas;
  - `dampenedConcepts` = grupos centrais das últimas 2 semanas.
- Injetar nos system prompts de feed: `renderPillarPlanBlock()` + `renderDiversityBlock(...)`. Manter `POSITIONING_GUARDRAIL_BLOCK` existente. Stories ficam fora deste bloco.
- Após sanitizar a semana, rodar `validateWeekDiversity`. Se violar, fazer **um** retry pedindo à LLM para reescrever apenas os posts em violação, listando o motivo.
  - Se o retry **também** violar: **aceitar** a versão do retry. `console.warn("[editorial-diversity] retry-violation", { user_id, week_index, violations })`. Nunca travar a entrega.
- Após aceitar a semana, persistir um registro por post em `used_title_patterns`.
- **Escopo do detector**: `title_formula`/`title_anchors`/`central_concepts` consideram apenas `theme` (peso 2x) + `caption.headline` (peso 1x). Slides internos do carrossel são ignorados.
- **Telemetria**: depois de persistir, emitir log estruturado:
  ```
  [editorial-diversity] week=W{n} user={id}
    pillars=[...]
    formulas=[...]
    concept_groups_central=[...]
    violations=[...]
  ```

### 5. Token budget

Antes de mergear, conferir tamanho do `feedSystem` final (positioning + pillar plan + diversity). Meta: ≤ ~6k tokens. Estratégia para caber:

- `renderPillarPlanBlock` carrega os exemplos bom/ruim (Havaianas/Postar todo dia).
- `renderDiversityBlock` é compacto: só ids+labels curtos das fórmulas banidas, sem exemplos longos.

### 6. Sem mudanças de UX

Só backend de geração + nova tabela + novo campo `pillar` no JSON de saída.

## Detalhes técnicos

- Detecção heurística é tolerante (sinal, não bloqueio); o gate real é o retry guiado.
- `dicotomia_travessao` cobre `—`, ` - ` longo e ` – `, sempre com negação ("não … —").
- Sanitização (`editorialSanitize.ts`) e versionamento ficam intactos; bumpamos `EDITORIAL_GENERATOR_VERSION` para `2026-05-14-v9` para marcar conteúdos antigos como desatualizados.

## Ordem de execução

1. Migração SQL (`used_title_patterns`).
2. Criar `_shared/editorialDiversity.ts`.
3. Editar `process-content-generation-job/index.ts`: carregar histórico, injetar blocos, exigir `pillar` no schema, validar, retry opcional, persistir, telemetria.
4. Bump em `_shared/generatorVersion.ts` para v9.