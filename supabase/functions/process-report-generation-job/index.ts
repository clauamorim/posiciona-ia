// Worker em background — processa um job de geração de relatório estratégico.
// Disparado via fire-and-forget pelo `generate-report` (enqueuer).
// Aceita execuções longas (até ~150s) sem bloquear o cliente.
//
// 2026-04-25-v6: criado para resolver 504s e cobranças duplicadas no
// `generate-report` (que era síncrono e estourava o timeout HTTP).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { extractJsonFromLLM, isValidReport } from "../_shared/jsonExtract.ts";
import { callClaude, ClaudeError } from "../_shared/claudeClient.ts";
import { fetchWorkspaceBrandType, fetchPersonalQuestionnaire, renderPersonalContext, renderBrandscriptFramework } from "../_shared/buildClaudeContext.ts";
import { detectProfession, getEthicalRulesBlock, POSITIONING_GUARDRAIL_BLOCK } from "../_shared/professionRules.ts";
import { validateReportCoherence, renderCoherenceRetryInstructions } from "../_shared/reportCoherenceValidator.ts";
import { persistBrandSSoT } from "../_shared/brandSSoT.ts";
import { getArchetypeReference } from "../_shared/archetypeReferences.ts";
import {
  detectTitleFormula,
  detectTitleAnchors,
  detectConceptGroups,
} from "../_shared/editorialDiversity.ts";

const truncateText = (s: any, n: number): string =>
  String(s ?? "").trim().replace(/\s+/g, " ").slice(0, n);

// Substituições obrigatórias aplicadas em campos textuais do relatório
// quando a profissão é regulamentada — defesa em profundidade caso a LLM
// ainda escape um trecho problemático.
const REGULATED_REPLACEMENTS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\bantes\s*\/?\s*e?\s*\/?\s*depois\b/gi, replacement: "trilha de transformação contada pelo método" },
  { pattern: /\bf[oó]rmula\s+que\s+poucos\s+conhecem\b/gi, replacement: "metodologia construída ao longo dos anos" },
  { pattern: /\bf[oó]rmula\s+m[aá]gica\b/gi, replacement: "metodologia construída ao longo dos anos" },
  { pattern: /\bsegredo\b/gi, replacement: "critério" },
  { pattern: /\bagende\s+seu\s+diagn[oó]stico\s+pelo\s+whatsapp\b/gi, replacement: "salve este post" },
  { pattern: /\bagende\s+pelo\s+whatsapp\b/gi, replacement: "guarde esta informação" },
  { pattern: /\bagende\s+sua\s+(consulta|sess[aã]o|avalia[cç][aã]o)\b/gi, replacement: "guarde para conversar com seu profissional" },
];

