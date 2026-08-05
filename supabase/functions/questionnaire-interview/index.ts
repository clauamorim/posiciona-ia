// Entrevista conversacional dos questionários "Diagnóstico do Negócio" e
// "Sua História". Recebe um turno do usuário (texto ou áudio gravado no
// navegador), transcreve, extrai respostas para os campos do questionário e
// devolve a próxima pergunta.
// Chama a API do Gemini DIRETO (generativelanguage.googleapis.com) porque o
// gateway da Lovable não aceita áudio — a GEMINI_API_KEY já existe como secret
// (usada em _shared/embeddings.ts).
// Não escreve no banco: o cliente mescla `extracted` no estado do formulário e
// o autosave existente persiste pelo caminho normal (RLS respeitado).

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { requireUser, AuthError } from "../_shared/workspaceAuth.ts";
import { fetchWorkspaceBrandType } from "../_shared/buildClaudeContext.ts";

type FieldDef = { key: string; label: string; block: string; max?: number };

// Espelho dos campos definidos em src/pages/PersonalQuestionnaire.tsx.
// Se os campos mudarem lá, atualizar aqui também.
const PERSONAL_FIELDS: FieldDef[] = [
  { key: "hobby", label: "Seu maior hobby (algo feito por puro prazer, sem relação com trabalho)", block: "Quem você é fora do trabalho" },
  { key: "pets", label: "Pets ou animais que ama", block: "Quem você é fora do trabalho" },
  { key: "sports", label: "Esportes ou atividade física que pratica e por quê", block: "Quem você é fora do trabalho" },
  { key: "dependents", label: "Filhos ou dependentes e como isso molda a rotina", block: "Quem você é fora do trabalho" },
  { key: "sunday_morning", label: "Como é o domingo de manhã ideal (onde, com quem, fazendo o quê)", block: "Quem você é fora do trabalho" },
  { key: "proud_moment", label: "Momento profissional do qual mais se orgulha (caso específico, com detalhes)", block: "Bastidores profissionais" },
  { key: "failure_lesson", label: "Uma falha que ensinou algo e mudou a forma de trabalhar", block: "Bastidores profissionais" },
  { key: "work_routine", label: "Como é um dia típico de trabalho (horários, ambientes, ritmos)", block: "Bastidores profissionais" },
  { key: "pre_meeting_ritual", label: "Ritual antes de atender clientes (café, música, respiração...)", block: "Bastidores profissionais" },
  { key: "unblock_method", label: "Como sai de um bloqueio criativo ou mental", block: "Bastidores profissionais" },
  { key: "defended_belief", label: "Uma crença que defende publicamente", block: "Valores e visão" },
  { key: "social_cause", label: "Causa social ou tema que mobiliza", block: "Valores e visão" },
  { key: "desired_feeling", label: "O que quer que as pessoas sintam ao consumir seu conteúdo", block: "Valores e visão" },
  { key: "guiding_belief", label: "Frase ou ideia que guia decisões (mantra, citação, princípio)", block: "Valores e visão" },
  { key: "formative_story", label: "Uma história de vida que formou o profissional (infância, juventude, início de carreira)", block: "Memórias que moldaram você" },
  { key: "biggest_influence", label: "Alguém que influenciou profundamente e por quê", block: "Memórias que moldaram você" },
  { key: "advice_to_20yo", label: "Um conselho para si mesmo aos 20 anos", block: "Memórias que moldaram você" },
];

