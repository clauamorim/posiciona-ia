## Plano consolidado — Retratos: UI, fidelidade ao override, resolução real e variedade de poses

### 1. Card "Estúdio pronto" — UI
**Arquivo:** `src/pages/PortraitGenerator.tsx`
- Adicionar `created_at` à query de `portrait_trainings`.
- Substituir badge `USR{hash}` (`trigger_word`) por `Treinado em {dd/MM/yyyy}` formatado com `date-fns/format` + `ptBR`.

### 2. Modal "Personalizar figurinos" — aviso D1
**Arquivo:** `src/pages/PortraitGenerator.tsx`
- Adicionar nota discreta no topo do modal de override (ícone `Info` + texto `text-xs text-muted-foreground`):
  > *"O Look 1 é um close-up (rosto e ombros). Para vestidos, decotes ou peças de corpo inteiro, use os Looks 2 e 3."*

### 3. Exibir figurino aplicado abaixo de cada retrato
**Arquivos:** `src/pages/PortraitGenerator.tsx`, `src/lib/portraitFashion.ts` (novo), `supabase/functions/generate-portrait/index.ts`
- Backend passa a retornar `outfits: string[]` (em inglês) no payload, junto com `portraits` e `backgrounds`.
- Criar `src/lib/portraitFashion.ts` com helper `enToPtFashion(en: string)` — dicionário inverso simples para exibir em PT.
- Renderizar abaixo de cada imagem em `text-xs text-muted-foreground italic`.

### 4. Fidelidade ao override de figurino
**Arquivos:** `supabase/functions/_shared/portraitPrompts.ts`, `supabase/functions/generate-portrait/index.ts`
- **Expandir dicionário PT→EN** em `translateFashion`: vestido, seda, algodão, linho, tricô, malha, decote, alça, manga curta, sem mangas, roupa de academia, legging, top esportivo, moletom, vestido longo, vestido midi, salto, bordô, caramelo, creme, nude, terracota, etc.
- **Quando há override do usuário** (passar flag para `callFluxLora`):
  - `lora_scale`: 0.95 → **0.80** (reduz viés de business attire).
  - Wrap do outfit no prompt: `(outfit:1.4)` → `(outfit:1.8)`.
- **Negativos semânticos dinâmicos**:
  - Se override contém `dress|vestido|gown|silk`: adicionar `blazer, suit jacket, business suit, turtleneck, long sleeves, formal shirt, tie` ao negative.
  - Se contém `athletic|academia|legging|sportswear`: adicionar `formal wear, blazer, suit, dress shirt`.

### 5. Resolução real 1792×2304 (fix do 429)
**Arquivo:** `supabase/functions/generate-portrait/index.ts`
- Substituir `Promise.allSettled` da etapa de upscale por **loop sequencial**.
- Delay de **11s** entre upscales + retry com backoff de **30s** em caso de 429.
- Logs detalhados (latência + status) para validação.

### 6. Variedade de poses por categoria gestual
**Arquivos:** `supabase/functions/_shared/portraitPrompts.ts`, `supabase/functions/generate-portrait/index.ts`
- Reestruturar `HAND_POSE_POOLS` em **categorias gestuais** por família-arquétipo: `pocket`, `crossed`, `lapel`, `relaxed`, `gesture`.
- Expandir cada família de ~6 para ~10 poses no total.
- **Look 0** (close-up): `handPose: null` (não consome do pool).
- **Looks 1 e 2**: seleção obrigatoriamente de **categorias diferentes**.
- Manter memória curta `used_hand_poses` para evitar repetição entre gerações.

### Sem mudanças
- Banco de dados, storage, créditos, fluxo de treinamento, schema das tabelas.

### Arquivos editados/criados
- `src/pages/PortraitGenerator.tsx`
- `src/lib/portraitFashion.ts` (novo)
- `supabase/functions/_shared/portraitPrompts.ts`
- `supabase/functions/generate-portrait/index.ts`