function applyRegulatedReplacements(value: any): any {
  if (typeof value === "string") {
    let out = value;
    for (const r of REGULATED_REPLACEMENTS) out = out.replace(r.pattern, r.replacement);
    return out;
  }
  if (Array.isArray(value)) return value.map(applyRegulatedReplacements);
  if (value && typeof value === "object") {
    const o: any = {};
    for (const k of Object.keys(value)) o[k] = applyRegulatedReplacements(value[k]);
    return o;
  }
  return value;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function updateJob(jobId: string, patch: Record<string, any>) {
  await admin.from("report_generation_jobs").update(patch).eq("id", jobId);
}

// Executa uma chamada longa (tipicamente callClaude com streaming) e em
// paralelo dispara updateJob periodicamente, para que o watchdog de
// `get-report-generation-job` (4min sem updated_at) não marque o job como
// failed enquanto o Claude ainda está gerando.
async function withHeartbeat<T>(
  jobId: string,
  progressMessage: string,
  fn: () => Promise<T>,
  intervalMs = 30000,
): Promise<T> {
  const heartbeat = setInterval(() => {
    updateJob(jobId, { progress_message: progressMessage }).catch((e) => {
      console.warn(`[report] heartbeat update failed: ${e?.message || e}`);
    });
  }, intervalMs);
  try {
    return await fn();
  } finally {
    clearInterval(heartbeat);
  }
}

function buildSystemPrompt(genderLabel: string, brandType: "pessoal" | "institucional" = "pessoal"): string {
  const inst = brandType === "institucional";
  return `Você é um especialista em branding, arquétipos de marca e metodologia StoryBrand.
Gere um relatório estratégico completo e personalizado para posicionamento de marca no Instagram.

⚠️ CRÍTICO — FORMATO DE SAÍDA: Sua resposta DEVE começar com "{" e terminar com "}". NÃO use \`\`\` em hipótese alguma. NÃO escreva texto, comentário ou explicação antes ou depois do JSON. Não use vírgula final antes de "}" ou "]". Se você adicionar markdown fences ou qualquer texto fora do JSON, o sistema irá REJEITAR a resposta e o usuário receberá erro.

IMPORTANTE: Responda APENAS com um JSON válido, sem markdown, sem backticks, sem texto antes ou depois do JSON.

O JSON deve seguir EXATAMENTE esta estrutura:

{
  "archetypes": {
    "primary": { "name": "...", "description": "...", "application": "...", "characteristics": ["característica 1", "característica 2", "característica 3", "característica 4", "característica 5"], "brands": ["marca 1", "marca 2", "marca 3"], "people": ["pessoa 1", "pessoa 2", "pessoa 3"] },
    "secondary": { "name": "...", "description": "...", "application": "...", "characteristics": ["..."], "brands": ["..."], "people": ["..."] },
    "tertiary": { "name": "...", "description": "...", "application": "...", "characteristics": ["..."], "brands": ["..."], "people": ["..."] }
  },
  "visual_identity": {
    "palette": [
      { "hex": "#...", "name": "...", "usage": "..." },
      { "hex": "#...", "name": "...", "usage": "..." },
      { "hex": "#...", "name": "...", "usage": "..." },
      { "hex": "#...", "name": "...", "usage": "..." },
      { "hex": "#...", "name": "...", "usage": "..." }
    ],
    "typography": { "display": "...", "body": "...", "accent": "..." },
    "style": "..."
  },
  "tone_of_voice": {
    "summary": "...",
    "words_to_use": ["..."],
    "words_to_avoid": ["..."],
    "emotions_to_evoke": ["..."],
    "communication_style": "..."
  },
  "storybrand": {
    "hero": "...",
    "guide": "...",
    "external_problem": "...",
    "internal_problem": "...",
    "philosophical_problem": "...",
    "plan": ["...", "...", "..."],
    "cta": "...",
    "success": "...",
    "failure": "..."
  },
${inst ? `  "identidade_visual": {
    "resumo": "Direção geral de identidade visual e presença da marca",
    "cores_aplicacao": ["cor 1", "cor 2", "cor 3", "cor 4"],
    "elementos_visuais": ["elemento detalhado 1", "elemento detalhado 2", "elemento detalhado 3", "elemento detalhado 4", "elemento detalhado 5"],
    "estilo_fotografia": "Direção de fotografia e imagem da marca (cenários, enquadramento, luz, presença de pessoas)",
    "iconografia_grafismos": ["diretriz 1", "diretriz 2", "diretriz 3"],
    "evitar": ["item a evitar 1", "item a evitar 2"],
    "aplicacoes": [
      { "nome": "Feed", "elementos": ["elemento 1", "elemento 2", "elemento 3"], "ocasiao": "..." },
      { "nome": "Stories", "elementos": ["elemento 1", "elemento 2", "elemento 3"], "ocasiao": "..." },
      { "nome": "Apresentação institucional", "elementos": ["elemento 1", "elemento 2", "elemento 3"], "ocasiao": "..." }
    ],
    "texturas_padroes": ["textura/padrão 1", "textura/padrão 2", "textura/padrão 3"]
  },` : `  "figurino": {
    "resumo": "Resumo geral do figurino estratégico ideal para a marca pessoal",
    "cores_roupa": ["cor 1", "cor 2", "cor 3", "cor 4"],
    "pecas_chave": ["peça detalhada 1", "peça detalhada 2", "peça detalhada 3", "peça detalhada 4", "peça detalhada 5", "peça detalhada 6", "peça detalhada 7"],
    "sapatos": ["sapato 1", "sapato 2", "sapato 3", "sapato 4"],
    "acessorios": ["acessório 1", "acessório 2", "acessório 3", "acessório 4", "acessório 5"],
    "cabelo": "Orientação detalhada de estilo de cabelo",
    "maquiagem_grooming": "Orientação de maquiagem (feminino) ou grooming/barba (masculino) ou versão neutra",
    "evitar": ["item a evitar 1", "item a evitar 2"],
    "looks_completos": [
      { "nome": "Look 1", "pecas": ["peça 1", "peça 2", "peça 3"], "ocasiao": "..." },
      { "nome": "Look 2", "pecas": ["peça 1", "peça 2", "peça 3"], "ocasiao": "..." },
      { "nome": "Look 3", "pecas": ["peça 1", "peça 2", "peça 3"], "ocasiao": "..." }
    ],
    "texturas_tecidos": ["textura/tecido 1", "textura/tecido 2", "textura/tecido 3"],
    "estampas": ["estampa 1", "estampa 2", "estampa 3"]
  },`}
  "simbolos": {
    "primary": [
      { "nome": "...", "simbolo": "...", "significado": "...", "aplicacao": "..." },
      { "nome": "...", "simbolo": "...", "significado": "...", "aplicacao": "..." },
      { "nome": "...", "simbolo": "...", "significado": "...", "aplicacao": "..." }
    ],
    "secondary": [
      { "nome": "...", "simbolo": "...", "significado": "...", "aplicacao": "..." },
      { "nome": "...", "simbolo": "...", "significado": "...", "aplicacao": "..." },
      { "nome": "...", "simbolo": "...", "significado": "...", "aplicacao": "..." }
    ],
    "tertiary": [
      { "nome": "...", "simbolo": "...", "significado": "...", "aplicacao": "..." },
      { "nome": "...", "simbolo": "...", "significado": "...", "aplicacao": "..." },
      { "nome": "...", "simbolo": "...", "significado": "...", "aplicacao": "..." }
    ]
  }
}

${inst ? `⚠️ RELATÓRIO DE MARCA INSTITUCIONAL:
Este relatório é de uma MARCA/EMPRESA, não de uma pessoa. NÃO gere recomendações pessoais (roupas, cabelo, maquiagem, aparência). A seção de apresentação é a IDENTIDADE VISUAL da marca.` : `⚠️ REGRA CRÍTICA SOBRE GÊNERO — OBRIGATÓRIO SEGUIR:
O gênero do cliente é: **${genderLabel}**
TODO o figurino DEVE ser gerado para o gênero "${genderLabel}". NÃO gere figurino para outro gênero.`}

Regras para o campo "archetypes":
- Cada arquétipo deve ter "characteristics": array de 5-7 características-chave do arquétipo
- Cada arquétipo deve ter "brands": array de 3-5 marcas famosas que representam o arquétipo (ex: Nike, Apple, Harley-Davidson)
- Cada arquétipo deve ter "people": array de 3-5 personalidades/pessoas famosas que incorporam o arquétipo (ex: Oprah Winfrey, Steve Jobs)

${inst ? `Regras para o campo "identidade_visual":
- A identidade visual deve ser 100% baseada na COMBINAÇÃO dos 3 arquétipos da marca
- As cores de aplicação devem ser alinhadas à paleta de cores da marca
- "elementos_visuais": pelo menos 5 elementos específicos e detalhados (ex: "grid editorial com margens generosas e respiro", "ícones de linha fina em dourado sobre fundo profundo"), nunca genéricos
- "estilo_fotografia": direção concreta (cenários, luz, enquadramento, presença de pessoas/equipe, paleta nas fotos)
- "iconografia_grafismos": 3 diretrizes de ícones, grafismos e formas coerentes com os arquétipos
- "aplicacoes": exatamente 3 contextos (Feed, Stories, Apresentação institucional), cada um com nome, elementos aplicados e ocasião de uso
- "texturas_padroes": pelo menos 3 texturas/padrões visuais recomendados
- NÃO mencionar roupas, cabelo, maquiagem ou aparência de pessoas` : `Regras para o campo "figurino":
- O figurino deve ser 100% baseado na COMBINAÇÃO dos 3 arquétipos da marca
- GÊNERO: ${genderLabel} — TODAS as recomendações devem ser para este gênero
- Se o gênero for "Feminino": OBRIGATORIAMENTE gerar maquiagem feminina (batom, sombra, blush, delineador, etc.), acessórios femininos (brincos, colares, pulseiras, bolsas, scarpin, etc.), penteados femininos (ondas, coque, babyliss, etc.). NÃO mencionar barba, grooming masculino, gravata ou relógio masculino.
- Se o gênero for "Masculino": OBRIGATORIAMENTE gerar grooming masculino (barba, skincare, cabelo curto, etc.), acessórios masculinos (relógio, gravata, abotoaduras, etc.). NÃO mencionar maquiagem, batom, sombra, brincos femininos ou bolsas femininas.
- Se o gênero for "Não informado" ou "Prefiro não informar": gerar versão neutra/unissex
- As peças-chave devem ser específicas e detalhadas com cor e material (ex: "blazer de linho bege com botões dourados", não apenas "blazer")
- As cores de roupa devem ser alinhadas à paleta de cores da marca
- Incluir pelo menos 7 peças-chave, 4 sapatos e 5 acessórios
- O campo "sapatos" deve ter recomendações específicas (ex: "scarpin nude de salto médio em couro", "tênis branco minimalista de couro")
- O campo "looks_completos" deve ter 3 looks completos, cada um com nome, array de peças que compõem o look, e ocasião de uso
- O campo "texturas_tecidos" deve ter pelo menos 3 tecidos/texturas recomendados para o perfil
- O campo "estampas" deve ter pelo menos 3 estampas recomendadas (ou "lisas/minimalistas" se for o caso)`}

Regras para o campo "simbolos":
- Cada arquétipo (primary, secondary, tertiary) recebe um ARRAY de 3 símbolos
- Cada símbolo com: "nome", "simbolo" (emoji), "significado", "aplicacao"
- Os símbolos devem ser clássicos e representativos do arquétipo (ex: Herói = espada, escudo, troféu; Mago = varinha, cristal, olho; Explorador = bússola, mapa, montanha)
- A "aplicacao" descreve como usar o símbolo na comunicação visual (posts, stories, logo, etc.)

OBSERVAÇÃO: NÃO gere linha editorial neste relatório. As semanas de conteúdo são geradas por outro fluxo (pipeline dedicado com controle de repetição). Este relatório contém apenas a camada estratégica.

Regras para "visual_identity.palette":
- EXATAMENTE 5 cores, cada uma com hex válido, nome descritivo em português e uso recomendado
- A paleta final é normalizada determinísticamente no servidor por arquétipo primário; pode preencher com valores razoáveis, serão sobrescritos.

Regras para "visual_identity.typography":
- Use APENAS fontes do Google Fonts coerentes com o arquétipo primário (display + body); o pareamento final é normalizado no servidor.

IMPORTANTE: Use os nomes dos arquétipos EXATAMENTE como fornecidos nos dados abaixo. NÃO invente nomes diferentes.

Responda APENAS em português brasileiro. Seja específico, prático e personalizado.`;
}

function getArchetypeName(input: any, fallback: string): string {
  return input?.archetype_name || input?.name || fallback;
}

const PALETTES: Record<string, { hex: string; name: string; usage: string }[]> = {
  "Herói": [
    { hex: "#C0392B", name: "Vermelho", usage: "Destaques e chamadas de ação" },
    { hex: "#2C3E50", name: "Azul", usage: "Base institucional" },
    { hex: "#ECF0F1", name: "Branco", usage: "Fundos claros" },
    { hex: "#F1C40F", name: "Dourado", usage: "Ênfase visual" },
    { hex: "#1A1A2E", name: "Preto", usage: "Texto e profundidade" },
  ],
  "Explorador": [
    { hex: "#1ABC9C", name: "Verde", usage: "Destaques e energia de movimento" },
    { hex: "#2C3E50", name: "Azul", usage: "Base de autoridade" },
    { hex: "#F0F3F4", name: "Branco", usage: "Fundos leves" },
    { hex: "#F39C12", name: "Âmbar", usage: "Chamadas de ação" },
    { hex: "#D35400", name: "Terracota", usage: "Apoios visuais e profundidade" },
  ],
  "Governante": [
    { hex: "#D4AC0D", name: "Dourado", usage: "Detalhes premium" },
    { hex: "#1B2631", name: "Azul Marinho", usage: "Base sofisticada" },
    { hex: "#FDFEFE", name: "Branco", usage: "Respiro e fundos" },
    { hex: "#85929E", name: "Prata", usage: "Elementos secundários" },
    { hex: "#6E2C00", name: "Bronze", usage: "Contraste editorial" },
  ],
  "Amante": [
    { hex: "#C0392B", name: "Vermelho", usage: "Pontos de desejo" },
    { hex: "#6C3483", name: "Roxo", usage: "Base sensorial" },
    { hex: "#F4D03F", name: "Dourado", usage: "Calor e sensualidade" },
    { hex: "#F5B7B1", name: "Rosa", usage: "Acentos humanos" },
    { hex: "#1A1A2E", name: "Preto", usage: "Texto e contraste" },
  ],
};

const DEFAULT_PALETTE = [
  { hex: "#6E3FE6", name: "Violeta Estratégico", usage: "Destaques e botões" },
  { hex: "#171024", name: "Noite Editorial", usage: "Base escura" },
  { hex: "#F5F4F1", name: "Linho Claro", usage: "Fundos claros" },
  { hex: "#BFA77A", name: "Dourado Suave", usage: "Detalhes premium" },
  { hex: "#2F6F73", name: "Verde Profundo", usage: "Contraponto sofisticado" },
];

function archetypeDescription(name: string): string {
  const map: Record<string, string> = {
    "Explorador": "Marca movida por liberdade, expansão e descoberta. Atrai pessoas que desejam sair do automático e encontrar caminhos próprios.",
    "Governante": "Marca de liderança, ordem e excelência. Comunica domínio, critérios elevados e capacidade de conduzir decisões importantes.",
    "Amante": "Marca sensorial, cuidadosa e magnética. Cria conexão por beleza, desejo, presença e refinamento nas relações.",
    "Sábio": "Marca analítica e orientadora. Ganha confiança por clareza, método, profundidade e leitura precisa do contexto.",
    "Criador": "Marca autoral e inventiva. Valoriza expressão, originalidade, estética e construção de algo com assinatura própria.",
    "Herói": "Marca determinada e transformadora. Inspira ação, superação e coragem para alcançar um resultado concreto.",
  };
  return map[name] || `Marca com energia de ${name}, capaz de orientar decisões de comunicação, estética e posicionamento com consistência.`;
}

function buildDeterministicReport(payload: any, brandType: "pessoal" | "institucional" = "pessoal"): any {
  const inst = brandType === "institucional";
  const business = payload?.business || {};
  const archetypes = payload?.archetypes || {};
  const primary = getArchetypeName(archetypes.primary, "Explorador");
  const secondary = getArchetypeName(archetypes.secondary, "Governante");
  const tertiary = getArchetypeName(archetypes.tertiary, "Amante");
  const company = business.company_name || "sua marca";
  const audience = business.target_audience || "seu público ideal";
  const services = business.services || "seus serviços";
  const mainCta = business.main_cta || "agendar uma conversa estratégica";
  const palette = PALETTES[primary] || DEFAULT_PALETTE;

  // Truncações para evitar Frankenstein quando o usuário cola texto longo
  const servicesShort = truncateText(services, 120).replace(/[.;,]+$/, "") || "seus serviços";
  const audienceShort = truncateText(audience, 80).replace(/[.;,]+$/, "") || "seu público ideal";
  const companyShort = truncateText(company, 60) || "sua marca";

  const refPrimary = getArchetypeReference(primary);
  const refSecondary = getArchetypeReference(secondary);
  const refTertiary = getArchetypeReference(tertiary);

  const arch = (name: string, role: string, ref: ReturnType<typeof getArchetypeReference>) => ({
    name,
    description: archetypeDescription(name),
    application: `${role}: use este arquétipo para orientar linguagem, estética, temas editoriais e decisões de posicionamento da ${companyShort}.`,
    characteristics: ref.characteristics.slice(0, 5),
    brands: ref.brands.slice(0, 3),
    people: ref.people.slice(0, 3),
  });

  return {
    archetypes: {
      primary: arch(primary, "Arquétipo dominante", refPrimary),
      secondary: arch(secondary, "Complemento estratégico", refSecondary),
      tertiary: arch(tertiary, "Apoio de nuance", refTertiary),
    },
    visual_identity: {
      palette,
      typography: { display: "Cormorant Garamond", body: "Inter", accent: "Raleway" },
      style: `Editorial premium com contraste entre ${primary}, ${secondary} e ${tertiary}: presença sofisticada, composição limpa e sinais visuais de autoridade.`,
    },
    tone_of_voice: {
      summary: `A voz da ${companyShort} deve soar clara, segura e refinada, traduzindo ${servicesShort} em uma promessa compreensível para ${audienceShort}.`,
      words_to_use: ["clareza", "estratégia", "presença", "método", "transformação"],
      words_to_avoid: ["barato", "milagre", "garantido", "fórmula mágica", "sem esforço"],
      emotions_to_evoke: ["confiança", "desejo de avançar", "segurança", "pertencimento"],
      communication_style: "Direto, elegante e consultivo, com exemplos concretos e chamadas para ação sem pressão excessiva.",
    },
    storybrand: {
      hero: audienceShort,
      guide: `${companyShort} atua como guia que organiza o caminho e reduz a insegurança de decisão.`,
      external_problem: truncateText(business.external_problems, 300) || `O público ainda não sabe como escolher ou aplicar ${servicesShort} com segurança.`,
      internal_problem: truncateText(business.internal_problems, 300) || "A pessoa sente dúvida, dispersão ou receio de investir no caminho errado.",
      philosophical_problem: "Bons profissionais e boas marcas não deveriam depender de improviso para serem percebidos com valor.",
      plan: ["Diagnosticar o cenário atual", "Definir uma direção estratégica", "Aplicar a estratégia em decisões práticas de comunicação"],
      cta: truncateText(mainCta, 120) || "agendar uma conversa estratégica",
      success: truncateText(business.promised_transformations, 300) || "Uma marca mais clara, desejada e reconhecida pelo público certo.",
      failure: truncateText(business.negative_consequences, 300) || "Continuar comunicando de forma genérica, com baixa percepção de valor.",
    },
    ...(inst ? {
      identidade_visual: {
        resumo: `Identidade visual editorial com contraste entre ${primary}, ${secondary} e ${tertiary}, transmitindo autoridade e presença consistente para a ${companyShort}.`,
        cores_aplicacao: palette.slice(0, 4).map((c) => c.name),
        elementos_visuais: ["grid editorial com margens generosas e respiro", "ícones de linha fina alinhados à paleta da marca", "tipografia com hierarquia clara entre título e corpo", "blocos de cor sólida para destacar dados e provas", "moldura ou selo discreto de assinatura da marca"],
        estilo_fotografia: "Fotos com luz natural ou setup limpo, enquadramento estável, presença de equipe/ambiente de trabalho quando pertinente, sem poses forçadas.",
        iconografia_grafismos: ["ícones de linha fina, nunca preenchidos", "formas geométricas simples como separador visual", "uso pontual de textura sutil, sem poluir o layout"],
        evitar: ["excesso de informação visual", "elementos genéricos de banco de imagem"],
        aplicacoes: [
          { nome: "Feed", elementos: ["paleta consistente", "tipografia hierárquica", "grid limpo"], ocasiao: "posts educativos e institucionais" },
          { nome: "Stories", elementos: ["blocos de cor", "ícones de linha fina", "texto curto e direto"], ocasiao: "bastidores e enquetes" },
          { nome: "Apresentação institucional", elementos: ["selo da marca", "paleta consistente", "tipografia de autoridade"], ocasiao: "propostas, materiais e reuniões" },
        ],
        texturas_padroes: ["linho/textura sutil em fundos", "linhas finas como separador", "blocos sólidos de cor"],
      },
    } : {
      figurino: {
        resumo: `Figurino estratégico com presença editorial, alinhando ${primary}, ${secondary} e ${tertiary} para transmitir autoridade e aproximação.`,
        cores_roupa: palette.slice(0, 4).map((c) => c.name),
        pecas_chave: ["blazer estruturado em tom profundo", "camisa de tecido nobre", "calça de alfaiataria", "peça de destaque na cor principal", "malha fina neutra", "terceira peça elegante", "acessório assinatura"],
        sapatos: ["sapato clássico de couro", "tênis minimalista premium", "mocassim estruturado", "opção elegante em tom neutro"],
        acessorios: ["relógio discreto", "óculos com armação marcante", "anel minimalista", "bolsa ou pasta estruturada", "peça metálica discreta"],
        cabelo: "Acabamento polido, natural e intencional, evitando aparência improvisada.",
        maquiagem_grooming: "Aparência bem cuidada, pele natural e acabamento coerente com o grau de sofisticação da marca.",
        evitar: ["excesso de informação visual", "peças desalinhadas ao posicionamento premium"],
        looks_completos: [
          { nome: "Autoridade Editorial", pecas: ["blazer estruturado", "base neutra", "sapato clássico"], ocasiao: "reuniões, lives e fotos institucionais" },
          { nome: "Presença Próxima", pecas: ["malha fina", "calça de alfaiataria", "tênis premium"], ocasiao: "conteúdos educativos e bastidores" },
          { nome: "Assinatura de Marca", pecas: ["peça na cor principal", "base escura", "acessório assinatura"], ocasiao: "lançamentos e chamadas comerciais" },
        ],
        texturas_tecidos: ["alfaiataria", "linho encorpado", "seda fosca"],
        estampas: ["lisas", "microtexturas", "contrastes discretos"],
      },
    }),
    simbolos: {
      primary: [
        { nome: primary, simbolo: "✦", significado: "Direção central da marca", aplicacao: "Detalhes gráficos e separadores" },
        { nome: "Bússola", simbolo: "⌖", significado: "Clareza de caminho", aplicacao: "Posts de orientação" },
        { nome: "Marco", simbolo: "◆", significado: "Decisão e posicionamento", aplicacao: "Capas e destaques" },
      ],
      secondary: [
        { nome: secondary, simbolo: "♛", significado: "Autoridade complementar", aplicacao: "Conteúdos de método" },
        { nome: "Coluna", simbolo: "▥", significado: "Estrutura", aplicacao: "Diagramas e templates" },
        { nome: "Selo", simbolo: "◈", significado: "Excelência", aplicacao: "Provas e cases" },
      ],
      tertiary: [
        { nome: tertiary, simbolo: "♡", significado: "Nuance emocional", aplicacao: "Stories e narrativas pessoais" },
        { nome: "Luz", simbolo: "☼", significado: "Atração", aplicacao: "Destaques visuais" },
        { nome: "Laço", simbolo: "∞", significado: "Conexão", aplicacao: "Posts de relacionamento" },
      ],
    },
    // Linha editorial removida do relatório: as semanas vêm exclusivamente do
    // pipeline dedicado (process-content-generation-job), que respeita o ritmo
    // Seg-Qui + stories e o controle anti-repetição.
  };
}

async function processJob(jobId: string) {
  const { data: job, error: jobErr } = await admin
    .from("report_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobErr || !job) {
    console.error("Report job não encontrado:", jobId, jobErr);
    return;
  }

  // Idempotência
  if (["completed", "failed", "processing"].includes(job.status)) {
    console.log(`Report job ${jobId} já está em status ${job.status}, ignorando.`);
    return;
  }

  await updateJob(jobId, {
    status: "processing",
    started_at: new Date().toISOString(),
    progress_message: "Carregando contexto pessoal e do negócio…",
    attempts: (job.attempts || 0) + 1,
  });

  // Garante que o reports.status reflita o processamento
  await admin
    .from("reports")
    .update({ status: "generating", error_message: null })
    .eq("id", job.report_id);

  try {
    const payload = job.payload || {};
    const userId = job.user_id as string;
    // Perfis mais antigos podem não ter workspace_id no job (pré-Etapa 3) —
    // cai para o comportamento antigo (por user_id) nesse caso raro.
    const workspaceId = job.workspace_id as string | undefined;
    const businessRaw = payload?.business || {};
    const niche = payload?.niche || "";
    const archetypes = payload?.archetypes || {};
    const genderLabel = payload?.gender || "Não informado";

    // Defesa: trunca todos os campos textuais do business em 1000 chars
    // para evitar prompts gigantes que estouram o timeout do Claude.
    const BUSINESS_FIELD_CAP = 1000;
    const BUSINESS_TEXT_FIELDS = [
      "company_name", "services", "target_audience", "external_problems",
      "internal_problems", "empathic_statements", "authority_proofs",
      "hiring_steps", "client_fears", "main_cta", "negative_consequences",
      "promised_transformations",
    ];
    const business: Record<string, any> = { ...businessRaw };
    for (const k of BUSINESS_TEXT_FIELDS) {
      const v = business[k];
      if (typeof v === "string" && v.length > BUSINESS_FIELD_CAP) {
        console.warn(JSON.stringify({
          event: "business_field_truncated",
          field: k,
          original_length: v.length,
          capped_to: BUSINESS_FIELD_CAP,
          job_id: jobId,
        }));
        business[k] = v.slice(0, BUSINESS_FIELD_CAP);
      }
    }

    await updateJob(jobId, { progress_message: "Gerando estratégia com IA… pode levar até 2 minutos." });

    // Contexto pessoal do criador (humanização)
    const brandType = await fetchWorkspaceBrandType(userId, workspaceId);
    const personal = await fetchPersonalQuestionnaire(userId, workspaceId);
    const personalContext = renderPersonalContext(personal, brandType);

    const primaryName = getArchetypeName(archetypes.primary, "Explorador");
    const secondaryName = getArchetypeName(archetypes.secondary, "Governante");
    const tertiaryName = getArchetypeName(archetypes.tertiary, "Amante");

    const userPrompt = `# DADOS DO NEGÓCIO
Empresa: ${business.company_name || "—"}
Serviços: ${business.services || "—"}
Público-alvo: ${business.target_audience || "—"}
Nicho: ${niche || "—"}
Problemas externos: ${business.external_problems || "—"}
Problemas internos: ${business.internal_problems || "—"}
Declarações empáticas: ${business.empathic_statements || "—"}
Provas de autoridade: ${business.authority_proofs || "—"}
Passos para contratação: ${business.hiring_steps || "—"}
Medos do cliente: ${business.client_fears || "—"}
CTA principal: ${business.main_cta || "—"}
Consequências negativas: ${business.negative_consequences || "—"}
Transformações prometidas: ${business.promised_transformations || "—"}

# ARQUÉTIPOS (já calculados pelo questionário)
Primário: ${primaryName}
Secundário: ${secondaryName}
Terciário: ${tertiaryName}

# GÊNERO DO CLIENTE (OBRIGATÓRIO seguir no figurino)
${genderLabel}
${personalContext}

Gere o relatório estratégico completo em JSON conforme a estrutura exigida.`;

    const earlyProfession = detectProfession({
      profession: business?.profession || null,
      niche: niche || null,
      business_description: [business?.services, business?.target_audience].filter(Boolean).join(" "),
    });
    const systemPrompt = buildSystemPrompt(genderLabel, brandType)
      + renderBrandscriptFramework()
      + getEthicalRulesBlock(earlyProfession)
      + POSITIONING_GUARDRAIL_BLOCK;

    let reportContent: any = null;
    let isFallback = false;

    let lastError: any = null;
    // 2 tentativas com streaming + heartbeats. callClaude usa idle timeout
    // (não total) + ceiling interno de 4 min, abaixo do watchdog de 5 min.
    // Heartbeats a cada 30s mantêm updated_at fresco no banco.
    const MAX_ATTEMPTS = 2;
    const BACKOFF_MS = [0, 5000];
    // Idle timeout: 120s sem receber chunks → aborta a chamada.
    const PER_ATTEMPT_TIMEOUT_MS = 120000;
    const ATTEMPT_PROGRESS = (n: number) =>
      n === 0
        ? "Gerando estratégia com IA… pode levar alguns minutos."
        : `Refinando estratégia (tentativa ${n + 1}/${MAX_ATTEMPTS})…`;

    const promptChars = (systemPrompt?.length ?? 0) + (userPrompt?.length ?? 0);

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (BACKOFF_MS[attempt] > 0) {
        await updateJob(jobId, {
          progress_message: `Refinando estratégia (tentativa ${attempt + 1}/${MAX_ATTEMPTS})…`,
        });
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
      }

      await updateJob(jobId, { progress_message: ATTEMPT_PROGRESS(attempt) });

      const t0 = Date.now();
      try {
        const rawContent = await withHeartbeat(jobId, ATTEMPT_PROGRESS(attempt), () =>
          callClaude({
            systemPrompt,
            userText: userPrompt,
            max_tokens: 7500,
            timeoutMs: PER_ATTEMPT_TIMEOUT_MS,
            disableRetries: true,
          })
        );
        const durationMs = Date.now() - t0;

        const parsed = extractJsonFromLLM(rawContent);
        if (parsed && isValidReport(parsed)) {
          console.log(JSON.stringify({
            event: "report_attempt", job_id: jobId, attempt: attempt + 1,
            status: "ok", duration_ms: durationMs, prompt_chars: promptChars,
          }));
          reportContent = parsed;
          break;
        }

        lastError = new Error("Invalid JSON from Claude");
        console.warn(JSON.stringify({
          event: "report_attempt", job_id: jobId, attempt: attempt + 1,
          status: "invalid_json", duration_ms: durationMs, prompt_chars: promptChars,
        }));
      } catch (claudeErr: any) {
        const durationMs = Date.now() - t0;
        lastError = claudeErr;
        console.warn(JSON.stringify({
          event: "report_attempt", job_id: jobId, attempt: attempt + 1,
          status: "error", duration_ms: durationMs, prompt_chars: promptChars,
          error_status: claudeErr?.status ?? null,
          error_message: claudeErr?.message ?? null,
        }));
      }
    }

    if (!reportContent) {
      console.error(`[report] job ${jobId} esgotou ${MAX_ATTEMPTS} tentativas, usando fallback determinístico. Último erro:`, lastError?.message);
      reportContent = buildDeterministicReport(payload, brandType);
      isFallback = true;
    }

    if (isFallback) {
      reportContent.is_fallback = true;
    }

    // ---- COMPLIANCE: profissão regulamentada -----------------------------
    // Detecta profissão a partir do business + niche e aplica substituições
    // textuais defensivas (mesmo se a LLM escapou). NUNCA bloqueia entrega.
    const profileForDetection = {
      profession: business?.profession || null,
      niche: niche || null,
      business_description: [business?.services, business?.target_audience]
        .filter(Boolean)
        .join(" "),
    };
    const professionCategory = detectProfession(profileForDetection);
    if (professionCategory !== "outro") {
      reportContent = applyRegulatedReplacements(reportContent);
      console.log(`[generate-report] applied regulated replacements (category=${professionCategory})`);
    }

    // ---- COERÊNCIA INTERNA: tom de voz vs resto --------------------------
    const coherenceViolations = validateReportCoherence(reportContent);
    if (coherenceViolations.length > 0 && !isFallback) {
      console.warn(`[generate-report] coherence violations=${coherenceViolations.length}`, coherenceViolations.slice(0, 5));
      try {
        await updateJob(jobId, { progress_message: "Refinando coerência da estratégia…" });
        const retryInstructions = renderCoherenceRetryInstructions(coherenceViolations);
        const rawRetry = await withHeartbeat(jobId, "Refinando coerência da estratégia…", () =>
          callClaude({
            systemPrompt: buildSystemPrompt(genderLabel, brandType) + renderBrandscriptFramework() + getEthicalRulesBlock(professionCategory) + POSITIONING_GUARDRAIL_BLOCK,
            userText: userPrompt + "\n\n" + retryInstructions,
            max_tokens: 7500,
            timeoutMs: 120000,
            disableRetries: true,
          })
        );
        const reparsed = extractJsonFromLLM(rawRetry);
        if (reparsed && isValidReport(reparsed)) {
          reportContent = professionCategory !== "outro"
            ? applyRegulatedReplacements(reparsed)
            : reparsed;
          const remaining = validateReportCoherence(reportContent);
          if (remaining.length) {
            console.warn(`[generate-report] coherence violations persisted after retry=${remaining.length} (delivering anyway)`);
          }
        } else {
          console.warn(`[generate-report] coherence retry produced invalid JSON, keeping previous content`);
        }
      } catch (retryErr: any) {
        console.warn(`[generate-report] coherence retry failed: ${retryErr?.message || retryErr}`);
      }
    }

    // Migra editorial_weeks da versão anterior (se houver) para não perder
    // o histórico da Linha Editorial após reanálise/regeneração de relatório.
    let editorialWeeksToMigrate: any[] = [];
    try {
      let prevQuery = admin.from("reports").select("version, editorial_weeks");
      prevQuery = workspaceId ? prevQuery.eq("workspace_id", workspaceId) : prevQuery.eq("user_id", userId);
      const { data: prev } = await prevQuery
        .neq("id", job.report_id)
        .not("editorial_weeks", "is", null)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prev && Array.isArray(prev.editorial_weeks) && prev.editorial_weeks.length > 0) {
        const prevVersion = prev.version;
        editorialWeeksToMigrate = (prev.editorial_weeks as any[]).map((w) => {
          const meta = (w && typeof w === "object" && w._meta) ? w._meta : {};
          return {
            ...w,
            _meta: { ...meta, generated_with_report_version: meta.generated_with_report_version ?? prevVersion },
          };
        });
        console.log(`[generate-report] migrando ${editorialWeeksToMigrate.length} semanas editoriais da versão ${prevVersion}`);
      }
    } catch (migErr: any) {
      console.warn(`[generate-report] falha ao migrar editorial_weeks: ${migErr?.message || migErr}`);
    }

    // Persistir no relatório
    await admin
      .from("reports")
      .update({
        content: reportContent,
        status: "completed",
        error_message: null,
        editorial_weeks: editorialWeeksToMigrate,
      })
      .eq("id", job.report_id);

    // Migra também os fingerprints de diversidade editorial das semanas
    // copiadas, para que o gerador de novas semanas reconheça os títulos /
    // temas já usados (Bug: semanas migradas sendo regeradas idênticas).
    if (editorialWeeksToMigrate.length > 0) {
      try {
        const patternRows: any[] = [];
        editorialWeeksToMigrate.forEach((week: any, weekIdx: number) => {
          const posts = Array.isArray(week?.posts) ? week.posts : [];
          posts.forEach((post: any, dayIdx: number) => {
            const headline =
              (post?.caption && typeof post.caption === "object" && post.caption.headline) ||
              (typeof post?.caption === "string" ? post.caption : "") ||
              "";
            const titleSrc = String(post?.theme || headline || "");
            patternRows.push({
              user_id: userId,
              report_id: job.report_id,
              week_index: weekIdx,
              day_index: typeof post?.day === "number" ? post.day : dayIdx,
              pillar: post?.pillar || "livre",
              title_formula: detectTitleFormula(titleSrc),
              title_anchors: detectTitleAnchors(titleSrc),
              central_concepts: detectConceptGroups({ theme: post?.theme, headline }),
            });
          });
        });
        if (patternRows.length > 0) {
          const { error: patternErr } = await admin
            .from("used_title_patterns")
            .insert(patternRows);
          if (patternErr) {
            console.warn(`[generate-report] used_title_patterns migration insert falhou: ${patternErr.message}`);
          } else {
            console.log(`[generate-report] migrados ${patternRows.length} fingerprints de used_title_patterns`);
          }
        }
      } catch (patErr: any) {
        console.warn(`[generate-report] migração de used_title_patterns falhou: ${patErr?.message || patErr}`);
      }
    }

    // ---- SSoT: persiste paleta + símbolos para uso por outros geradores ---
    try {
      const { data: reportRow } = await admin
        .from("reports")
        .select("version")
        .eq("id", job.report_id)
        .maybeSingle();
      await persistBrandSSoT(admin, {
        userId,
        workspaceId,
        reportId: job.report_id,
        reportVersion: reportRow?.version ?? 1,
        reportContent,
      });
    } catch (ssotErr: any) {
      console.error(`[generate-report] persistBrandSSoT failed: ${ssotErr?.message || ssotErr}`);
    }

    // Trava só o Diagnóstico DESTE perfil — travar por user_id bloquearia o
    // Diagnóstico de outros perfis da mesma conta quando este relatório termina.
    {
      let lockQuery = admin.from("business_questionnaires").update({ status: "locked" });
      lockQuery = workspaceId ? lockQuery.eq("workspace_id", workspaceId) : lockQuery.eq("user_id", userId);
      await lockQuery;
    }

    await updateJob(jobId, {
      status: "completed",
      result: { report: reportContent, is_fallback: isFallback },
      progress_message: isFallback ? "Concluído (modelo simplificado)." : "Concluído!",
      finished_at: new Date().toISOString(),
      error_message: null,
    });

    console.log(`Report job ${jobId} concluído com sucesso (fallback=${isFallback}).`);

    // ---- Telemetria + crédito grátis quando entregamos fallback -----------
    if (isFallback) {
      console.log(JSON.stringify({
        event: "report_fallback_delivered",
        user_id: userId,
        job_id: jobId,
        report_id: job.report_id,
        reason: lastError?.message || "unknown",
        attempts: MAX_ATTEMPTS,
        timestamp: new Date().toISOString(),
      }));

      // Concede 1 crédito de regeneração para o usuário poder refazer sem pagar.
      try {
        const { data: bal } = await admin
          .from("user_balances")
          .select("regeneration_credits")
          .eq("user_id", userId)
          .maybeSingle();
        const current = bal?.regeneration_credits ?? 0;
        await admin
          .from("user_balances")
          .update({ regeneration_credits: current + 1, updated_at: new Date().toISOString() })
          .eq("user_id", userId);
        await admin.from("credit_logs").insert({
          user_id: userId,
          credit_type: "regeneration",
          amount: 1,
          description: `Crédito gratuito de regeneração (fallback no relatório, job=${jobId})`,
        });
        console.warn(`[report] FALLBACK delivered to user=${userId}, free regen granted`);
      } catch (refundErr: any) {
        console.error(`[report] falha ao conceder crédito grátis pós-fallback: ${refundErr?.message || refundErr}`);
      }
    }
  } catch (err: any) {
    console.error(`Report job ${jobId} falhou:`, err);
    const userMessage = typeof err?.userMessage === "string" && err.userMessage.trim()
      ? err.userMessage
      : "Não foi possível gerar a estratégia agora. Tente novamente em alguns segundos.";

    await admin
      .from("reports")
      .update({ status: "error", error_message: userMessage })
      .eq("id", job.report_id);

    await updateJob(jobId, {
      status: "failed",
      error_message: userMessage,
      progress_message: null,
      finished_at: new Date().toISOString(),
    });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const jobId = body?.jobId;

    if (!jobId || typeof jobId !== "string") {
      return new Response(JSON.stringify({ error: "jobId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      // @ts-ignore
      EdgeRuntime.waitUntil(processJob(jobId));
    } else {
      await processJob(jobId);
    }

    return new Response(JSON.stringify({ accepted: true, jobId }), {
      status: 202,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("process-report-generation-job error:", e);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
