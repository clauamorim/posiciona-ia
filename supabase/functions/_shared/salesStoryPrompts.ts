// Prompts e helpers para o módulo de Stories de Venda.
//
// - SALES_STORY_SYSTEM_PROMPT: prompt fixo com os 7 templates oficiais.
// - buildSalesStoryUserPrompt: monta o contexto do criador (narrativa
//   de venda + business + personal) para a sequência específica pedida.
// - SEQUENCE_LABELS / SEQUENCE_LENGTHS: metadados úteis no frontend e
//   na própria edge function (para validar tamanho da resposta).
// - fetchSalesNarrative / renderSalesNarrativeContext: usados também
//   pelo worker editorial (process-content-generation-job) para enriquecer
//   a geração de linha editorial quando o usuário tiver preenchido.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type SalesSequenceType =
  | "transformacao"
  | "criticas_julgamentos"
  | "objecao_narrativa"
  | "objecao_direto"
  | "bastidores_atendimentos"
  | "bastidores_entregas"
  | "apresentacao_bio";

export const SEQUENCE_LABELS: Record<SalesSequenceType, string> = {
  transformacao: "Jornada de transformação pessoal",
  criticas_julgamentos: "Enfrentando críticas e julgamentos",
  objecao_narrativa: "Quebrando objeções com narrativa",
  objecao_direto: "Quebrando objeções direto ao ponto",
  bastidores_atendimentos: "Bastidores de atendimentos",
  bastidores_entregas: "Bastidores de entregas",
  apresentacao_bio: "Apresentação pessoal / Bio",
};

export const SEQUENCE_DESCRIPTIONS: Record<SalesSequenceType, string> = {
  transformacao: "Gerar identificação e conduzir para venda.",
  criticas_julgamentos: "Vulnerabilidade combinada com autoridade.",
  objecao_narrativa: "Desconstruir crença com profundidade narrativa.",
  objecao_direto: "Rápido, assertivo, com CTA imediato.",
  bastidores_atendimentos: "Prova social pelo trabalho do dia.",
  bastidores_entregas: "Volume e variedade de público atendido.",
  apresentacao_bio: "História completa para conexão profunda.",
};

export const SEQUENCE_LENGTHS: Record<SalesSequenceType, number> = {
  transformacao: 7,
  criticas_julgamentos: 6,
  objecao_narrativa: 7,
  objecao_direto: 5,
  bastidores_atendimentos: 4,
  bastidores_entregas: 5,
  apresentacao_bio: 9,
};

export const SALES_SEQUENCE_TYPES = Object.keys(SEQUENCE_LABELS) as SalesSequenceType[];

// ---------------------------------------------------------------------------
// SYSTEM PROMPT
// ---------------------------------------------------------------------------

