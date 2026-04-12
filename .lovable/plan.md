

## Plano: Correção de 7 problemas relatados

### 1. Paleta de cores inconsistente entre gerações

**Problema:** A paleta é gerada pela IA a cada vez que o relatório é gerado. Mesmo com mesmos arquétipos/pontuações, a IA pode gerar cores diferentes.

**Solução:** No `generate-report/index.ts`, adicionar instrução no prompt para que a paleta de cores siga um mapeamento FIXO por arquétipo primário (semelhante ao que já existe para tipografia). Adicionar uma tabela de referência de paletas por arquétipo no prompt do sistema para que as cores sejam determinísticas.

| Arquivo | Ação |
|---------|------|
| `supabase/functions/generate-report/index.ts` | Adicionar mapeamento fixo de paletas por arquétipo no prompt |

### 2. Erro ao gerar semana 3+ de conteúdo editorial

**Problema:** O `generate-content-week` usa `user_credits` (balance) para verificar créditos, mas a `EditorialPage` usa `user_balances.weekly_cycles` para deduzir. Discrepância: a função edge verifica `user_credits.balance` (que pode ser 0 após a primeira geração do relatório) enquanto o frontend usa `weekly_cycles`.

**Solução:** Alterar `generate-content-week/index.ts` para verificar `user_balances.weekly_cycles` em vez de `user_credits.balance`, alinhando com o frontend.

| Arquivo | Ação |
|---------|------|
| `supabase/functions/generate-content-week/index.ts` | Trocar verificação de créditos de `user_credits.balance` para `user_balances.weekly_cycles` |

### 3. Primeiro retrato sem fisionomia das fotos

**Problema:** Comportamento do modelo de IA — difícil garantir 100%. Porém, podemos reforçar o prompt e usar mais selfies na primeira mensagem, enfatizando a preservação facial.

**Solução:** Reforçar ainda mais o prompt de `generate-portrait` com instruções mais enfáticas sobre preservação de identidade facial na primeira geração. Adicionar "IDENTITY PRESERVATION IS THE #1 PRIORITY" no topo do prompt.

| Arquivo | Ação |
|---------|------|
| `supabase/functions/generate-portrait/index.ts` | Reforçar prioridade de preservação facial no prompt |

### 4. Gerar retratos com todas as opções de figurino

**Problema:** Atualmente gera apenas 1 retrato. O usuário quer que sejam geradas variações usando diferentes peças de figurino do relatório.

**Solução:** Adicionar opção na UI para selecionar qual "look" de figurino usar. Gerar múltiplos retratos em sequência (1 por look), cada um com peças diferentes do figurino. Adicionar um seletor de "Opção de figurino" no `PortraitGenerator` que divide as peças-chave em looks distintos.

| Arquivo | Ação |
|---------|------|
| `src/pages/PortraitGenerator.tsx` | Adicionar seletor de look/figurino e gerar variações |
| `supabase/functions/generate-portrait/index.ts` | Aceitar parâmetro `wardrobeVariation` para usar peças diferentes |

### 5. Redimensionamento de elementos no editor de posts (não proporcional)

**Problema:** O resize do `PostCanvas` só usa o handle bottom-right e mantém proporção fixa. Faltam handles nos outros cantos/lados para redimensionamento livre.

**Solução:** Adicionar 8 handles de redimensionamento (4 cantos + 4 lados). Os cantos com Shift mantêm proporção; sem Shift = livre. Os lados redimensionam apenas uma dimensão.

| Arquivo | Ação |
|---------|------|
| `src/components/post-editor/PostCanvas.tsx` | Adicionar 8 handles de resize; lógica proporcional vs livre |

### 6. Melhorias no editor de posts: alinhamento de texto, caixa de texto redimensionável, cores da paleta + custom, botão copiar legenda

**Soluções:**
- **Alinhamento de texto:** Adicionar botões left/center/right/justify no `PostToolbar` e prop `textAlign` no `PostCanvas`
- **Redimensionar caixa de texto:** Fazer os textos editáveis em containers redimensionáveis
- **Cores da paleta + custom:** Mostrar as cores da paleta na toolbar como botões rápidos + input type="color" para cor customizada
- **Botão copiar legenda:** Adicionar botão "Copiar" ao lado da legenda do Instagram no `PostEditorPage`

| Arquivo | Ação |
|---------|------|
| `src/components/post-editor/PostToolbar.tsx` | Alinhamento de texto, cores da paleta + color picker custom |
| `src/components/post-editor/PostCanvas.tsx` | Prop textAlign, caixa de texto redimensionável |
| `src/pages/PostEditorPage.tsx` | Estado textAlign, botão copiar legenda |

### 7. Scroll para topo ao mudar de página no questionário de arquétipos

**Problema:** Ao clicar "Próximo", a página permanece na posição do botão.

**Solução:** Adicionar `window.scrollTo(0, 0)` após mudar de página.

| Arquivo | Ação |
|---------|------|
| `src/pages/ArchetypeQuestionnaire.tsx` | Adicionar scrollTo(0,0) ao mudar página |

### Resumo de arquivos

| Arquivo | Alterações |
|---------|-----------|
| `supabase/functions/generate-report/index.ts` | Paletas fixas por arquétipo |
| `supabase/functions/generate-content-week/index.ts` | Corrigir verificação de créditos |
| `supabase/functions/generate-portrait/index.ts` | Reforçar preservação facial + aceitar variação de figurino |
| `src/pages/PortraitGenerator.tsx` | Seletor de look/figurino |
| `src/components/post-editor/PostCanvas.tsx` | 8 handles resize + textAlign + caixa texto |
| `src/components/post-editor/PostToolbar.tsx` | Alinhamento texto + color picker |
| `src/pages/PostEditorPage.tsx` | textAlign state + copiar legenda |
| `src/pages/ArchetypeQuestionnaire.tsx` | Scroll to top ao mudar página |

