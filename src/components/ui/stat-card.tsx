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
    "p-3 rounded-xl bg-muted/30 border border-border/50 space-y-1",
    className
  )}>
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xl font-bold text-foreground">{value}</span>
    </div>
    <p className="text-[11px] font-semibold text-foreground/80 leading-tight">{label}</p>
    {description && (
      <p className="text-[10px] text-muted-foreground leading-tight">{description}</p>
    )}
  </div>
);
