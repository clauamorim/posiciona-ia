// Detecção de profissão regulamentada e injeção de regras éticas obrigatórias
// no system prompt. Cobre advogados, médicos, psicólogos, dentistas,
// nutricionistas e fisioterapeutas.

export type ProfessionCategory =
  | "advogado"
  | "medico"
  | "psicologo"
  | "dentista"
  | "nutricionista"
  | "fisioterapeuta"
  | "outro";

export interface ProfileForDetection {
  profession?: string | null;
  niche?: string | null;
  specialty?: string | null;
  business_description?: string | null;
}

function normalize(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildHaystack(profile: ProfileForDetection): string {
  return [
    profile.profession,
    profile.niche,
    profile.specialty,
    profile.business_description,
  ]
    .filter(Boolean)
    .map(normalize)
    .join(" ");
}

const ADVOGADO_KEYWORDS = ["advog", "juridic", "direito", "oab", "tribunal", "advocacia"];
const PSICOLOGO_KEYWORDS = [
  "psicolog", "psicoterap", "terapeuta", "psicanal", "psicologia",
  "neuropsicolog", "psicopedag", "terapia cognitiva", "tcc",
];
const DENTISTA_KEYWORDS = [
  "dentist", "odontolog", "ortodont", "endodont", "periodont",
  "implantodont", "buco-maxil", "bucomaxil", "protesist",
  "odontopediatr", "harmonizacao orofacial",
];
const NUTRICIONISTA_KEYWORDS = [
  "nutric", "nutricion", "nutrologo", "nutrologa",
  "nutricionista esportiv", "nutricao clinic", "nutricao funcional",
];
const FISIOTERAPEUTA_KEYWORDS = [
  "fisioterap", "fisioterapeut", "pilates clinic", "rpg",
  "fisio ortoped", "fisio neuro", "fisio respirat", "osteopat", "quiropr",
];
const MEDICO_KEYWORDS = [
  "medic", "medico", "doutor", "doutora", "cfm", "saude", "clinic", "cardiolog",
  "dermatolog", "pediatr", "ginec", "ortoped", "psiquiatr", "neurolog", "oncolog",
  "endocrinolog", "gastroenterolog", "cirurgia", "cirurgi",
];

export function detectProfession(profile: ProfileForDetection | null | undefined): ProfessionCategory {
  if (!profile) return "outro";
  const haystack = buildHaystack(profile);
  // Ordem importa: testar mais específico antes do mais genérico ("medico").
  if (ADVOGADO_KEYWORDS.some((k) => haystack.includes(k))) return "advogado";
  if (DENTISTA_KEYWORDS.some((k) => haystack.includes(k))) return "dentista";
  if (PSICOLOGO_KEYWORDS.some((k) => haystack.includes(k))) return "psicologo";
  if (NUTRICIONISTA_KEYWORDS.some((k) => haystack.includes(k))) return "nutricionista";
  if (FISIOTERAPEUTA_KEYWORDS.some((k) => haystack.includes(k))) return "fisioterapeuta";
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

const PSICOLOGO_BLOCK = `# REGRAS ÉTICAS OBRIGATÓRIAS — PSICOLOGIA (CFP / Resoluções 010/2005 e 003/2007)

Este conteúdo será publicado por um(a) psicólogo(a). NÃO escreva nada que viole as regras abaixo. Se uma ideia esbarrar em qualquer item, REESCREVA com outro ângulo.

PROIBIDO:
- Garantia de resultado terapêutico: "você vai superar a ansiedade", "cura da depressão", "resultado em X sessões".
- Promessa de cura para transtornos, sofrimentos psíquicos ou condições mentais.
- Antes/depois emocional ou comportamental ("ela chegou em crise e hoje está plena").
- Exposição de pacientes — mesmo anonimizada, mesmo com consentimento, mesmo em "caso clínico hipotético baseado em paciente real".
- Depoimentos de pacientes sobre resultado de terapia.
- Sensacionalismo: "técnica revolucionária", "método único", "abordagem que ninguém mais usa".
- Divulgação de técnicas como exclusivas ou patenteadas como diferencial mercadológico.
- Divulgação de valores de sessão, pacotes, descontos, "primeira sessão grátis" como chamariz.
- Comparação com colegas ou outras abordagens ("psicanálise não funciona, TCC sim").
- Captação direta de pacientes: "estou com vagas", "agende sua sessão", promessa de retorno emocional/financeiro.
- Diagnóstico à distância ou indução a autodiagnóstico ("se você sente X, você tem ansiedade").
- Auto-promoção exagerada de títulos não comprovados ou cursos privados como especialização.

PERMITIDO E ENCORAJADO:
- Educação em saúde mental, prevenção, alfabetização emocional.
- Esclarecimento de mitos sobre psicologia e terapia.
- Reflexões sobre escuta, vínculo, ética profissional, formação.
- Posicionamento técnico sobre temas de saúde mental pública.
- Conteúdo educativo sobre quando e como procurar ajuda profissional.
- CTAs sóbrios: "salve este post", "compartilhe com quem possa se beneficiar", "procure um(a) profissional para avaliar seu caso".

LINGUAGEM:
- Tom técnico-acessível, sem prometer, sem dramatizar.
- Substitua "agende sua sessão" por "se isso ressoa, busque acompanhamento profissional".
- Sempre que tratar de tema clínico, deixe claro que cada caso é individual e a publicação é educativa, não substitui acompanhamento.
- Use linguagem cuidadosa em torno de sofrimento psíquico — sem romantizar nem patologizar.
`;

const DENTISTA_BLOCK = `# REGRAS ÉTICAS OBRIGATÓRIAS — ODONTOLOGIA (CFO / Resoluções 118/2012 e 196/2019)

Este conteúdo será publicado por um(a) cirurgião(ã)-dentista. NÃO escreva nada que viole as regras abaixo. Se uma ideia esbarrar em qualquer item, REESCREVA com outro ângulo.

PROIBIDO:
- Antes/depois de tratamentos com finalidade publicitária ou comparativa.
- Garantia de resultado estético ou clínico ("seu sorriso perfeito", "X dentes brancos em Y dias", "resultado garantido").
- Divulgação de preços, pacotes, descontos, parcelamentos como atrativo principal, "primeira avaliação grátis" como chamariz.
- Sensacionalismo: "tratamento revolucionário", "técnica exclusiva", "único profissional com X equipamento".
- Comparação com colegas, clínicas ou técnicas alheias.
- Exposição de pacientes identificáveis — mesmo com consentimento, mesmo com tarja.
- Testemunhos de pacientes sobre resultado de tratamento.
- Promessas de resultado em harmonização orofacial, ortodontia, implantes ou estética dental.
- Indicação de marcas comerciais de materiais ou equipamentos como diferencial pessoal.
- Auto-promoção com títulos não registrados no CFO ou rankings privados sem critério.
- Captação direta: "agende sua consulta hoje", "vagas limitadas para procedimento X".

PERMITIDO E ENCORAJADO:
- Educação em saúde bucal, prevenção, orientação técnica.
- Esclarecimento de mitos odontológicos.
- Reflexões sobre formação, rotina clínica, ética profissional.
- Conteúdo educativo sobre quando procurar diferentes especialidades.
- Posicionamento técnico sobre temas de saúde pública bucal.
- CTAs sóbrios: "salve este post", "guarde para a próxima consulta", "procure seu dentista para avaliar".

LINGUAGEM:
- Tom técnico-acessível. Cada caso é individual. A publicação é educativa, não consultiva.
- Substitua "agende sua consulta" por "guarde esta informação para conversar com seu dentista".
- Não prometa estética; fale de saúde, função, prevenção.
`;

const NUTRICIONISTA_BLOCK = `# REGRAS ÉTICAS OBRIGATÓRIAS — NUTRIÇÃO (CFN / Código de Ética 599/2018)

Este conteúdo será publicado por um(a) nutricionista. NÃO escreva nada que viole as regras abaixo. Se uma ideia esbarrar em qualquer item, REESCREVA com outro ângulo.

PROIBIDO:
- Prescrição de dietas, suplementos ou condutas nutricionais para indivíduo não identificado.
- Promessa de emagrecimento ou ganho de massa em tempo determinado ("X kg em Y semanas", "perca peso rápido").
- Antes/depois corporal de paciente, mesmo com tarja, mesmo com consentimento.
- Exposição de pacientes (relatos identificáveis, evolução de medidas, fotos de progresso).
- Sensacionalismo: "alimento milagroso", "veneno", "elimina toxinas", "detox" como promessa.
- Divulgação de marcas comerciais de suplementos, produtos ou serviços com vínculo comercial não declarado.
- Garantia de resultado: "você vai emagrecer", "cura da compulsão alimentar", "fim da TPM".
- Indução a autodiagnóstico nutricional ("se você sente X, está com deficiência de Y, tome Z").
- Divulgação de preços de consulta, pacotes, "primeira consulta grátis" como chamariz.
- Comparação com colegas ou outras abordagens nutricionais ("low-carb funciona, vegano não").
- Demonização ou romantização de grupos alimentares fora de contexto técnico responsável.

PERMITIDO E ENCORAJADO:
- Educação alimentar e nutricional baseada em evidência.
- Esclarecimento de mitos nutricionais.
- Reflexões sobre relação com comida, cultura alimentar, sustentabilidade.
- Posicionamento técnico sobre saúde pública nutricional.
- Conteúdo sobre formação, rotina clínica, ética profissional.
- CTAs sóbrios: "salve este post", "leve essa informação para sua próxima consulta", "procure um(a) nutricionista para avaliação individual".

LINGUAGEM:
- Tom técnico-acessível, sem alarmismo, sem prometer transformação corporal.
- Substitua "agende sua consulta" por "para conduta individual, busque acompanhamento".
- Não fale de peso/medidas como métricas centrais — fale de saúde, função, bem-estar.
- Linguagem inclusiva em relação a corpos.
`;

const FISIOTERAPEUTA_BLOCK = `# REGRAS ÉTICAS OBRIGATÓRIAS — FISIOTERAPIA (COFFITO / Resolução 424/2013 e Acórdão 424/2013)

Este conteúdo será publicado por um(a) fisioterapeuta. NÃO escreva nada que viole as regras abaixo. Se uma ideia esbarrar em qualquer item, REESCREVA com outro ângulo.

PROIBIDO:
- Garantia de cura ou resultado ("você vai ficar sem dor em X sessões", "alívio garantido").
- Antes/depois de tratamento, evolução visual de paciente, mesmo com consentimento.
- Exposição de pacientes identificáveis.
- Testemunhos de pacientes sobre resultado de tratamento.
- Sensacionalismo: "técnica revolucionária", "método exclusivo", "única forma de tratar X".
- Divulgação de técnicas como patenteadas ou exclusivas como diferencial mercadológico.
- Indução a autotratamento ("faça este exercício para curar sua hérnia").
- Divulgação de preços, pacotes, "primeira avaliação grátis" como chamariz.
- Comparação com colegas, clínicas ou abordagens.
- Captação direta: "agende sua avaliação hoje", "vagas limitadas".
- Indicação de medicamentos (não é competência do fisioterapeuta).
- Auto-promoção com títulos não comprovados.

PERMITIDO E ENCORAJADO:
- Educação em movimento, postura, prevenção de lesões.
- Esclarecimento de mitos comuns sobre dor, exercício e reabilitação.
- Reflexões sobre formação, prática clínica, ética profissional.
- Conteúdo sobre quando procurar fisioterapia versus outras especialidades.
- Posicionamento técnico sobre saúde pública e movimento.
- CTAs sóbrios: "salve este post", "compartilhe com quem possa se beneficiar", "procure um(a) fisioterapeuta para avaliação".

LINGUAGEM:
- Tom técnico-acessível, sem prometer alívio ou cura.
- Substitua "agende sua avaliação" por "se você convive com dor, procure avaliação profissional".
- Cada caso é individual — a publicação é educativa, não substitui avaliação.
`;

export function getEthicalRulesBlock(category: ProfessionCategory): string {
  if (category === "advogado") return `\n\n${ADVOGADO_BLOCK}`;
  if (category === "medico") return `\n\n${MEDICO_BLOCK}`;
  if (category === "psicologo") return `\n\n${PSICOLOGO_BLOCK}`;
  if (category === "dentista") return `\n\n${DENTISTA_BLOCK}`;
  if (category === "nutricionista") return `\n\n${NUTRICIONISTA_BLOCK}`;
  if (category === "fisioterapeuta") return `\n\n${FISIOTERAPEUTA_BLOCK}`;
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

export const POSITIONING_GUARDRAIL_BLOCK = `\n\n# GUARDRAIL DE POSICIONAMENTO (OBRIGATÓRIO EM TODOS OS POSTS)

Este conteúdo deve servir a profissionais que querem:
- Cobrar pelo valor (não pela hora ou volume)
- Atrair clientes premium (não clientes em massa)
- Construir autoridade (não popularidade)
- Trabalhar com menos pessoas (com mais resultado e margem)

NUNCA produzir conteúdo que:
- Defenda agenda cheia como métrica de sucesso
- Exclua quem está construindo autoridade ("só para quem já é referência")
- Trate cobrar mais como tabu ou arrogância
- Sugira que volume de clientes = competência

=== POSICIONAMENTO ESTRATÉGICO DO POSICIONA (NORTE OBRIGATÓRIO) ===
Todo conteúdo gerado deve servir a UM objetivo central:
ajudar este profissional a ser percebido como referência de valor — para atrair clientes/pacientes
que pagam mais, trabalhar com menos volume e ter melhor qualidade de vida.

NUNCA escrever conteúdo que:
- Trate "ter agenda cheia" como sinal de sucesso (é sinal de preço baixo).
- Posicione o profissional como "para quem já é referência" — exclui o público real.
- Glorifique volume de clientes, frequência alta de atendimento ou popularidade.
- Diga que "Posiciona é só para quem já cobra acima do mercado" — é para quem QUER cobrar mais.
- Fale em "transparecer no online o sucesso do offline" — é construir autoridade que justifica ticket.

SEMPRE orientar o conteúdo para um destes eixos de valorização:
1. AUTORIDADE QUE JUSTIFICA TICKET: por que esse profissional cobra (ou deveria cobrar) mais.
2. RECORTE DE CLIENTE IDEAL: quem é o cliente que paga pelo valor — e quem não é.
3. METODOLOGIA EXCLUSIVA: o que esse profissional faz que ninguém faz igual.
4. RESULTADO TRANSFORMACIONAL: o tipo de transformação que justifica investimento alto.
5. CRITÉRIO DE ESCOLHA: como o cliente premium decide — e por que critério de preço perde.
`;