// "Voz da Marca" — variante institucional de PERSONAL_FIELDS, mesmas colunas de
// personal_questionnaires (a tabela é reaproveitada, só muda o enquadramento).
// Espelho de INSTITUTIONAL_VOICE_LABELS em _shared/buildClaudeContext.ts.
const INSTITUTIONAL_VOICE_FIELDS: FieldDef[] = [
  { key: "hobby", label: "Algo que a marca faz muito bem e com orgulho, além de vender", block: "Cultura e cotidiano da marca" },
  { key: "pets", label: "Como é a equipe por trás da marca (quantas pessoas, quem faz o quê, clima)", block: "Cultura e cotidiano da marca" },
  { key: "sports", label: "Hábito ou disciplina que a marca cultiva internamente", block: "Cultura e cotidiano da marca" },
  { key: "dependents", label: "Quem depende da marca funcionar bem (clientes fixos, parceiros, comunidade)", block: "Cultura e cotidiano da marca" },
  { key: "sunday_morning", label: "Como é uma semana bem-sucedida para a marca", block: "Cultura e cotidiano da marca" },
  { key: "proud_moment", label: "Resultado ou entrega da qual a marca mais se orgulha (caso específico)", block: "Bastidores da entrega" },
  { key: "failure_lesson", label: "Um erro ou desafio que ensinou algo e mudou a forma de operar", block: "Bastidores da entrega" },
  { key: "work_routine", label: "Como é um dia típico de operação (horários, ferramentas, ritmos)", block: "Bastidores da entrega" },
  { key: "pre_meeting_ritual", label: "Ritual ou processo antes de atender um cliente", block: "Bastidores da entrega" },
  { key: "unblock_method", label: "Como a equipe resolve um imprevisto ou bloqueio", block: "Bastidores da entrega" },
  { key: "defended_belief", label: "Uma crença que a marca defende publicamente sobre o mercado", block: "Valores e propósito" },
  { key: "social_cause", label: "Causa ou tema que a marca apoia ou mobiliza", block: "Valores e propósito" },
  { key: "desired_feeling", label: "O que a marca quer que o cliente sinta ao interagir com ela", block: "Valores e propósito" },
  { key: "guiding_belief", label: "Frase ou princípio que guia as decisões da marca", block: "Valores e propósito" },
  { key: "formative_story", label: "Um marco que definiu quem a marca é hoje", block: "Marcos que moldaram a marca" },
  { key: "biggest_influence", label: "Uma marca, pessoa ou referência que influencia como constroem isso", block: "Marcos que moldaram a marca" },
  { key: "advice_to_20yo", label: "Um conselho que dariam para a marca no primeiro dia", block: "Marcos que moldaram a marca" },
];

// Espelho dos campos definidos em src/pages/BusinessQuestionnaire.tsx (com os
// limites de caracteres de lá). Se os campos mudarem lá, atualizar aqui também.
const BUSINESS_FIELDS: FieldDef[] = [
  { key: "company_name", label: "Nome da empresa ou negócio (nome fantasia ou como é conhecido no mercado)", block: "Negócio e público", max: 120 },
  { key: "services", label: "Serviços ou produtos oferecidos", block: "Negócio e público", max: 600 },
  { key: "target_audience", label: "Público-alvo (cliente ideal: idade, profissão, renda, interesses, dores)", block: "Negócio e público", max: 400 },
  { key: "external_problems", label: "Problemas externos que resolve (dificuldades práticas e visíveis do cliente)", block: "Dores e empatia", max: 600 },
  { key: "internal_problems", label: "Problemas internos do cliente (como ele se sente antes de contratar)", block: "Dores e empatia", max: 600 },
  { key: "empathic_statements", label: "Declarações empáticas (frases que mostram que entende o cliente)", block: "Dores e empatia", max: 800 },
  { key: "authority_proofs", label: "Provas de autoridade (certificações, cases, depoimentos, números)", block: "Autoridade e jornada", max: 800 },
  { key: "hiring_steps", label: "Etapas para o cliente contratar (passo a passo simples)", block: "Autoridade e jornada", max: 400 },
  { key: "client_fears", label: "Medos do cliente (o que o impede de agir/comprar)", block: "Autoridade e jornada", max: 600 },
  { key: "main_cta", label: "Principal chamada para ação (ex: agende sua consultoria)", block: "Ação e transformação", max: 120 },
  { key: "negative_consequences", label: "Consequências negativas evitadas (o que acontece se o cliente NÃO agir)", block: "Ação e transformação", max: 600 },
  { key: "promised_transformations", label: "Conquistas e transformações prometidas (como a vida do cliente muda)", block: "Ação e transformação", max: 600 },
];

