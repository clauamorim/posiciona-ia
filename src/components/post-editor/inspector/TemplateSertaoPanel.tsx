import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import type { CardData, SertaoTokens } from "@/components/post-templates/governante/types";

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
  /** Card atualmente visível no canvas — base pros campos da seção "Conteúdo do slide". */
  currentCard?: CardData | null;
  /** Índice do slide atual (0..6), só pra mostrar no header da seção. */
  currentSlideIndex?: number;
  /** Edita um slot do slide atual (eyebrow, kicker, titleLead, etc.). */
  onEditCurrentSlot?: (field: string, value: string) => void;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
      {label}
    </label>
    {children}
  </div>
);

const slideKindLabel = (kind: CardData["kind"] | undefined, index: number | undefined): string => {
  if (kind === "cover") return "Capa";
  if (kind === "close") return "Fechamento";
  if (kind === "clause") {
    const n = typeof index === "number" ? index : null;
    return n != null ? `Cláusula ${n}` : "Cláusula";
  }
  return "Slide";
};

const SlotFields: React.FC<{ card: CardData; onEdit: (field: string, value: string) => void }> = ({ card, onEdit }) => {
  const text = (field: string, label: string, placeholder: string, value: string) => (
    <Row label={label} key={field}>
      <Input
        className="h-8 text-xs"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onEdit(field, e.target.value)}
      />
    </Row>
  );
  const area = (field: string, label: string, placeholder: string, value: string) => (
    <Row label={label} key={field}>
      <Textarea
        className="text-xs min-h-[60px]"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onEdit(field, e.target.value)}
      />
    </Row>
  );

  if (card.kind === "cover") {
    return (
      <>
        {text("eyebrow",   "Sobretítulo (eyebrow)",       "ex: POSICIONA EDITORIAL · DIREITO DO AGRO", card.eyebrow)}
        {text("kicker",    "Palavra-tema (italic ouro)",  "ex: Cláusulas",                              card.kicker)}
        {text("countWord", "Número por extenso (gigante)","ex: Sete",                                   card.countWord)}
        {area("titleLead", "Título principal",            "Título principal da capa",                   card.titleLead)}
        {area("titleTail", "Complemento (italic suave)",  "complemento do título (opcional)",           card.titleTail)}
        {text("footer",    "Rodapé esquerdo",             "ex: arraste para começar",                   card.footer)}
      </>
    );
  }
  if (card.kind === "clause") {
    return (
      <>
        {text("topic", "Tópico (no eyebrow)",  "ex: PRAZO, REAJUSTE, CAR",          card.topic)}
        {text("title", "Título da cláusula",   "ex: Prazo e renovação automática",  card.title)}
        {area("body",  "Texto da cláusula",    "Frase-resumo curta da cláusula",    card.body)}
      </>
    );
  }
  // close
  return (
    <>
      {text("eyebrow", "Sobretítulo",        "ex: FECHAMENTO",                            card.eyebrow)}
      {area("title",   "Frase de fechamento","ex: Releia seu contrato esta semana.",      card.title)}
      {area("body",    "Apoio do fechamento","Texto curto reforçando a ideia (opcional)", card.body)}
      {text("cta",     "Chamada à ação",     "ex: Salve para a próxima revisão.",         card.cta)}
    </>
  );
};

const TemplateSertaoPanel: React.FC<Props> = ({
  tokens, onChange, onReset, defaultBrandMark,
  currentCard, currentSlideIndex, onEditCurrentSlot,
}) => {
  const brandMarkPlaceholder = (defaultBrandMark || "Posiciona Editorial").trim();
  const slideLabel = slideKindLabel(currentCard?.kind, currentSlideIndex);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Template</h3>
          <p className="text-[11px] text-muted-foreground">Sertão Profundo · Editorial</p>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={onReset}>
          Restaurar
        </Button>
      </div>

      {currentCard && onEditCurrentSlot && (
        <div className="space-y-3 rounded-md border border-border/50 bg-muted/20 p-3">
          <div className="flex items-baseline justify-between">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/80">
              Conteúdo do slide
            </h4>
            <span className="text-[10px] text-muted-foreground">{slideLabel}</span>
          </div>
          <SlotFields card={currentCard} onEdit={onEditCurrentSlot} />
        </div>
      )}

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
