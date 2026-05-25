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
  /**
   * Multiplicadores manuais de tamanho de fonte por slot (0.6..1.4).
   * Aplicados sobre o `fontSize` base do slot antes do autofit, permitindo
   * que o usuário reduza/aumente texto quando o autofit não acomoda bem.
   * Default 1 (= sem alteração) quando ausente.
   */
  closeTitleScale?: number;
  closeBodyScale?: number;
  coverTitleScale?: number;
  coverCountScale?: number;
  clauseBodyScale?: number;

  // ── Logo da marca ────────────────────────────────────────────────
  // Logo PNG (com fundo já removido — vem de user_gallery_assets
  // is_logo=true via fetchUserLogo, que garante transparência real)
  // renderizada como camada do template. Controles ficam no inspector.
  /** URL (signed) da logo. Quando vazio, nenhuma logo é renderizada. */
  logoUrl?: string | null;
  /** Toggle pra mostrar/esconder a logo sem perder a URL. Default true. */
  showLogo?: boolean;
  /** Largura da logo em % da largura do card (0..100). Default ~18%. */
  logoSize?: number;
  /** Opacidade da logo (0..1). Default 1. */
  logoOpacity?: number;
  /**
   * Quando true, a logo é renderizada ATRÁS dos textos do template (z-index
   * baixo), funcionando como marca d'água. Quando false (default), fica na
   * frente, no rodapé direito.
   */
  logoBehindText?: boolean;
  /** Posição X do centro da logo em % da largura do card (0..100). Quando ausente, usa canto inf direito. */
  logoX?: number;
  /** Posição Y do centro da logo em % da altura do card (0..100). Quando ausente, usa canto inf direito. */
  logoY?: number;
}
