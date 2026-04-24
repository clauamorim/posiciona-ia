## Problema

Ao clicar em **"Atualizar semana (grátis)"** o app mostra:
> Erro ao atualizar semana — Failed to send a request to the Edge Function

A edge function `generate-content-week` está deployada e responde ao preflight `OPTIONS` com 200, mas a chamada `POST` real nunca chega ao backend (não aparece nos logs HTTP).

## Causa

O `@supabase/supabase-js` foi atualizado para a versão **2.104.1** e passou a enviar um header novo no request: **`x-supabase-api-version`**. Esse header **não está listado** em `Access-Control-Allow-Headers` no `supabase/functions/_shared/cors.ts`.

Quando o navegador detecta que o servidor não permite explicitamente um header que o cliente quer enviar, ele bloqueia o request **antes de sair**, e o `fetch` rejeita com `TypeError`. O SDK traduz esse erro como “Failed to send a request to the Edge Function”. É por isso que vemos apenas o `OPTIONS 200` nos logs — o `POST` é abortado pelo browser.

Esse problema afeta **todas as edge functions do projeto** (regenerar semana, gerar relatório, gerar retrato, etc.), não só a atualização gratuita de semana.

## Mudança

**`supabase/functions/_shared/cors.ts`** — adicionar `x-supabase-api-version` à lista de headers permitidos e expor `Access-Control-Max-Age` para reduzir custo de preflight.

```ts
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
```

Como todas as edge functions importam `corsHeaders` desse arquivo único, a mudança propaga automaticamente para o projeto inteiro após o redeploy.

## Redeploy

Como a mudança só recompila quando a função é deployada de novo, vou redeployar todas as edge functions ativas para garantir que peguem o novo CORS:

`generate-content-week`, `regenerate-single-post`, `generate-report`, `generate-portrait`, `portrait-train`, `portrait-fix-weights`, `portrait-pack-checkout`, `analyze-instagram`, `fetch-post-image`, `firecrawl-scrape`, `extras-checkout`, `upgrade-checkout`, `stripe-checkout`, `remove-background`, `admin-manage-user`.

(Não tocaremos em `stripe-webhook` e `portrait-webhook` pois são chamados por servidores externos, não pelo browser.)

## Resultado esperado

- "Atualizar semana (grátis)" volta a chamar a função normalmente.
- O mesmo erro deixa de aparecer em qualquer outra ação do app.
- Nada mais muda: lógica, créditos, prompts, UI permanecem idênticos.
