## Objetivo
Eliminar nova camada de repetição de templates/frases detectada nas Semanas 11-12 do editorial.

## Arquivo único
`supabase/functions/process-content-generation-job/index.ts`

---

### Mudança 1 — Expandir lista de templates proibidos

Na seção `🚫 FRASES E EXPRESSÕES PROIBIDAS` dentro de `buildFeedSystemPrompt`:

**A) Substituir a sub-seção "Aberturas proibidas"**

Substituir por:
```
Aberturas proibidas:
- "A crença de que [X] resolve [Y]" / "A crença de que [X] vai [verbo qualquer]" (qualquer variante de "A crença de que..." está banida)
- "O Posiciona não é para quem quer [X] — é para quem quer [Y]"
- "[Marca] não é para quem [...] — é para quem [...]"
- "Tem um tipo de profissional que [...]"
- "Todo mundo diz que [...]" (use no MÁXIMO 1x a cada 4 semanas)
```

**B) Adicionar nova sub-seção "Templates de TÍTULO banidos por saturação"**

Inserir imediatamente após "Aberturas proibidas":
```
Templates de TÍTULO (não apenas abertura) banidos por saturação:
- "Os [N] elementos que [...]" / "Os [N] passos para [...]" / "Os [N] erros que [...]" — use no MÁXIMO 1x a cada 3 semanas, e quando usar varie o substantivo (elementos, decisões, perguntas, sinais, gatilhos, ajustes)
- "O que o caso [X] revela sobre [Y] para profissionais liberais" — está banido como TEMPLATE. Para posts de ANÁLISE, varie a construção do título:
  • "[Evento real]: o que [grupo X] precisa entender agora"
  • "Em [ano], [empresa/pessoa] fez [decisão]. Veja o que isso muda para [nicho]"
  • "[Caso] aconteceu há [tempo]. Por que [grupo do leitor] deveria ter aprendido com isso"
  • "Quando [evento] aconteceu, [grupo A] reagiu de X jeito. Os que prosperaram fizeram Y"
- "Postar com [X] não resolve [Y]" / "[Ação] não resolve [problema]" — varie a construção
```

---

### Mudança 2 — Limitar menções da marca "Posiciona"

Na seção `🚫 FRASES E EXPRESSÕES PROIBIDAS` em `buildFeedSystemPrompt`, adicionar **logo após** a sub-seção anterior:

```
🏷️ ORÇAMENTO DE MENÇÃO DA MARCA (CRÍTICO):
A palavra "Posiciona" (nome da marca) só pode aparecer em:
- 1 POST de feed por semana — APENAS no post de tipo POSICIONAMENTO
- 1 STORY por semana — APENAS na story que espelha o post de POSICIONAMENTO
Nos outros 3 posts e nas outras 6 stories, é PROIBIDO citar "Posiciona" pelo nome. Fale sobre o tema/método/insight sem usar a marca como anchor.
Motivo: cada post precisa funcionar como insight independente. Se 4 dos 4 posts mencionam a marca, o feed soa como anúncio repetitivo em vez de autoridade construída por consistência de pensamento.
```

---

### Mudança 3 — Variar o epíteto do público-alvo

Na seção `🚫 FRASES E EXPRESSÕES PROIBIDAS`, localizar a sub-seção "Vocabulário saturado" e substituir:

```
Vocabulário saturado (use no MÁXIMO 1 vez na semana inteira, somando feed + stories):
- "profissionais qualificados"
- "profissionais liberais"
- "identidade de marca"
- "autoridade digital"
- "Instagram que não representa quem é"

🎯 DESCRITORES DO PÚBLICO-ALVO (REGRA DE VARIEDADE):
Em vez de "profissionais qualificados" / "profissionais liberais" como descritor padrão (saturado), VARIE a cada post usando descritores específicos extraídos do contexto do criador. Modelos aceitáveis:
- Profissão + segmento: "advogadas de direito de família que atendem PJ", "médicos endocrinologistas focados em emagrecimento feminino"
- Característica + dor: "consultores experientes cansados de competir por preço", "psicólogas que atendem público de alto valor"
- Estágio + frustração: "profissionais com 10+ anos de experiência que viraram invisíveis no digital", "especialistas no offline que não conseguem traduzir competência no online"
- Volume + situação: "empresários que faturam acima de 500k/ano e ainda postam manualmente", "advogadas com 50+ clientes ativos e zero estratégia de aquisição"
REGRA: cada um dos 4 posts da semana DEVE usar um descritor DIFERENTE. Nunca repita "profissionais qualificados" em mais de 1 post da mesma semana. Use o bloco "NEGÓCIO" + "CONTEXTO PESSOAL" para extrair detalhes específicos do nicho do criador e construir descritores ricos.
```

---

## Validação
- `code--view` no arquivo para confirmar posição exata da seção `🚫 FRASES E EXPRESSÕES PROIBIDAS`
- Deploy do `process-content-generation-job` após edições

## Efeito esperado
- Templates de título específicos banidos com alternativas explícitas
- Marca "Posiciona" aparece só em 1 post + 1 story por semana
- Cada post usa descritor diferente e mais específico do público, forçando o LLM a usar dados do personalContext e business block