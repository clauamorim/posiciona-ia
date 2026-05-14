## Objetivo

Tornar o relatório a Single Source of Truth (SSoT) da marca. Análise de Instagram, linha editorial, retratos e geração visual de posts passam a consumir símbolos, paleta, figurino e tom de voz do relatório do usuário, em vez de gerar em paralelo.

---

## 1. Guardrails éticos no relatório (`generate-report`)

Localizar a função que gera o relatório (provavelmente `supabase/functions/generate-report/index.ts` ou similar) e:

- Detectar profissão via `detectProfession()` e injetar `getEthicalRulesBlock(category)` no prompt do Gemini.
- Adicionar bloco de **substituições obrigatórias** quando regulamentada:
  - "antes e depois" → "trilha de transformação contada pelo método"
  - "fórmula que poucos conhecem" / "segredo" / "fórmula mágica" → "metodologia construída ao longo de [X] anos"
  - CTA "agende pelo WhatsApp" / "agende seu diagnóstico" → "salve este post", "guarde esta informação", "indique para um colega"
- Pós-geração: rodar `validatePostCompliance()` (já existente) sobre todos os campos textuais do relatório (bio, CTAs, descrição de arquétipos, símbolos, figurino, tom de voz). Se severity `high`, **retry guiado uma vez** apontando o trecho infrator. Nunca bloquear entrega — log de auditoria se persistir.

## 2. Validador de contradição interna do relatório

Novo módulo `supabase/functions/_shared/reportCoherenceValidator.ts`:

- Extrai a lista "palavras a evitar" do tom de voz do relatório.
- Varre todas as outras seções (arquétipos, símbolos, figurino, StoryBrand, CTAs) procurando essas palavras.
- Palavras críticas hard-coded sempre verificadas: `segredo`, `fórmula mágica`, `fácil`, `rápido`, `viral`.
- Retorna `{ contradictions: [{section, word, snippet}] }`.
- Se houver contradições, retry guiado uma vez no `generate-report` listando exatamente o que reescrever.

## 3. Persistir símbolos e paleta do relatório (DB)

Migração — duas tabelas novas:

**`user_archetype_symbols`**
- `user_id`, `report_id`, `report_version`
- `symbol_name` (text)
- `applies_to` (text[]) — ex: `["overlay", "highlight_icon", "post_decoration"]`
- `svg_data` (text, nullable) — SVG inline se gerado
- `emoji` (text, nullable) — fallback emoji
- `priority` (int) — ordem do relatório
- RLS: usuário lê/insere o seu; service role full

**`user_brand_palette`**
- `user_id`, `report_id`, `report_version`
- `color_name` (text) — ex: "Verde Aventura"
- `hex` (text) — ex: `#1ABC9C`
- `role` (text) — `primary | secondary | accent | neutral_light | neutral_dark`
- `priority` (int)
- RLS idem.

Na conclusão de `generate-report`, popular as duas tabelas (deletando versões antigas do mesmo user e inserindo as novas atômicas). Sempre usar a versão `max(version)` em consultas.

## 4. Consumo da SSoT pelos geradores visuais

**`buildAutoLayout` / `buildArchetypeOverlays`** (arquivo provavelmente em `src/lib/postEditor/...` ou `src/features/posts/...`):
- Antes de cair em overlays genéricos por arquétipo, consultar `user_archetype_symbols` da versão mais recente do usuário.
- Se vazio, fallback para os símbolos genéricos atuais.

**Paleta no editor / templates**:
- Hook novo `useUserBrandPalette()` que retorna as cores do `user_brand_palette` (versão mais recente).
- Onde hoje se lê a paleta padrão por arquétipo (post editor, geração de stories, geração de capas), trocar para tentar SSoT primeiro, fallback para paleta default.

## 5. `analyze-instagram` consome o relatório

Antes de chamar a LLM, carregar do DB:
- Último relatório do usuário (`reports` onde `version = max`).
- Símbolos da SSoT (`user_archetype_symbols`).
- Paleta da SSoT (`user_brand_palette`).
- Tom de voz (palavras a usar / evitar do relatório).
- Figurino estratégico (peças e cores).

Injetar no system prompt um bloco `BRAND_SSOT_BLOCK` com instruções:
- Sugestões de **destaques** DEVEM citar os símbolos da lista (nome + emoji/svg) como ícones recomendados.
- Sugestões de **paleta** DEVEM usar exatamente as 5 cores nomeadas (não inventar).
- Sugestões de **bio/CTA** DEVEM respeitar palavras a usar/evitar (e nunca repetir as banidas).
- Sugestões de **figurino** DEVEM citar as peças e cores do figurino estratégico.

Se o relatório não existir, comportamento atual permanece (genérico).

## 6. `generate-portrait` consome figurino

A função (`supabase/functions/generate-portrait/index.ts` ou nome equivalente) lê do relatório do usuário:
- Lista de peças-chave do figurino estratégico.
- Cores de roupa recomendadas (da paleta SSoT).
- Paleta de fundo recomendada.

Esses dados são injetados no prompt do Gemini como bloco `WARDROBE_GUIDANCE_BLOCK` (peças permitidas, cores, evitar X). Fallback para o comportamento atual se vazio.

---

## Arquivos esperados

**Novos:**
- `supabase/functions/_shared/reportCoherenceValidator.ts`
- `supabase/functions/_shared/brandSSoT.ts` — helpers `loadUserSymbols()`, `loadUserPalette()`, `loadUserWardrobe()`, `renderBrandSSoTBlock()`
- Migração DB para `user_archetype_symbols` + `user_brand_palette`
- `src/hooks/useUserBrandPalette.ts`

**Editados:**
- `supabase/functions/generate-report/index.ts` (guardrails + validador + persistência SSoT)
- `supabase/functions/analyze-instagram/index.ts` (carrega SSoT + injeta no prompt)
- `supabase/functions/generate-portrait/index.ts` (figurino do relatório)
- `supabase/functions/_shared/professionRules.ts` (substituições obrigatórias se ainda não cobertas)
- Geradores de overlay/template (a localizar) — consumir `user_archetype_symbols`
- Componentes de paleta do editor — consumir `useUserBrandPalette()`

---

## Validação

- Gerar um relatório teste para profissão regulamentada → conferir que "antes/depois", "segredo", "fórmula mágica" não aparecem.
- Conferir que tabelas SSoT são populadas após `generate-report`.
- Rodar `analyze-instagram` para usuário com relatório → conferir que destaques citam símbolos do relatório e paleta usa as 5 cores nomeadas.
- Gerar retrato → conferir que prompt inclui peças do figurino.
- Gerar post no editor → conferir que overlays são os símbolos do relatório, não genéricos.