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

// "Voz da Marca" — variante institucional do MESMO questionário (mesmas
// colunas de personal_questionnaires), só reenquadrado para marca/empresa em
// vez de pessoa física. Ver docs/plano-multi-workspace.md seção 7.
const INSTITUTIONAL_VOICE_LABELS: Record<string, string> = {
  hobby: "Algo que a marca faz muito bem e com orgulho, além de vender",
  pets: "Como é a equipe por trás da marca",
  sports: "Hábito ou disciplina que a marca cultiva internamente",
  dependents: "Quem depende da marca funcionar bem (clientes fixos, parceiros, comunidade)",
  sunday_morning: "Como é uma semana bem-sucedida para a marca",
  proud_moment: "Resultado ou entrega da qual a marca mais se orgulha",
  failure_lesson: "Erro ou desafio que ensinou algo e mudou a forma de operar",
  work_routine: "Rotina típica de operação",
  pre_meeting_ritual: "Ritual ou processo antes de atender um cliente",
  unblock_method: "Como a equipe resolve um imprevisto ou bloqueio",
  defended_belief: "Crença que a marca defende publicamente sobre o mercado",
  social_cause: "Causa ou tema que a marca apoia ou mobiliza",
  desired_feeling: "Sentimento que a marca quer despertar no cliente",
  guiding_belief: "Frase/princípio que guia as decisões da marca",
  formative_story: "Marco que definiu quem a marca é hoje",
  biggest_influence: "Marca, pessoa ou referência que influencia como constroem isso",
  advice_to_20yo: "Conselho que dariam para a marca no primeiro dia",
};

export interface PersonalAnswers {
  [key: string]: string | null | undefined;
}

/**
 * Busca o questionário pessoal mais recente do PERFIL (status = 'submitted').
 * Com `workspaceId`, escopa pelo perfil ativo — essencial em contas com mais
 * de um perfil, senão pega o questionário de version mais alta entre TODOS os
 * perfis do dono, que pode ser de outro perfil. Sem `workspaceId` (chamadores
 * legados), cai no comportamento antigo por `user_id`.
 * Retorna `null` se ainda não preenchido.
 */
export async function fetchPersonalQuestionnaire(userId: string, workspaceId?: string | null): Promise<PersonalAnswers | null> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    let query = admin.from("personal_questionnaires").select("*").eq("status", "submitted");
    query = workspaceId ? query.eq("workspace_id", workspaceId) : query.eq("user_id", userId);
    const { data } = await query
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
export function renderPersonalContext(
  personal: PersonalAnswers | null | undefined,
  brandType: "pessoal" | "institucional" = "pessoal",
): string {
  if (!personal) return "";
  const inst = brandType === "institucional";
  const labels = inst ? INSTITUTIONAL_VOICE_LABELS : PERSONAL_LABELS;
  const lines: string[] = [];
  for (const [key, label] of Object.entries(labels)) {
    const value = personal[key];
    if (typeof value === "string" && value.trim().length > 0) {
      lines.push(`- ${label}: ${value.trim()}`);
    }
  }
  if (lines.length === 0) return "";

  if (inst) {
    return `\n\n# CONTEXTO DA MARCA (bastidores reais — use para humanizar, NUNCA invente fatos)
Estas são respostas reais sobre a marca, disponíveis para uso editorial.

${lines.join("\n")}

REGRAS DE USO DESTE CONTEXTO:
- Use estes dados APENAS quando o post estiver explicitamente marcado como bastidor (is_personal=true), o que ocorre no pilar "bastidor". Nos demais posts, NÃO insira bastidores da marca fora de contexto.
- NUNCA invente fatos, nomes, números ou depoimentos. Use apenas o que está acima.
- NUNCA trate isto como vida pessoal de um indivíduo — é sempre sobre a MARCA (operação, equipe, valores).
- NUNCA exponha dados sensíveis literalmente (ex: nome de cliente real sem autorização, valores contratuais).
- Prefira metáforas e paralelos a descrições literais.
- Se um campo estiver ausente acima, simplesmente não o use.`;
  }

  return `\n\n# CONTEXTO PESSOAL DO CRIADOR (use para humanizar — NUNCA invente fatos)
Estas são respostas reais do criador, disponíveis para uso editorial.

${lines.join("\n")}

REGRAS DE USO DESTE CONTEXTO:
- Use estes dados APENAS quando o post estiver explicitamente marcado como pessoal (is_personal=true), o que ocorre no pilar "bastidor". Nos demais posts, NÃO insira menções pessoais, vivências do criador, hobbies, família ou rotina.
- NUNCA invente fatos pessoais. Use apenas o que está acima.
- NUNCA exponha dados sensíveis literalmente (ex: nome de familiares, doenças, endereços).
- Prefira metáforas e paralelos a descrições literais.
- Se um campo estiver ausente acima, simplesmente não o use.`;
}

