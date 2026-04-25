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
import { fetchPersonalQuestionnaire, renderPersonalContext, renderBrandscriptFramework } from "../_shared/buildClaudeContext.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function updateJob(jobId: string, patch: Record<string, any>) {
  await admin.from("report_generation_jobs").update(patch).eq("id", jobId);
}

function buildSystemPrompt(genderLabel: string): string {
  return `Você é um especialista em branding, arquétipos de marca e metodologia StoryBrand.
Gere um relatório estratégico completo e personalizado para posicionamento de marca no Instagram.

⚠️ CRÍTICO — FORMATO DE SAÍDA: Sua resposta DEVE começar com "{" e terminar com "}". NÃO use \`\`\` em hipótese alguma. NÃO escreva texto, comentário ou explicação antes ou depois do JSON. Não use vírgula final antes de "}" ou "]". Se você adicionar markdown fences ou qualquer texto fora do JSON, o sistema irá REJEITAR a resposta e o usuário receberá erro.

IMPORTANTE: Responda APENAS com um JSON válido, sem markdown, sem backticks, sem texto antes ou depois do JSON.

REGRA DE LINGUAGEM (CRÍTICA) — VÁLIDA APENAS PARA O ARRAY "editorial":
O StoryBrand é uma camada ESTRATÉGICA INTERNA. Dentro de "editorial", NUNCA escreva os rótulos do framework dentro de "theme", "caption", "card_copy", "cta" ou "script". Esses campos visíveis devem soar como copy de marketing real, não como template.

PROIBIDO escrever literalmente nos campos visíveis do "editorial":
"Problema Externo", "Problema Interno", "Problema Filosófico", "O Plano", "Chamada à Ação", "Chamada para Ação", "O Sucesso", "O Fracasso", "O Guia", "O Herói", "Sucesso vs Fracasso", "StoryBrand", "Framework", "Etapa do Framework".

Não use prefixos como "Problema Externo: ...", "Plano: ...", "CTA: ...". Apenas escreva o conteúdo direto, em linguagem natural.

NUNCA prefixe os itens de "card_copy" com "Slide 1:", "Slide 2:", "Card 1:", "Página 1:", etc. Cada item do array JÁ É um slide; escreva apenas o conteúdo do slide, sem rótulo posicional.
ERRADO: ["Slide 1: Você também sente que o tempo voa?", "Slide 2: A solução está aqui"]
CERTO:  ["Você também sente que o tempo voa?", "A solução está aqui"]

Exemplos:
- ERRADO em theme: "Problema Externo: Desvendando o Emaranhado do Conflito"
- CERTO  em theme: "Desvendando o Emaranhado do Conflito"
- ERRADO em cta:   "Chamada à Ação: Agende sua sessão hoje"
- CERTO  em cta:   "Agende sua sessão hoje"

OBSERVAÇÃO: Os rótulos "Problema Externo", "O Herói", etc. PODEM e DEVEM ser usados normalmente dentro do objeto "storybrand" (que é a definição estratégica em si). A regra acima vale APENAS para o array "editorial".

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
  "figurino": {
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
  },
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
  },
  "editorial": [
    {
      "day": 1,
      "theme": "...",
      "format": "reels|carrossel|stories|post",
      "caption": "...",
      "card_copy": ["texto do slide/card 1", "texto do slide/card 2"],
      "cta": "...",
      "script": "..."
    }
  ]
}

⚠️ REGRA CRÍTICA SOBRE GÊNERO — OBRIGATÓRIO SEGUIR:
O gênero do cliente é: **${genderLabel}**
TODO o figurino DEVE ser gerado para o gênero "${genderLabel}". NÃO gere figurino para outro gênero.

Regras para o campo "archetypes":
- Cada arquétipo deve ter "characteristics": array de 5-7 características-chave do arquétipo
- Cada arquétipo deve ter "brands": array de 3-5 marcas famosas que representam o arquétipo (ex: Nike, Apple, Harley-Davidson)
- Cada arquétipo deve ter "people": array de 3-5 personalidades/pessoas famosas que incorporam o arquétipo (ex: Oprah Winfrey, Steve Jobs)

Regras para o campo "figurino":
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
- O campo "estampas" deve ter pelo menos 3 estampas recomendadas (ou "lisas/minimalistas" se for o caso)

Regras para o campo "simbolos":
- Cada arquétipo (primary, secondary, tertiary) recebe um ARRAY de 3 símbolos
- Cada símbolo com: "nome", "simbolo" (emoji), "significado", "aplicacao"
- Os símbolos devem ser clássicos e representativos do arquétipo (ex: Herói = espada, escudo, troféu; Mago = varinha, cristal, olho; Explorador = bússola, mapa, montanha)
- A "aplicacao" descreve como usar o símbolo na comunicação visual (posts, stories, logo, etc.)

Regras para o campo "editorial":
- OBRIGATORIAMENTE 7 dias (day 1 a 7)
- A linha editorial deve ser guiada EXCLUSIVAMENTE pelo StoryBrand gerado acima, aprofundando cada faceta do framework ao longo da semana
- Dia 1: Foque no HERÓI (cliente); Dia 2: PROBLEMA EXTERNO; Dia 3: PROBLEMA INTERNO; Dia 4: Marca como GUIA; Dia 5: O PLANO; Dia 6: CTA claro; Dia 7: SUCESSO vs FRACASSO
- Cada dia deve ter um tema diferente e relevante
- O campo "caption" deve conter a LEGENDA COMPLETA pronta para copiar e colar no Instagram
- O campo "card_copy": para formato "carrossel", deve ser um ARRAY com o texto completo de CADA SLIDE (mínimo 5 slides); para formato "post", deve ser um array com 1 item contendo o texto visual do card; para "reels" e "stories", pode ser array vazio []
- O campo "script": APENAS para "reels" e "stories" deve conter ROTEIRO COMPLETO (gancho de abertura, desenvolvimento, CTA final). Para "post" e "carrossel", o campo script DEVE ser string vazia ""
- O campo "cta" deve ser específico e acionável
- Varie os formatos ao longo da semana

Regras para "visual_identity.palette":
- EXATAMENTE 5 cores
- Cada cor deve ter hex válido, nome descritivo em português e uso recomendado (ex: "Cor de fundo principal", "Cor de destaque para CTAs", "Cor de texto secundário")
- A paleta DEVE ser determinística e baseada no arquétipo PRIMÁRIO, seguindo este mapeamento FIXO:
  - Herói → #C0392B (Vermelho Poder), #2C3E50 (Azul Aço), #ECF0F1 (Branco Nobre), #E74C3C (Vermelho Impacto), #1A1A2E (Escuro Épico)
  - Mago → #6C3483 (Roxo Místico), #1B2631 (Azul Profundo), #F4ECF7 (Lilás Suave), #A569BD (Ametista), #2E4053 (Noite Cósmica)
  - Rebelde → #1C1C1C (Preto Rebelde), #E74C3C (Vermelho Fogo), #F5F5F5 (Branco Contraste), #95A5A6 (Cinza Urbano), #2C3E50 (Azul Escuro)
  - Explorador → #1ABC9C (Verde Aventura), #2C3E50 (Azul Oceano), #F0F3F4 (Branco Areia), #F39C12 (Âmbar), #16A085 (Verde Floresta)
  - Sábio → #2C3E50 (Azul Sabedoria), #1A5276 (Azul Profundo), #FDFEFE (Branco Puro), #85929E (Cinza Acadêmico), #154360 (Azul Noturno)
  - Inocente → #F9E79F (Amarelo Suave), #AED6F1 (Azul Céu), #FDFEFE (Branco Puro), #ABEBC6 (Verde Esperança), #FAD7A0 (Pêssego)
  - Criador → #8E44AD (Roxo Criativo), #F39C12 (Laranja Inspiração), #FDFEFE (Branco Tela), #2ECC71 (Verde Inovação), #2C3E50 (Azul Profundo)
  - Governante → #D4AC0D (Dourado Real), #1B2631 (Azul Marinho), #FDFEFE (Branco Majestade), #85929E (Prata), #6E2C00 (Bronze Imperial)
  - Cuidador → #27AE60 (Verde Cuidado), #2980B9 (Azul Confiança), #F8F9F9 (Branco Suave), #82E0AA (Verde Menta), #AED6F1 (Azul Celeste)
  - Cara-comum → #5D6D7E (Cinza Equilibrado), #2E86C1 (Azul Confiável), #F2F3F4 (Branco Natural), #A9CCE3 (Azul Claro), #85929E (Cinza Neutro)
  - Bobo-da-corte → #F39C12 (Laranja Alegria), #E74C3C (Vermelho Energia), #FDFEFE (Branco), #3498DB (Azul Divertido), #2ECC71 (Verde Brilhante)
  - Amante → #C0392B (Vermelho Paixão), #6C3483 (Roxo Sedução), #FDEDEC (Rosa Suave), #F5B7B1 (Rosa Quente), #1A1A2E (Escuro Elegante)
- Você PODE ajustar levemente os tons para harmonizar com o nicho e os arquétipos secundário/terciário, mas a base DEVE seguir o mapeamento acima

Regras para "visual_identity.typography":
- Use APENAS fontes do Google Fonts
- A tipografia DEVE ser alinhada ao arquétipo primário da marca, seguindo este mapeamento:
  - Herói/Guerreiro → Display: Oswald ou Bebas Neue | Body: Montserrat ou Source Sans Pro
  - Mago → Display: Cinzel ou Cormorant Garamond | Body: Lora ou EB Garamond
  - Fora-da-Lei/Rebelde → Display: Permanent Marker ou Rubik Mono One | Body: Barlow ou Work Sans
  - Explorador → Display: Fjalla One ou Pathway Gothic One | Body: Open Sans ou Nunito
  - Sábio → Display: Merriweather ou Libre Baskerville | Body: Source Serif Pro ou Noto Serif
  - Inocente → Display: Quicksand ou Comfortaa | Body: Poppins ou Nunito Sans
  - Criador → Display: Playfair Display ou DM Serif Display | Body: Inter ou Karla
  - Governante → Display: Cormorant Garamond ou Libre Baskerville | Body: Raleway ou Lato
  - Cuidador → Display: Lora ou Merriweather | Body: Open Sans ou Nunito
  - Cara Comum → Display: Roboto Slab ou Bitter | Body: Roboto ou Open Sans
  - Bobo da Corte → Display: Fredoka One ou Baloo 2 | Body: Nunito ou Quicksand
  - Amante → Display: Playfair Display ou Cormorant | Body: Lora ou EB Garamond
- Escolha as fontes mais adequadas dentre as opções do arquétipo primário

IMPORTANTE: Use os nomes dos arquétipos EXATAMENTE como fornecidos nos dados abaixo. NÃO invente nomes diferentes.

Responda APENAS em português brasileiro. Seja específico, prático e personalizado.`;
}

