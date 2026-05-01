// Cliente Claude (Anthropic) para edge functions.
//
// API Reference: https://docs.anthropic.com/en/api/messages
//
// Suporta:
// - System prompt
// - Mensagens user/assistant
// - Anexar PDFs como conteúdo `document` (base64) — para passar referências
//   como StoryBrand, Made to Stick e Obviously Awesome.
// - Timeout configurável com AbortController.
//
// Não usa SDK — fetch direto para manter zero dependências.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// Modelo Claude Sonnet 4.5 (sonnet-4-5) — melhor custo/benefício para
// geração editorial longa. Trocar para "claude-opus-4-1" se precisar de
// mais profundidade no relatório estratégico (mais caro).
export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-5";

export interface ClaudePdfPart {
  /** PDF base64-encoded (sem o prefixo `data:`). */
  data: string;
  /** Sempre "application/pdf" para PDFs. */
  mime_type?: string;
}

export interface CallClaudeOptions {
  systemPrompt: string;
  /** Texto humano (prompt do usuário). PDFs são anexados antes deste texto. */
  userText: string;
  pdfs?: ClaudePdfPart[];
  model?: string;
  max_tokens?: number;
  /** Timeout em ms. Padrão: 120s. */
  timeoutMs?: number;
  /**
   * Desativa o retry automático em 429/5xx. Útil para chamadas caras
   * (ex.: relatório estratégico) onde cada tentativa custa tokens reais
   * e o caller prefere falhar rápido + permitir retry manual do usuário.
   */
  disableRetries?: boolean;
}

