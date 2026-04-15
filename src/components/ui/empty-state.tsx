import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export const EmptyState = ({ icon: Icon, title, description, children, className }: EmptyStateProps) => (
  <div className={cn(
    "flex flex-col items-center justify-center py-16 text-center gap-4",
    className
  )}>
    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center">
      <Icon className="h-7 w-7 text-muted-foreground/60" />
    </div>
    <div className="space-y-1.5 max-w-sm">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      )}
    </div>
    {children}
  </div>
);
