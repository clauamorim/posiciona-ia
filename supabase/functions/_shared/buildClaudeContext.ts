// Helpers para montar blocos de contexto enviados ao Claude.
//
// Garante que TODA chamada de geração editorial inclua:
// 1) O contexto do negócio (questionário de negócio).
// 2) StoryBrand + tom de voz da marca (do relatório estratégico).
// 3) Contexto pessoal do criador (questionário pessoal) — humanização.
// 4) Os PDFs de referência (StoryBrand, Made to Stick, Obviously Awesome).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { ClaudePdfPart } from "./claudeClient.ts";

// ============ PDFs de referência ============

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
