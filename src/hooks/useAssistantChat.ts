import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { buildJourneyContext } from "@/lib/assistantJourney";
import { consumeQuestionContext, clearQuestionContext } from "@/lib/assistantBus";

export type Msg = { id?: string; role: "user" | "assistant"; content: string };

const WELCOME =
  "Olá! Sou a assistente da Posiciona. Estou aqui para guiar você em cada etapa da plataforma — seja para explicar um conceito, esclarecer uma dúvida ou indicar o próximo passo. Em que posso ajudar?";

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
        setMessages([{ role: "assistant", content: WELCOME }]);
      } else {
        setMessages(msgs.map((m: any) => ({ id: m.id, role: m.role, content: m.content })));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user]);

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
