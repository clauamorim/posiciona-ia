import React from "react";
import { Button } from "@/components/ui/button";
import { Download, RotateCcw, AlignCenter, AlignLeft, Columns } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PaletteColor {
  hex: string;
  name: string;
}

interface PostToolbarProps {
  palette: PaletteColor[];
  selectedBgIndex: number;
  onBgChange: (index: number) => void;
  layout: "centered" | "top" | "split";
  onLayoutChange: (layout: "centered" | "top" | "split") => void;
  onDownload: () => void;
  onReset: () => void;
}

const LAYOUTS = [
  { value: "centered" as const, icon: AlignCenter, label: "Centralizado" },
  { value: "top" as const, icon: AlignLeft, label: "Topo" },
  { value: "split" as const, icon: Columns, label: "Dividido" },
];

const PostToolbar: React.FC<PostToolbarProps> = ({
  palette,
  selectedBgIndex,
  onBgChange,
  layout,
  onLayoutChange,
  onDownload,
  onReset,
}) => {
  return (
    <div className="flex flex-col gap-6 p-4 rounded-xl bg-card border">
      {/* Colors */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Cor de fundo</h4>
        <div className="flex gap-2 flex-wrap">
          {palette.map((color, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onBgChange(i)}
                  className={`w-10 h-10 rounded-lg transition-all border-2 ${
                    i === selectedBgIndex ? "ring-2 ring-primary ring-offset-2 scale-110" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.hex, borderColor: i === selectedBgIndex ? color.hex : "transparent" }}
                />
              </TooltipTrigger>
              <TooltipContent>{color.name}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Layout */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Layout</h4>
        <div className="flex gap-2">
          {LAYOUTS.map(({ value, icon: Icon, label }) => (
            <Tooltip key={value}>
              <TooltipTrigger asChild>
                <Button
                  variant={layout === value ? "default" : "outline"}
                  size="icon"
                  onClick={() => onLayoutChange(value)}
                >
                  <Icon className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2">
        <Button onClick={onDownload} className="gap-2 w-full">
          <Download className="h-4 w-4" /> Baixar PNG
        </Button>
        <Button variant="outline" onClick={onReset} className="gap-2 w-full">
          <RotateCcw className="h-4 w-4" /> Resetar textos
        </Button>
      </div>
    </div>
  );
};

export default PostToolbar;
