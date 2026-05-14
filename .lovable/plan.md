## Objetivo

Em `supabase/functions/process-content-generation-job/index.ts`, na função `buildFeedSystemPrompt` (linhas 97–104), substituir as subseções **A) Gancho**, **B) Posicionamento** e **C) StoryBrand interno** por uma **distribuição fixa e obrigatória de 4 tipos de post** (Educacional, Desmistificação, Posicionamento, Análise/Caso).

Subseções **D (carrossel)**, **E (bastidor)** e **F (profundidade)** permanecem intactas. Nenhum outro arquivo é tocado.

## Mudança exata

**Remover (linhas 97–104):**
```
ESTRATÉGIA DE COPY (OBRIGATÓRIA):
A) Gancho específico do nicho ...
B) Posicionamento (Obviously Awesome) ...
C) StoryBrand interno ...
```

**Inserir no lugar:**

```
ESTRATÉGIA DE COPY (OBRIGATÓRIA) — DISTRIBUIÇÃO FIXA DOS 4 POSTS:
Cada um dos 4 posts da semana TEM UM TIPO FIXO E OBRIGATÓRIO. Não invente outros tipos. Não repita tipo.

POST 1 — EDUCACIONAL: tutorial ou passo a passo prático.
Estrutura: problema concreto → passos numerados → resultado esperado.
SEM storytelling pessoal. SEM abrir com "você sabia que".

POST 2 — DESMISTIFICAÇÃO: escolha uma crença errada comum no nicho e refute com raciocínio sólido ou dado observável.
Estrutura: mito declarado → por que as pessoas acreditam → por que está errado → o que é verdade.

POST 3 — POSICIONAMENTO: evidencie categoria + o que a marca NÃO é + para quem especificamente é.
Estrutura: alternativa que o público usaria sem esta solução → por que essa alternativa é insuficiente → o que torna esta abordagem diferente → perfil exato do cliente ideal.

POST 4 — ANÁLISE DE MERCADO OU CASO: se houver tendência relevante no bloco TENDÊNCIAS, use-a. Se não houver, use mini-caso hipotético com estrutura situação → decisão → resultado.

REGRAS DE GANCHO (mantidas): primeira frase de toda caption e slide 1 de carrossel = detalhe concreto, número, cena, dado contraintuitivo ou pergunta inesperada — específicos para o NICHO. PROIBIDO abrir com: "Você sabia que…", "5 dicas para…", "A importância de…", "Vamos falar sobre…", "Hoje vou te contar…", "Já parou para pensar…", "Imagine que…", "Você já se perguntou…".

LIMITE PESSOAL: máximo 1 post pessoal (is_personal=true) por semana, e APENAS se o pilar "bastidor" estiver sub-representado (ver bloco ROTAÇÃO DE PILARES).

PROIBIDO: dois posts do mesmo tipo na mesma semana.
PROIBIDO: post de POSICIONAMENTO e post de DESMISTIFICAÇÃO com o mesmo tema central.
```

## Fora de escopo

- Subseções D, E, F permanecem como estão.
- Distribuição de formatos, regras de card_copy, checklist final, output JSON, mapeamento de `pillar` — tudo inalterado.
- Nenhuma mudança no prompt de Stories nem em outros arquivos.
