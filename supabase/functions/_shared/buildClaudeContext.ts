// Helpers para montar blocos de contexto enviados ao Claude.
//
// Garante que TODA chamada de geração editorial inclua:
// 1) O contexto do negócio (questionário de negócio).
// 2) StoryBrand + tom de voz da marca (do relatório estratégico).
// 3) Contexto pessoal do criador (questionário pessoal) — humanização.
// 4) Os PDFs de referência (StoryBrand, Made to Stick, Obviously Awesome).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { ClaudePdfPart } from "./claudeClient.ts";

// ============ Resumos de frameworks (substituem PDFs) ============
//
// Os PDFs de StoryBrand / Made to Stick / Obviously Awesome consumiam
// 50-100k tokens por chamada — bem acima do limite de 30k tokens/min
// da org Anthropic. Substituídos por resumos densos canônicos abaixo.
// As funções de fetch ficam mantidas (deprecadas) caso o tier suba.

export function renderBrandscriptFramework(): string {
  return `

# FRAMEWORK BRANDSCRIPT (StoryBrand — Donald Miller) — referência interna

Toda marca clara segue 7 elementos narrativos. Use como espinha dorsal estratégica do relatório (NUNCA cite os rótulos no conteúdo visível para o cliente final).

1. PERSONAGEM (Herói = o cliente, NUNCA a marca): o cliente quer algo. Defina o desejo concreto e a identidade aspiracional.
2. PROBLEMA — em três camadas:
   - Externo: o problema tangível e visível (ex.: "minha marca não vende").
   - Interno: o sentimento ruim que o problema externo causa (ex.: "me sinto amador / impostor").
   - Filosófico: por que é INJUSTO o cliente passar por isso (ex.: "todo profissional sério merece ser visto como referência").
   - VILÃO: personifique a fonte do problema (procrastinação, ruído digital, "achismo", concorrência genérica). Vilão deve ser único, real e relacionável.
3. GUIA (a marca): mostra empatia + autoridade. Empatia = "eu entendo o que você sente". Autoridade = prova (anos, clientes, método, resultados). NUNCA se posicione como herói.
4. PLANO: passos simples (3 a 4) que removem ansiedade. Cliente precisa saber EXATAMENTE o que fazer agora.
5. CHAMA À AÇÃO: direta (compre/agende) e transicional (baixe/assine algo de baixo compromisso para quem ainda não está pronto).
6. SUCESSO: pinte o "depois" — como será a vida do cliente após resolver o problema. Concreto, sensorial.
7. FRACASSO: o que está em jogo se ele NÃO agir. Sem isso a história não tem peso.

REGRAS DE APLICAÇÃO:
- Tudo deve ser específico e do cliente (linguagem dele, dores dele, vocabulário dele) — não jargão da marca.
- Plano e CTA precisam reduzir a fricção mental do herói.
- Sucesso e Fracasso são âncoras emocionais — NUNCA omita.`;
}

