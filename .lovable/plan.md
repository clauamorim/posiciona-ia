
## Correção da regressão — Semana atualizada voltou a exibir rótulos de StoryBrand

### Objetivo
Eliminar de forma confiável os termos estruturais de framework na Linha Editorial regenerada gratuitamente, para que o conteúdo exibido ao usuário continue parecendo copy final de marketing, e não saída “crua” de metodologia.

### O que vou corrigir
1. **Blindagem no backend da geração semanal**
   - Hoje `generate-content-week` depende principalmente do prompt para proibir rótulos como “Herói”, “Problema Interno”, “Problema Externo”, “Plano”, “CTA” etc.
   - Vou adicionar uma **sanitização/validação pós-LLM** no próprio backend, aplicada a:
     - `theme`
     - `caption`
     - `cta`
     - `script`
     - cada item de `card_copy`
   - Essa sanitização vai remover:
     - prefixos como `Herói:`, `Problema interno:`, `Plano:`, `CTA:`, `Slide 1:`
     - cadeias de rótulos combinados
     - variantes com maiúsculas/minúsculas e acentos

2. **Validação forte para evitar conteúdo “com cara de framework”**
   - Além da limpeza, vou criar uma checagem que detecta quando o conteúdo ainda veio “estruturado demais”.
   - Se, após sanitizar, o resultado ainda contiver rótulos proibidos como marcadores visíveis, a função:
     - tenta uma segunda passagem de correção automática, ou
     - rejeita a resposta e força nova geração, em vez de salvar conteúdo ruim.

3. **Aplicar a mesma proteção também na regeneração de post avulso**
   - O problema apareceu na atualização gratuita da semana, mas vou alinhar também `regenerate-single-post` para evitar inconsistência entre:
     - regenerar a semana inteira
     - regenerar um único dia

4. **Nova versão do gerador editorial**
   - Vou incrementar `EDITORIAL_GENERATOR_VERSION` para uma nova versão.
   - Isso garante que:
     - o conteúdo com essa correção fique marcado como atual
     - qualquer conteúdo gerado antes dessa blindagem continue detectável como desatualizado, se necessário

5. **Ajuste do texto da UI para refletir a correção nova**
   - O aviso da Linha Editorial hoje diz que a atualização gratuita aplica “rótulos do framework removidos, textos mais limpos”.
   - Vou atualizar a copy para deixar claro que a atualização gratuita aplica a **nova limpeza reforçada de rótulos estruturais**, evitando que o usuário espere uma correção já entregue quando ainda houver uma regressão.

### Arquivos que entram na correção
- `supabase/functions/generate-content-week/index.ts`
- `supabase/functions/regenerate-single-post/index.ts`
- `supabase/functions/_shared/...` ou utilitário compartilhado novo para sanitização editorial
- `src/lib/generatorVersion.ts`
- `supabase/functions/_shared/generatorVersion.ts`
- `src/pages/EditorialPage.tsx`

### Abordagem técnica
- Extrair a limpeza para um utilitário compartilhado de backend, para não depender só do `cleanText` do frontend.
- Tratar o problema **antes de salvar** no relatório.
- Manter o `cleanText` do frontend como camada extra de exibição, mas não como única defesa.
- Preservar a intenção do texto: remover rótulos estruturais sem “quebrar” a copy final.

### Resultado esperado
- Ao atualizar a semana gratuitamente, a Linha Editorial não volta mais com:
  - “Herói”
  - “Problema Interno”
  - “Problema Externo”
  - “Plano”
  - “CTA”
  - “Slide 1”
  - e rótulos semelhantes
- O conteúdo salvo já sai limpo no banco, e não apenas mascarado na interface.
- Regeneração de semana e regeneração de post passam a seguir a mesma regra de limpeza.

### Detalhe técnico importante
O problema atual sugere que a correção anterior ficou forte no **prompt** e no **frontend**, mas não suficientemente garantida no **pipeline de persistência da geração semanal**. A correção agora será feita com validação e sanitização no backend, que é o ponto mais confiável para impedir a regressão.

