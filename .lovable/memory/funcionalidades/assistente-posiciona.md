---
name: Assistente Posiciona
description: Chat assistant guiando o usuário pelas etapas, modelo Gemini 2.5 Flash Lite, persistido em assistant_conversations/messages
type: feature
---
Assistente conversacional global da plataforma.

**Modelo**: `google/gemini-2.5-flash-lite` via Lovable AI Gateway (edge function `assistant-chat`, streaming SSE).

**UI**: Botão flutuante (`AssistantButton`) no canto inferior direito, escondido em rotas públicas (landing, login, signup, legais). Painel lateral via Sheet (`AssistantPanel`). Renderização Markdown com react-markdown. Pulso de "sugestão contextual" exibido uma vez por rota conhecida (sessionStorage).

**Persistência**: Tabelas `assistant_conversations` (1 por usuário, reutilizada) e `assistant_messages` com RLS por user_id. Histórico carregado ao abrir; mensagem de boas-vindas se conversa vazia.

**Contexto da jornada**: `src/lib/assistantJourney.ts` calcula etapa atual + concluídas (mesma lógica do Dashboard) e injeta no system prompt antes de cada chamada. Limita histórico enviado ao modelo às últimas 20 mensagens para controlar custo.

**System prompt**: definido no edge function (não no client). Tom premium editorial, sem emojis, conhecimento dos 12 arquétipos e StoryBrand.

**Limites v1**: não executa ações, não acessa conteúdo dos questionários/relatório (apenas etapa), sem upload de imagem, conversa única por usuário.
