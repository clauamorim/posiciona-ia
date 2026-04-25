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
}

export class ClaudeError extends Error {
  status?: number;
  userMessage?: string;
  constructor(message: string, status?: number, userMessage?: string) {
    super(message);
    this.status = status;
    this.userMessage = userMessage;
  }
}

/**
 * Chama o Claude Messages API e retorna o texto completo da resposta.
 * Faz tratamento de erros amigável (timeout, 429, 402, JSON inválido).
 */
export async function callClaude(opts: CallClaudeOptions): Promise<string> {
  const RETRY_DELAYS_MS = [2000, 5000, 10000];
  let lastError: any;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await callClaudeOnce(opts);
    } catch (e) {
      lastError = e;
      const status = e instanceof ClaudeError ? e.status : undefined;
      const retriable = status === 429 || status === 529 || (status !== undefined && status >= 500 && status < 600);
      if (!retriable || attempt === RETRY_DELAYS_MS.length) throw e;
      const delay = RETRY_DELAYS_MS[attempt];
      console.warn(`Claude ${status} — retry ${attempt + 1}/${RETRY_DELAYS_MS.length} em ${delay}ms`);
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
}: CallClaudeOptions): Promise<string> {
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
    if (response.status === 429) {
      userMessage = "Muitas solicitações ao mesmo tempo. Aguarde um pouco e tente novamente.";
    } else if (response.status === 402 || response.status === 401) {
      userMessage = "A geração está temporariamente indisponível. Tente novamente em alguns minutos.";
    } else if (response.status >= 500) {
      userMessage = "A IA está instável agora. Tente novamente em alguns segundos.";
    }
    console.error(`Claude API error ${response.status}:`, errText.substring(0, 500));
    throw new ClaudeError(
      `Claude API error: ${response.status} - ${errText.substring(0, 200)}`,
      response.status,
      userMessage
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

  return text;
}
