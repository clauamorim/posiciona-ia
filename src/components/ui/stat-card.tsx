import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  value: number | string;
  label: string;
  description?: string;
  className?: string;
}

export const StatCard = ({ icon: Icon, value, label, description, className }: StatCardProps) => (
  <div className={cn(
    "flex items-center gap-2.5 p-3 rounded-lg bg-card border border-border",
    className
  )}>
    <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
    <span className="text-base font-bold text-foreground">{value}</span>
    <div className="min-w-0">
      <p className="text-[11px] font-sans font-medium text-muted-foreground leading-tight truncate">{label}</p>
      {description && (
        <p className="text-[10px] text-disabled leading-tight truncate">{description}</p>
      )}
    </div>
  </div>
);
