// Detecção de profissão regulamentada e injeção de regras éticas obrigatórias
// no system prompt. Aplicado quando o cadastro indica advogado(a) ou médico(a).
//
// Fonte usada: campos `profession` e `niche` do `profiles` (cadastro inicial).

export type ProfessionCategory = "advogado" | "medico" | "outro";

export interface ProfileForDetection {
  profession?: string | null;
  niche?: string | null;
}

function normalize(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const ADVOGADO_KEYWORDS = ["advog", "juridic", "direito", "oab", "tribunal", "advocacia"];
const MEDICO_KEYWORDS = [
  "medic", "medico", "doutor", "doutora", "cfm", "saude", "clinic", "cardiolog",
  "dermatolog", "pediatr", "ginec", "ortoped", "psiquiatr", "neurolog", "oncolog",
  "endocrinolog", "gastroenterolog", "cirurgia", "cirurgi",
];

export function detectProfession(profile: ProfileForDetection | null | undefined): ProfessionCategory {
  if (!profile) return "outro";
  const haystack = `${normalize(profile.profession)} ${normalize(profile.niche)}`;
  if (ADVOGADO_KEYWORDS.some((k) => haystack.includes(k))) return "advogado";
  if (MEDICO_KEYWORDS.some((k) => haystack.includes(k))) return "medico";
  return "outro";
}

const ADVOGADO_BLOCK = `# REGRAS ÉTICAS OBRIGATÓRIAS — ADVOCACIA (OAB / Provimento 205/2021 e Código de Ética)

Este conteúdo será publicado por um(a) advogado(a). NÃO escreva nada que viole as regras abaixo. Se uma ideia esbarrar em qualquer item, REESCREVA com outro ângulo.

PROIBIDO:
- Captação de clientela: "estou aceitando novos casos", "agende sua consulta", "te ajudo a ganhar a causa", "me chame para resolver seu problema jurídico", promessas de retorno financeiro, ofertas de serviços específicos a destinatário indeterminado.
- Garantia ou expectativa de resultado: "garanto vitória", "100% de aprovação", "você vai ganhar", "indenização certa", "processo rápido garantido".
- Comparação com colegas ou outros escritórios ("melhor que…", "diferente de outros advogados…").
- Mercantilização: divulgação de honorários, descontos, promoções, "primeira consulta grátis" como chamariz, parcelamento como atrativo.
- Sensacionalismo: linguagem alarmista, exploração emocional de tragédias, exposição de casos com detalhes que permitam identificar partes envolvidas.
- Divulgação de casos específicos identificáveis (nome do cliente, processo, sentença), mesmo com permissão.
- Uso de testemunhos de clientes sobre resultados obtidos.
- Auto-promoção exagerada com títulos não comprovados ou rankings privados sem critério.

PERMITIDO E ENCORAJADO:
- Informação jurídica de utilidade pública (explicar leis, mudanças, direitos, prazos).
- Conteúdo educativo e preventivo (como evitar problemas, o que observar antes de assinar contratos).
- Esclarecimento de mitos jurídicos comuns.
- Reflexões sobre ética, formação, rotina profissional, leituras, decisões marcantes da jurisprudência.
- Posicionamento técnico sobre temas públicos da área.
- CTAs sóbrios: "salve este post", "comente sua dúvida em termos gerais", "indique para alguém que precise saber disso".

LINGUAGEM:
- Tom técnico-acessível, sem jargão excessivo, sem prometer.
- Substitua "agende sua consulta" por "guarde esta informação para quando precisar" ou similar.
- Sempre que tratar de tema jurídico, deixe claro que cada caso tem particularidades e a leitura é informativa, não consultiva.
`;

const MEDICO_BLOCK = `# REGRAS ÉTICAS OBRIGATÓRIAS — MEDICINA (CFM / Resoluções 1.974/2011, 2.336/2023 e Código de Ética Médica)

Este conteúdo será publicado por um(a) médico(a). NÃO escreva nada que viole as regras abaixo. Se uma ideia esbarrar em qualquer item, REESCREVA com outro ângulo.

PROIBIDO:
- Antes/depois de procedimentos, fotos de pacientes (mesmo com tarja), exposição visual de resultados.
- Garantia de cura, resultado ou tempo de recuperação ("você vai ficar curado", "resultado em 7 dias").
- Sensacionalismo: dramatização de doenças, exploração do medo, "milagres", "tratamento revolucionário".
- Auto-promoção de aparelhos, marcas comerciais, técnicas patenteadas como diferencial mercadológico ("único com o equipamento X").
- Divulgação de preços, pacotes, descontos, "promoções", financiamentos como chamariz.
- Comparação com colegas ou clínicas ("melhor que…", "mais experiente que…").
- Exposição de pacientes (relatos identificáveis, depoimentos sobre tratamento, histórias de caso reconhecíveis), mesmo com consentimento.
- Indicação direta de medicamentos específicos por nome comercial.
- Conteúdo que induza autodiagnóstico ou automedicação ("se você sente X, é Y, tome Z").
- Títulos de especialista não registrados no CRM/CFM.

PERMITIDO E ENCORAJADO:
- Educação em saúde, prevenção, informação técnica acessível.
- Esclarecimento de mitos médicos.
- Conteúdo sobre rotina profissional, formação, ética, escolhas de carreira.
- Reflexões sobre relação médico-paciente, escuta, dignidade no cuidado.
- Posicionamento técnico sobre temas de saúde pública.
- CTAs sóbrios: "salve este post", "compartilhe com quem precise saber", "procure seu médico para avaliar seu caso".

LINGUAGEM:
- Tom técnico-acessível. Sempre lembre que cada caso é individual e que a publicação é educativa, não substitui consulta.
- Substitua "agende sua consulta" por orientações genéricas de cuidado.
- Use linguagem inclusiva e respeitosa em relação a pacientes.
`;

export function getEthicalRulesBlock(category: ProfessionCategory): string {
  if (category === "advogado") return `\n\n${ADVOGADO_BLOCK}`;
  if (category === "medico") return `\n\n${MEDICO_BLOCK}`;
  return "";
}

export interface MarketTrend {
  title: string;
  summary: string;
  source_url?: string;
  published_at?: string;
  angle_suggestion?: string;
}

export function renderMarketTrendsBlock(trends: MarketTrend[] | null | undefined): string {
  if (!trends || trends.length === 0) {
    return `\n\n# CONTEXTO ATUAL — POST DE ANÁLISE DE MERCADO OU CASO
Não há tendências pré-buscadas disponíveis esta semana. Para o post de ANÁLISE DE MERCADO OU CASO, use seu conhecimento de treinamento para identificar um evento, decisão, polêmica ou caso REAL e NOMEADO relevante ao nicho do criador (empresa conhecida, pessoa pública, produto, legislação). Regras:
- Deve ter nome próprio identificável (empresa X, produto Y, decisão Z)
- Deve ter uma data ou período estimado razoável (ex: "em 2024", "recentemente")
- Comente com perspectiva técnica/profissional do criador — NÃO apenas relate o fato
- NÃO invente casos. Se não encontrar referência verificável, declare explicitamente como hipótese`;
  }
  const lines = trends.map((t, i) => {
    const parts = [
      `${i + 1}. ${t.title}`,
      t.summary ? `   Resumo: ${t.summary}` : "",
      t.angle_suggestion ? `   Ângulo sugerido para post: ${t.angle_suggestion}` : "",
      t.source_url ? `   Fonte: ${t.source_url}` : "",
    ].filter(Boolean);
    return parts.join("\n");
  });
  return `\n\n# CONTEXTO ATUAL DO MERCADO — USE OBRIGATORIAMENTE
Estas são notícias, casos públicos e debates RECENTES do nicho do criador. Você DEVE usar pelo menos 1 destas tendências como GANCHO CONCRETO de UM post específico da semana (idealmente 2). Citar o caso pelo nome, comentar com voz própria do criador, trazer perspectiva técnica/posicional sobre o evento. Conteúdo atual gera mais engajamento que conteúdo abstrato — não é opcional.

Se NENHUMA das tendências fizer absolutamente nenhum sentido (raro), escolha a menos distante e construa o gancho mesmo assim. Repertório cultural atual é prioridade do sistema editorial.

Regras:
- Cite o caso pelo nome ou referência clara (ex: "o caso X", "a recente decisão de Y", "a polêmica de Z")
- Comente, NÃO informe — o leitor já sabe que aconteceu, queremos o ÂNGULO
- Mantenha as regras éticas e narrativas anteriores
- NÃO copie o título da notícia como manchete do post

${lines.join("\n\n")}`;
}
