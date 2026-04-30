import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

type Props = {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
};

export function MessageBubble({ role, content, streaming }: Props) {
  const isUser = role === "user";
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-card border border-border text-foreground rounded-bl-sm"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap font-sans">{content}</p>
        ) : (
          <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-headings:font-display prose-strong:text-foreground prose-li:my-0.5">
            <ReactMarkdown>{content || (streaming ? "…" : "")}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