export function renderEditorialFrameworks(): string {
  return `

# FRAMEWORKS EDITORIAIS — referência interna densa
(NUNCA cite os nomes ou rótulos abaixo nos campos visíveis: theme, caption, card_copy, cta, script.)

## 1. STORYBRAND (Donald Miller) — narrativa
Estrutura interna de TODO post: Herói (cliente) com um desejo → enfrenta um Problema (externo + interno + filosófico) → encontra um Guia (a marca, com empatia + autoridade) → recebe um Plano simples → é convocado por uma Chamada à Ação direta → vislumbra um Sucesso concreto e teme um Fracasso real. O BrandScript específico desta marca já está renderizado no prompt do usuário (bloco "ESTRATÉGIA STORYBRAND DA MARCA") — use-o como fonte da verdade.

## 2. SUCCESs (Made to Stick — irmãos Heath) — ideias que grudam
Toda mensagem memorável combina 6 atributos:
- SIMPLE: uma única ideia central, descascada até o essencial. Evite múltiplas mensagens por post.
- UNEXPECTED: quebra o padrão esperado — abra com um número incomum, contradição, cena estranha ou pergunta que ninguém faz. Gera "gap de curiosidade".
- CONCRETE: imagens sensoriais e exemplos verificáveis. Substitua abstrações ("excelência", "qualidade") por cenas (uma audiência, um cliente, uma planilha).
- CREDIBLE: prova interna (autoridade, números, casos) ou externa (testemunhos, dados, autoridade citada).
- EMOTIONAL: fale de PESSOAS, não de categorias. Ative dor, orgulho, alívio, pertencimento.
- STORIES: histórias curtas (vivência do criador, caso de cliente, mini-cena). Histórias prendem porque o leitor simula vivê-las.
APLICAÇÃO POR POST: gancho (primeira frase) = SIMPLE + UNEXPECTED + CONCRETE. Corpo = CREDIBLE + EMOTIONAL. Fecho = STORY ou prova viva → CTA.

## 3. POSITIONING (Obviously Awesome — April Dunford) — posicionamento
5 componentes de um posicionamento forte:
- ALTERNATIVAS COMPETITIVAS: o que o cliente faria se você não existisse (concorrente, planilha, "fazer sozinho", não fazer nada). Deixe claro o que a marca NÃO é.
- ATRIBUTOS ÚNICOS: capacidades reais que só esta marca tem (método próprio, combinação rara de habilidades, contexto exclusivo).
- VALOR DESSES ATRIBUTOS: o benefício concreto que esses atributos geram para o cliente — em outcomes mensuráveis ou emocionais.
- MELHOR CLIENTE: o segmento específico que mais valoriza esse valor. Quanto mais nichado, mais forte.
- CATEGORIA DE MERCADO: o frame de referência em que o cliente vai encaixar a marca. Categoria errada = comparação errada.
APLICAÇÃO POR POST: pelo menos 1 vez por semana o conteúdo deve evidenciar categoria + alternativa rejeitada + valor único. Evite "somos diferentes" — mostre POR QUE e PARA QUEM.`;
}

// ============ PDFs de referência (DEPRECADO — manter para reativação futura) ============

function normalizeDocName(name: string): string {
  return (name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\.pdf$/i, "")
    .replace(/[\s_\-.]+/g, "");
}

const EDITORIAL_PDF_WHITELIST = ["storybrand", "madetostick", "obviouslyawesome"];
const STRATEGY_PDF_WHITELIST = ["storybrand"];

export async function fetchStrategyReferencePdfs(): Promise<ClaudePdfPart[]> {
  return fetchReferencePdfsByWhitelist(STRATEGY_PDF_WHITELIST);
}

export async function fetchEditorialReferencePdfs(): Promise<ClaudePdfPart[]> {
  return fetchReferencePdfsByWhitelist(EDITORIAL_PDF_WHITELIST);
}

async function fetchReferencePdfsByWhitelist(whitelist: string[]): Promise<ClaudePdfPart[]> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: docs } = await admin
      .from("reference_documents")
      .select("file_path, file_size, name")
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (!docs?.length) return [];

    const filtered = docs.filter((d: any) => {
      const candidate = normalizeDocName(d.name || d.file_path?.split("/").pop() || "");
      return whitelist.some((w) => candidate.includes(w));
    });
    if (!filtered.length) return [];

    const parts: ClaudePdfPart[] = [];
    let totalSize = 0;
    const MAX_TOTAL = 8 * 1024 * 1024;

    for (const doc of filtered) {
      if (totalSize + doc.file_size > MAX_TOTAL) break;
      const { data: fileData, error } = await admin.storage
        .from("reference-pdfs")
        .download(doc.file_path);
      if (error || !fileData) continue;
      const arrayBuf = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      let binary = "";
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, Math.min(i + CHUNK, bytes.length)))
        );
      }
      parts.push({ mime_type: "application/pdf", data: btoa(binary) });
      totalSize += doc.file_size;
    }
    return parts;
  } catch (e) {
    console.error("Error fetching reference PDFs:", e);
    return [];
  }
}

// ============ Questionário pessoal ============

