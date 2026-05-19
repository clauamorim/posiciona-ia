import { useMemo } from "react";
import { cn } from "@/lib/utils";

export function getPasswordStrength(password: string): { score: 0 | 1 | 2 | 3; label: string } {
  if (!password) return { score: 0, label: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  const variety =
    (/[a-z]/.test(password) ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/\d/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);
  if (variety >= 2) score++;
  if (variety >= 3) score++;
  const final = Math.min(3, Math.max(1, Math.ceil(score / 1.5))) as 1 | 2 | 3;
  const label = final === 1 ? "Fraca" : final === 2 ? "Média" : "Forte";
  return { score: final, label };
}

export const PasswordStrengthMeter = ({ password }: { password: string }) => {
  const { score, label } = useMemo(() => getPasswordStrength(password), [password]);
  if (!password) return null;
  const colors = ["bg-destructive", "bg-amber-500", "bg-emerald-500"];
  const labelColor = score === 1 ? "text-destructive" : score === 2 ? "text-amber-600" : "text-emerald-600";
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i < score ? colors[score - 1] : "bg-muted"
            )}
          />
        ))}
      </div>
      <p className={cn("text-xs font-medium", labelColor)}>Força: {label}</p>
    </div>
  );
};
