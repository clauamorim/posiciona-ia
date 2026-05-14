// Validador heurístico pós-geração para conteúdo de profissões regulamentadas.
// Roda regex sobre os campos visíveis do post e devolve violações classificadas
// como "high" (passíveis de retry) ou "medium" (apenas log).
//
// O validador NUNCA bloqueia entrega — ele apenas sinaliza para que a camada
// chamadora decida disparar um retry guiado e/ou registrar para auditoria.

import type { ProfessionCategory } from "./professionRules.ts";

export interface ComplianceViolation {
  rule: string;
  matched_text: string;
  field: "title" | "headline" | "body" | "cta" | "stories";
  severity: "high" | "medium";
}

export interface PostForCompliance {
  title?: string;
  headline?: string;
  body?: string;
  cta?: string;
  stories?: string[];
}

// Regras universais (qualquer profissão regulamentada).
const UNIVERSAL_RULES: Array<{ rule: string; pattern: RegExp; severity: "high" | "medium" }> = [
  { rule: "promessa_resultado_garantido", pattern: /\b(garanto|garantia|garantido[a]?)\b/i, severity: "high" },
  { rule: "promessa_cura", pattern: /\bcura\s+(garantida|certa|definitiva)\b/i, severity: "high" },
  { rule: "preco_chamariz", pattern: /\bR\$\s?\d|\b(primeira\s+(consulta|sess[aã]o|avalia[cç][aã]o)\s+gr[aá]tis)\b/i, severity: "high" },
  { rule: "antes_e_depois", pattern: /\b(antes\s+e\s+depois|antes\/depois)\b/i, severity: "high" },
  { rule: "captacao_direta", pattern: /\b(agende\s+sua|estou\s+aceitando|vagas?\s+limitadas|me\s+chame\s+(no\s+)?direct)\b/i, severity: "medium" },
  { rule: "milagre", pattern: /\b(milagr[eo]|revolucion[aá]ri[oa]|[uú]nic[ao]\s+que)\b/i, severity: "medium" },
  // Caso anonimizado de paciente/cliente com detalhes verossímeis — risco de
  // identificabilidade mesmo sem nome real. Bloquear para profissões reguladas.
  // Ex.: "Paciente de 42 anos que…", "Advogada de Curitiba que perdeu…",
  // "Cliente que veio com…", "Médico com 12 anos de prática que…".
  {
    rule: "caso_cliente_identificavel",
    pattern: /\b(paciente|cliente|atendid[oa]|consulent[ea])\s+(de\s+\d{1,2}\s+anos|de\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+|com\s+\d+\s+anos|que\s+(veio|chegou|me\s+procurou|relatou|tinha))\b/i,
    severity: "high",
  },
  {
    rule: "profissional_identificavel",
    pattern: /\b(advogad[oa]|m[eé]dic[oa]|dentista|psic[oó]log[oa]|nutricionista|fisioterapeuta|arquitet[oa]|contador[a]?)\s+(de\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+|com\s+\d+\s+anos\s+de\s+(pr[aá]tica|carreira|profiss[aã]o))\b/,
    severity: "high",
  },
];

