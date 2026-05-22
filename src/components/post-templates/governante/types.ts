// Tipos do template editorial "Governante", derivados de
// design-sources/governante/manifest.json.

export type Format = "4:5" | "9:16";
export type CardKind = "cover" | "clause" | "close";

export interface CoverSlots {
  eyebrow: string;
  kicker: string;
  countWord: string;
  titleLead: string;
  titleTail: string;
  footer: string;
}

export interface ClauseSlots {
  num: string;
  roman?: string;
  topic: string;
  title: string;
  body: string;
  detail?: string;
}

export interface CloseSlots {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
}

export type CardData =
  | ({ kind: "cover" } & CoverSlots)
  | ({ kind: "clause" } & ClauseSlots)
  | ({ kind: "close" } & CloseSlots);

export interface SertaoTokens {
  verdeBg?: string;
  areiaInk?: string;
  ouroAccent?: string;
  bodyFont?: "lato" | "cormorant" | "playfair";
  numberingStyle?: "plain" | "bracketed" | "roman";
  showOrnaments?: boolean;
  showSwipeHint?: boolean;
  eyebrowText?: string | null;
}
