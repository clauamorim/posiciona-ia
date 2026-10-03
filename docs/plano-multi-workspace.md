# Plano: Multi-workspace + Linha editorial pessoal e institucional

**Status:** Fases 1, 2, 3 e 4 implementadas (17/07 a 25/08/2026). Pendente só a fase
"contract" (seção 0.3). As seções 1 a 9 são o desenho original e ficam como registro;
onde a implementação divergiu, a seção 0.2 explica.
**Data:** 2026-07-15 (rev. 2026-07-17; estado atualizado em 2026-10-03)

## 0. Estado da implementação (atualizado em 03/10/2026)

Levantado a partir do histórico do repositório. Como as migrações são aplicadas à mão
no SQL editor do Lovable Cloud, este levantamento mostra o que foi **escrito e
commitado**; a confirmação de que cada migração está de fato aplicada em produção é
feita no painel (ver "Risco operacional nº 1", seção 4).

### 0.1 O que foi entregue

**Fase 1 — Fundação (17/07)**
- `20260717120000_workspaces_expand_1.sql`: enums, `workspaces`,
  `workspace_members`, `has_workspace_access`, 1 workspace default "pessoal" por
  usuário existente.
- `20260717130000_workspaces_expand_2.sql`: `workspace_id` (ainda nullable) nas 22
  tabelas do Grupo A + índices + backfill pelo workspace default do dono.
- `20260717140000_cleanup_orphans_fix_fks.sql`: limpeza de linhas órfãs de contas
  apagadas e FKs com cascade que faltavam.
- `_shared/workspaceAuth.ts` em uso em `questionnaire-interview`,
  `storybrand-preview`, `assistant-chat`, `analyze-instagram`,
  `generate-content-week`, `generate-sales-stories`, `regenerate-single-post` e
  `generate-report`. As três funções que aceitavam chamada sem autenticação agora
  validam o JWT (pendência de segurança da seção 2 resolvida).

**Fase 3 — Editorial por tipo de marca (antecipada, 18/07 a 12/08)**
- Bateria de arquétipos institucional: 36 perguntas (3 por arquétipo), aprovadas em
  `docs/questionario-arquetipos-institucional.md`, numeradas 1001–1036
  (`20260718090000_institutional_archetypes.sql`).
- Geração de relatório respeitando `brand_type`, inclusive no fallback determinístico
  e no retry de coerência; Results com pontuação máxima correta para a bateria
  institucional.
- CompleteProfile adaptado ao institucional (esconde Gênero, relabela Profissão).
- História de Venda e os 7 templates de Stories de Venda com variante institucional.

**Fase 2 — Multi-perfil (21/07 a 23/08)**
- `WorkspaceContext` + switcher + criação de perfil com `brand_type`.
- Isolamento por perfil, com troca de `UNIQUE(user_id, …)` por
  `UNIQUE(workspace_id, …)` onde havia colisão: `archetype_answers`,
  `business_questionnaires`, `reports`, `archetype_scores`, `user_top_archetypes`,
  `sales_narrative_questionnaires`.
- Motor de geração por perfil: dedup semântico (`match_post_embeddings` /
  `match_story_embeddings` filtrando por `workspace_id`), traços, tendências.
- Análise do Instagram e Brand SSoT isolados por perfil; Profissão/Nicho editáveis
  e escopados ao perfil ativo.
- Planos multi-perfil (`20260822120000_multi_workspace_plans.sql`), com
  `max_workspaces` e trigger de limite:

  | Plano | Perfis | Preço (centavos) |
  |-------|--------|------------------|
  | Posiciona Dupla | 2 | 79700 |
  | Posiciona Multi | 4 | 119700 |
  | Posiciona Agência | 10 | 219700 |

  Créditos escalam pela unidade do Autoridade Total (4 ciclos / 2 reanálises /
  5 retratos / 20 ajustes por perfil). Extras (semana extra, packs de retrato) e
  cupons habilitados para os três. Detalhes comerciais em
  `docs/precos-planos-e-parceria.md`.

**Fase 4 — Convites (24 e 25/08)**
- `workspace_invites` (convite por link com token, validade de 14 dias) e as RPCs
  `get_invite_preview`, `accept_workspace_invite`, `list_workspace_members`.
- Exclusão de perfil individual, com salvaguarda que impede a conta de ficar sem
  nenhum perfil.
