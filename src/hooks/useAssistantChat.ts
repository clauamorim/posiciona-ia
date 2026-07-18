import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buildJourneyContext, getRouteLabel } from "@/lib/assistantJourney";
import { consumeQuestionContext, clearQuestionContext } from "@/lib/assistantBus";

export type Msg = { id?: string; role: "user" | "assistant"; content: string };

const WELCOME_DEFAULT =
  "Olá! Sou a assistente da Posiciona. Estou aqui para guiar você em cada etapa da plataforma — seja para explicar um conceito, esclarecer uma dúvida ou indicar o próximo passo. Em que posso ajudar?";

// Mensagens de boas-vindas contextuais por rota.
// Quando a rota tem mensagem dedicada, ela substitui o WELCOME_DEFAULT.
const ROUTE_WELCOMES: Record<string, string> = {
  "/dashboard": "Olá! Vejo que você está no Dashboard. Posso explicar o resumo da sua jornada, ajudar a interpretar seus créditos disponíveis ou orientar o próximo passo. O que precisa?",
  "/business-questionnaire": "Olá! Você está no Diagnóstico do Negócio. Posso ajudar com qualquer pergunta — basta clicar em 'Precisa de ajuda?' ao lado dela ou me perguntar diretamente. Por onde quer começar?",
  "/personal-questionnaire": "Olá! Esse é o questionário Sua História — onde a sua trajetória pessoal vira matéria-prima de storytelling. Se travar em alguma pergunta, posso ajudar com exemplos. Qual é a dúvida?",
  "/archetype-questionnaire": "Olá! Aqui estão as afirmações que vão identificar os 3 arquétipos dominantes. Responda com honestidade — não há resposta certa ou errada. Posso explicar qualquer arquétipo se quiser entender melhor.",
  "/sales-narrative": "Olá! Você está na Narrativa de Vendas. Esse questionário é opcional, mas alimenta as sequências de Stories de Venda. Posso ajudar com exemplos ou explicar o que cada pergunta busca.",
  "/results": "Olá! Sua estratégia está sendo gerada — pode levar alguns minutos. Posso aproveitar pra explicar os arquétipos identificados ou o que vem a seguir. O que prefere?",
  "/report": "Olá! Você está no seu Relatório Estratégico. Ele tem 3 capítulos: Identidade, Apresentação e Narrativa. Posso explicar qualquer seção ou ajudar a aplicar o que está aqui na prática.",
  "/storybrand": "Olá! Aqui está sua Narrativa de Marca no formato StoryBrand. Posso explicar cada elemento (Herói, Guia, Problema, Plano, CTA) ou como usar isso no seu Instagram.",
  "/instagram-analysis": "Olá! Essa é a análise do seu perfil atual comparado à estratégia ideal. Posso explicar cada gap identificado e como ajustar.",
  "/editorial": "Olá! Você está na Linha Editorial. Cada semana segue ritmo Seg-Qui com feed + stories e Sex-Dom só com stories. Posso explicar qualquer post, ajudar a criar variações ou orientar como gerar nova semana.",
  "/post-editor": "Olá! Você está editando um post. Posso ajudar com escolha de imagem (Pexels grátis vs IA paga), variações de layout, ou explicar o tom de voz adequado pro arquétipo do post.",
  "/portraits": "Olá! Você está nos Retratos de Marca. Apenas o seu arquétipo primário guia o estilo dos retratos. Posso explicar como melhorar suas fotos de referência ou interpretar os retratos gerados.",
  "/stories-de-venda": "Olá! Aqui você gera sequências de 7 stories para conversão. Cada sequência usa um dos 7 templates testados e custa 1 ajuste de conteúdo. Posso explicar quando usar cada template.",
  "/my-designs": "Olá! Aqui ficam seus designs salvos. Posso ajudar a organizá-los ou orientar quando vale criar uma variação de um post existente.",
  "/my-gallery": "Olá! Aqui ficam todas as suas imagens (uploads, retratos, geradas por IA). Posso orientar como reutilizá-las em posts da Linha Editorial.",
  "/choose-plan": "Olá! Aqui você escolhe o plano. Cada um tem combinação diferente de ciclos, reanálises, retratos e ajustes mensais. Posso ajudar a entender qual melhor encaixa no seu uso.",
};

