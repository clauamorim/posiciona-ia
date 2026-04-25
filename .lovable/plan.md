## Eliminar 429 do Claude removendo PDFs de todas as chamadas

### Causa raiz confirmada
Logs mostram limite duro de **30k tokens/min** na organização Anthropic. Os PDFs (~50-100k tokens só de StoryBrand) estouram esse limite numa única chamada — retry exponencial não resolve, porque o problema é o **tamanho da requisição**, não congestionamento momentâneo.

Solução: tirar os PDFs de **todas** as chamadas Claude e injetar **resumos densos** dos frameworks no system prompt. Eu escrevo os resumos direto no código — você não precisa fazer nada.

---

### 1. `supabase/functions/generate-report/index.ts` (Estratégia)
- Remover import e chamada de `fetchStrategyReferencePdfs()`.
- Remover `pdfs: pdfParts` da chamada `callClaude(...)`.
- Estender o `systemPrompt` com um bloco textual **"Framework BrandScript (StoryBrand) — referência interna"** descrevendo os 7 elementos (Personagem/Herói, Problemas externo+interno+filosófico, Guia, Plano, CTA, Sucesso, Fracasso) com diretrizes de aplicação. ~600 tokens.

### 2. `supabase/functions/process-content-generation-job/index.ts` (Linha Editorial — geração de semanas)
- Remover import e chamada de `fetchEditorialReferencePdfs()`.
- Remover `pdfs` da chamada `callClaude(...)` (2 ocorrências: principal + retry).
- Trocar a frase atual *"Você domina e aplica de forma OBRIGATÓRIA três referências (anexadas em PDF como contexto)"* por blocos textuais densos:
  - **StoryBrand** — narrativa Herói→Problema→Guia→Plano→CTA→Sucesso/Fracasso, referenciar que o BrandScript específico da marca já está no contexto via `renderStorybrandBlock`.
  - **SUCCESs (Made to Stick)** — Simple, Unexpected, Concrete, Credible, Emotional, Stories — com diretriz prática de aplicação por post.
  - **Positioning (Obviously Awesome / April Dunford)** — 5 componentes (alternativas competitivas, atributos únicos, valor desses atributos, melhor cliente, categoria de mercado) — com diretriz de aplicação ao copy.
  Total: ~900 tokens adicionais (vs ~50-100k de PDFs).

### 3. `supabase/functions/regenerate-single-post/index.ts` (Regenerar post individual)
- Mesmo tratamento da #2: remover `fetchEditorialReferencePdfs()` e `pdfs` da chamada (2 ocorrências: principal + stricter retry).
- Usar os mesmos blocos textuais StoryBrand+SUCCESs+Positioning (extrair pra constante compartilhada em `_shared/buildClaudeContext.ts` pra evitar duplicação — função `renderEditorialFrameworks()`).

### 4. `supabase/functions/_shared/buildClaudeContext.ts`
- Adicionar exports:
  - `renderBrandscriptFramework(): string` — bloco textual usado em `generate-report`.
  - `renderEditorialFrameworks(): string` — bloco StoryBrand+SUCCESs+Positioning usado em `process-content-generation-job` e `regenerate-single-post`.
- Marcar `fetchStrategyReferencePdfs` e `fetchEditorialReferencePdfs` como `@deprecated` (manter código para reuso futuro caso o tier Anthropic suba).

### 5. `analyze-instagram` (verificação)
- Esta função usa Lovable AI Gateway (Gemini), não Claude — **não precisa alterar**. Confirmado nos logs/imports: não chama `callClaude`.

### 6. Memória
- Atualizar `mem://logica/geracao-conteudo-editorial` refletindo que os frameworks agora são entregues como resumo textual no system prompt (PDFs cadastrados no admin permanecem inativos, prontos para reativação caso o tier mude).

### 7. Deploy
- Redeploy de `generate-report`, `process-content-generation-job` e `regenerate-single-post`.

---

### O que **não** muda
- Você **não precisa escrever resumo nem cadastrar PDF novo**. Eu escrevo os resumos direto no código baseado no conhecimento canônico dos três livros.
- PDFs já cadastrados no admin (`reference_documents`) **continuam lá**, só não são mais enviados nas chamadas. Reversível a qualquer momento.
- Respostas dos questionários, relatórios anteriores e qualquer dado salvo permanecem **intactos**.
- Tom de voz, contexto pessoal, StoryBrand renderizado da marca — tudo segue chegando ao Claude normalmente.

### Impacto esperado
- Tokens por requisição: de ~50-100k → ~5-8k. Folga grande dentro do limite de 30k/min.
- Custo por geração cai junto (menos tokens de input).
- Qualidade preservada: frameworks são canônicos e bem conhecidos pelo Claude; resumos densos no system prompt costumam dar **mais controle** que PDFs.