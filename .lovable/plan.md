

# Fix: Barra de progresso no Questionário de Arquétipos

## Problema
Todas as 72 questões recebem valor padrão `3` no carregamento, então `Object.keys(answers).length === questions.length` sempre — progresso mostra 100% mesmo sem interação.

## Solução

Separar o estado de "respostas do usuário" do "valor visual pré-selecionado":

1. **Manter um Set de questões efetivamente respondidas** (`touchedIds`) — começa vazio, adiciona o `question_id` quando o usuário clica em um botão de score, ou carrega do banco (respostas salvas previamente).

2. **Calcular progresso com base no Set** em vez de `Object.keys(answers).length`:
   ```
   answeredCount = touchedIds.size
   progress = Math.round((touchedIds.size / questions.length) * 100)
   ```

3. **No `useEffect` de carregamento**: popular `touchedIds` apenas com as questões que têm respostas salvas no banco (`archetype_answers`).

4. **No handler de clique**: adicionar `q.id` ao `touchedIds` ao selecionar um score.

5. **Botão "Calcular arquétipos"**: manter a validação `answeredCount < questions.length` usando `touchedIds.size`.

### Arquivo alterado
- `src/pages/ArchetypeQuestionnaire.tsx`