const PERSONAL_LABELS: Record<string, string> = {
  hobby: "Hobby principal",
  pets: "Pets / animais que ama",
  sports: "Esportes / atividade física",
  dependents: "Filhos ou dependentes",
  sunday_morning: "Domingo de manhã ideal",
  proud_moment: "Momento profissional do qual mais se orgulha",
  failure_lesson: "Falha que ensinou algo",
  work_routine: "Rotina típica de trabalho",
  pre_meeting_ritual: "Ritual antes de atender clientes",
  unblock_method: "Como sai de bloqueios criativos/mentais",
  defended_belief: "Crença defendida publicamente",
  social_cause: "Causa social que mobiliza",
  desired_feeling: "Sentimento que quer despertar no público",
  guiding_belief: "Frase/ideia que guia decisões",
  formative_story: "História que o formou como profissional",
  biggest_influence: "Pessoa que mais o influenciou",
  advice_to_20yo: "Conselho que daria pra si mesmo aos 20 anos",
};

export interface PersonalAnswers {
  [key: string]: string | null | undefined;
}

/**
 * Busca o questionário pessoal mais recente do usuário (status = 'submitted').
 * Retorna `null` se ainda não preenchido.
 */
export async function fetchPersonalQuestionnaire(userId: string): Promise<PersonalAnswers | null> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data } = await admin
      .from("personal_questionnaires")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "submitted")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data || null;
  } catch (e) {
    console.error("Error fetching personal questionnaire:", e);
    return null;
  }
}

/**
 * Renderiza o bloco de contexto pessoal pronto pra colar no prompt do Claude.
 * Campos vazios são omitidos para reduzir ruído.
 * Retorna string vazia se não houver dados.
 */
export function renderPersonalContext(personal: PersonalAnswers | null | undefined): string {
  if (!personal) return "";
  const lines: string[] = [];
  for (const [key, label] of Object.entries(PERSONAL_LABELS)) {
    const value = personal[key];
    if (typeof value === "string" && value.trim().length > 0) {
      lines.push(`- ${label}: ${value.trim()}`);
    }
  }
  if (lines.length === 0) return "";

  return `\n\n# CONTEXTO PESSOAL DO CRIADOR (use para humanizar — NUNCA invente fatos)
Estas são respostas reais do criador. Reserve 1–2 dos 7 dias da semana para posts em formato STORYTELLING que tecem paralelos entre a vida pessoal/história do criador e as dores do cliente-alvo (modelo "do tatame ao tribunal"). Nos demais dias, use detalhes pessoais como tempero — referências sutis, vocabulário, exemplos concretos — sem forçar.

${lines.join("\n")}

REGRAS DE USO DESTE CONTEXTO:
- NUNCA invente fatos pessoais. Use apenas o que está acima.
- NUNCA exponha dados sensíveis literalmente (ex: nome de familiares, doenças, endereços).
- Prefira metáforas e paralelos a descrições literais.
- Se um campo estiver ausente acima, simplesmente não o use.`;
}

// ============ StoryBrand + Tom de voz ============

export function renderStorybrandBlock(storybrand: any | null | undefined): string {
  if (!storybrand) return "";
  return `\n\n# ESTRATÉGIA STORYBRAND DA MARCA (espinha dorsal interna)
- Herói (Cliente): ${storybrand.hero || ""}
- Guia (Marca): ${storybrand.guide || ""}
- Problema Externo: ${storybrand.external_problem || ""}
- Problema Interno: ${storybrand.internal_problem || ""}
- Problema Filosófico: ${storybrand.philosophical_problem || ""}
- Plano: ${Array.isArray(storybrand.plan) ? storybrand.plan.join(", ") : storybrand.plan || ""}
- CTA: ${storybrand.cta || ""}
- Sucesso: ${storybrand.success || ""}
- Fracasso: ${storybrand.failure || ""}`;
}

export function renderToneBlock(tone: any | null | undefined): string {
  if (!tone) return "";
  return `\n\n# TOM DE VOZ DA MARCA
- Resumo: ${tone.summary || ""}
- Estilo: ${tone.communication_style || ""}
- Palavras para USAR: ${(tone.words_to_use || []).join(", ")}
- Palavras para EVITAR: ${(tone.words_to_avoid || []).join(", ")}
- Emoções para evocar: ${(tone.emotions_to_evoke || []).join(", ")}`;
}
