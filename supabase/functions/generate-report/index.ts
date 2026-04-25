// 2026-04-25-v5: migrado de Gemini para Claude Sonnet 4.5.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { extractJsonFromLLM, isValidReport } from "../_shared/jsonExtract.ts";
import { callClaude, ClaudeError } from "../_shared/claudeClient.ts";
import { fetchEditorialReferencePdfs, fetchPersonalQuestionnaire, renderPersonalContext } from "../_shared/buildClaudeContext.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { business, niche, archetypes, gender } = await req.json();

    if (!business || !archetypes) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const genderLabel = gender || "Não informado";

    const systemPrompt = `Você é um especialista em branding, arquétipos de marca e metodologia StoryBrand.
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

    const userPrompt = `
Dados do negócio:
- Nome: ${business.company_name || "Não informado"}
- Serviços: ${business.services || "Não informado"}
- Público-alvo: ${business.target_audience || "Não informado"}
- Problemas externos: ${business.external_problems || "Não informado"}
- Problemas internos: ${business.internal_problems || "Não informado"}
- Declarações empáticas: ${business.empathic_statements || "Não informado"}
- Provas de autoridade: ${business.authority_proofs || "Não informado"}
- Etapas para contratar: ${business.hiring_steps || "Não informado"}
- Medos do cliente: ${business.client_fears || "Não informado"}
- CTA principal: ${business.main_cta || "Não informado"}
- Consequências negativas: ${business.negative_consequences || "Não informado"}
- Transformações prometidas: ${business.promised_transformations || "Não informado"}

Nicho/área de atuação: ${niche || "Não informado"}

⚠️ GÊNERO DO CLIENTE (OBRIGATÓRIO para figurino): ${genderLabel}
Gere TODAS as recomendações de figurino, maquiagem/grooming, acessórios e cabelo para o gênero ${genderLabel}.

Arquétipos principais (calculados pela aplicação — use EXATAMENTE estes nomes):
- Primário: ${archetypes.primary?.archetype_name || archetypes.primary?.name} (pontuação: ${archetypes.primary?.score}/30)
- Secundário: ${archetypes.secondary?.archetype_name || archetypes.secondary?.name} (pontuação: ${archetypes.secondary?.score}/30)
- Terciário: ${archetypes.tertiary?.archetype_name || archetypes.tertiary?.name} (pontuação: ${archetypes.tertiary?.score}/30)

Gere o relatório completo em JSON agora.`;

    // Fetch reference PDFs to include as context
    const pdfParts = await fetchReferencePdfs();

    // Build user message content — multipart if PDFs exist
    const userContent: any = pdfParts.length > 0
      ? [
          ...pdfParts.map(p => ({ type: "file", file: { filename: "reference.pdf", file_data: `data:application/pdf;base64,${p.data}` } })),
          { type: "text", text: userPrompt },
        ]
      : userPrompt;

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 10000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.choices?.[0]?.message?.content || "";

    const reportContent = extractJsonFromLLM(rawContent);

    if (!isValidReport(reportContent)) {
      console.error("AI returned malformed JSON. First 500 chars:", String(rawContent).substring(0, 500));
      return new Response(
        JSON.stringify({ error: "A IA retornou uma resposta inválida. Tente gerar novamente." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ report: reportContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