// "Diagnóstico do Negócio" institucional — mesmas chaves de BUSINESS_FIELDS,
// enquadramento fala da EMPRESA/MARCA em vez de "você". Espelho de
// institutionalFields em src/pages/BusinessQuestionnaire.tsx.
const INSTITUTIONAL_BUSINESS_FIELDS: FieldDef[] = [
  { key: "company_name", label: "Nome da empresa ou marca (nome fantasia ou como é conhecida no mercado)", block: "Negócio e público", max: 120 },
  { key: "services", label: "Serviços ou produtos oferecidos pela empresa", block: "Negócio e público", max: 600 },
  { key: "target_audience", label: "Público-alvo da empresa (cliente ideal: idade, profissão, renda, interesses, dores)", block: "Negócio e público", max: 400 },
  { key: "external_problems", label: "Problemas externos que a empresa resolve (dificuldades práticas e visíveis do cliente)", block: "Dores e empatia", max: 600 },
  { key: "internal_problems", label: "Problemas internos do cliente (como ele se sente antes de contratar a empresa)", block: "Dores e empatia", max: 600 },
  { key: "empathic_statements", label: "Declarações empáticas (frases que mostram que a empresa entende o cliente)", block: "Dores e empatia", max: 800 },
  { key: "authority_proofs", label: "Provas de autoridade da empresa (certificações, cases, depoimentos, números)", block: "Autoridade e jornada", max: 800 },
  { key: "hiring_steps", label: "Etapas para o cliente contratar a empresa (passo a passo simples)", block: "Autoridade e jornada", max: 400 },
  { key: "client_fears", label: "Medos do cliente (o que o impede de agir/comprar)", block: "Autoridade e jornada", max: 600 },
  { key: "main_cta", label: "Principal chamada para ação da empresa (ex: agende uma consultoria)", block: "Ação e transformação", max: 120 },
  { key: "negative_consequences", label: "Consequências negativas evitadas (o que acontece se o cliente NÃO agir)", block: "Ação e transformação", max: 600 },
  { key: "promised_transformations", label: "Conquistas e transformações prometidas (como o negócio do cliente muda)", block: "Ação e transformação", max: 600 },
];

// Espelho dos campos definidos em src/pages/SalesNarrativeQuestionnaire.tsx.
// Se os campos mudarem lá, atualizar aqui também.
const SALES_FIELDS: FieldDef[] = [
  { key: "previous_profession", label: "Profissão ou situação antes do trabalho atual", block: "Sua virada" },
  { key: "career_turn", label: "A virada: o que decidiu mudar e que novo caminho escolheu", block: "Sua virada" },
  { key: "start_year_motivation", label: "Ano em que começou o trabalho atual e a motivação do primeiro passo", block: "Sua virada" },
  { key: "negative_comments", label: "Críticas ou comentários negativos que ouviu nessa virada (frases literais, entre aspas)", block: "Vozes da audiência" },
  { key: "audience_objections", label: "As 3 principais objeções/dúvidas do cliente antes de fechar (frases literais, em primeira pessoa)", block: "Vozes da audiência" },
  { key: "proof_cases", label: "1 a 3 casos reais como prova (nome — pode ser fictício —, contexto antes, resultado depois; um por linha)", block: "Prova e identidade" },
  { key: "personal_expressions", label: "Palavra, expressão ou bordão que é muito seu", block: "Prova e identidade" },
  { key: "forbidden_topics", label: "Temas que JAMAIS tocaria no conteúdo", block: "Prova e identidade" },
];

