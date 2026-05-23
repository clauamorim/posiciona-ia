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
  /** Corpo opcional de abertura. Recebe copy[0] no carrossel para paridade
   *  com o PostCanvas legado, que mostra título + corpo no slide 0. */
  body?: string;
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
  /**
   * Accent secundário, usado por templates com 2 zonas distintas
   * (ex: Manuscrito tem accent dourado em cima do split e accent
   * mais quente/escuro embaixo). Quando vazio, cai pra ouroAccent.
   */
  secondaryAccent?: string;
  bodyFont?: "lato" | "cormorant" | "playfair";
  numberingStyle?: "plain" | "bracketed" | "roman";
  showOrnaments?: boolean;
  showSwipeHint?: boolean;
  eyebrowText?: string | null;
  /**
   * Rótulo de seção que aparece antes do tópico em cada slide de cláusula
   * ("CLÁUSULA · TÓPICO"). Variável porque nem todo carrossel é sobre
   * cláusulas — pode ser "SITUAÇÃO", "PASSO", "CAPÍTULO", "DICA", etc.
   * Default: "CLÁUSULA".
   */
  sectionLabel?: string;
  /**
   * Marca/assinatura mostrada no rodapé dos slides de cláusula.
   * Default: nome da empresa do usuário (lido do business questionnaire);
   * caso vazio, cai para "Posiciona Editorial".
   */
  brandMark?: string;
}