export class ClaudeError extends Error {
  status?: number;
  userMessage?: string;
  /** Delay sugerido pela API (em ms) extraído de headers tipo retry-after. */
  retryAfterMs?: number;
  constructor(message: string, status?: number, userMessage?: string, retryAfterMs?: number) {
    super(message);
    this.status = status;
    this.userMessage = userMessage;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Possible Anthropic stop_reason values: "end_turn", "max_tokens",
 * "stop_sequence", "tool_use", or null/undefined.
 */
export type ClaudeStopReason =
  | "end_turn"
  | "max_tokens"
  | "stop_sequence"
  | "tool_use"
  | string
  | null;

export interface ClaudeResponse {
  text: string;
  stopReason: ClaudeStopReason;
}

/**
 * Chama o Claude Messages API e retorna o texto completo da resposta.
 * Faz tratamento de erros amigável (timeout, 429, 402, JSON inválido).
 */
export async function callClaude(opts: CallClaudeOptions): Promise<string> {
  const { text } = await callClaudeWithMeta(opts);
  return text;
}

/**
 * Variante que devolve também o `stop_reason` da Anthropic. Útil para
 * o caller detectar truncamento (`stop_reason === "max_tokens"`) e acionar
 * recuperação parcial em vez de falhar o job inteiro.
 */
export async function callClaudeWithMeta(opts: CallClaudeOptions): Promise<ClaudeResponse> {
  // 429 é retorno ANTES do consumo de tokens — sempre seguro de retry.
  // Mesmo quando o caller passa `disableRetries: true` (proteção contra
  // cobrança em loop por truncamento), continuamos retentando em 429.
  const RETRY_DELAYS_MS = opts.disableRetries
    ? [5000, 15000, 30000]   // só usado para 429 quando retries estão "desativados"
    : [3000, 8000, 20000, 40000];

  const clampDelay = (ms: number) => Math.min(60000, Math.max(3000, ms));

  let lastError: any;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await callClaudeOnce(opts);
    } catch (e) {
      lastError = e;
      const status = e instanceof ClaudeError ? e.status : undefined;
      const is429 = status === 429;
      const isOther5xx = status === 529 || (status !== undefined && status >= 500 && status < 600);
      // Quando disableRetries está ligado, só retenta em 429 (não consome tokens).
      const retriable = opts.disableRetries ? is429 : (is429 || isOther5xx);
      if (!retriable || attempt === RETRY_DELAYS_MS.length) throw e;
      const suggested = e instanceof ClaudeError && typeof e.retryAfterMs === "number" ? e.retryAfterMs : undefined;
      const delay = clampDelay(suggested ?? RETRY_DELAYS_MS[attempt]);
      console.warn(`Claude ${status} — retry ${attempt + 1}/${RETRY_DELAYS_MS.length} em ${delay}ms${suggested ? " (sugerido pela API)" : ""}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

async function callClaudeOnce({
  systemPrompt,
  userText,
  pdfs = [],
  model = DEFAULT_CLAUDE_MODEL,
  max_tokens = 6000,
  timeoutMs = 120000,
}: CallClaudeOptions): Promise<ClaudeResponse> {
  if (!ANTHROPIC_API_KEY) {
    throw new ClaudeError(
      "ANTHROPIC_API_KEY não configurada",
      500,
      "A geração está temporariamente indisponível. Tente novamente em alguns minutos."
    );
  }

  // Monta o conteúdo do user: PDFs primeiro (Anthropic recomenda) + texto.
  const userContent: any[] = [];
  for (const pdf of pdfs) {
    userContent.push({
      type: "document",
      source: {
        type: "base64",
        media_type: pdf.mime_type || "application/pdf",
        data: pdf.data,
      },
    });
  }
  userContent.push({ type: "text", text: userText });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        // Necessário para enviar PDFs como `document`.
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model,
        max_tokens,
        system: systemPrompt,
        messages: [
          { role: "user", content: userContent },
        ],
      }),
    });
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e?.name === "AbortError") {
      throw new ClaudeError(
        "Tempo limite excedido na chamada à IA",
        504,
        "A IA demorou para responder. Tente novamente em alguns segundos."
      );
    }
    throw new ClaudeError(
      `Falha de rede ao chamar Claude: ${e?.message || e}`,
      502,
      "Falha de conexão com a IA. Tente novamente em alguns segundos."
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    let userMessage: string | undefined;
    let retryAfterMs: number | undefined;
    if (response.status === 429) {
      userMessage = "O serviço de IA está com muita demanda agora. Aguarde cerca de 1 minuto e tente novamente — seu crédito não foi consumido.";
      // Anthropic envia retry-after em segundos. Também há
      // anthropic-ratelimit-*-reset (ISO timestamp) para janelas específicas.
      const ra = response.headers.get("retry-after");
      if (ra) {
        const seconds = Number(ra);
        if (Number.isFinite(seconds) && seconds > 0) {
          retryAfterMs = Math.round(seconds * 1000);
        }
      }
      if (retryAfterMs === undefined) {
        const reset = response.headers.get("anthropic-ratelimit-input-tokens-reset")
          || response.headers.get("anthropic-ratelimit-requests-reset");
        if (reset) {
          const t = Date.parse(reset);
          if (Number.isFinite(t)) {
            retryAfterMs = Math.max(0, t - Date.now());
          }
        }
      }
    } else if (response.status === 402 || response.status === 401) {
      userMessage = "A geração está temporariamente indisponível. Tente novamente em alguns minutos.";
    } else if (response.status >= 500) {
      userMessage = "A IA está instável agora. Tente novamente em alguns segundos.";
    }
    console.error(`Claude API error ${response.status}:`, errText.substring(0, 500));
    throw new ClaudeError(
      `Claude API error: ${response.status} - ${errText.substring(0, 200)}`,
      response.status,
      userMessage,
      retryAfterMs,
    );
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new ClaudeError(
      "Resposta inválida do Claude",
      502,
      "A IA retornou uma resposta inválida. Tente novamente."
    );
  }

  // Anthropic retorna `content: [{ type: "text", text: "..." }, ...]`
  const blocks = Array.isArray(data?.content) ? data.content : [];
  const text = blocks
    .filter((b: any) => b?.type === "text" && typeof b.text === "string")
    .map((b: any) => b.text)
    .join("");

  if (!text.trim()) {
    throw new ClaudeError(
      "Conteúdo vazio do Claude",
      502,
      "A IA não retornou conteúdo. Tente novamente em alguns segundos."
    );
  }

  const stopReason: ClaudeStopReason = (data?.stop_reason ?? null) as ClaudeStopReason;
  return { text, stopReason };
}
