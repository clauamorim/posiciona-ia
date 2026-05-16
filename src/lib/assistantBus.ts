// Lightweight event bus used to open the global Assistant panel from anywhere
// and (optionally) pre-seed a per-question context that will be appended to
// the AI's journeyContext on the next message.

let pendingQuestionContext: string | null = null;

export const ASSISTANT_OPEN_EVENT = "assistant:open";

export function openAssistant(questionContext?: string | null) {
  pendingQuestionContext = questionContext?.trim() || null;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ASSISTANT_OPEN_EVENT));
  }
}

export function consumeQuestionContext(): string | null {
  return pendingQuestionContext;
}

export function clearQuestionContext() {
  pendingQuestionContext = null;
}
