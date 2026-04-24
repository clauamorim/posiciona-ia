# Plano: Traduzir mensagens e melhorar diagnóstico do erro "+7 dias"

## Contexto

Ao clicar em **"+7 dias"** para gerar um novo ciclo de conteúdo, aparece a mensagem genérica **"Erro ao gerar conteúdo"**. Essa mensagem não diz o que de fato aconteceu (timeout da IA, sessão dessincronizada, JSON inválido, etc.), o que dificulta o diagnóstico para o usuário.

A causa provável é que a edge function `generate-content-week` falha em uma de duas situações:
1. O Gemini retorna resposta vazia ou fora do formato esperado nas duas tentativas (principal + retry).
2. A sessão local do navegador está dessincronizada com o servidor após mudanças recentes na função.

Hoje todos os erros são exibidos no frontend como uma string fixa em inglês internalizada (`"Erro ao gerar conteúdo."`), ignorando o `error` específico que a edge function devolve.

---

## Mudanças propostas (todas em português)

### 1. `supabase/functions/generate-content-week/index.ts`

- **Validar a resposta do Gemini** antes de tentar fazer `JSON.parse`. Se vier vazia ou sem o campo de texto esperado, retornar:
  - HTTP **502** com `{ error: "A IA demorou para responder. Tente novamente em alguns segundos." }`
- Se as **duas tentativas** (geração + retry anti-vazamento) falharem em produzir JSON válido, retornar:
  - HTTP **502** com `{ error: "Não foi possível gerar a semana agora. Tente novamente." }`
- Garantir que toda mensagem `error` retornada esteja **em português**, sem termos técnicos.

### 2. `supabase/functions/regenerate-single-post/index.ts`

- Aplicar o mesmo padrão: validar resposta da IA e devolver mensagens claras em português (`"A IA demorou para responder..."`, `"Não foi possível regenerar este post agora..."`).

### 3. `src/pages/EditorialPage.tsx`

- Atualizar `ensureFreshSession` para chamar `supabase.auth.refreshSession()` explicitamente antes de invocar qualquer edge function, garantindo que o token local esteja sincronizado com o login mais recente.
- Trocar os toasts de erro genéricos pelo conteúdo real do campo `error` devolvido pela edge function (com fallback em português caso não venha mensagem):
  - Geração de semana: usar `data?.error ?? "Não foi possível gerar a semana. Tente novamente."`
  - Regeneração de post: usar `data?.error ?? "Não foi possível regenerar este post. Tente novamente."`
  - Atualização gratuita: usar `data?.error ?? "Não foi possível atualizar a semana. Tente novamente."`
- Garantir que o título do toast também esteja em português ("Erro na geração", "Erro ao regenerar post", "Erro ao atualizar semana").

### 4. Verificação rápida

Após o deploy, ao clicar em "+7 dias":
- Se houver problema de sessão, o refresh automático resolve sem mostrar erro.
- Se a IA falhar, o usuário verá uma mensagem clara em português indicando que deve tentar novamente, em vez do genérico "Erro ao gerar conteúdo".

---

## Arquivos editados

- `supabase/functions/generate-content-week/index.ts`
- `supabase/functions/regenerate-single-post/index.ts`
- `src/pages/EditorialPage.tsx`

## Deploy

Redeploy de `generate-content-week` e `regenerate-single-post`.
