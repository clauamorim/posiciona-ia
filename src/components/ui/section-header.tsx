import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
  compact?: boolean;
}

export const SectionHeader = ({ title, subtitle, className, compact }: SectionHeaderProps) => (
  <div className={cn("space-y-1", className)}>
    <h2 className={cn(
      "font-display font-semibold tracking-tight text-foreground",
      compact ? "text-lg" : "text-xl md:text-2xl"
    )}>
      {title}
    </h2>
    {subtitle && (
      <p className={cn(
        "text-muted-foreground leading-relaxed",
        compact ? "text-xs" : "text-sm"
      )}>
        {subtitle}
      </p>
    )}
  </div>
);
