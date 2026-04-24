# Plano: Linha Editorial sem vazamento de framework

## Objetivos

1. Garantir que **termos do StoryBrand e meta-linguagem de framework** nunca apareçam nos posts (theme, caption, card_copy, cta, script).
2. Restringir os PDFs enviados à LLM (na **análise de Instagram** e na **geração editorial**) para apenas três: **StoryBrand**, **Made to Stick** e **Obviously Awesome**.
3. Na regeneração de **um único post**, **não enviar a descrição/legenda** dos posts vizinhos para a LLM — apenas títulos curtos para evitar repetição, sem contaminar a saída.

---

## 1. Restringir PDFs de referência enviados à LLM

Hoje as edge functions baixam até 5 PDFs ativos da tabela `reference_documents`, sem filtrar nome. Vamos filtrar por nome de arquivo (case-insensitive, ignorando acentos/underscores).

**Edge functions afetadas:**
- `supabase/functions/generate-content-week/index.ts`
- `supabase/functions/regenerate-single-post/index.ts`
- `supabase/functions/analyze-instagram/index.ts`

**O que muda em cada uma:**
- A função `fetchReferencePdfs()` passa a aceitar um **whitelist** de nomes normalizados.
- Para essas três funções, a whitelist será: `["storybrand", "madetostick", "obviouslyawesome"]`.
- Normalização: lowercase, sem acentos, sem espaços, sem `_` e sem `-`. Assim "Made_to_Stick.pdf", "made-to-stick.pdf" e "Made To Stick.pdf" todos casam.
- Se nenhum dos três PDFs whitelistados estiver ativo, a função segue funcionando normalmente, apenas sem PDFs (a sanitização e os prompts continuam fazendo o trabalho).

**Não muda:**
- `generate-report/index.ts` continua usando todos os PDFs ativos (precisa de arquétipos e psicologia das cores).

---

## 2. Eliminar termos do StoryBrand nos posts

Diagnóstico: a IA não está mais escrevendo prefixos como "Problema Externo:" (já cobertos pelo sanitizer atual), mas está embutindo **meta-narrativa** dentro do texto, ex.: "A marca, atuando como guia do herói, oferece o plano…". Esse padrão escapa do filtro atual porque não é um rótulo no início da string.

**Mudanças em `supabase/functions/_shared/editorialSanitize.ts`:**

a) **Expandir `SUSPICIOUS_PATTERNS`** com frases inteiras de meta-narrativa:
   - `\b(o\s+)?her[óo]i\b` (em qualquer posição, não só prefixo)
   - `\bguia\s+(da|do)\s+her[óo]i\b`
   - `\bplano\s+de\s+(3|tr[êe]s)\s+passos\b`
   - `\bfracasso\s+(iminente|potencial)\b`
   - `\bjornada\s+do\s+her[óo]i\b`
   - `\b(a\s+)?marca\s+(como|atuando\s+como)\s+guia\b`
   - `\bproblema\s+(externo|interno|filos[óo]fico)\b` (já existe — manter)
   - `\bcategoria\s+(de\s+mercado|cognitiva)\b`
   - `\bprincipios?\s+succes\b`

b) **Nova função `containsFrameworkPhrases(text)`** que retorna true se qualquer um desses padrões aparecer no meio do texto, não apenas como prefixo.

c) **Atualizar `countFrameworkLeaks`** para também invocar `containsFrameworkPhrases`. Isso aumenta a sensibilidade do retry automático que já existe nas duas funções de geração — quando vazamento for detectado, o segundo passe com prompt mais estrito é disparado.

**Mudanças nos prompts de `generate-content-week` e `regenerate-single-post`:**

- Adicionar bloco explícito de exemplos **ERRADO → CERTO** cobrindo meta-narrativa (não só rótulos), por exemplo:
  - ERRADO: "Como guia, mostramos ao herói o plano para superar o problema interno."
  - CERTO: "Em 3 passos, sua agenda da semana sai do caos para um sistema previsível."
- Reforçar: *"Nunca descreva a narrativa em termos teóricos. Escreva a copy final, como se o leitor nunca tivesse ouvido falar de framework."*

---

## 3. Regeneração de um único post: não enviar descrição

Hoje, ao clicar "Regenerar este post", o frontend monta `existingPosts = allWeeks.flat()` e a edge function transforma em:
```
- {theme}: {caption.substring(0, 80)}
```

Isso envia **trechos das legendas** de TODOS os posts existentes, o que:
- Aumenta tokens.
- Pode poluir a saída se a IA decidir "ecoar" o estilo dos posts antigos.
- Não é necessário para evitar repetição — basta o tema.

**Mudança em `supabase/functions/regenerate-single-post/index.ts`:**
- Linha 76: trocar
  ```ts
  const existingTitles = (existingPosts || []).map((p: any) => `- ${p.theme}: ${p.caption?.substring(0, 80)}`).join("\n");
  ```
  por
  ```ts
  const existingTitles = (existingPosts || [])
    .map((p: any) => p?.theme)
    .filter((t: string) => typeof t === "string" && t.trim().length > 0)
    .map((t: string) => `- ${t}`)
    .join("\n");
  ```
- Resultado: a LLM recebe apenas a lista de **temas já usados** para evitar repetição, sem ver caption, card_copy nem script dos vizinhos.

**Mudança em `src/pages/EditorialPage.tsx`** (otimização opcional, mas recomendada):
- Antes de enviar `existingPosts`, mapear para `[{ theme }]` apenas, reduzindo payload da requisição.

---

## 4. Bump de versão do gerador

Para que os posts atuais (versão `2026-04-24-v3`) fiquem marcados como desatualizados e o usuário possa regenerar **gratuitamente** com as melhorias acima:

- `src/lib/generatorVersion.ts` → `EDITORIAL_GENERATOR_VERSION = "2026-04-24-v4"`
- `supabase/functions/_shared/generatorVersion.ts` → mesma string
- Adicionar entrada no histórico do comentário JSDoc descrevendo: filtro de PDFs, sanitização anti meta-narrativa, regeneração sem caption dos vizinhos.

Após o deploy, o botão "Atualizar (grátis)" aparecerá nos posts antigos e permitirá refazê-los sem consumir créditos.

---

## Arquivos editados

- `supabase/functions/_shared/editorialSanitize.ts` — novos padrões e função `containsFrameworkPhrases`
- `supabase/functions/_shared/generatorVersion.ts` — bump v4
- `supabase/functions/generate-content-week/index.ts` — whitelist de PDFs + reforço de prompt
- `supabase/functions/regenerate-single-post/index.ts` — whitelist + prompt + remover caption dos vizinhos
- `supabase/functions/analyze-instagram/index.ts` — whitelist de PDFs
- `src/lib/generatorVersion.ts` — bump v4 (espelho)
- `src/pages/EditorialPage.tsx` — enviar apenas `theme` em `existingPosts` na regeneração

## Deploy

Redeploy das três edge functions após as edições: `generate-content-week`, `regenerate-single-post`, `analyze-instagram`.
