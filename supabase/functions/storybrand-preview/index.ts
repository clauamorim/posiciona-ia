// Prévia resumida da narrativa StoryBrand, gerada logo após a conclusão do
// Diagnóstico do Negócio — recompensa intermediária da jornada. A versão
// completa continua sendo gerada pelo relatório estratégico.
// Mesmo padrão do questionnaire-interview: Gemini direto (GEMINI_API_KEY),
// lista de modelos com fallback e timeout por tentativa. Não escreve no banco;
// o cliente cacheia em localStorage.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const GEMINI_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash-lite"];
const PER_MODEL_TIMEOUT_MS = 30_000;

// Campos do diagnóstico usados como matéria-prima (espelho de
// src/pages/BusinessQuestionnaire.tsx).
const INPUT_FIELDS = [
  "company_name",
  "services",
  "target_audience",
  "external_problems",
  "internal_problems",
  "empathic_statements",
  "authority_proofs",
  "hiring_steps",
  "client_fears",
  "main_cta",
  "negative_consequences",
  "promised_transformations",
] as const;

const SYSTEM_PROMPT = `Você é a estrategista da Posiciona. A partir das respostas do Diagnóstico do Negócio de um profissional, monte a PRÉVIA da narrativa StoryBrand (Donald Miller) da marca dele.

Regras:
- Escreva em português brasileiro, tom elegante e direto, sem emojis.
- Cada elemento deve ser CURTO: 1 a 2 frases (é uma prévia; a versão completa virá no relatório).
- Use SOMENTE as informações das respostas. Não invente números, certificações ou fatos.
- O cliente é o herói; o profissional é o guia.
- "hero": quem é o cliente ideal, em uma frase.
- "external_problem": o problema prático e visível.
- "internal_problem": como o cliente se sente.
- "philosophical_problem": por que isso é injusto/errado no nível de princípio (derive das respostas).
- "guide": o profissional como guia — empatia + autoridade, em 1-2 frases.
- "plan": exatamente 3 passos curtos para contratar (baseie-se nas etapas informadas; se faltarem, simplifique em 3 passos genéricos coerentes com o serviço).
- "cta": a chamada para ação principal, imperativa e direta.
- "success": a transformação alcançada.
- "failure": o que o cliente evita ao agir.

Responda SEMPRE no JSON do schema.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    hero: { type: "STRING" },
    external_problem: { type: "STRING" },
    internal_problem: { type: "STRING" },
    philosophical_problem: { type: "STRING" },
    guide: { type: "STRING" },
    plan: { type: "ARRAY", items: { type: "STRING" } },
    cta: { type: "STRING" },
    success: { type: "STRING" },
    failure: { type: "STRING" },
  },
  required: ["hero", "external_problem", "internal_problem", "philosophical_problem", "guide", "plan", "cta", "success", "failure"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_KEY) return json({ error: "GEMINI_API_KEY não configurada" }, 500);

    const { answers, profession, niche } = await req.json();
    if (!answers || typeof answers !== "object") {
      return json({ error: "answers é obrigatório" }, 400);
    }

    const lines: string[] = [];
    for (const key of INPUT_FIELDS) {
      const v = String(answers[key] || "").trim();
      if (v) lines.push(`${key}: ${v}`);
    }
    if (lines.length < 6) {
      return json({ error: "Diagnóstico incompleto — responda o questionário antes de gerar a prévia." }, 400);
    }
    if (profession) lines.unshift(`profissao: ${profession}`);
    if (niche) lines.unshift(`nicho: ${niche}`);

    const requestBody = JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: `RESPOSTAS DO DIAGNÓSTICO:\n${lines.join("\n")}` }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.5,
        maxOutputTokens: 2048,
      },
    });

    let r: Response | null = null;
    const attempts: string[] = [];
    for (const model of GEMINI_MODELS) {
      try {
        r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
            signal: AbortSignal.timeout(PER_MODEL_TIMEOUT_MS),
          },
        );
      } catch (e) {
        r = null;
        attempts.push(`${model}: timeout`);
        console.error(`Gemini timeout/abort (${model}):`, e instanceof Error ? e.message : e);
        continue;
      }
      if (r.ok) break;
      const body = await r.text().catch(() => "");
      attempts.push(`${model}: ${r.status}`);
      console.error(`Gemini error (${model}):`, r.status, body.slice(0, 300));
      if (![404, 429, 503].includes(r.status)) break;
    }

    if (!r || !r.ok) {
      console.error("Todos os modelos falharam:", attempts.join(" | "));
      return json({
        error: "O serviço de IA está indisponível no momento. Tente novamente em instantes.",
        detail: attempts.join(" | "),
      }, 500);
    }

    const data = await r.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return json({ error: "Resposta vazia da IA. Tente novamente." }, 500);

    let storybrand: any;
    try {
      storybrand = JSON.parse(rawText);
    } catch {
      console.error("JSON inválido do Gemini:", rawText.slice(0, 300));
      return json({ error: "Não foi possível montar a prévia. Tente novamente." }, 500);
    }

    return json({ storybrand });
  } catch (e) {
    console.error("storybrand-preview error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
