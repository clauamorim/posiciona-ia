

## Plano: Figurino por gênero, símbolos, e retratos aprimorados (com geração automática)

### 1. Adicionar campo "Gênero" no cadastro e na tabela `profiles`

**Migração:** Adicionar coluna `gender` (text) à tabela `profiles` (já existe — nenhuma migração necessária)

**Editar `src/pages/Signup.tsx`:**
- Adicionar Select com opções: "Feminino", "Masculino", "Prefiro não informar"
- Salvar no campo `gender` do profile após signup

### 2. Geração automática do relatório após cálculo dos arquétipos

**Editar `src/pages/Results.tsx`:**
- Após salvar os scores e top 3 no banco, verificar se o questionário de negócio está completo (`is_complete = true`)
- Se sim, automaticamente disparar a geração do relatório (mesma lógica do `handleGenerate` em StoryBrand.tsx):
  1. Buscar `business_questionnaires`, `profiles` (niche, gender), `user_top_archetypes`
  2. Criar/atualizar registro em `reports` com status "generating"
  3. Invocar `generate-report` edge function
  4. Salvar resultado e bloquear questionários
- Mostrar progresso em etapas: "Calculando arquétipos..." → "Gerando sua estratégia completa..." → "Concluído!"
- Ao finalizar, exibir botão para navegar ao relatório

**Editar `src/pages/StoryBrand.tsx`:**
- Remover o botão "Gerar Estratégia StoryBrand" e a lógica `handleGenerate` — a geração agora é automática
- Manter apenas a visualização do StoryBrand existente
- Se o relatório ainda não existe, mostrar mensagem "Complete os questionários para gerar automaticamente"

### 3. Adicionar seções "Figurino" e "Símbolos" ao relatório

**Editar `supabase/functions/generate-report/index.ts`:**
- Receber `gender` do cliente junto com os dados do negócio
- Adicionar ao JSON schema as seções `figurino` e `simbolos`:
  - `figurino`: resumo, peças-chave, cores, acessórios, maquiagem (só feminino), barba/grooming (só masculino), cabelo, itens a evitar
  - Instruir a LLM: "Se o gênero for feminino, gerar maquiagem, acessórios femininos, penteados femininos. Se masculino, gerar grooming, acessórios masculinos, cortes masculinos. Se não informado, gerar versão neutra."
  - `simbolos`: símbolo principal de cada arquétipo com significado e aplicação visual

**Editar `src/pages/Report.tsx`:**
- Renderizar seção "Figurino Estratégico" com cards por subcategoria
- Renderizar seção "Símbolos dos Arquétipos"
- Incluir ambas no PDF download

### 4. Aprimorar retratos com figurino e realismo

**Editar `supabase/functions/generate-portrait/index.ts`:**
- Buscar `gender` do profile do usuário
- Buscar `figurino` do relatório e incluir no prompt (peças, cores, acessórios)
- Forçar SEMPRE fundo de estúdio (remover variações outdoor)
- Adicionar regras de realismo: preservar assimetrias, pele natural, mãos corretas
- Adaptar vestimenta/acessórios ao gênero

### Resumo de arquivos

| Acao | Arquivo |
|------|---------|
| Editar | `src/pages/Signup.tsx` (campo gênero) |
| Editar | `src/pages/Results.tsx` (geração automática do relatório após cálculo) |
| Editar | `src/pages/StoryBrand.tsx` (remover botão gerar, apenas visualização) |
| Editar | `supabase/functions/generate-report/index.ts` (figurino + símbolos + gênero) |
| Editar | `supabase/functions/generate-portrait/index.ts` (figurino, estúdio, realismo, gênero) |
| Editar | `src/pages/Report.tsx` (renderizar figurino + símbolos + PDF) |