- Quem só está aceitando convite pula CompleteProfile e ChoosePlan.
- Correções de exclusão de usuário/conta causadas pelas FKs novas
  (`20260823140000`, `20260824160000`, `20260825120000`).

### 0.2 Onde a implementação divergiu do desenho

- **RLS das tabelas de conteúdo não foi migrada em massa para
  `has_workspace_access`** (passo 7 da seção 4). Decisão: o conteúdo continua com
  `auth.uid() = user_id`, porque todo perfil pertence a um único dono e o isolamento
  entre perfis do mesmo dono é feito pelas queries por `workspace_id`. Só as quatro
  tabelas que o convidado precisa acessar ganharam políticas por membership:
  `personal_questionnaires`, `business_questionnaires`,
  `sales_narrative_questionnaires` e `archetype_answers`.
  Consequência: a reescrita das ~92 políticas, apontada como risco principal na
  seção 4, deixou de ser necessária, e também não há fallback `OR auth.uid() =
  user_id` para remover na fase contract.
- **Escopo do convidado (editor) mais restrito que o previsto**: preenche e vê
  Diagnóstico, Voz da Marca/Sua História, História de Venda e as próprias respostas
  de Arquétipos. Relatório, Editorial, Stories de Venda, Análise do Instagram,
  plano/créditos e gestão de membros ficam só com o dono.
- **Multi tem 4 perfis**, não 5 como na proposta da seção 8.
- `reference_documents` saiu do Grupo A (catálogo global, sem `user_id`), e
  `report_generation_jobs` entrou.

### 0.3 O que falta

1. **Fase contract.** `workspace_id` ainda é nullable nas tabelas do Grupo A; não há
   migração tornando-o `NOT NULL`. É o único passo irreversível do plano. Antes dele:
   - backup manual do banco;
   - SELECT de contagem no painel confirmando zero linhas com `workspace_id IS NULL`
     em cada tabela do Grupo A;
   - conferir se todo caminho de escrita (front e edge functions, incluindo jobs em
     segundo plano como `process-report-generation-job`, que não usa
     `workspaceAuth`) já grava `workspace_id`; senão o `NOT NULL` quebra a gravação.
2. **Teste de ponta a ponta em produção** do fluxo de convite e de exclusão (dono +
   convidado reais), já que os últimos commits foram correções seguidas nesses fluxos.

## 1. Objetivo

Duas evoluções de produto tratadas como um único projeto de arquitetura:

1. **Multi-perfil (workspaces):** um usuário pode ter/acessar vários perfis de marca no
   Posiciona (ex.: médico com Instagram pessoal + Instagram da clínica; social media ou
   gestor de tráfego administrando perfis de clientes).
2. **Linha editorial por tipo de marca:** cada perfil é declarado como **marca pessoal**
   ou **marca institucional**, e isso dirige questionários, análise, relatório e linha
   editorial.

A entidade que resolve as duas coisas é a mesma: o **workspace é um perfil de marca com
um tipo**. Fazer o multi-workspace primeiro torna o pessoal/institucional um atributo
natural do modelo, em vez de um remendo em tabelas que seriam remodeladas depois.

## 2. Estado atual (resumo do diagnóstico)

- O produto assume **1 usuário = 1 marca**. O funil (arquétipos → diagnóstico do negócio
  → questionário pessoal → relatório/linha editorial) é linear e único por conta.
- ~38 tabelas penduradas diretamente em `user_id`, com ~92 políticas RLS no padrão
  `auth.uid() = user_id`.
- Várias tabelas usam `UNIQUE(user_id, version)` (ex.: `reports`,
  `business_questionnaires`, `personal_questionnaires`) — o versionamento é por conta.
- Edge functions usam **service role**; a autorização efetiva nelas é feita em código
  (filtros por `user_id`), não por RLS. **Atenção**: `questionnaire-interview`,
  `storybrand-preview` e `assistant-chat` hoje aceitam chamada SEM autenticação
  (pendência de segurança pré-publicação). O helper `workspaceAuth` da Fase 1 deve
  fechá-las — validar JWT de verdade é pré-requisito, não detalhe da migração.
- O contexto de IA (`_shared/buildClaudeContext.ts`) já mistura pessoa + negócio num
  relatório único, sem distinção formal de tipo de marca.

## 3. Novo modelo de dados

### 3.1 Enums e tabelas novas

