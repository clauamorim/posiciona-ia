

# Melhorias no Relatório + Preparação para Créditos e Funcionalidades Futuras

## Resumo

Implementar 5 frentes: (1) prompt da IA com 7 dias completos + copy + roteiros de Reels, (2) visual do relatório estilo slides/Canva, (3) paleta de cores visual com swatches, (4) geração de semanas adicionais, (5) tabela de créditos preparada para o futuro.

---

## 1. Banco de dados — preparar para créditos e semanas extras

**Migração SQL:**
- Adicionar coluna `editorial_weeks jsonb default '[]'` na tabela `reports` para armazenar semanas adicionais
- Criar tabela `user_credits` com: `user_id`, `balance` (integer, default 1 — o relatório inicial é gratuito), `created_at`, `updated_at`
- RLS: usuário lê/atualiza próprios créditos; admin lê/atualiza todos
- Cada geração de +7 dias consome 1 crédito; a primeira semana (do relatório) é incluída sem custo

Essa tabela ficará pronta para quando o sistema de pagamento for implementado. Por agora, todo usuário começa com 1 crédito gratuito para testar a geração extra.

## 2. Prompt da IA — relatório completo com JSON estruturado

**Arquivo:** `supabase/functions/generate-report/index.ts`

- Aumentar `max_tokens` para 8000
- Reescrever o `systemPrompt` para pedir resposta em **JSON estruturado** com seções:
  - `archetypes` — descrição dos 3 arquétipos aplicados ao negócio
  - `visual_identity` — paleta de 5 cores (hex + nome + uso), tipografia, estilo/figurino
  - `tone_of_voice` — diretrizes de comunicação
  - `storybrand` — herói, guia, problema (externo/interno/filosófico), plano, CTA, sucesso, fracasso
  - `editorial` — array de 7 objetos, cada um com: dia, tema, formato, legenda/copy completa, CTA, e roteiro completo para Reels
- Parse JSON no edge function antes de retornar; fallback para texto se falhar

## 3. Nova edge function — gerar semanas adicionais

**Arquivo:** `supabase/functions/generate-content-week/index.ts`

- Recebe: dados do negócio, arquétipos, e conteúdos anteriores (para não repetir)
- Verifica créditos do usuário antes de gerar (consulta `user_credits`)
- Debita 1 crédito após geração bem-sucedida
- Retorna 7 novos dias no mesmo formato JSON
- O frontend salva no campo `editorial_weeks` da tabela `reports`

## 4. Visual do relatório estilo Canva/slides

**Arquivo:** `src/pages/Report.tsx` (reescrita completa)

Seções visuais com fundo alternado, simulando slides:

- **Arquétipos**: 3 cards com gradiente da cor do arquétipo, badge de classificação, descrição
- **Paleta de Cores**: 5 blocos coloridos estilo Coolors — retângulo com a cor de fundo, hex e nome sobrepostos, uso recomendado abaixo
- **Tipografia e Estilo**: card com sugestões visuais
- **Tom de Voz**: card formatado com ícone
- **StoryBrand**: 7 cards individuais (Herói, Guia, Problema, Plano, CTA, Sucesso, Fracasso)
- **Linha Editorial**: grid de 7 cards por semana, cada um com:
  - Badge do formato (Reels, Carrossel, Stories, Post)
  - Tema em destaque
  - Copy/legenda completa
  - CTA
  - Seção expansível com roteiro do Reel (quando aplicável)
- **Abas "Semana 1", "Semana 2"...** para semanas adicionais
- **Botão "Gerar +7 dias"** — verifica créditos, mostra saldo, gera ou avisa que precisa comprar

## 5. Atualizar Results.tsx

- Parsear a resposta JSON da IA e salvar como objeto (não string) no campo `content`
- Tratar erro de parse com fallback

## 6. PDF atualizado

- Headers coloridos por seção
- Swatches de cor representados como blocos
- Editorial em formato de tabela organizada

---

## Arquivos a criar/editar

| Arquivo | Ação |
|---------|------|
| Migração SQL | `editorial_weeks` em reports + tabela `user_credits` |
| `supabase/functions/generate-report/index.ts` | Reescrever prompt, pedir JSON, 8000 tokens |
| `supabase/functions/generate-content-week/index.ts` | Nova função para semanas extras com verificação de créditos |
| `src/pages/Report.tsx` | Reescrita completa — visual slides/Canva |
| `src/pages/Results.tsx` | Parse JSON da resposta da IA |

---

## Detalhes técnicos

- A tabela `user_credits` é criada agora mas só será alimentada por pagamento em versão futura. Por enquanto, o trigger `handle_new_user` será atualizado para inserir 1 crédito inicial.
- A coluna `content` (jsonb) já suporta objetos; o novo formato será o JSON estruturado descrito acima.
- O campo `editorial_weeks` será um array JSON de arrays de 7 dias.
- O botão "Gerar +7 dias" mostrará o saldo de créditos e desabilitará se saldo = 0, com mensagem "Adquira mais créditos" (link futuro para landing page).

