import { Sparkles } from "lucide-react";
import { openAssistant } from "@/lib/assistantBus";
import { cn } from "@/lib/utils";

type Props = {
  /** Texto que identifica a pergunta — será enviado como contexto à IA. */
  questionContext: string;
  label?: string;
  className?: string;
};

export function InlineHelpButton({ questionContext, label = "Precisa de ajuda?", className }: Props) {
  return (
    <button
      type="button"
      onClick={() => openAssistant(questionContext)}
      className={cn(
        "inline-flex items-center gap-1 text-[12px] text-purple-400/70 hover:text-purple-400 transition-colors",
        className
      )}
      aria-label={`${label} sobre esta pergunta`}
    >
      <Sparkles size={14} strokeWidth={1.5} />
      <span>{label}</span>
    </button>
  );
}
