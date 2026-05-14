## Bug

Ao remover uma referência de retrato, o cliente chama:

```ts
supabase.functions.invoke(`portrait-references?id=${id}`, { method: "DELETE" });
```

`supabase.functions.invoke()` trata o primeiro argumento como **nome da função** e URL-encoda caracteres especiais. O `?` vira `%3F`, então a requisição é enviada para uma função inexistente `portrait-references%3Fid%3D...`, resultando em `Failed to send a request to the Edge Function`.

## Correção

Passar o `id` no **body** em vez de querystring, nas duas pontas.

### 1. `src/pages/PortraitGenerator.tsx` (função `removeReference`, ~linha 214–224)

Trocar:
```ts
const { error } = await supabase.functions.invoke(`portrait-references?id=${id}`, {
  method: "DELETE",
});
```

Por:
```ts
const { error } = await supabase.functions.invoke("portrait-references", {
  method: "DELETE",
  body: { id },
});
```

### 2. `supabase/functions/portrait-references/index.ts` (bloco `===== DELETE =====`, ~linha 198–200)

Trocar a leitura do id de querystring para body, com fallback para querystring (compatibilidade):

```ts
if (req.method === "DELETE") {
  let id = url.searchParams.get("id");
  if (!id) {
    try {
      const body = await req.json();
      id = body?.id ?? null;
    } catch { /* body vazio é ok */ }
  }
  if (!id) {
    return new Response(JSON.stringify({ error: "id obrigatório" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  // ...resto inalterado
}
```

Atualizar também o comentário do cabeçalho (linha 9) para refletir que `id` agora vai no body.

## Fora de escopo

- Lógica de soft delete, storage cleanup, RLS, GET/POST handlers — tudo intacto.
- Nenhuma migração de banco.