```sql
CREATE TYPE public.brand_type AS ENUM ('pessoal', 'institucional');
CREATE TYPE public.workspace_role AS ENUM ('owner', 'editor', 'viewer');

CREATE TABLE public.workspaces (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,                 -- "Dr. Fulano", "Clínica X"
  brand_type  public.brand_type NOT NULL DEFAULT 'pessoal',
  handle      text,                          -- @ do Instagram do perfil (opcional)
  profession  text,                          -- migrado de profiles.profession
  niche       text,                          -- migrado de profiles.niche
  is_default  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Garante no máximo 1 workspace default por dono
CREATE UNIQUE INDEX one_default_workspace_per_owner
  ON public.workspaces (owner_id) WHERE is_default;

CREATE TABLE public.workspace_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         public.workspace_role NOT NULL DEFAULT 'editor',
  invited_by   uuid REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
```

Observações:

- O **owner é sempre membro implícito** (não precisa de linha em `workspace_members`);
  a função de acesso (3.2) cobre os dois casos.
- `workspace_members` **nasce no schema já na v1**, mesmo que a UI de convites fique
  para a v2 — evita nova rodada de migração de RLS depois.
- `profiles` continua existindo como dados da **conta** (nome, telefone, e-mail,
  bloqueio). `profession`/`niche` migram para o workspace, pois são atributos da marca.

### 3.2 Função de acesso (base de toda a RLS nova)

```sql
CREATE OR REPLACE FUNCTION public.has_workspace_access(_workspace_id uuid, _min_role public.workspace_role DEFAULT 'viewer')
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces w
    WHERE w.id = _workspace_id AND w.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.workspace_members m
    WHERE m.workspace_id = _workspace_id
      AND m.user_id = auth.uid()
      AND (
        _min_role = 'viewer'
        OR (_min_role = 'editor' AND m.role IN ('owner','editor'))
        OR (_min_role = 'owner'  AND m.role = 'owner')
      )
  )
$$;
```

`SECURITY DEFINER` é obrigatório para evitar recursão de RLS entre
`workspaces`/`workspace_members` (mesmo padrão já usado em `has_role`).

Padrão de política que substitui `auth.uid() = user_id` nas tabelas de conteúdo:

```sql
CREATE POLICY "Members can view" ON public.reports
  FOR SELECT USING (public.has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Editors can write" ON public.reports
  FOR INSERT WITH CHECK (public.has_workspace_access(workspace_id, 'editor'));
-- UPDATE/DELETE idem com 'editor'; políticas de admin (has_role) permanecem como estão.
```

### 3.3 Classificação das tabelas existentes

**Grupo A — ganham `workspace_id` (conteúdo da marca):**

`reports` (inclui `editorial_weeks`), `business_questionnaires`,
`personal_questionnaires`, `sales_narrative_questionnaires`, `sales_story_sequences`,
`archetype_answers`, `archetype_scores`, `user_top_archetypes`,
`user_archetype_symbols`, `instagram_analyses`, `user_brand_palette`,
`post_embeddings`, `story_embeddings`, `used_title_patterns`, `used_personal_traits`,
`used_market_trends`, `assistant_conversations` (+ `assistant_messages` via FK da
conversa), `content_generation_jobs`, `report_generation_jobs` (o Results consulta
por `user_id` para retomar geração — precisa de `workspace_id` para o switcher),
`user_designs`,
`user_gallery_assets`, `dedup`/backfills relacionados.

> Nota sobre arquétipos: numa marca institucional os arquétipos são **da marca**
> (respondidos pensando na empresa), não da pessoa. A tabela é a mesma; o que muda é o
> enquadramento das perguntas e dos prompts (seção 7).

**Grupo B — continuam por usuário (conta, billing, identidade física):**

`profiles`, `user_roles`, `subscriptions`, `plans`, `user_credits`, `user_balances`,
`reference_documents` (catálogo global sem `user_id` — constatado em 17/07),
`credit_logs`, `account_deletion_requests`, `portrait_*` (referências usam selfies da
pessoa; retrato é da pessoa, não do workspace), `gallery_assets` (catálogo global),
`archetype_questions`, `market_trends_cache`, `post_background_cache`.

**Regra da `UNIQUE`:** onde hoje existe `UNIQUE(user_id, version)`, passa a ser
`UNIQUE(workspace_id, version)` (o `user_id` é mantido como coluna de auditoria/criador,
mas sai da constraint).

