

## Plano: remover rótulos StoryBrand do conteúdo visível

### Causa
Os prompts de `generate-content-week` e `regenerate-single-post` instruem o Gemini a usar StoryBrand como base, mas não proíbem que rótulos do framework (ex.: "Problema Externo:", "O Plano:", "Chamada à Ação:") apareçam dentro de `theme`, `caption`, `card_copy`, `cta` e `script`. Resultado: posts saem com cara de template ("Problema Externo: Desvendando o Emaranhado…").

### Solução
Reforçar o system prompt das duas edge functions com uma seção explícita de "REGRA DE LINGUAGEM" proibindo qualquer rótulo do framework no output visível, mantendo o StoryBrand apenas como camada estratégica interna. Também acrescentar exemplo curto do que NÃO fazer e do que fazer.

Sem mudanças em UI, schema, créditos ou Stripe. O painel da Linha Editorial continua mostrando o conteúdo cru retornado pela IA — o ganho vem do prompt produzir copy limpa.

### Mudança nos prompts (ambas as functions)

Adicionar bloco no `systemPrompt`:

```
REGRA DE LINGUAGEM (CRÍTICA):
O StoryBrand é uma camada ESTRATÉGICA INTERNA. NUNCA escreva os rótulos do framework dentro de "theme", "caption", "card_copy", "cta" ou "script". Os campos visíveis devem soar como copy de marketing real, não como template.

PROIBIDO escrever literalmente (em qualquer campo visível):
"Problema Externo", "Problema Interno", "Problema Filosófico", "O Plano", "Chamada à Ação", "Chamada para Ação", "O Sucesso", "O Fracasso", "O Guia", "O Herói", "Sucesso vs Fracasso", "StoryBrand", "Framework", "Etapa do Framework".

Não use prefixos como "Problema Externo: ...", "Plano: ...", "CTA: ...". Apenas escreva o conteúdo direto, em linguagem natural.

Exemplos:
- ERRADO: "Problema Externo: Desvendando o Emaranhado do Conflito"
- CERTO:  "Desvendando o Emaranhado do Conflito"
- ERRADO em cta: "Chamada à Ação: Agende sua sessão hoje"
- CERTO em cta: "Agende sua sessão hoje"
```

E no `generate-content-week`, ajustar a seção "ESTRATÉGIA DE CONTEÚDO" para deixar claro que o foco do dia é orientação interna:

```
Cada dia explora INTERNAMENTE uma faceta do StoryBrand (não cite a faceta no texto visível):
- Dia 1: foco interno = HERÓI
- Dia 2: foco interno = PROBLEMA EXTERNO
... etc.
```

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/generate-content-week/index.ts` | Adicionar bloco "REGRA DE LINGUAGEM" no systemPrompt; reescrever a lista de dias para deixar a faceta como orientação interna |
| `supabase/functions/regenerate-single-post/index.ts` | Adicionar o mesmo bloco "REGRA DE LINGUAGEM" no systemPrompt |

Conteúdos já gerados antes da mudança permanecem como estão. Para limpá-los, o usuário pode usar o botão "Ajustar conteúdo" (regeneração de post individual) — agora ele virá sem os rótulos.

