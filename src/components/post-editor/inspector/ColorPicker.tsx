import React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface PaletteColor {
  hex: string;
  name: string;
}

interface ColorPickerProps {
  palette: PaletteColor[];
  value?: string | null;
  onChange: (color: string) => void;
  size?: "sm" | "md";
  allowTransparent?: boolean;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  palette,
  value,
  onChange,
  size = "sm",
  allowTransparent,
}) => {
  const dim = size === "md" ? "w-7 h-7" : "w-6 h-6";
  return (
    <div className="flex gap-1 flex-wrap items-center">
      {allowTransparent && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onChange("transparent")}
              className={`${dim} rounded-md border border-dashed text-[10px] flex items-center justify-center hover:bg-muted transition-colors`}
              aria-label="Transparente"
            >
              ∅
            </button>
          </TooltipTrigger>
          <TooltipContent>Transparente</TooltipContent>
        </Tooltip>
      )}
      {palette.map((color, i) => (
        <Tooltip key={i}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onChange(color.hex)}
              className={`${dim} rounded-md border-2 transition-all ${
                value === color.hex
                  ? "ring-2 ring-primary ring-offset-1 scale-110"
                  : "hover:scale-105"
              }`}
              style={{
                backgroundColor: color.hex,
                borderColor: value === color.hex ? color.hex : "transparent",
              }}
              aria-label={color.name}
            />
          </TooltipTrigger>
          <TooltipContent>{color.name}</TooltipContent>
        </Tooltip>
      ))}
      <Tooltip>
        <TooltipTrigger asChild>
          <label
            className={`${dim} rounded-md border-2 border-dashed border-muted-foreground/40 cursor-pointer flex items-center justify-center hover:bg-muted transition-colors relative`}
          >
            <input
              type="color"
              value={value && value !== "transparent" ? value : "#7c3aed"}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <span className="text-muted-foreground text-xs font-bold pointer-events-none">+</span>
          </label>
        </TooltipTrigger>
        <TooltipContent>Cor personalizada</TooltipContent>
      </Tooltip>
    </div>
  );
});
ColorPicker.displayName = "ColorPicker";

export default ColorPicker;
