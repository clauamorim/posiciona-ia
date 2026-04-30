# Assistente Posiciona — Plano de Implementação

## Visão geral

Criar uma assistente conversacional dentro da plataforma, alimentada por **Lovable AI (Gemini 2.5 Flash Lite)**, que guia o usuário pelas etapas da jornada com tom premium e conhecimento profundo da metodologia (arquétipos + StoryBrand). A conversa será persistida no banco e a assistente conhecerá a etapa atual da jornada do usuário.

## Como funciona para o usuário

1. **Botão flutuante** discreto no canto inferior direito de todas as páginas autenticadas (oculto na landing, login, signup).
2. Ao clicar, abre um **painel lateral** com chat em estilo editorial (alinhado ao Light Premium Workspace: bege #F5F4F1, roxo #6E3FE6, fontes Cormorant Garamond + Inter).
3. **Sugestão contextual**: ao entrar em uma etapa nova (ex.: arquétipos, relatório, editor), o botão exibe um pulso sutil + tooltip curto ("Posso explicar essa etapa?"). Se o usuário ignorar, fica quieto.
4. **Histórico persistente**: o usuário retoma a conversa de onde parou em qualquer dispositivo.
5. **Mensagem inicial** automática na primeira abertura: a frase de abertura sugerida no prompt.

## Comportamento da assistente

- **Modelo**: `google/gemini-2.5-flash-lite` via Lovable AI Gateway (sem API key adicional).
- **System prompt**: o texto completo que você forneceu (metodologia + 12 arquétipos + StoryBrand + regras de tom), injetado no backend.
- **Contexto da etapa atual**: antes de cada resposta, o backend acrescenta ao system prompt um bloco com a etapa em que o usuário está (ex.: *"O usuário está atualmente em: Linha Editorial. Já concluiu: Diagnóstico, Sua História, Arquétipos, Relatório."*). Isso permite respostas precisas sem inventar dados.
- **Streaming**: respostas aparecem token-a-token (SSE), renderizadas em Markdown.
- **Sem dados sensíveis**: a assistente não lê arquétipos, profissão ou conteúdo de questionários — apenas a etapa da jornada (decisão sua na pergunta de contexto).

## Estrutura técnica

### Banco de dados (2 tabelas novas, com RLS)

- **`assistant_conversations`** — uma conversa por usuário (mantém histórico contínuo).
  - Campos: usuário, título, timestamps.
- **`assistant_messages`** — mensagens individuais.
  - Campos: conversa, papel (`user` / `assistant`), conteúdo, timestamp.
- **RLS**: cada usuário só lê/escreve suas próprias conversas e mensagens.

### Edge Function: `assistant-chat`

- Recebe: histórico de mensagens + etapa atual da jornada (calculada no frontend a partir dos mesmos sinais que o `Dashboard` já usa).
- Monta o system prompt + bloco de contexto da etapa.
- Chama `https://ai.gateway.lovable.dev/v1/chat/completions` com `stream: true`.
- Trata erros 429 (rate limit) e 402 (créditos esgotados) com mensagens claras.
- Retorna o stream SSE direto para o cliente.

### Frontend

- **`src/components/assistant/AssistantButton.tsx`** — botão flutuante global, montado no `App.tsx` dentro do `AuthProvider` (renderiza apenas quando há usuário logado).
- **`src/components/assistant/AssistantPanel.tsx`** — painel lateral (Sheet do shadcn) com lista de mensagens, input e estado de streaming.
- **`src/components/assistant/MessageBubble.tsx`** — renderização com `react-markdown`.
- **`src/hooks/useAssistantChat.ts`** — gerencia conversa, fetch streaming, persistência em tempo real.
- **`src/lib/assistantJourney.ts`** — função reutilizável que calcula a etapa atual do usuário (extrai a lógica que já existe no `Dashboard.tsx`).

## Premissas e limites da v1

- **Não executa ações** (não preenche questionários, não navega por você). Apenas explica e orienta.
- **Não acessa o conteúdo** dos questionários, relatório ou Instagram do usuário — só sabe em qual etapa ele está.
- **Sem upload de imagem** no chat.
- **Custo controlado**: Flash Lite é o modelo mais econômico do Gemini; o histórico é limitado às últimas ~20 mensagens enviadas ao modelo (o resto fica salvo, mas não vai no contexto, evitando custos crescentes).

## O que fica fora desta v1 (possíveis evoluções futuras)

- Acesso aos arquétipos dominantes do usuário para personalizar exemplos.
- Ações automáticas ("Levar até o editor", "Iniciar reanálise").
- Botão de "Iniciar nova conversa" / múltiplas conversas paralelas.
- Avaliação de respostas (👍/👎) para melhorar o prompt.

## Resumo do fluxo de implementação

1. Migração: criar `assistant_conversations` + `assistant_messages` com RLS.
2. Edge function `assistant-chat` com streaming e Gemini 2.5 Flash Lite.
3. Hook `useAssistantChat` + helper `assistantJourney`.
4. Componentes `AssistantButton` + `AssistantPanel` + `MessageBubble`.
5. Montagem global no `App.tsx`, com pulso contextual ao mudar de rota.
6. Validação visual (tom premium, sem emojis, fontes corretas).

Pronto para implementar? Posso seguir com a migração e o código.