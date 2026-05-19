import { Badge } from "@/components/ui/badge";
import { Lock, Check, PencilLine } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuestionnaireVisualStatus = "in_use" | "completed" | "in_progress";

interface Props {
  status: QuestionnaireVisualStatus;
  className?: string;
}

const MAP: Record<QuestionnaireVisualStatus, { label: string; classes: string; Icon: typeof Lock }> = {
  in_use: {
    label: "Em uso",
    classes: "bg-amber-500/15 text-amber-500 border border-amber-500/30",
    Icon: Lock,
  },
  completed: {
    label: "Concluído",
    classes: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30",
    Icon: Check,
  },
  in_progress: {
    label: "Em andamento",
    classes: "bg-primary/15 text-primary border border-primary/30",
    Icon: PencilLine,
  },
};

export function QuestionnaireStatusBadge({ status, className }: Props) {
  const { label, classes, Icon } = MAP[status];
  return (
    <Badge variant="outline" className={cn(classes, "gap-1", className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}