## 4. Migração e backfill (expand → migrate → contract)

Zero downtime, em 3 migrações separadas:

**Fase 1 — Expand (não quebra nada):**
1. Criar enums, `workspaces`, `workspace_members`, `has_workspace_access`, RLS das novas
   tabelas.
2. Backfill: `INSERT INTO workspaces (owner_id, name, brand_type, profession, niche, is_default)
   SELECT user_id, full_name, 'pessoal', profession, niche, true FROM profiles;`
   (todo usuário existente ganha 1 workspace default do tipo pessoal — comportamento
   idêntico ao atual).
3. Adicionar `workspace_id uuid NULL` em todas as tabelas do Grupo A + índices.
4. Backfill do `workspace_id` via join com o workspace default do dono
   (em lotes, para tabelas grandes como `post_embeddings`).
5. Atualizar `handle_new_user()` para criar também o workspace default no signup.

**Fase 2 — Migrate (deploy coordenado):**
6. Deploy do frontend + edge functions lendo/escrevendo `workspace_id` (seções 5 e 6).
7. Trocar as políticas RLS do Grupo A para o padrão `has_workspace_access`
   (manter temporariamente `OR auth.uid() = user_id` como rede de segurança durante a
   transição).

**Fase 3 — Contract (após validação em produção):**
8. `workspace_id` vira `NOT NULL`; troca das constraints `UNIQUE`; remoção do fallback
   `OR auth.uid() = user_id` das políticas.

**Riscos concentrados:** a reescrita das ~92 políticas RLS (mitigar com testes de RLS
automatizados por papel: owner/editor/viewer/não-membro/admin) e o backfill de tabelas
grandes (mitigar com lotes + verificação de contagem antes da Fase 3).

### Risco operacional nº 1: o Lovable (adição de 17/07/2026)

O projeto é Lovable Cloud: `git push` NÃO garante deploy de edge function (3 ocorrências
documentadas), e migrações de banco não são aplicadas automaticamente a partir do repo —
o caminho confiável é o SQL editor do painel (Lovable Cloud). Portanto, a coreografia
expand → migrate → contract exige **verificação real a cada etapa antes de avançar**:
migração conferida por SELECTs de contagem no painel; deploy de função conferido por
curl/log, nunca pela palavra do Lovable. Os arquivos de migração continuam sendo
commitados no repo como registro, mas a aplicação é manual e verificada.

## 5. Edge functions (~40)

Como todas usam service role, a RLS **não protege** esse caminho — a checagem de
membership precisa ser explícita em código:

1. Criar helper em `_shared/workspaceAuth.ts`:
   `resolveWorkspace(req, supabase): { userId, workspaceId, role }` — valida o JWT
   (como hoje), lê `workspace_id` do body (ou header `x-workspace-id`), confere
   membership via `has_workspace_access` e rejeita com 403 se não houver acesso.
   Se `workspace_id` não vier, resolve o workspace default do usuário
   (retrocompatibilidade durante a transição).
2. Substituir, função por função, os filtros `eq("user_id", ...)` por
   `eq("workspace_id", ...)` nas tabelas do Grupo A. Funções de billing/retrato
   (Grupo B) permanecem por `user_id`.
3. `buildClaudeContext.ts` passa a receber `workspaceId` e a carregar
   questionários/arquétipos/relatório do workspace.

## 6. Frontend

1. **`WorkspaceContext`** ao lado do `AuthContext`: carrega workspaces do usuário
   (próprios + membros), mantém `activeWorkspace` (persistido em `localStorage`),
   expõe `switchWorkspace()`.
2. **Switcher de perfil** no header/sidebar (avatar + nome + badge do tipo de marca)
   com ação "Criar novo perfil" (limitado pelo plano — seção 8).
3. Todas as queries do app (Dashboard, EditorialPage, Report, questionários, histórico,
   assistente) trocam `eq("user_id", user.id)` por
   `eq("workspace_id", activeWorkspace.id)`.
4. Fluxo de criação de perfil: nome + tipo de marca (pessoal/institucional) + @ do
   Instagram → cai no funil de questionários zerado daquele workspace.
5. Páginas de conta, plano e retratos ficam fora do escopo do switcher (são do usuário).

## 7. Linha editorial pessoal × institucional

Com `workspaces.brand_type` no lugar, a bifurcação é de conteúdo, não de estrutura:

