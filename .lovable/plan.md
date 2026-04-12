

## Plano: Figurino por gênero, símbolos, e retratos aprimorados

### 1. Adicionar campo "Gênero" no cadastro e na tabela `profiles`

**Migração:** Adicionar coluna `gender` (text) à tabela `profiles`

**Editar `src/pages/Signup.tsx`:**
- Adicionar Select com opções: "Feminino", "Masculino", "Prefiro não informar"
- Salvar no campo `gender` do profile após signup

### 2. Adicionar seções "Figurino" e "Símbolos" ao relatório

**Editar `supabase/functions/generate-report/index.ts`:**
- Receber `gender` do cliente junto com os dados do negócio
- Adicionar ao JSON schema as seções `figurino` e `simbolos`:
  - `figurino`: resumo, peças-chave, cores, acessórios, maquiagem (só feminino), barba/grooming (só masculino), cabelo, itens a evitar
  - Instruir a LLM: "Se o gênero for feminino, gerar maquiagem, acessórios femininos, penteados femininos. Se masculino, gerar grooming, acessórios masculinos, cortes masculinos. Se não informado, gerar versão neutra."
  - `simbolos`: símbolo principal de cada arquétipo com significado e aplicação visual

**Editar quem chama generate-report** (buscar o `gender` do profile e enviar)

**Editar `src/pages/Report.tsx`:**
- Renderizar seção "Figurino Estratégico" com cards por subcategoria
- Renderizar seção "Símbolos dos Arquétipos"
- Incluir ambas no PDF download

### 3. Aprimorar retratos com figurino e realismo

**Editar `supabase/functions/generate-portrait/index.ts`:**
- Buscar `gender` do profile do usuário
- Buscar `figurino` do relatório e incluir no prompt (peças, cores, acessórios)
- Forçar SEMPRE fundo de estúdio (remover variações outdoor)
- Adicionar regras de realismo: preservar assimetrias, pele natural, mãos corretas
- Adaptar vestimenta/acessórios ao gênero

### Resumo de arquivos

| Ação | Arquivo |
|------|---------|
| Migração | Adicionar `gender` em `profiles` |
| Editar | `src/pages/Signup.tsx` (campo gênero) |
| Editar | `supabase/functions/generate-report/index.ts` (figurino + símbolos + gênero) |
| Editar | `supabase/functions/generate-portrait/index.ts` (figurino, estúdio, realismo, gênero) |
| Editar | `src/pages/Report.tsx` (renderizar figurino + símbolos + PDF) |
| Editar | Arquivo que chama generate-report (passar gender) |

