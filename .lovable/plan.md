

## Diagnóstico

Investiguei o banco e encontrei o problema real:

1. **Print 2 (relatório como JSON cru com ` ```json `)**: o registro desse usuário foi salvo no Supabase com `content` do tipo **string** literal `"```json\n{...}\n```"` em vez de objeto JSON. Isso aconteceu porque o regex de limpeza no edge function `generate-report` falhou em remover o cerca de markdown, então o `JSON.parse` caiu no `catch` e gravou o texto cru.
2. **Print 1 (Narrativa da Marca vazia)**: é consequência direta — como `parseReportContent` não consegue extrair o objeto, `hasStorybrand` vira `false` e a página mostra empty state.

Outros 7 relatórios no banco foram salvos corretamente como `object`. Esse é um bug intermitente que reaparece quando a IA decide envelopar a resposta em fence apesar das instruções.

## Solução em 3 camadas

### 1. Edge function `generate-report` — parsing robusto

Substituir o regex frágil atual:
```ts
const cleaned = rawContent.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
reportContent = JSON.parse(cleaned);
```

Por uma rotina de extração em cascata:
- Tenta `JSON.parse(rawContent)` direto.
- Se falhar, busca bloco entre ```` ```json ... ``` ```` (regex `/```(?:json)?\s*([\s\S]*?)\s*```/i`).
- Se falhar, recorta entre primeira `{` e última `}`.
- Em cada tentativa, faz `JSON.parse` e valida que tem pelo menos `archetypes` ou `storybrand`.
- Só salva como string crua **em último caso**, e nesse cenário **retorna 502** com erro claro (`"AI returned malformed JSON"`) em vez de salvar lixo no banco. Assim o front mostra mensagem "Erro ao gerar, tente regenerar" em vez de exibir JSON cru.

Aplicar a mesma rotina em `generate-content-week` e `regenerate-single-post` (mesmo bug latente).

### 2. Hardening do prompt

Reforçar a primeira linha do system prompt:
> **CRÍTICO:** Sua resposta deve começar com `{` e terminar com `}`. NÃO use ``` ``` ``` em hipótese alguma. NÃO escreva nenhum texto antes ou depois do JSON. Se você adicionar markdown fences, o sistema irá rejeitar a resposta.

Reduz a frequência do problema na origem.

### 3. Limpeza do registro corrompido + recuperação no front

- **Migração corretiva**: rodar UPDATE pontual no relatório `3ebfdae8...` para extrair o JSON de dentro da string e regravar como objeto. Vou inspecionar o conteúdo, fazer parse manual e executar a migração via tool de banco.
- **Reforço no `reportParser.ts`**: melhorar `extractJsonCandidates` para tolerar fences seguidas de whitespace/newlines mais agressivamente e tentar reparar o JSON (remover vírgulas finais antes de `}` ou `]`, que é o erro típico de Gemini).

## Arquivos afetados

- `supabase/functions/generate-report/index.ts` — parsing robusto + prompt hardening
- `supabase/functions/generate-content-week/index.ts` — mesmo parsing robusto
- `supabase/functions/regenerate-single-post/index.ts` — mesmo parsing robusto
- `src/lib/reportParser.ts` — extração tolerante + reparo de JSON
- Migração SQL: corrigir 1 registro existente no banco

## Resultado esperado

- Relatório do usuário do print volta a renderizar normalmente (Narrativa da Marca + todas as seções) após a migração corretiva.
- Próximas gerações ficam blindadas: 3 níveis de fallback para parsing, e se tudo falhar o front mostra "Erro ao gerar" claro em vez de JSON cru.
- Prompt mais agressivo reduz incidência do problema.

## Fora do escopo

- Reescrever a UI da página Report — ela está OK, o problema é de dados.
- Mudar de Gemini para outro modelo — o bug é resolvível com parsing defensivo.

