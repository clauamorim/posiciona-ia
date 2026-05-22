import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ColorPicker, { PaletteColor } from "./ColorPicker";
import {
  AREIA,
  AREIA_TINT,
  GRAFITE,
  MOGNO,
  OURO,
  OURO_INK,
  VERDE,
  VERDE_INK,
} from "@/components/post-templates/governante/tokens";
import type { SertaoTokens } from "@/components/post-templates/governante/types";

const SERTAO_PALETTE: PaletteColor[] = [
  { hex: VERDE, name: "Verde Sertão" },
  { hex: VERDE_INK, name: "Verde Tinta" },
  { hex: GRAFITE, name: "Grafite" },
  { hex: MOGNO, name: "Mogno" },
  { hex: OURO, name: "Ouro" },
  { hex: OURO_INK, name: "Ouro Velho" },
  { hex: AREIA, name: "Areia" },
  { hex: AREIA_TINT, name: "Areia Suave" },
];

interface Props {
  tokens: Partial<SertaoTokens>;
  onChange: (patch: Partial<SertaoTokens>) => void;
  onReset: () => void;
  /** Sugestão pro brandMark (geralmente o nome do negócio do usuário). */
  defaultBrandMark?: string;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
      {label}
    </label>
    {children}
  </div>
);

const TemplateSertaoPanel: React.FC<Props> = ({ tokens, onChange, onReset, defaultBrandMark }) => {
  const brandMarkPlaceholder = (defaultBrandMark || "Posiciona Editorial").trim();
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Template</h3>
          <p className="text-[11px] text-muted-foreground">Governante · Sertão Profundo</p>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={onReset}>
          Restaurar
        </Button>
      </div>

      <Row label="Rótulo da seção">
        <Input
          className="h-8 text-xs"
          placeholder="CLÁUSULA"
          value={tokens.sectionLabel ?? ""}
          onChange={(e) => onChange({ sectionLabel: e.target.value })}
        />
        <p className="text-[10px] text-muted-foreground">
          Aparece antes do tópico em cada slide. Ex.: CLÁUSULA, SITUAÇÃO, PASSO, DICA, CAPÍTULO.
        </p>
      </Row>

      <Row label="Marca no rodapé">
        <Input
          className="h-8 text-xs"
          placeholder={brandMarkPlaceholder}
          value={tokens.brandMark ?? ""}
          onChange={(e) => onChange({ brandMark: e.target.value })}
        />
        <p className="text-[10px] text-muted-foreground">
          Vazio usa o nome do seu negócio automaticamente.
        </p>
      </Row>

      <Row label="Cor de fundo">
        <ColorPicker
          palette={SERTAO_PALETTE}
          value={tokens.verdeBg ?? VERDE}
          onChange={(c) => onChange({ verdeBg: c })}
        />
      </Row>

      <Row label="Cor da tinta">
        <ColorPicker
          palette={SERTAO_PALETTE}
          value={tokens.areiaInk ?? AREIA}
          onChange={(c) => onChange({ areiaInk: c })}
        />
      </Row>

      <Row label="Cor do accent (réguas, número, diamantes)">
        <ColorPicker
          palette={SERTAO_PALETTE}
          value={tokens.ouroAccent ?? OURO}
          onChange={(c) => onChange({ ouroAccent: c })}
        />
      </Row>

      <Row label="Fonte do corpo">
        <Select
          value={tokens.bodyFont ?? "cormorant"}
          onValueChange={(v) => onChange({ bodyFont: v as SertaoTokens["bodyFont"] })}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cormorant">Cormorant Garamond</SelectItem>
            <SelectItem value="lato">Lato</SelectItem>
            <SelectItem value="playfair">Playfair Display</SelectItem>
          </SelectContent>
        </Select>
      </Row>

      <Row label="Numeração">
        <Select
          value={tokens.numberingStyle ?? "plain"}
          onValueChange={(v) =>
            onChange({ numberingStyle: v as SertaoTokens["numberingStyle"] })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="plain">Padrão · 01</SelectItem>
            <SelectItem value="bracketed">Colchetes · [ 01 ]</SelectItem>
            <SelectItem value="roman">Romano · I</SelectItem>
          </SelectContent>
        </Select>
      </Row>

      <div className="flex items-center justify-between pt-1">
        <label className="text-xs">Ornamentos (diamantes)</label>
        <Switch
          checked={tokens.showOrnaments !== false}
          onCheckedChange={(v) => onChange({ showOrnaments: v })}
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="text-xs">Indicação "arraste"</label>
        <Switch
          checked={tokens.showSwipeHint !== false}
          onCheckedChange={(v) => onChange({ showSwipeHint: v })}
        />
      </div>
    </div>
  );
};

export default TemplateSertaoPanel;