const KINDS: Record<string, { fields: FieldDef[]; mission: string }> = {
  personal: {
    fields: PERSONAL_FIELDS,
    mission:
      'Você conduz o questionário "Sua História" da Posiciona em formato de conversa. O objetivo é colher matéria-prima humana (hobbies, valores, memórias, bastidores) que alimentará posts de storytelling do usuário. Incentive detalhes específicos e cenas concretas — são elas que geram conteúdo autêntico.',
  },
  personal_institucional: {
    fields: INSTITUTIONAL_VOICE_FIELDS,
    mission:
      'Você conduz o questionário "Voz da Marca" da Posiciona em formato de conversa. O objetivo é colher matéria-prima real sobre a marca/empresa (cultura, bastidores da entrega, valores, marcos) que alimentará posts de storytelling institucional. NUNCA pergunte sobre a vida pessoal de um indivíduo — o sujeito das respostas é sempre a MARCA. Incentive detalhes específicos e casos concretos — são eles que geram conteúdo autêntico.',
  },
  business: {
    fields: BUSINESS_FIELDS,
    mission:
      'Você conduz o questionário "Diagnóstico do Negócio" da Posiciona em formato de conversa. O objetivo é mapear o negócio do usuário (serviços, público, dores do cliente, autoridade, chamada para ação) para a análise estratégica. Respostas específicas e concretas valem mais que genéricas.',
  },
  business_institucional: {
    fields: INSTITUTIONAL_BUSINESS_FIELDS,
    mission:
      'Você conduz o questionário "Diagnóstico do Negócio" da Posiciona em formato de conversa. O objetivo é mapear o negócio da EMPRESA/MARCA (serviços, público, dores do cliente, autoridade, chamada para ação) para a análise estratégica. NUNCA pergunte sobre a vida pessoal de um indivíduo — o sujeito das respostas é sempre a EMPRESA. Respostas específicas e concretas valem mais que genéricas.',
  },
  sales: {
    fields: SALES_FIELDS,
    mission:
      'Você conduz o questionário "História de Venda" da Posiciona em formato de conversa. O objetivo é colher a história de virada profissional do usuário e a matéria-prima da narrativa de vendas (críticas ouvidas, objeções de clientes, casos de prova, jeito de falar), que alimenta o módulo Stories de Venda. ATENÇÃO: nos campos de críticas e objeções, preserve as FRASES LITERAIS que o usuário citar, entre aspas, exatamente como ditas — elas geram identificação na audiência. Nos casos de prova, estruture um por linha (nome, contexto antes, resultado depois).',
  },
};

// gemini-2.5-flash foi aposentado pelo Google (404 "no longer available to new
// users" em jul/2026) e gemini-3.5-flash oscila entre 503 e travar sem
// responder (high demand). Lite primeiro por estabilidade — a tarefa
// (transcrever + extrair campos) não exige o modelo maior. Cada tentativa tem
// prazo máximo; estourou, passa ao próximo.
const GEMINI_MODELS = ["gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash-lite"];
const PER_MODEL_TIMEOUT_MS = 30_000;
const MAX_HISTORY_TURNS = 40;
// generateContent aceita até ~20MB de request; 8MB de áudio base64 é folga segura.
const MAX_AUDIO_BASE64_CHARS = 8_000_000;