export const SALES_STORY_SYSTEM_PROMPT = `Você é uma estrategista de conteúdo especializada em sequências de stories para conversão direta no Instagram.

Sua tarefa: gerar uma sequência de stories baseada em UM dos 7 templates oficiais abaixo, preenchendo todos os campos com os dados REAIS do criador (fornecidos pelo usuário). Não invente fatos — use SOMENTE o que foi fornecido.

REGRAS INVIOLÁVEIS:
1. Mantenha a voz do criador — use as expressões pessoais informadas em "personal_expressions".
2. NUNCA toque em "forbidden_topics" — REGRA INVIOLÁVEL, mesmo que o contexto do template sugira.
3. Frases entre aspas devem ser EXATAMENTE as que o criador relatou ouvir/dizer (negative_comments e audience_objections).
4. Cada story tem 1 ideia, no máximo 3 linhas — formato mobile, leitura rápida.
5. CTA final precisa ser DIRETO e específico ao offer_context fornecido pelo usuário.
6. Aplique os princípios narrativos obrigatórios: cliente herói (não a marca), específico vence genérico, gancho concreto nas 8 primeiras palavras.
7. Português brasileiro natural. Sem coachismo, sem clichês ("no mundo de hoje", "cada vez mais"), sem emojis decorativos.

Devolva APENAS JSON no formato:
{
  "stories": [
    { "ordem": 1, "texto": "...", "tipo": "abertura" }
  ]
}

Onde "tipo" é um de: "abertura", "desenvolvimento", "cta".

═══════════════════════════════════════════════════════════════
TEMPLATES (use o indicado pelo sequence_type):
═══════════════════════════════════════════════════════════════

[TEMPLATE: transformacao] — 7 stories
S1 (abertura): Foto/contexto antigo — situação anterior, sentimento por fora vs por dentro.
S2 (desenvolvimento): A decisão da virada — o que abandonou e para onde foi.
S3 (desenvolvimento): Dificuldades reais do começo + comentários negativos LITERAIS (em aspas).
S4 (desenvolvimento): Conquistas concretas (lista de até 3, com números/fatos quando possível).
S5 (desenvolvimento): Onde está hoje vs onde quer chegar.
S6 (desenvolvimento): Pergunta reflexiva direta para a audiência.
S7 (cta): Frase inspiradora curta + chamada direta para a oferta.

[TEMPLATE: criticas_julgamentos] — 6 stories
S1 (abertura): O momento em que o medo se concretizou.
S2 (desenvolvimento): Críticas LITERAIS que ouviu (em aspas, exatamente como foram ditas).
S3 (desenvolvimento): Parte da crítica que concorda + o que mudou a partir disso.
S4 (desenvolvimento): 3 resultados positivos concretos hoje.
S5 (desenvolvimento): Quebra da crença limitante do nicho.
S6 (cta): Frase de força + chamada direta.

[TEMPLATE: objecao_narrativa] — 7 stories
S1 (abertura): Contexto/situação em que ouviu a objeção.
S2 (desenvolvimento): A objeção LITERAL (em aspas).
S3 (desenvolvimento): Reconhecimento — também acreditava nisso.
S4 (desenvolvimento): A verdade que descobriu (a quebra).
S5 (desenvolvimento): Exemplo real (do próprio criador ou de cliente — apenas se houver em proof_cases).
S6 (desenvolvimento): Reflexão pessoal.
S7 (cta): Dedicatória ("essa sequência é pra você que…") + chamada.

[TEMPLATE: objecao_direto] — 5 stories
S1 (abertura): Objeção LITERAL (em aspas) + "entendi".
S2 (desenvolvimento): "E vou te provar que não é verdade".
S3 (desenvolvimento): História/caso que contraria a objeção.
S4 (desenvolvimento): Explicação objetiva + "viu só como [objeção] não é verdade?".
S5 (cta): "Se você quer [objetivo derivado do offer_context], [CTA direto]".

[TEMPLATE: bastidores_atendimentos] — 4 stories
S1 (abertura): "Hoje tive [algo pessoal/cotidiano] + [tipo de atendimento]".
S2 (desenvolvimento): Cliente 1 — contexto + transformação entregue.
S3 (desenvolvimento): Cliente 2 — contexto + transformação entregue.
S4 (cta): Diferencial/bônus + "se você quer esse resultado, [CTA]".

[TEMPLATE: bastidores_entregas] — 5 stories
S1 (abertura): Tipo de entrega de hoje + público + transformação.
S2 (desenvolvimento): Indicação de mídia (foto/vídeo) — descrever o que mostrar entre colchetes (ex.: "[mostrar foto do material entregue]").
S3 (desenvolvimento): Segunda entrega — outro perfil de cliente.
S4 (desenvolvimento): Indicação de mídia da segunda.
S5 (cta): Sentimento do dia + "você também quer? [CTA]".

[TEMPLATE: apresentacao_bio] — 9 stories
S1 (abertura): "Quero te contar minha história…".
S2 (desenvolvimento): Origem (cidade/ano se disponível) + contexto desafiador.
S3 (desenvolvimento): "Sempre quis mais".
S4 (desenvolvimento): Sonho profundo + ação ousada + primeira conquista.
S5 (desenvolvimento): Dificuldade que apareceu + sentimento negativo.
S6 (desenvolvimento): O insight central que mudou tudo (em aspas).
S7 (desenvolvimento): Ano que começou + projeto/oferta atual + transformação que entrega.
S8 (desenvolvimento): Quem você ajuda hoje + que resultado entrega.
S9 (cta): Pergunta de identificação + boas-vindas + CTA.
`;

// ---------------------------------------------------------------------------
// USER PROMPT BUILDER
// ---------------------------------------------------------------------------

export interface SalesNarrative {
  previous_profession?: string | null;
  career_turn?: string | null;
  negative_comments?: string | null;
  audience_objections?: string | null;
  proof_cases?: string | null;
  personal_expressions?: string | null;
  forbidden_topics?: string | null;
  start_year_motivation?: string | null;
}

const trimOrEmpty = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";

function listIfPresent(label: string, value: string | null | undefined): string | null {
  const v = (value || "").toString().trim();
  if (!v) return null;
  return `- ${label}: ${v}`;
}