function getArchetypeName(input: any, fallback: string): string {
  return input?.archetype_name || input?.name || fallback;
}

const PALETTES: Record<string, { hex: string; name: string; usage: string }[]> = {
  "Herói": [
    { hex: "#C0392B", name: "Vermelho Poder", usage: "Destaques e chamadas de ação" },
    { hex: "#2C3E50", name: "Azul Aço", usage: "Base institucional" },
    { hex: "#ECF0F1", name: "Branco Nobre", usage: "Fundos claros" },
    { hex: "#E74C3C", name: "Vermelho Impacto", usage: "Ênfase visual" },
    { hex: "#1A1A2E", name: "Escuro Épico", usage: "Texto e profundidade" },
  ],
  "Explorador": [
    { hex: "#1ABC9C", name: "Verde Aventura", usage: "Destaques e energia de movimento" },
    { hex: "#2C3E50", name: "Azul Oceano", usage: "Base de autoridade" },
    { hex: "#F0F3F4", name: "Branco Areia", usage: "Fundos leves" },
    { hex: "#F39C12", name: "Âmbar", usage: "Chamadas de ação" },
    { hex: "#16A085", name: "Verde Floresta", usage: "Apoios visuais" },
  ],
  "Governante": [
    { hex: "#D4AC0D", name: "Dourado Real", usage: "Detalhes premium" },
    { hex: "#1B2631", name: "Azul Marinho", usage: "Base sofisticada" },
    { hex: "#FDFEFE", name: "Branco Majestade", usage: "Respiro e fundos" },
    { hex: "#85929E", name: "Prata", usage: "Elementos secundários" },
    { hex: "#6E2C00", name: "Bronze Imperial", usage: "Contraste editorial" },
  ],
  "Amante": [
    { hex: "#C0392B", name: "Vermelho Paixão", usage: "Pontos de desejo" },
    { hex: "#6C3483", name: "Roxo Sedução", usage: "Base sensorial" },
    { hex: "#FDEDEC", name: "Rosa Suave", usage: "Fundos delicados" },
    { hex: "#F5B7B1", name: "Rosa Quente", usage: "Acentos humanos" },
    { hex: "#1A1A2E", name: "Escuro Elegante", usage: "Texto e contraste" },
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

function buildDeterministicReport(payload: any): any {
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

  const arch = (name: string, role: string) => ({
    name,
    description: archetypeDescription(name),
    application: `${role}: use este arquétipo para orientar linguagem, estética, temas editoriais e decisões de posicionamento da ${company}.`,
    characteristics: ["clareza", "presença", "consistência", "autoridade", "diferenciação"],
    brands: ["Apple", "Nike", "Chanel"],
    people: ["Oprah Winfrey", "Steve Jobs", "Michelle Obama"],
  });

  return {
    archetypes: {
      primary: arch(primary, "Arquétipo dominante"),
      secondary: arch(secondary, "Complemento estratégico"),
      tertiary: arch(tertiary, "Apoio de nuance"),
    },
    visual_identity: {
      palette,
      typography: { display: "Cormorant Garamond", body: "Inter", accent: "Raleway" },
      style: `Editorial premium com contraste entre ${primary}, ${secondary} e ${tertiary}: presença sofisticada, composição limpa e sinais visuais de autoridade.`,
    },
    tone_of_voice: {
      summary: `A voz da ${company} deve soar clara, segura e refinada, traduzindo ${services} em uma promessa compreensível para ${audience}.`,
      words_to_use: ["clareza", "estratégia", "presença", "método", "transformação"],
      words_to_avoid: ["barato", "milagre", "garantido", "fórmula mágica", "sem esforço"],
      emotions_to_evoke: ["confiança", "desejo de avançar", "segurança", "pertencimento"],
      communication_style: "Direto, elegante e consultivo, com exemplos concretos e chamadas para ação sem pressão excessiva.",
    },
    storybrand: {
      hero: audience,
      guide: `${company} atua como guia que organiza o caminho e reduz a insegurança de decisão.`,
      external_problem: business.external_problems || `O público ainda não sabe como escolher ou aplicar ${services} com segurança.`,
      internal_problem: business.internal_problems || "A pessoa sente dúvida, dispersão ou receio de investir no caminho errado.",
      philosophical_problem: "Bons profissionais e boas marcas não deveriam depender de improviso para serem percebidos com valor.",
      plan: ["Diagnosticar o cenário atual", "Definir uma direção estratégica", "Aplicar a estratégia em decisões práticas de comunicação"],
      cta: mainCta,
      success: business.promised_transformations || "Uma marca mais clara, desejada e reconhecida pelo público certo.",
      failure: business.negative_consequences || "Continuar comunicando de forma genérica, com baixa percepção de valor.",
    },
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
    editorial: [1, 2, 3, 4, 5, 6, 7].map((day) => ({
      day,
      theme: ["O desejo do cliente", "O obstáculo visível", "A tensão interna", "A marca como guia", "O caminho em etapas", "Convite para avançar", "O custo de adiar"][day - 1],
      format: ["post", "carrossel", "reels", "post", "carrossel", "stories", "post"][day - 1],
      caption: `Conteúdo para ${company}: conecte ${audience} ao problema central e apresente ${services} como caminho claro, específico e desejável.`,
      card_copy: day === 2 || day === 5 ? ["Você não precisa decidir no escuro.", "Existe um caminho mais claro.", "O primeiro passo é nomear o problema.", "Depois, organizar prioridades.", "Por fim, agir com direção."] : [`${company}: uma direção mais clara para ${audience}.`],
      cta: mainCta,
      script: day === 3 || day === 6 ? `Abra nomeando a dúvida principal de ${audience}, mostre o custo de permanecer no improviso e convide para ${mainCta}.` : "",
    })),
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

    await updateJob(jobId, { progress_message: "Gerando estratégia sem chamada paga à IA…" });

    // Modo de segurança: evita novas cobranças no Claude enquanto a API externa está
    // demorando além do limite. Gera um relatório estruturado determinístico com os
    // dados já preenchidos pelo usuário.
    const reportContent = buildDeterministicReport(payload);

    // Persistir no relatório
    await admin
      .from("reports")
      .update({ content: reportContent, status: "completed", error_message: null })
      .eq("id", job.report_id);

    await admin
      .from("business_questionnaires")
      .update({ status: "locked" })
      .eq("user_id", userId);

    await updateJob(jobId, {
      status: "completed",
      result: { report: reportContent },
      progress_message: "Concluído!",
      finished_at: new Date().toISOString(),
      error_message: null,
    });

    console.log(`Report job ${jobId} concluído com sucesso.`);
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