function buildSystemPrompt(
  kind: { fields: FieldDef[]; mission: string },
  answers: Record<string, string>,
  profession?: string,
  niche?: string,
) {
  const pending = kind.fields.filter((f) => !(answers[f.key] || "").trim());
  const filled = kind.fields.filter((f) => (answers[f.key] || "").trim());

  const pendingList = pending
    .map((f) => `- ${f.key} (bloco "${f.block}")${f.max && f.max <= 150 ? " [resposta CURTA, uma frase]" : ""}: ${f.label}`)
    .join("\n");
  const filledList = filled.length > 0
    ? filled.map((f) => `- ${f.key}: já respondido ("${(answers[f.key] || "").slice(0, 120)}")`).join("\n")
    : "(nenhum ainda)";

  return `${kind.mission}

Tom: elegante, acolhedor e direto, como uma consultora sênior. Nunca use emojis. Nunca use gírias.
${profession ? `Profissão do usuário: ${profession}.` : ""}${niche ? ` Nicho: ${niche}.` : ""}

CAMPOS PENDENTES (pergunte sobre eles, seguindo a ordem dos blocos):
${pendingList || "(todos preenchidos)"}

CAMPOS JÁ PREENCHIDOS (não pergunte de novo):
${filledList}

COMO CONDUZIR:
1. Se o turno do usuário vier em ÁUDIO, transcreva fielmente em "transcript" (português, limpando hesitações tipo "ééé", "hmm"). Se vier em texto, copie o texto em "transcript".
   - Se o áudio estiver em SILÊNCIO, vazio ou ininteligível, NUNCA invente uma fala: retorne "transcript" como string vazia, "extracted" vazio, e em "reply" diga que não conseguiu ouvir e repita a pergunta atual.
2. Extraia TUDO que o usuário disse que responda algum campo pendente — uma fala longa pode preencher vários campos de uma vez. Coloque em "extracted" pares {field, value}.
   - "value" deve ser escrito em primeira pessoa, como se o usuário tivesse digitado, preservando as palavras e expressões dele. Limpe apenas a oralidade. Não invente, não complete, não embeleze com fatos que ele não disse.
   - Use APENAS chaves de campo listadas acima. Só extraia para campos pendentes.
   - Campos marcados [resposta CURTA] devem receber uma frase objetiva, não um parágrafo.
3. Em "reply", reaja brevemente ao que foi dito (1 frase, sem bajulação) e faça a PRÓXIMA pergunta — uma pergunta por vez, sobre o próximo campo pendente na ordem dos blocos. Ao mudar de bloco, anuncie o tema em meia frase.
4. Se a resposta foi vaga demais para extrair, peça UM detalhe específico (só uma vez; se continuar vago, extraia o que der e siga em frente).
5. Se o usuário quiser pular uma pergunta, respeite imediatamente e passe à próxima. Não insista.
6. Se o usuário fizer uma pergunta sobre o processo, responda em uma frase e retome a entrevista.
7. Quando não restarem campos pendentes (ou o usuário pedir para encerrar), defina "finished": true e em "reply" convide-o a revisar as respostas antes de concluir.

Responda SEMPRE no JSON do schema fornecido.`;
}

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    transcript: { type: "STRING", description: "Transcrição fiel do turno do usuário" },
    reply: { type: "STRING", description: "Resposta da entrevistadora com a próxima pergunta" },
    extracted: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          field: { type: "STRING" },
          value: { type: "STRING" },
        },
        required: ["field", "value"],
      },
    },
    finished: { type: "BOOLEAN" },
  },
  required: ["transcript", "reply", "extracted", "finished"],
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

  // Função de IA custa crédito de API — exige usuário autenticado de verdade.
  let authedUserId: string;
  try {
    authedUserId = (await requireUser(req)).userId;
  } catch (e) {
    const status = e instanceof AuthError ? e.status : 401;
    return json({ error: "Faça login para usar a entrevista por voz." }, status);
  }

  try {
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_KEY) return json({ error: "GEMINI_API_KEY não configurada" }, 500);

    const { kind: kindName, history, userText, audio, answers, profession, niche } = await req.json();

    // "Sua História"/"Voz da Marca" e "Diagnóstico do Negócio" são a MESMA
    // entrevista por fora ("personal"/"business") — o servidor troca para os
    // campos institucionais sozinho, conforme o tipo de marca do workspace do
    // usuário autenticado.
    let resolvedKindName = String(kindName);
    if (resolvedKindName === "personal" || resolvedKindName === "business") {
      const brandType = await fetchWorkspaceBrandType(authedUserId);
      if (brandType === "institucional") resolvedKindName = `${resolvedKindName}_institucional`;
    }
    const kind = KINDS[resolvedKindName];
    if (!kind) return json({ error: 'kind deve ser "personal", "business" ou "sales"' }, 400);
    if (!Array.isArray(history)) return json({ error: "history must be an array" }, 400);
    if (!userText && !audio?.data) return json({ error: "Envie userText ou audio" }, 400);
    if (audio?.data && audio.data.length > MAX_AUDIO_BASE64_CHARS) {
      return json({ error: "Áudio muito longo. Grave respostas de até ~3 minutos." }, 400);
    }

    const safeAnswers: Record<string, string> =
      answers && typeof answers === "object" ? answers : {};
    const fieldByKey = new Map(kind.fields.map((f) => [f.key, f]));

    // Histórico só em texto (o áudio de turnos anteriores já virou transcript no cliente).
    const contents = history
      .slice(-MAX_HISTORY_TURNS)
      .filter((m: any) => m && typeof m.content === "string" && m.content.trim())
      .map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const currentParts: any[] = [];
    if (audio?.data) {
      // Safari grava audio/mp4; Chrome audio/webm. Gemini aceita ambos —
      // remover o sufixo ";codecs=..." que a API não reconhece.
      const mimeType = String(audio.mimeType || "audio/webm").split(";")[0];
      currentParts.push({ inlineData: { mimeType, data: audio.data } });
      currentParts.push({ text: "(turno em áudio acima — transcreva e processe)" });
    } else {
      currentParts.push({ text: String(userText) });
    }
    contents.push({ role: "user", parts: currentParts });

    const requestBody = JSON.stringify({
      systemInstruction: {
        parts: [{ text: buildSystemPrompt(kind, safeAnswers, profession, niche) }],
      },
      contents,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    });

    // Tenta os modelos em ordem; timeout, 404 (aposentado), 429 (rate limit) e
    // 503 (sobrecarga) passam para o próximo. Outros erros interrompem.
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
      if (r.ok) {
        console.log(`Gemini ok com ${model}`);
        break;
      }
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
    if (!rawText) {
      console.error("Gemini sem texto na resposta:", JSON.stringify(data).slice(0, 500));
      return json({ error: "Resposta vazia da IA. Tente novamente." }, 500);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      console.error("JSON inválido do Gemini:", rawText.slice(0, 500));
      return json({ error: "Não consegui entender. Pode repetir?" }, 500);
    }

    // Trava anti-alucinação: turno de áudio cuja transcrição veio vazia não
    // pode gerar extração — o modelo não ouviu nada.
    const transcriptOut = String(parsed.transcript || userText || "").trim();
    if (audio?.data && !transcriptOut) {
      return json({
        transcript: "",
        reply: String(parsed.reply || "").trim() || "Não consegui ouvir sua resposta. Pode repetir, por favor?",
        extracted: {},
        finished: false,
      });
    }

    // Só aceita chaves válidas e valores não vazios; não sobrescreve campo já
    // preenchido; respeita o limite de caracteres do campo (Diagnóstico).
    const extracted: Record<string, string> = {};
    if (Array.isArray(parsed.extracted)) {
      for (const item of parsed.extracted) {
        const key = String(item?.field || "");
        const def = fieldByKey.get(key);
        let value = String(item?.value || "").trim();
        if (def?.max) value = value.slice(0, def.max);
        if (def && value && !(safeAnswers[key] || "").trim()) {
          extracted[key] = value;
        }
      }
    }

    return json({
      transcript: transcriptOut,
      reply: String(parsed.reply || "").trim(),
      extracted,
      finished: Boolean(parsed.finished),
    });
  } catch (e) {
    console.error("questionnaire-interview error:", e);
    return json({ error: e instanceof Error ? e.message : "Erro desconhecido" }, 500);
  }
});
