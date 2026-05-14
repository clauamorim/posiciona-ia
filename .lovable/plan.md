## Objetivo
Eliminar repetição de templates retóricos e CTAs no feed editorial, detectados na comparação Semana 9 vs 10.

## Arquivo único
`supabase/functions/process-content-generation-job/index.ts`

## Mudança 1 — Expandir `FEED_POST_TYPES` com múltiplas estruturas por tipo
Substituir o array `FEED_POST_TYPES` (definido antes de `const FEED_DAYS = [1, 3, 5, 7];`) por uma versão com 4 estruturas alternativas de abertura para cada tipo:

- **EDUCACIONAL** — 4 opções (passos / como sem erro / N erros / o que pro faz antes); proíbe "você sabia que" e o fechamento "o processo que transforma expertise em presença reconhecida".
- **DESMISTIFICAÇÃO** — 4 opções de abertura; proíbe explicitamente "A crença de que X resolve Y".
- **POSICIONAMENTO** — 4 opções (comparação / perfil / não-encaixe / contraste); proíbe "[Marca] não é para quem X — é para quem Y".
- **ANÁLISE DE MERCADO OU CASO** — 4 opções (manchete + virada / caso + analogia / cronologia / contraste de reações); mantém regra de caso real nomeado.

Cada bloco instrui o LLM a escolher uma estrutura **diferente das usadas em semanas anteriores**.

## Mudança 2 — Bloco "FRASES E CTAs PROIBIDOS" no system prompt
Em `buildFeedSystemPrompt`, **antes** da seção `REGRAS DE GANCHO (mantidas):`, inserir bloco `🚫 FRASES E EXPRESSÕES PROIBIDAS` cobrindo:

- Aberturas proibidas (3 templates literais).
- Encerramentos proibidos (3 frases-clichê).
- Vocabulário saturado: máx. 1 uso na semana inteira (feed + stories) — "profissionais qualificados", "identidade de marca", "autoridade digital", "Instagram que não representa quem é".
- CTAs: "Me chame no direct com a palavra X" no máx. 1 dos 4 posts; outros 3 devem usar naturezas diferentes (pergunta / salvar / comentar / compartilhar com contexto / referência interna ao slide).
- Regra geral de cadência: se a frase parece "encaixar perfeitamente", provavelmente já foi usada — reescrever.

## Mudança 3 — Reforçar variedade no `feedUser`
Substituir a linha `Gere agora os 4 posts de feed para os dias ${FEED_DAYS.join(", ")}.` por um checklist de 4 passos antes da geração:
1. Ler temas anteriores e identificar templates já usados.
2. Escolher estrutura de abertura diferente para o tipo da vez.
3. Verificar nenhuma frase proibida.
4. Confirmar diversidade de naturezas de CTA entre os 4 posts.

Em seguida, manter a linha original `Gere agora os 4 posts de feed para os dias ...`.

## Validação
- `code--view` em `process-content-generation-job/index.ts` para confirmar nomes/posições exatas: `FEED_POST_TYPES`, `FEED_DAYS`, `buildFeedSystemPrompt`, `REGRAS DE GANCHO (mantidas)`, e a string `feedUser`.
- Deploy do `process-content-generation-job` após edições.

## Efeito esperado
- 4 estruturas por tipo × lista explícita de frases banidas × 5 modelos de CTA.
- LLM passa a ler `previousSummary` (já no contexto) e escolher estrutura diferente das semanas anteriores.
- Frases proibidas funcionam como "memória externa" forçando reformulação.