function getWelcomeMessage(pathname: string): string {
  // Match exato primeiro
  if (ROUTE_WELCOMES[pathname]) return ROUTE_WELCOMES[pathname];
  // Match por prefixo (ex: /post-editor/abc também usa o welcome de /post-editor)
  for (const key of Object.keys(ROUTE_WELCOMES)) {
    if (pathname.startsWith(key + "/")) return ROUTE_WELCOMES[key];
  }
  // Fallback genérico, com nome da página se houver
  const routeLabel = getRouteLabel(pathname);
  if (routeLabel) {
    return `Olá! Vejo que você está em ${routeLabel}. Posso explicar essa tela, orientar o próximo passo ou esclarecer dúvidas sobre a metodologia. Em que posso ajudar?`;
  }
  return WELCOME_DEFAULT;
}

export function useAssistantChat(open: boolean) {
  const { user } = useAuth();
  const location = useLocation();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load or create conversation when opened
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      const { data: convs } = await supabase
        .from("assistant_conversations")
        .select("id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      let convId = convs?.[0]?.id ?? null;
      if (!convId) {
        const { data: created } = await supabase
          .from("assistant_conversations")
          .insert({ user_id: user.id })
          .select("id")
          .single();
        convId = created?.id ?? null;
      }
      if (cancelled || !convId) return;
      setConversationId(convId);

      const { data: msgs } = await supabase
        .from("assistant_messages")
        .select("id, role, content, created_at")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (!msgs || msgs.length === 0) {
        setMessages([{ role: "assistant", content: getWelcomeMessage(location.pathname) }]);
      } else {
        setMessages(msgs.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user, location.pathname]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!user || !conversationId || !text.trim() || isStreaming) return;
      setError(null);
      const userMsg: Msg = { role: "user", content: text.trim() };
      const baseHistory = [...messages, userMsg];
      setMessages(baseHistory);
      setIsStreaming(true);

      // Persist user message
      await supabase.from("assistant_messages").insert({
        conversation_id: conversationId,
        user_id: user.id,
        role: "user",
        content: userMsg.content,
      });

      try {
        const baseJourney = await buildJourneyContext(user.id, location.pathname);
        const qCtx = consumeQuestionContext();
        const journeyContext = qCtx
          ? `${baseJourney}\nPergunta atual em que o usuário pediu ajuda: ${qCtx}\nResponda de forma específica a essa pergunta.`
          : baseJourney;
        clearQuestionContext();

        const controller = new AbortController();
        abortRef.current = controller;

        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/assistant-chat`;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            messages: baseHistory.map((m) => ({ role: m.role, content: m.content })),
            journeyContext,
          }),
          signal: controller.signal,
        });

        if (!resp.ok) {
          const errBody = await resp.json().catch(() => ({ error: "Erro inesperado" }));
          throw new Error(errBody.error || `HTTP ${resp.status}`);
        }
        if (!resp.body) throw new Error("Sem corpo de resposta");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let textBuffer = "";
        let assistantSoFar = "";
        let streamDone = false;

        // Push empty assistant message that will be filled
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        const updateAssistant = (chunk: string) => {
          assistantSoFar += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
              );
            }
            return [...prev, { role: "assistant", content: assistantSoFar }];
          });
        };

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          textBuffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
            let line = textBuffer.slice(0, newlineIndex);
            textBuffer = textBuffer.slice(newlineIndex + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              streamDone = true;
              break;
            }
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) updateAssistant(content);
            } catch {
              textBuffer = line + "\n" + textBuffer;
              break;
            }
          }
        }

        if (textBuffer.trim()) {
          for (let raw of textBuffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (raw.startsWith(":") || raw.trim() === "") continue;
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) updateAssistant(content);
            } catch {}
          }
        }

        // Persist final assistant message
        if (assistantSoFar.trim()) {
          await supabase.from("assistant_messages").insert({
            conversation_id: conversationId,
            user_id: user.id,
            role: "assistant",
            content: assistantSoFar,
          });
          await supabase
            .from("assistant_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId);
        }
      } catch (e: any) {
        if (e.name !== "AbortError") {
          setError(e.message || "Erro ao consultar a assistente");
          // Remove last empty assistant bubble if any
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && !last.content) return prev.slice(0, -1);
            return prev;
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [user, conversationId, messages, isStreaming, location.pathname]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, sendMessage, isStreaming, error, stop };
}
