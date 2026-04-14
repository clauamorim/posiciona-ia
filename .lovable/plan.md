

# Plano: 3 Melhorias — Editorial sem Arquétipos, Retratos com Nano Banana 2, Cobrança por Download

## 1. Linha Editorial baseada apenas no StoryBrand (sem arquétipos)

**Problema**: Os prompts de `generate-content-week` e `regenerate-single-post` usam arquétipos para guiar o conteúdo. O pedido é focar exclusivamente no StoryBrand, aprofundando os assuntos.

**Alterações**:

### `supabase/functions/generate-content-week/index.ts`
- Remover referências a arquétipos do `systemPrompt` e `userPrompt`
- Aprofundar a instrução de StoryBrand no prompt: cada post deve explorar uma faceta diferente do framework (herói, problema interno, externo, filosófico, plano, sucesso, fracasso)
- Manter tom de voz

### `supabase/functions/regenerate-single-post/index.ts`
- Remover `Arquétipo primário: ...` do `userPrompt`
- Reforçar StoryBrand como guia único do conteúdo

### `supabase/functions/generate-report/index.ts`
- Nas regras do campo "editorial", reforçar que a semana 1 deve ser guiada pelo StoryBrand gerado, não pelos arquétipos

### `src/pages/EditorialPage.tsx`
- Continuar enviando `storybrand` e `tone_of_voice` no body
- Remover envio de `archetypes` no body de `generate-content-week` (linhas 70-73)
- Remover envio de `archetypes` no body de `regenerate-single-post` (linha 116)

---

## 2. Melhorar qualidade dos retratos — Trocar para Nano Banana 2

**Problema**: Modelo atual (`google/gemini-3-pro-image-preview`) gera imagens genéricas sem respeitar as selfies. O modelo `google/gemini-3.1-flash-image-preview` (Nano Banana 2) tem melhor qualidade e velocidade.

**Alterações**:

### `supabase/functions/generate-portrait/index.ts`
- Trocar `model: "google/gemini-3-pro-image-preview"` por `model: "google/gemini-3.1-flash-image-preview"`
- Melhorar o prompt para enfatizar mais fortemente a fidelidade facial:
  - Adicionar instrução explícita: "This is an IMAGE EDITING task, NOT image generation. Transform the reference photo into a professional studio portrait while preserving the EXACT person."
  - Reforçar: "Do NOT create a new person. Do NOT approximate. The output must be the SAME person from the reference photos."
  - Reduzir contexto de marca no prompt (menos instruções de figurino/arquétipos competindo com a instrução de fidelidade facial)

---

## 3. Cobrar apenas pelos retratos que o usuário baixar (download = cobrança + histórico)

**Problema atual**: O crédito é consumido na geração, antes do usuário ver o resultado. O pedido é cobrar apenas quando o usuário fizer download — e só salvar no histórico as fotos baixadas.

**Alterações**:

### `supabase/functions/generate-portrait/index.ts`
- **Remover** a dedução de créditos (linhas 216-231)
- **Remover** o insert em `credit_logs`
- Continuar verificando se tem créditos (para não gerar se saldo = 0), mas não deduzir
- Retornar o retrato sem salvar no banco

### Nova edge function: `supabase/functions/confirm-portrait/index.ts`
- Recebe: `{ portrait: string (base64), style_index: number }`
- Verifica créditos do usuário
- Deduz 1 crédito (`portrait_credits_included` primeiro, depois `portrait_credits_extra`)
- Insere em `credit_logs`
- Insere em `portrait_generations`
- Retorna sucesso

### `src/pages/PortraitGenerator.tsx`
- Na geração (`handleGenerate`): **não** salvar no `portrait_generations` (remover linhas 172-177)
- No botão "Baixar Retrato": antes de iniciar o download, chamar `confirm-portrait` para cobrar e salvar
- Mostrar feedback: "Retrato salvo e crédito debitado"
- Se o usuário não baixar, nenhum crédito é consumido
- Atualizar saldo após confirmação (`refreshSubscription`)

---

## Resumo de arquivos

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/generate-content-week/index.ts` | Remover arquétipos, aprofundar StoryBrand |
| `supabase/functions/regenerate-single-post/index.ts` | Remover arquétipos, foco no StoryBrand |
| `supabase/functions/generate-report/index.ts` | Editorial guiado por StoryBrand |
| `src/pages/EditorialPage.tsx` | Não enviar arquétipos nas chamadas |
| `supabase/functions/generate-portrait/index.ts` | Trocar modelo, melhorar prompt, remover cobrança |
| `supabase/functions/confirm-portrait/index.ts` | **Nova** — cobrar e salvar no download |
| `src/pages/PortraitGenerator.tsx` | Cobrar no download, não na geração |