// Regras específicas por profissão.
const PROFESSION_RULES: Record<Exclude<ProfessionCategory, "outro">, Array<{ rule: string; pattern: RegExp; severity: "high" | "medium" }>> = {
  advogado: [
    { rule: "advog_promessa_vitoria", pattern: /\b(ganhar\s+a\s+causa|vit[oó]ria\s+(certa|garantida)|indeniza[cç][aã]o\s+certa)\b/i, severity: "high" },
    { rule: "advog_honorarios", pattern: /\b(honor[aá]rios?\s+a\s+partir|primeira\s+consulta\s+gr[aá]tis|parcelamos?\s+em)\b/i, severity: "high" },
  ],
  medico: [
    { rule: "med_indicacao_medicamento", pattern: /\b(tome\s+\w+ina|use\s+\w+ina|prescrev[oa]\s+\w+)\b/i, severity: "medium" },
    { rule: "med_autodiagnostico", pattern: /\bse\s+voc[eê]\s+(sente|tem)\s+.{0,40}?\s*(é|significa|provavelmente)\b/i, severity: "medium" },
  ],
  psicologo: [
    { rule: "psi_promessa_terapia", pattern: /\b(cura\s+da\s+(ansiedade|depress[aã]o)|supera[cç][aã]o\s+garantida)\b/i, severity: "high" },
    { rule: "psi_autodiagnostico", pattern: /\bse\s+voc[eê]\s+(sente|tem)\s+.{0,40}?\s*(voc[eê]\s+tem|é\s+ansiedade|é\s+depress[aã]o)\b/i, severity: "medium" },
  ],
  dentista: [
    { rule: "odonto_sorriso_perfeito", pattern: /\b(sorriso\s+perfeito|dentes?\s+brancos?\s+em\s+\d)\b/i, severity: "high" },
  ],
  nutricionista: [
    { rule: "nutri_emagrecimento_prazo", pattern: /\b(\d+\s?kg\s+em\s+\d+|emagrece[rt]?\s+r[aá]pido|perca\s+peso)\b/i, severity: "high" },
    { rule: "nutri_detox", pattern: /\bdetox\b/i, severity: "medium" },
  ],
  fisioterapeuta: [
    { rule: "fisio_alivio_garantido", pattern: /\b(sem\s+dor\s+em\s+\d|al[ií]vio\s+garantido|cure\s+sua\s+h[eé]rnia)\b/i, severity: "high" },
  ],
};

export function validatePostCompliance(
  post: PostForCompliance,
  category: ProfessionCategory,
): ComplianceViolation[] {
  if (category === "outro") return [];
  const violations: ComplianceViolation[] = [];
  const rules = [...UNIVERSAL_RULES, ...(PROFESSION_RULES[category] || [])];

  const fields: Array<["title" | "headline" | "body" | "cta" | "stories", string]> = [
    ["title", post.title || ""],
    ["headline", post.headline || ""],
    ["body", post.body || ""],
    ["cta", post.cta || ""],
    ["stories", (post.stories || []).join("\n")],
  ];

  for (const [field, text] of fields) {
    if (!text) continue;
    for (const r of rules) {
      const m = text.match(r.pattern);
      if (m) violations.push({ rule: r.rule, matched_text: m[0], field, severity: r.severity });
    }
  }
  return violations;
}

/** Adapta um post no shape do editorial (theme/caption/card_copy/cta/script)
 *  para o shape genérico do validador. */
export function feedPostToCompliance(p: any): PostForCompliance {
  const cardCopy = Array.isArray(p?.card_copy) ? p.card_copy.join("\n") : "";
  const bodyParts = [p?.caption, p?.script, cardCopy].filter((s) => typeof s === "string" && s.trim());
  return {
    title: typeof p?.theme === "string" ? p.theme : "",
    headline: Array.isArray(p?.card_copy) && p.card_copy[0] ? String(p.card_copy[0]) : "",
    body: bodyParts.join("\n\n"),
    cta: typeof p?.cta === "string" ? p.cta : "",
    stories: [],
  };
}

/** Mensagem para o retry guiado, listando o que precisa ser reescrito. */
export function renderComplianceRetryInstructions(
  perPost: Array<{ day: number; violations: ComplianceViolation[] }>,
): string {
  const blocks = perPost.map(({ day, violations }) => {
    const lines = violations
      .filter((v) => v.severity === "high")
      .map((v) => `   - regra "${v.rule}" no campo "${v.field}": "${v.matched_text}"`)
      .join("\n");
    return `Dia ${day}:\n${lines}`;
  });
  return `\n\n⚠️ COMPLIANCE — REESCREVA APENAS OS POSTS ABAIXO
A versão anterior infringiu regras éticas obrigatórias da profissão regulamentada do criador. Reescreva SOMENTE os posts dos dias listados, removendo o trecho problemático e mantendo o tema. Devolva um array JSON contendo APENAS os posts reescritos (com o mesmo "day").

${blocks.join("\n\n")}`;
}