// ============ Workspace / tipo de marca ============

export type BrandType = "pessoal" | "institucional";

/**
 * Tipo de marca do workspace. Com `workspaceId`, busca ESSE perfil
 * específico — sem isso, uma conta com 2º perfil institucional (não-default)
 * geraria conteúdo institucional como se fosse pessoal, porque o default da
 * conta continua "pessoal". Sem `workspaceId` (chamadores legados), cai no
 * workspace default do dono (comportamento pré-multi-perfil).
 * Fallback "pessoal" em qualquer falha.
 */
export async function fetchWorkspaceBrandType(userId: string, workspaceId?: string | null): Promise<BrandType> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    let query = admin.from("workspaces").select("brand_type");
    query = workspaceId ? query.eq("id", workspaceId) : query.eq("owner_id", userId).eq("is_default", true);
    const { data } = await query.maybeSingle();
    return data?.brand_type === "institucional" ? "institucional" : "pessoal";
  } catch (e) {
    console.error("Error fetching workspace brand_type:", e);
    return "pessoal";
  }
}

// ============ Narrativa de Venda (História de Venda) ============

export interface SalesNarrativeAnswers {
  previous_profession?: string | null;
  career_turn?: string | null;
  start_year_motivation?: string | null;
  negative_comments?: string | null;
  audience_objections?: string | null;
  proof_cases?: string | null;
  personal_expressions?: string | null;
  forbidden_topics?: string | null;
  is_complete?: boolean | null;
  status?: string | null;
  [k: string]: any;
}

/**
 * Busca o questionário "História de Venda" (sales_narrative_questionnaires)
 * mais recente do usuário. Não filtra por status para que rascunhos parciais
 * ainda contribuam — o render block omite campos vazios.
 */
export async function fetchSalesNarrative(userId: string): Promise<SalesNarrativeAnswers | null> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data } = await admin
      .from("sales_narrative_questionnaires")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    return data || null;
  } catch (e) {
    console.error("Error fetching sales narrative:", e);
    return null;
  }
}

/**
 * Renderiza o bloco de Narrativa de Venda para colar no system prompt do
 * estágio A (feed) e do estágio B (stories). Campos vazios são omitidos.
 * Inclui guia de uso por pilar editorial.
 */
