## Objetivo

Adicionar três camadas obrigatórias ao pipeline de geração de conteúdo do Posiciona, **somando** ao contexto existente (questionários de negócio + história + StoryBrand + tom de voz + arquétipos), sem alterar fluxos, visual ou funcionalidades já em produção.

```text
Ordem final do prompt enviado ao Claude:
  [Parte 0] Princípios narrativos (sempre)
  [Parte 1] Regras éticas da profissão (quando aplicável)
  [Contexto existente] Negócio + História + StoryBrand + Tom + Arquétipos + Temas publicados
  [Parte 2] Contexto atual do mercado (quando disponível)
  [Instrução final de geração]
```

---

## 1. Princípios narrativos obrigatórios (Parte 0)

**Arquivo novo:** `supabase/functions/_shared/narrativePrinciples.ts`
- Exporta `NARRATIVE_PRINCIPLES_BLOCK` (string) com os princípios obrigatórios:
  - StoryBrand (cliente como herói, marca como guia)
  - Made to Stick / SUCCESs (simples, inesperado, concreto, credível, emocional, com história)
  - Obviously Awesome (categoria clara, contexto antes de produto)
  - Anti-padrões: nada de jargão vazio, nada de "venha conhecer", nada de listas genéricas sem narrativa
  - Tom: editorial, específico, voz humana

Aplicado **sempre**, em qualquer geração (semana, regeneração de post único, capa de reels com legenda etc.).

---

## 2. Regras éticas por profissão (Parte 1)

**Arquivo novo:** `supabase/functions/_shared/professionRules.ts`
- Função `detectProfession(profile)` lê `profession` + `niche` do `profiles` (cadastro) e classifica em:
  - `advogado` (palavras: advog, jurídic, direito, OAB)
  - `medico` (médic, medic, doutor, CFM, saúde)
  - `outro` (sem restrições adicionais)
- Exporta `getEthicalRulesBlock(category)` retornando:
  - **OAB (Provimento 205/2021)**: proibido auto-promoção sensacionalista, captação de clientela, garantia de resultado, comparação com colegas, divulgação de valores fora do permitido, casos específicos identificáveis. Permitido: informação técnica, prevenção, esclarecimento.
  - **CFM (Resolução 2.336/2023)**: proibido antes/depois, garantia de cura, sensacionalismo, autopromoção, exposição de pacientes, divulgação de equipamentos como diferencial. Permitido: educação em saúde, prevenção.
  - `outro`: bloco vazio.

---

## 3. Contexto de mercado em tempo real (Parte 2)

**Edge Function nova:** `supabase/functions/fetch-market-trends/index.ts`
- Input: `{ profession, niche, userId }`
- Usa Claude com tool `web_search_20250305` para buscar 2–3 tendências/notícias recentes (últimos 14 dias) no nicho.
- Retorna JSON: `[{ title, summary, source_url, published_at, angle_suggestion }]`
- Cache em memória por `(profession+niche)` com TTL de 24h dentro da função (Map simples).

**Persistência:** as tendências usadas na geração são salvas dentro de cada item de `reports.editorial_weeks[i].market_trends` (JSON), garantindo consistência entre exibição e regenerações futuras.

---

## 4. Integração no pipeline existente

**Arquivo:** `supabase/functions/_shared/buildClaudeContext.ts`
- Adicionar parâmetros opcionais `professionCategory` e `marketTrends` na função builder.
- Montar o `systemText` final concatenando, nesta ordem:
  1. `NARRATIVE_PRINCIPLES_BLOCK`
  2. `getEthicalRulesBlock(professionCategory)` (se existir)
  3. Sistema atual (intacto)
- Adicionar bloco `# CONTEXTO ATUAL DO MERCADO` no final do `userText` quando `marketTrends` vier preenchido. Os blocos atuais (`# NEGÓCIO`, `# HISTÓRIA PESSOAL`, `# ESTRATÉGIA STORYBRAND DA MARCA`, `# TOM DE VOZ DA MARCA`, `# CONTEXTO PESSOAL DO CRIADOR`, `# TEMAS JÁ PUBLICADOS`) permanecem inalterados.

**Arquivo:** `supabase/functions/process-content-generation-job/index.ts`
- Antes de chamar Claude:
  1. Carregar `profiles` do usuário (já disponível) → `detectProfession`.
  2. Invocar `fetch-market-trends` (best-effort, com timeout 15s; falha silenciosa não bloqueia geração).
  3. Passar `professionCategory` e `marketTrends` para `buildClaudeContext`.
  4. Salvar `marketTrends` em `editorial_weeks[weekIndex].market_trends`.

**Arquivo:** `supabase/functions/regenerate-single-post/index.ts`
- Mesma lógica: detectar profissão, reaproveitar `market_trends` já salvas na semana (não refaz busca para manter consistência), passar para o builder.

---

## 5. UI — cards de tendências dentro de cada semana

**Arquivo:** `src/pages/EditorialPage.tsx`
- Dentro do bloco de cada semana renderizada, **acima da grade de posts**, adicionar seção:
  - Título: *"Baseado no que está acontecendo na sua área"*
  - Subtítulo discreto: data da última atualização
  - Cards (até 3) com: título da tendência, resumo curto, fonte (link discreto), botão **"Criar post sobre isso"**
- O botão chama o fluxo atual de regeneração de post único, passando o `angle_suggestion` da tendência como tema pré-preenchido (parâmetro novo opcional `themeOverride` no `regenerate-single-post`).
- Visual segue o sistema light premium do workspace (Cormorant + Inter, sem emojis, sem cores novas).
- Renderização condicional: se `week.market_trends` estiver vazio, seção não aparece (zero impacto visual).

---

## 6. Garantias de não-regressão

- Nenhum arquivo de UI fora de `EditorialPage.tsx` é tocado.
- Nenhum schema de tabela é alterado (tendências vivem dentro do JSONB já existente `reports.editorial_weeks`).
- Falha em `fetch-market-trends` é silenciosa: geração continua com Partes 0+1+contexto atual.
- Profissões fora de "advogado/médico" recebem bloco ético vazio — comportamento idêntico ao atual para esses usuários.
- Toda a lógica nova é aditiva ao prompt; nada é removido ou substituído.

---

## Arquivos afetados

**Novos:**
- `supabase/functions/_shared/narrativePrinciples.ts`
- `supabase/functions/_shared/professionRules.ts`
- `supabase/functions/fetch-market-trends/index.ts`

**Modificados:**
- `supabase/functions/_shared/buildClaudeContext.ts`
- `supabase/functions/process-content-generation-job/index.ts`
- `supabase/functions/regenerate-single-post/index.ts`
- `src/pages/EditorialPage.tsx`

Sem migrations. Sem novos secrets (usa `ANTHROPIC_API_KEY` existente).
