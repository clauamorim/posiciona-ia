// Cliente Claude (Anthropic) para edge functions.
//
// API Reference: https://docs.anthropic.com/en/api/messages
//
// Suporta:
// - System prompt
// - Mensagens user/assistant
// - Anexar PDFs como conteúdo `document` (base64) — para passar referências
//   como StoryBrand, Made to Stick e Obviously Awesome.
// - Streaming via SSE: tokens chegam progressivamente, e o `timeoutMs`
//   configurável é um IDLE timeout (tempo máximo SEM receber chunks),
//   não um timeout total. Permite gerações que demoram >120s contanto
//   que o Claude continue mandando bytes. Ceiling global interno de 3min
//   garante que nunca passe do watchdog de 4min em `get-report-generation-job`.
//
// Não usa SDK — fetch direto para manter zero dependências.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// Modelo Claude Sonnet 4.6 — sucessor do 4.5, com mais profundidade
// editorial e menos alucinação em prompts longos. Trocar para
// "claude-opus-4-1" se precisar de ainda mais profundidade no relatório
// estratégico (mais caro).
export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-6";

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
  /**
   * Idle timeout em ms (tempo máximo SEM receber chunks do stream). Padrão: 120s.
   * Não é um timeout total — com streaming, gerações longas (>2 min) terminam
   * normalmente contanto que o Claude continue mandando bytes. Um ceiling
   * global de 3 min é aplicado internamente, abaixo do watchdog de 4 min.
   */
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

  // Streaming: idle timeout (gap entre chunks) + ceiling total como salvaguarda.
  // Ceiling fica abaixo do watchdog (4min) — assim, mesmo no pior caso,
  // a chamada aborta com erro antes do watchdog marcar o job como failed.
  // O caller (process-report-generation-job) é responsável por enviar
  // heartbeats periódicos enquanto esta função está rodando, senão o
  // watchdog pode disparar em chamadas longas.
  const IDLE_TIMEOUT_MS = timeoutMs;
  const TOTAL_CEILING_MS = 3 * 60 * 1000;

  const controller = new AbortController();
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const resetIdle = () => {
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
  };
  const totalTimer = setTimeout(() => controller.abort(), TOTAL_CEILING_MS);
  const clearTimers = () => {
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    clearTimeout(totalTimer);
  };
  resetIdle();

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
        stream: true,
        system: systemPrompt,
        messages: [
          { role: "user", content: userContent },
        ],
      }),
    });
  } catch (e: any) {
    clearTimers();
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
  }

  if (!response.ok) {
    clearTimers();
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

  const reader = response.body?.getReader();
  if (!reader) {
    clearTimers();
    throw new ClaudeError(
      "Resposta sem corpo do Claude",
      502,
      "A IA retornou resposta vazia. Tente novamente."
    );
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let stopReason: ClaudeStopReason = null;
  let streamError: ClaudeError | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      resetIdle();
      // Normaliza CRLF→LF para o parser SSE.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      // SSE: eventos separados por \n\n; dentro de cada evento, linhas
      // event:/data:. Ignoramos `event:` (o tipo já vem no JSON de `data:`).
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        sep = buffer.indexOf("\n\n");

        let dataPayload = "";
        for (const line of rawEvent.split("\n")) {
          if (line.startsWith("data:")) {
            dataPayload += line.slice(line.startsWith("data: ") ? 6 : 5);
          }
        }
        if (!dataPayload) continue;

        let evt: any;
        try {
          evt = JSON.parse(dataPayload);
        } catch {
          continue;
        }

        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          text += evt.delta.text || "";
        } else if (evt.type === "message_delta" && evt.delta?.stop_reason) {
          stopReason = evt.delta.stop_reason as ClaudeStopReason;
        } else if (evt.type === "error") {
          streamError = new ClaudeError(
            `Erro no stream do Claude: ${evt.error?.message || "desconhecido"}`,
            502,
            "A IA retornou erro durante a geração. Tente novamente em alguns segundos."
          );
        }
      }
    }
  } catch (e: any) {
    clearTimers();
    if (e?.name === "AbortError") {
      throw new ClaudeError(
        "Tempo limite excedido na chamada à IA",
        504,
        "A IA demorou para responder. Tente novamente em alguns segundos."
      );
    }
    throw new ClaudeError(
      `Falha lendo stream do Claude: ${e?.message || e}`,
      502,
      "Falha de conexão com a IA. Tente novamente em alguns segundos."
    );
  } finally {
    clearTimers();
    try { reader.releaseLock(); } catch { /* ignore */ }
  }

  if (streamError) throw streamError;

  if (!text.trim()) {
    throw new ClaudeError(
      "Conteúdo vazio do Claude",
      502,
      "A IA não retornou conteúdo. Tente novamente em alguns segundos."
    );
  }

  return { text, stopReason };
}
