# Plano: Fix exibição + Variedade de figurinos + Mãos seguras + Clarity Upscaler

## Diagnóstico do bug "retratos não aparecem no histórico nem no editor"
A coluna `portraits` (jsonb) hoje guarda **data URLs base64** das 3 imagens. Com 25 gerações × 3 imagens × ~1.1MB ≈ **~80MB** de payload por SELECT. O navegador trava/aborta silenciosamente o fetch — por isso o histórico fica vazio e o editor não consegue listar os retratos. **A causa raiz não é RLS nem rendering — é tamanho de payload.**

A solução estrutural é mover os PNGs para Storage e guardar apenas paths no banco.

---

## 1. Migração de armazenamento: base64 → Storage privado

### Novo bucket `portrait-outputs` (privado)
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('portrait-outputs', 'portrait-outputs', false);
```

Policies em `storage.objects`:
- `SELECT`: usuário autenticado pode ler arquivos onde `(storage.foldername(name))[1] = auth.uid()::text`
- `INSERT`: idem (mas na prática só a edge function via service_role grava)
- `DELETE`: idem (limpeza futura)

Estrutura de path: `portrait-outputs/{user_id}/{generation_id}/{look_index}.png`

### Edge function `generate-portrait/index.ts`
Após gerar (e tentar upscale), em vez de devolver data URL:
1. Faz upload do PNG ao bucket usando `service_role`
2. Insere em `portrait_generations.portraits` apenas o **path relativo** (string), não o data URL
3. Devolve ao front data URLs frescas (signedUrl 1h) só para exibição imediata

### Frontend — helper `src/lib/portraitUrl.ts`
```ts
export async function resolvePortraitUrl(value: string): Promise<string> {
  if (!value) return "";
  if (value.startsWith("data:") || value.startsWith("http")) return value; // legado
  const { data } = await supabase.storage.from("portrait-outputs").createSignedUrl(value, 3600);
  return data?.signedUrl ?? "";
}
```
Usado em `HistoryPage.tsx`, `PortraitGenerator.tsx` e `PostEditorPage.tsx` (galeria de retratos do usuário).

### Compatibilidade com 25 retratos legados (base64)
- O helper detecta `data:` no início e retorna como está → continuam aparecendo
- HistoryPage passa a fazer query com `.limit(12)` (últimas 12 gerações) + ordena por `created_at desc` → evita carregar os 80MB legados de uma vez
- Adiciona `.select("id, created_at, portraits, used_hand_poses, used_outfits")` explícito (sem `*`) para não trazer campos novos pesados acidentalmente

---

## 2. Variedade de figurinos — Híbrido (pool curado + override opcional)

### Novo arquivo `supabase/functions/_shared/outfitPool.ts`
- **Categorização de profissão** (`mapProfessionToCategory`): regex sobre `profile.profession` → uma de 9 categorias (`executive`, `creative`, `therapy`, `education`, `legal`, `beauty`, `tech`, `gastronomy`, `general`).
- **OUTFIT_POOLS**: matriz `família-arquétipo × categoria-profissional` → array de 8–12 figurinos premium em inglês com peças/cores/tecidos coerentes. Exemplos:
  - `authority × executive`: `tailored navy blazer with silk shell, neutral pearl earrings`, `charcoal pinstripe suit, crisp white shirt`...
  - `expressive × creative`: `oversized linen shirt, statement gold earrings`, `silk midi dress with leather belt`...
  - `nurturing × therapy`: `soft cream knit cardigan over ivory blouse`, `warm beige wrap dress`...
- Função `pickOutfits(family, category, recentlyUsed, count=3)`: filtra usados, embaralha, pega N.

### Migração: nova coluna
```sql
ALTER TABLE public.portrait_generations 
  ADD COLUMN IF NOT EXISTS used_outfits jsonb NOT NULL DEFAULT '[]'::jsonb;
