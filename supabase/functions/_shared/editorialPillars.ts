// Pilares editoriais fixos. Cada post de feed deve carregar UM pilar.
// A rotação anti-repetição usa as últimas 4 semanas para sugerir
// pilares sub e sobre-representados ao gerador.

export const EDITORIAL_PILLARS = [
  {
    id: "metodo",
    label: "Método",
    description:
      "Passo a passo, frameworks ou processo proprietário do criador. Mostra COMO ele resolve o problema. Tese clara, ordem dos passos, o que evitar. Não é dica genérica — é o método assinado pelo criador.",
  },
  {
    id: "mito",
    label: "Mito vs. realidade",
    description:
      "Quebra de uma crença comum no nicho. Estrutura: 'todo mundo acredita X' → por que X é incompleto/errado → o que faz mais sentido. Exige prova ou raciocínio sólido (nunca afirmação vazia).",
  },
  {
    id: "mercado",
    label: "Análise de mercado",
    description:
      "Leitura de cenário, dado, tendência, mudança regulatória ou movimento do setor. Posiciona o criador como observador estratégico do nicho. Sempre conecta o dado a uma implicação prática para o público.",
  },
  {
    id: "caso",
    label: "Caso real",
    description:
      "Mini-case anonimizado: situação inicial → ação tomada → resultado. SÓ usar com mini-case real cadastrado no bloco FATOS VERIFICÁVEIS. Sem fato, formular como hipótese sinalizada ('imagine um cliente que...').",
  },
  {
    id: "posicionamento",
    label: "Posicionamento",
    description:
      "April Dunford: categoria + alternativa rejeitada + valor único. Define o que o criador É e o que NÃO É. Útil para repelir o cliente errado e atrair o ideal. Aparece no mínimo 1x a cada 4 semanas.",
  },
  {
    id: "bastidor",
    label: "Bastidor pessoal",
    description:
      "Storytelling do criador (do bloco CONTEXTO PESSOAL). Vivência real usada como metáfora para a dor do cliente, modelo 'do tatame ao tribunal'. Único pilar que aceita is_personal=true. Limite: 1x por semana e SOMENTE se estiver sub-representado.",
  },
] as const;

export type PillarId = (typeof EDITORIAL_PILLARS)[number]["id"];

export const PILLAR_IDS: PillarId[] = EDITORIAL_PILLARS.map((p) => p.id);

export function isValidPillar(value: unknown): value is PillarId {
  return typeof value === "string" && (PILLAR_IDS as string[]).includes(value);
}

export function renderPillarsBlock(): string {
  const lines = EDITORIAL_PILLARS
    .map((p) => `- ${p.id} ("${p.label}"): ${p.description}`)
    .join("\n");
  return `

# PILARES EDITORIAIS (use o id exato no campo "pillar" de cada post)
Cada post de feed pertence a EXATAMENTE UM dos 6 pilares abaixo. O id deve ser escrito literalmente como aparece (em minúsculas, sem acentos).

${lines}

REGRAS:
- Os 4 posts de uma mesma semana DEVEM usar 4 pilares DIFERENTES entre si.
- "bastidor" só entra se estiver na lista de pilares sub-representados desta semana E SE houver dados pessoais cadastrados.
- "caso" só usa números/situações reais quando existirem no bloco FATOS VERIFICÁVEIS — sem dado, formular como hipótese explícita.
- O conteúdo visível ao público (theme, caption, card_copy, cta, script) NUNCA cita o nome do pilar.`;
}

export interface PillarRotationHint {
  counts: Record<PillarId, number>;
  underrepresented: PillarId[];
  overrepresented: PillarId[];
}

/**
 * Lê o histórico de pilares por semana (ordem cronológica) e devolve a
 * distribuição nas últimas 4 semanas + listas de pilares sub e
 * sobre-representados.
 *
 * Limiares:
 * - sub-representado: contagem ≤ 1 nas últimas 4 semanas (ou zero)
 * - sobre-representado: contagem ≥ 4 (≥ 2 para "bastidor", mais agressivo)
 */
export function getPillarRotationHint(
  previousPillarsByWeek: PillarId[][],
): PillarRotationHint {
  const last4 = (previousPillarsByWeek || []).slice(-4);
  const counts: Record<PillarId, number> = {
    metodo: 0,
    mito: 0,
    mercado: 0,
    caso: 0,
    posicionamento: 0,
    bastidor: 0,
  };
  for (const week of last4) {
    if (!Array.isArray(week)) continue;
    for (const pid of week) {
      if (isValidPillar(pid)) counts[pid] += 1;
    }
  }

  const underrepresented: PillarId[] = [];
  const overrepresented: PillarId[] = [];
  for (const pid of PILLAR_IDS) {
    const c = counts[pid];
    if (c <= 1) underrepresented.push(pid);
    const overLimit = pid === "bastidor" ? 2 : 4;
    if (c >= overLimit) overrepresented.push(pid);
  }

  return { counts, underrepresented, overrepresented };
}

export function renderRotationBlock(hint: PillarRotationHint): string {
  const countsStr = PILLAR_IDS
    .map((pid) => `${pid}=${hint.counts[pid]}`)
    .join(", ");
  const under = hint.underrepresented.length > 0
    ? hint.underrepresented.join(", ")
    : "nenhum (todos balanceados)";
  const over = hint.overrepresented.length > 0
    ? hint.overrepresented.join(", ")
    : "nenhum";
  return `

# ROTAÇÃO DE PILARES — REGRA OBRIGATÓRIA
Pilares já cobertos nas últimas 4 semanas: ${countsStr}
Pilares SUB-REPRESENTADOS (priorize esta semana): ${under}
Pilares SOBRE-REPRESENTADOS (evite esta semana): ${over}

REGRA: os 4 posts de feed desta semana DEVEM usar 4 pilares DIFERENTES entre si. Nenhum pilar pode aparecer 2x na mesma semana. Comece priorizando os sub-representados; se restarem espaços, escolha entre os neutros. Evite os sobre-representados.`;
}
