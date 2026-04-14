

# Plano: Melhorias na Linha Editorial, Arquétipos, Figurino, Símbolos e Retratos

São 10 alterações agrupadas em 5 áreas. Todas podem ser feitas sem mudanças no banco de dados.

---

## 1. Remover campo "roteiro" para posts e carrosséis

**Problema**: Posts e carrosséis não precisam de roteiro (só Reels/Stories precisam).

**Alterações**:
- `supabase/functions/generate-report/index.ts` — Na regra do campo `script`, especificar: "Para 'post' e 'carrossel', o campo script deve ser string vazia"
- `supabase/functions/generate-content-week/index.ts` — Mesma alteração no prompt
- `supabase/functions/regenerate-single-post/index.ts` — Mesma alteração no prompt
- `src/pages/EditorialPage.tsx` — Não exibir "Ver roteiro" quando `format` é `post` ou `carrossel`
- PDF export na mesma página — Não incluir roteiro para esses formatos

## 2. Aprofundar linha editorial + usar PDFs e StoryBrand

**Problema**: As edge functions `generate-content-week` e `regenerate-single-post` NÃO usam os PDFs de referência nem o StoryBrand do relatório. Geram conteúdo genérico.

**Alterações**:
- `supabase/functions/generate-content-week/index.ts`:
  - Adicionar `fetchReferencePdfs()` (copiar de generate-report)
  - Receber e incluir `storybrand` e `tone_of_voice` do relatório no prompt
  - Enviar PDFs como context ao modelo
  - Enriquecer o prompt com tom de voz, StoryBrand, palavras a usar/evitar
  - Aumentar `max_tokens` para 8000
- `supabase/functions/regenerate-single-post/index.ts`:
  - Mesmas melhorias: PDFs + StoryBrand + tom de voz no prompt
- `src/pages/EditorialPage.tsx`:
  - Enviar `storybrand`, `tone_of_voice` do relatório junto na chamada das edge functions

## 3. Figurino mais completo + Mais símbolos por arquétipo

**Alterações em `supabase/functions/generate-report/index.ts`**:

**Figurino** — Expandir o schema JSON do figurino para incluir:
  - `looks_completos`: array de 3 looks completos (conjunto de peças + ocasião)
  - `texturas_tecidos`: array de tecidos/texturas recomendados
  - `estampas`: array de estampas recomendadas
  - Aumentar mínimos: 7 peças-chave, 4 sapatos, 5 acessórios
  - Adicionar regra no prompt para detalhar cada peça com cor e material

**Símbolos** — Expandir de 1 símbolo por arquétipo para 3:
  - Mudar schema de `simbolos.primary` ter 1 símbolo para ter array de 3 símbolos
  - Cada símbolo com: `simbolo`, `nome`, `significado`, `aplicacao`

**Alterações no frontend `src/pages/Report.tsx`**:
- Exibir novos campos do figurino (looks completos, texturas, estampas)
- Exibir múltiplos símbolos por arquétipo

## 4. Arquétipos — características, marcas e pessoas exemplares

**Alterações em `supabase/functions/generate-report/index.ts`**:
- Expandir schema de `archetypes` para incluir:
  - `characteristics`: array de 5-7 características-chave
  - `brands`: array de 3-5 marcas famosas que usam o arquétipo
  - `people`: array de 3-5 pessoas/personalidades do arquétipo

**Alterações em `src/pages/Report.tsx`**:
- Na seção de arquétipos, exibir características como badges
- Exibir lista de marcas e pessoas como exemplos

## 5. Renomear "Estilo Visual & Figurino" → "Estilo Visual"

**Alteração em `src/pages/Report.tsx`**:
- Linha 323: trocar `"Estilo Visual & Figurino"` → `"Estilo Visual"`

## 6. Usar Estilo Visual na geração de retratos + Corrigir textura/sorriso

**Alterações em `supabase/functions/generate-portrait/index.ts`**:
- Buscar `visual_identity.style` e `visual_identity.palette` do relatório e incluir no prompt (ex: "Brand visual style: {style}. Brand colors: {palette colors}")
- No bloco REALISM, adicionar: "Do NOT over-sharpen or add excessive skin texture. Keep skin smooth and natural — do NOT add wrinkles that are not visible in the reference photos."
- Adicionar regra: "EXPRESSION: Match the expression from the reference photos. If the person is NOT smiling showing teeth in ANY reference photo, do NOT generate a photo showing teeth."

---

## Resumo de arquivos afetados

| Arquivo | Alterações |
|---------|-----------|
| `supabase/functions/generate-report/index.ts` | Figurino expandido, símbolos múltiplos, arquétipos com características/marcas/pessoas |
| `supabase/functions/generate-content-week/index.ts` | PDFs + StoryBrand + tom de voz, sem roteiro para post/carrossel |
| `supabase/functions/regenerate-single-post/index.ts` | PDFs + StoryBrand + tom de voz, sem roteiro para post/carrossel |
| `supabase/functions/generate-portrait/index.ts` | Estilo visual no prompt, corrigir textura/nitidez, regra de sorriso |
| `src/pages/Report.tsx` | Renomear label, exibir figurino expandido, símbolos múltiplos, características/marcas/pessoas |
| `src/pages/EditorialPage.tsx` | Ocultar roteiro para post/carrossel, enviar StoryBrand/tom de voz |

**Nota**: As alterações nos prompts só afetarão relatórios/conteúdos gerados **a partir de agora**. Relatórios existentes continuarão exibindo normalmente (o frontend trata campos ausentes graciosamente).