```

### Lógica em `generate-portrait/index.ts`
- Lê `used_outfits` da última geração do usuário
- Se houver `outfit_overrides` no payload (do front), usa eles e ignora pool
- Senão, sorteia 3 do pool da combinação `família × categoria` filtrando os usados
- Após gerar, grava os 3 figurinos sorteados em `used_outfits`

### Override opcional na UI (`src/pages/PortraitGenerator.tsx`)
- Botão discreto **"Personalizar figurinos"** abre `Dialog` com 3 `Textarea` opcionais ("Look 1 / Look 2 / Look 3")
- Dica: *"Descreva em poucas palavras (ex: 'vestido midi vermelho com cinto fino', 'blazer bege oversized com calça alfaiataria preta')."*
- Persiste em `localStorage` por usuário (`portrait-outfit-overrides-{userId}`)
- Quando preenchido, envia no payload da edge function como `outfit_overrides: string[]`
- Edge function traduz PT→EN (já temos `translateOutfitPieces` em `_shared/portraitPrompts.ts`) e injeta no prompt

---

## 3. Mãos — framing misto por look

Em `_shared/portraitPrompts.ts` introduzo `FRAMING_VARIATIONS`:
- **Look 0 (Neutro — "à prova de erro")**: `head and shoulders portrait, framed at chest level, hands not visible` → 100% sem risco de dedos deformados
- **Look 1 (Claro)**: enquadramento `waist-up`, com pose sorteada do pool de mãos da família
- **Look 2 (Escuro)**: enquadramento `waist-up`, com pose **diferente** do pool

`STUDIO_NEGATIVE` ganha reforço apenas para looks 1 e 2:
```
extra fingers, bad fingers, deformed fingers, disfigured fingers, misshapen hands, six fingers, four fingers, fused fingers, bent broken fingers
```

Look 0 não recebe esses negativos (não há mãos no frame).

---

## 4. Resolução — Clarity Upscaler

Em `generate-portrait/index.ts`, substituir `nightmareai/real-esrgan` por **`philz1337x/clarity-upscaler`**:
- Versão pinada: `dfad41707589d68ecdccd1dfa600d55a208f9310748e44bfe35b4a6291453d5e`
- Parâmetros: `scale_factor: 2`, `dynamic: 6`, `creativity: 0.35`, `resemblance: 0.6`, `output_format: "png"`
- Resultado esperado: **~1792×2304 px** com rostos significativamente mais nítidos
- Polling até **90s** (Clarity é mais lento que ESRGAN, mas qualidade muito superior em rostos)
- **Logs verbosos**: `[upscale] start`, `[upscale] create-status=N`, `[upscale] poll attempt N status=X`, `[upscale] success/fallback latency=Xms`
- **Fallback resiliente**: se falhar (timeout/erro), faz upload da imagem original 1MP e segue
- Aplica nas 3 imagens em paralelo via `Promise.allSettled`

---

## 5. Auditoria & logs em `generate-portrait`
- Categoria de profissão detectada
- Pool de figurinos filtrado (size antes/depois da exclusão de recentes)
- Figurinos sorteados (ou origem: "override-usuario")
- Pose sorteada por look + framing
- Status do upscale por imagem
- Path final no Storage por imagem

---

## Arquivos afetados

**Criados:**
- `supabase/functions/_shared/outfitPool.ts` (pool curado + categorização de profissão)
- `src/lib/portraitUrl.ts` (resolve path → signedUrl com fallback para data URL legada)
- Migração: bucket `portrait-outputs` + policies + coluna `used_outfits`

**Editados:**
- `supabase/functions/_shared/portraitPrompts.ts` (FRAMING_VARIATIONS, integração outfit override, negative reforçado nos looks com mãos)
- `supabase/functions/generate-portrait/index.ts` (upload Storage, sorteio outfits, leitura de overrides, Clarity Upscaler, logs)
- `src/pages/PortraitGenerator.tsx` (dialog "Personalizar figurinos", localStorage, envio overrides, uso de `resolvePortraitUrl`)
- `src/pages/HistoryPage.tsx` (limit 12 + select explícito + `resolvePortraitUrl` no map)
- `src/pages/PostEditorPage.tsx` (uso de `resolvePortraitUrl` na galeria de retratos do usuário)

## Sem mudanças
- LoRA / treinamento (não retreina)
- Custo de créditos (continua 3 por geração)
- Estrutura de pacotes / Stripe
- Tabela `portrait_generations` (apenas adiciona coluna `used_outfits`)
- 25 retratos legados continuam visíveis (helper detecta `data:`)
