import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, ExternalLink } from "lucide-react";

export interface MarketTrend {
  title: string;
  summary?: string;
  source_url?: string;
  published_at?: string;
  angle_suggestion?: string;
}

interface MarketTrendsSectionProps {
  trends: MarketTrend[];
  feedDays: { dayIndex: number; dayNumber: number; theme: string }[];
  onCreatePost: (trend: MarketTrend, dayIndex: number) => Promise<void>;
  disabled?: boolean;
}

export function MarketTrendsSection({ trends, feedDays, onCreatePost, disabled }: MarketTrendsSectionProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<Record<number, string>>({});
  const [submittingIdx, setSubmittingIdx] = useState<number | null>(null);

  if (!trends || trends.length === 0) return null;

  const handleClick = async (idx: number, trend: MarketTrend) => {
    const dayKey = selectedDay[idx];
    if (!dayKey) {
      setActiveIdx(idx);
      return;
    }
    const dayIndex = Number(dayKey);
    if (Number.isNaN(dayIndex)) return;
    setSubmittingIdx(idx);
    try {
      await onCreatePost(trend, dayIndex);
      setActiveIdx(null);
    } finally {
      setSubmittingIdx(null);
    }
  };

  return (
    <section className="mb-4" data-hide-pdf>
      <header className="flex items-center gap-2 mb-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight">
          Baseado no que está acontecendo na sua área
        </h2>
      </header>
      <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {trends.map((trend, idx) => {
          const isOpen = activeIdx === idx;
          const isSubmitting = submittingIdx === idx;
          return (
            <Card key={idx} className="border border-border/70 bg-card/60">
              <CardContent className="py-3 space-y-2">
                <h3 className="text-sm font-semibold leading-snug line-clamp-2">{trend.title}</h3>
                {trend.summary && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {trend.summary}
                  </p>
                )}
                {trend.source_url && (
                  <a
                    href={trend.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary"
                  >
                    Fonte <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {isOpen ? (
                  <div className="flex flex-col gap-2 pt-1">
                    <Select
                      value={selectedDay[idx] || ""}
                      onValueChange={(v) => setSelectedDay((prev) => ({ ...prev, [idx]: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Substituir o post do dia…" />
                      </SelectTrigger>
                      <SelectContent>
                        {feedDays.map((d) => (
                          <SelectItem key={d.dayIndex} value={String(d.dayIndex)} className="text-xs">
                            Dia {d.dayNumber}{d.theme ? ` — ${d.theme.slice(0, 40)}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-7 text-[11px] flex-1"
                        disabled={!selectedDay[idx] || isSubmitting || disabled}
                        onClick={() => handleClick(idx, trend)}
                      >
                        {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirmar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px]"
                        disabled={isSubmitting}
                        onClick={() => setActiveIdx(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] w-full"
                    disabled={disabled || feedDays.length === 0}
                    onClick={() => setActiveIdx(idx)}
                  >
                    Criar post sobre isso
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        Substitui o post do dia escolhido (consome 1 ajuste de conteúdo).
      </p>
    </section>
  );
}