export function buildSalesStoryUserPrompt(opts: {
  narrative: SalesNarrative;
  business: any | null;
  personal: any | null;
  sequence_type: SalesSequenceType;
  offer_context: string;
}): string {
  const { narrative, business, personal, sequence_type, offer_context } = opts;
  const expectedLength = SEQUENCE_LENGTHS[sequence_type];
  const label = SEQUENCE_LABELS[sequence_type];

  const narrativeLines: string[] = [
    listIfPresent("Profissão/situação anterior", narrative.previous_profession),
    listIfPresent("Virada de carreira", narrative.career_turn),
    listIfPresent("Críticas literais que ouviu", narrative.negative_comments),
    listIfPresent("Objeções literais da audiência", narrative.audience_objections),
    listIfPresent("Casos reais que pode citar", narrative.proof_cases),
    listIfPresent("Expressões pessoais (use organicamente)", narrative.personal_expressions),
    listIfPresent("Assuntos PROIBIDOS (jamais tocar)", narrative.forbidden_topics),
    listIfPresent("Quando/por que começou", narrative.start_year_motivation),
  ].filter((x): x is string => x !== null);

  const businessLines: string[] = [];
  if (business) {
    const company = trimOrEmpty(business.company_name);
    const services = trimOrEmpty(business.services);
    const audience = trimOrEmpty(business.target_audience);
    const transformations = trimOrEmpty(business.promised_transformations);
    if (company) businessLines.push(`- Marca/profissional: ${company}`);
    if (services) businessLines.push(`- Serviços: ${services}`);
    if (audience) businessLines.push(`- Público-alvo: ${audience}`);
    if (transformations) businessLines.push(`- Transformações prometidas: ${transformations}`);
  }

  const personalLines: string[] = [];
  if (personal) {
    const proudMoment = trimOrEmpty(personal.proud_moment);
    const formative = trimOrEmpty(personal.formative_story);
    const desiredFeeling = trimOrEmpty(personal.desired_feeling);
    if (proudMoment) personalLines.push(`- Momento de orgulho: ${proudMoment}`);
    if (formative) personalLines.push(`- História formativa: ${formative}`);
    if (desiredFeeling) personalLines.push(`- Sentimento desejado no leitor: ${desiredFeeling}`);
  }

  const businessBlock = businessLines.length > 0
    ? `\n\n# CONTEXTO DO NEGÓCIO\n${businessLines.join("\n")}`
    : "";
  const personalBlock = personalLines.length > 0
    ? `\n\n# CONTEXTO PESSOAL ADICIONAL (use com parcimônia)\n${personalLines.join("\n")}`
    : "";

  return `# OFERTA SENDO VENDIDA NESTA SEQUÊNCIA
${offer_context.trim() || "(não especificada)"}

# TIPO DE SEQUÊNCIA SOLICITADA
${label} (id: ${sequence_type}) — exatamente ${expectedLength} stories.

# NARRATIVA DE VENDA DO CRIADOR (fonte da verdade)
${narrativeLines.length > 0 ? narrativeLines.join("\n") : "(criador não preencheu — não invente, retorne erro)"}${businessBlock}${personalBlock}

# INSTRUÇÃO FINAL
Gere a sequência ${label} com EXATAMENTE ${expectedLength} stories, seguindo o template correspondente do system prompt. Devolva apenas JSON com a chave "stories" — sem markdown, sem comentários, sem texto fora do JSON.`;
}

// ---------------------------------------------------------------------------
// Helpers consumidos pelo worker editorial
// ---------------------------------------------------------------------------

const SALES_NARRATIVE_LABELS: Record<keyof SalesNarrative, string> = {
  previous_profession: "Profissão anterior",
  career_turn: "Virada de carreira",
  negative_comments: "Críticas literais que ouviu",
  audience_objections: "Objeções literais da audiência",
  proof_cases: "Casos reais que pode citar",
  personal_expressions: "Expressões pessoais que devem aparecer",
  forbidden_topics: "Assuntos PROIBIDOS (jamais tocar)",
  start_year_motivation: "Quando/por que começou",
};

/**
 * Busca o questionário de narrativa de venda do usuário (apenas se completo).
 * Retorna null se não existir ou estiver em rascunho — nesse caso o worker
 * editorial roda exatamente como antes.
 */
export async function fetchSalesNarrative(userId: string): Promise<SalesNarrative | null> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await admin
      .from("sales_narrative_questionnaires")
      .select("*")
      .eq("user_id", userId)
      .eq("is_complete", true)
      .maybeSingle();
    return (data as SalesNarrative | null) || null;
  } catch (e) {
    console.error("Error fetching sales narrative:", e);
    return null;
  }
}

/**
 * Renderiza o bloco "NARRATIVA DE VENDA DO CRIADOR" para colar no
 * USER prompt da geração editorial. Apenas campos preenchidos entram.
 * Retorna string vazia se nada estiver disponível.
 */
export function renderSalesNarrativeContext(
  narrative: SalesNarrative | null | undefined,
): string {
  if (!narrative) return "";
  const lines: string[] = [];
  for (const [key, label] of Object.entries(SALES_NARRATIVE_LABELS)) {
    const value = (narrative as any)[key];
    if (typeof value === "string" && value.trim().length > 0) {
      lines.push(`- ${label}: ${value.trim()}`);
    }
  }
  if (lines.length === 0) return "";

  return `\n\n# NARRATIVA DE VENDA DO CRIADOR (use quando aplicável)
${lines.join("\n")}

REGRAS DE USO:
- Expressões pessoais devem aparecer NATURALMENTE quando o tom permitir — nunca forçadas.
- "Assuntos PROIBIDOS" são REGRA INVIOLÁVEL — não toque mesmo se o contexto sugerir.
- Quando criar posts que rebatem objeções, use as objeções LITERAIS da audiência (entre aspas) — gera identificação imediata.
- Casos reais (proof_cases) podem ser citados em posts de prova social, mantendo nome e contexto exatamente como o criador forneceu.
- A virada de carreira e críticas vividas podem alimentar posts de "jornada/origem" no MÁXIMO uma vez a cada 4-6 semanas — não toda semana.`;
}