export function renderSalesNarrativeContext(narrative: SalesNarrativeAnswers | null | undefined): string {
  if (!narrative) return "";
  const v = (k: string): string => {
    const raw = (narrative as any)[k];
    return typeof raw === "string" ? raw.trim() : "";
  };
  const previous = v("previous_profession");
  const turn = v("career_turn");
  const motivation = v("start_year_motivation");
  const critics = v("negative_comments");
  const objections = v("audience_objections");
  const cases = v("proof_cases");
  const expressions = v("personal_expressions");
  const forbidden = v("forbidden_topics");

  const hasAny = [previous, turn, motivation, critics, objections, cases, expressions, forbidden]
    .some((s) => s.length > 0);
  if (!hasAny) return "";

  const lines: string[] = [];
  if (previous) lines.push(`- Profissão/situação ANTES da virada: ${previous}`);
  if (turn) lines.push(`- A virada de carreira: ${turn}`);
  if (motivation) lines.push(`- Quando começou + motivação: ${motivation}`);
  if (critics) lines.push(`- Críticas/comentários negativos recebidos na virada: ${critics}`);
  if (objections) lines.push(`- Top objeções/dúvidas do cliente antes de fechar: ${objections}`);
  if (cases) lines.push(`- Casos reais cadastrados (use APENAS literal, NUNCA invente variações):\n${cases.split(/\r?\n/).map((s) => `    • ${s.trim()}`).filter((s) => s.trim().length > 4).join("\n")}`);
  if (expressions) lines.push(`- Bordões/expressões pessoais do criador: ${expressions}`);
  if (forbidden) lines.push(`- TEMAS PROIBIDOS (JAMAIS mencionar em qualquer post): ${forbidden}`);

  return `\n\n# NARRATIVA DE VENDA — HISTÓRIA DE VIRADA, OBJEÇÕES E PROVAS DO CRIADOR
Estas respostas vêm do questionário "História de Venda" preenchido pelo criador. Material legítimo para enriquecer voz, autoridade e profundidade editorial. Use APENAS o que está aqui — nunca invente fatos, ano, casos ou frases.

${lines.join("\n")}

REGRAS DE USO POR PILAR EDITORIAL:
- pilar "caso": SE houver casos reais cadastrados, use-os com nome (fictício ou não, conforme cadastrado), contexto e resultado EXATAMENTE como aparecem. Sem caso cadastrado relevante para o ângulo do post, escolha outro pilar — não invente.
- pilar "posicionamento": use "Profissão/situação ANTES" + "A virada" para articular categoria + alternativa rejeitada (ex.: "venho de X, hoje atendo apenas Y" / "não trabalho com Z, trabalho com W").
- pilar "bastidor": combine com o bloco CONTEXTO PESSOAL DO CRIADOR. A história de virada é matéria-prima de bastidor legítima.
- pilar "mito": as críticas em "Críticas/comentários negativos" e as objeções em "Top objeções" podem virar a crença que o post derruba ("todo mundo me dizia X" / "todo cliente acha X — não é").
- pilar "metodo": as objeções do cliente ajudam a estruturar o passo a passo (cada passo do método responde a uma objeção real).

REGRAS TRANSVERSAIS:
- Bordões/expressões pessoais: PODEM aparecer em qualquer pilar como tempero de voz. Limite: no MÁXIMO 1 bordão por semana (não vire muleta).
- TEMAS PROIBIDOS: ZERO tolerância. Nem como gancho, nem como exemplo, nem como metáfora. Se um post precisaria tocar nesses temas, mude o ângulo.
- Nunca traduza fatos do bloco em afirmações genéricas ("muitos clientes me dizem que…") sem que o fato esteja literalmente aqui.`;
}

// ============ Fatos verificáveis (anti-alucinação) ============

/**
 * Renderiza o bloco "FATOS VERIFICÁVEIS" usado como guarda-corpo
 * anti-alucinação. Quando o questionário de negócio expõe os campos
 * `verifiable_facts`, `mini_cases` e/ou `signature_phrases`, o bloco
 * lista os fatos como fonte da verdade. Sem esses campos (estado atual),
 * renderiza a versão "sem fatos" que força o modelo a usar pergunta /
 * hipótese em vez de afirmação fabricada.
 */
export function renderVerifiableFactsBlock(business: any | null | undefined): string {
  const facts = (business?.verifiable_facts || "").toString().trim();
  const cases = (business?.mini_cases || "").toString().trim();
  const phrases = (business?.signature_phrases || "").toString().trim();

  const hasAny = facts.length > 0 || cases.length > 0 || phrases.length > 0;

  if (!hasAny) {
    return `\n\n# FATOS VERIFICÁVEIS
Sem fatos cadastrados. TODOS os exemplos numéricos, casos e métricas devem ser formulados como pergunta ou hipótese ("e se...", "imagine um profissional que...", "é comum ver..."). NUNCA afirme como fato concreto algo que não está no contexto da marca. Frases-marcantes, percentuais, nomes de clientes, prêmios, anos de experiência: nada disso pode aparecer como afirmação.`;
  }

  const parts: string[] = [];
  if (facts.length > 0) parts.push(`Números/provas: ${facts}`);
  if (cases.length > 0) parts.push(`Mini-cases: ${cases}`);
  if (phrases.length > 0) parts.push(`Frases-marcantes: ${phrases}`);

  return `\n\n# FATOS VERIFICÁVEIS (FONTE DA VERDADE)
${parts.join("\n\n")}

REGRA: todo número, caso, métrica ou exemplo concreto citado em qualquer post DEVE vir literalmente desta lista. Se não houver fato pertinente para o ângulo do post, reescreva em formato pergunta/hipótese ("e se...", "imagine que...", "em geral...") em vez de afirmar fato fabricado. Frases-marcantes podem ser parafraseadas, mas não distorcidas.`;
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
