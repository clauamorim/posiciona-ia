import { useEffect, useRef, useState, KeyboardEvent } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square, Sparkles } from "lucide-react";
import { useAssistantChat } from "@/hooks/useAssistantChat";
import { MessageBubble } from "./MessageBubble";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AssistantPanel({ open, onOpenChange }: Props) {
  const { messages, sendMessage, isStreaming, error, stop } = useAssistantChat(open);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isStreaming]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col bg-background"
      >
        <SheetHeader className="px-5 py-4 border-b border-border bg-card/50">
          <SheetTitle className="font-display text-xl flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Assistente Posiciona
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            Sua consultora de posicionamento, sempre disponível.
          </SheetDescription>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((m, i) => (
            <MessageBubble
              key={m.id || i}
              role={m.role}
              content={m.content}
              streaming={isStreaming && i === messages.length - 1 && m.role === "assistant"}
            />
          ))}
          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-border p-3 bg-card/30">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Pergunte algo à assistente..."
              rows={1}
              className={cn(
                "resize-none min-h-[44px] max-h-32 text-sm bg-background",
                "focus-visible:ring-1 focus-visible:ring-primary"
              )}
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button size="icon" variant="outline" onClick={stop} className="h-11 w-11 flex-shrink-0">
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim()}
                className="h-11 w-11 flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-2 px-1">
            Enter para enviar · Shift+Enter para nova linha
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