- **Questionários:** o funil é o mesmo (arquétipos → diagnóstico → complementar), mas o
  enquadramento muda por tipo. Institucional: perguntas de arquétipo formuladas para a
  marca ("como a marca se comporta…"), diagnóstico com campos de missão/valores/equipe,
  e o "questionário pessoal" vira "voz da marca" (tom, bastidores, quem aparece).
  Implementação: variantes de copy/campos condicionais por `brand_type`, mantendo as
  mesmas tabelas.
- **Prompts (edge functions):** `process-report-generation-job`, `generate-content-week`,
  `generate-sales-stories`, `assistant-chat` e `analyze-instagram` recebem o
  `brand_type` no contexto e trocam a linha de sistema — marca pessoal: autoridade,
  história pessoal, rosto, opinião; institucional: prova social, time, método, casos,
  CTA institucional — inclusive proporções de formatos/pilares diferentes na semana
  editorial.
- **Relatório:** seções condicionais (ex.: "arquétipo da marca" no lugar de "seu
  arquétipo").

## 8. Billing (decisão de produto embutida na proposta)

**Proposta v1 (mínimo impacto no Stripe):** créditos e assinatura continuam **por
usuário** (nada muda em `subscriptions`, `user_balances`, `stripe-webhook`). O plano
ganha um campo novo:

```sql
ALTER TABLE public.plans ADD COLUMN max_workspaces integer NOT NULL DEFAULT 1;
```

- Planos atuais: `max_workspaces = 1` (comportamento idêntico ao de hoje).
- Novos planos "Multi/Pro/Agência": 2, 5, 10 perfis, com preço maior e mais
  `weekly_cycles`/créditos, já que os créditos são consumidos pelo conjunto de perfis.
- Criação de workspace valida `count(workspaces where owner_id) < plan.max_workspaces`
  (checagem na edge function + trigger de defesa no banco).
- Ser **membro convidado** de workspace alheio não consome limite do convidado — o
  limite e os créditos são sempre do **dono** do workspace.

Alternativa (v2, se o modelo de agência crescer): créditos por workspace com
add-on de "perfil adicional" no Stripe. Fica fora da v1 por complexidade de webhook.

## 9. Fases de entrega

| Fase | Entrega | Conteúdo | Situação (03/10/2026) |
|------|---------|----------|-----------------------|
| 1 | Fundação | Migrações expand + backfill, `handle_new_user`, helper de workspace nas edge functions (sempre resolvendo o default) — **nenhuma mudança visível** | Feita (17/07) |
| 2 | Multi-perfil próprio | WorkspaceContext + switcher + criação de perfil com `brand_type`, `max_workspaces` nos planos, queries por workspace, RLS nova | Feita (até 23/08); RLS nova substituída pela decisão da seção 0.2 |
| 3 | Editorial por tipo | Variantes de questionário e prompts por `brand_type`, relatório condicional | Feita (18/07 a 12/08) |
| 4 | Colaboração | Convites (`workspace_members` UI), papéis editor/viewer, e-mails — caso social media/gestor de tráfego completo | Feita (24 e 25/08), convite por link |
| — | Contract | `NOT NULL`, constraints finais, remoção de fallbacks | **Pendente** (seção 0.3) |

**Ordem decidida (17/07/2026)**: Fase 1 → **Fase 3 antecipada** (editorial por tipo de
marca — o perfil da marca Posiciona e o pitch clínica/empresa destravam primeiro) →
Fase 2 → Fase 4. A fundação (Fase 1) serve a todas. Preços, tiers e extras dos planos
multi: ver `docs/precos-planos-e-parceria.md`.

## 10. Decisões (originalmente em aberto)

1. **Preço e limites dos planos multi-perfil**: decidido. Dupla (2), Multi (4) e
   Agência (10), com créditos compartilhados escalando por perfil (seção 0.1).
2. **Convites na v1 ou v2**: entregues como Fase 4, depois do multi-perfil, com
   escopo de editor restrito (seção 0.2).
3. **Retratos de marca**: continuam por usuário (Grupo B); planos multi compram packs
   extras pelo mesmo preço do Autoridade Total. Retratos de vários membros de uma
   equipe institucional continuam fora do escopo.
4. **Arquétipos do institucional**: a marca responde do zero, com bateria própria de
   36 perguntas. A opção de importar os arquétipos pessoais do dono como inspiração
   no prompt não foi implementada.
