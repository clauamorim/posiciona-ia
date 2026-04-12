import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

IMPORTANTE: Responda APENAS com um JSON válido, sem markdown, sem backticks, sem texto antes ou depois do JSON.

O JSON deve seguir EXATAMENTE esta estrutura:

{
  "archetypes": {
    "primary": { "name": "...", "description": "...", "application": "..." },
    "secondary": { "name": "...", "description": "...", "application": "..." },
    "tertiary": { "name": "...", "description": "...", "application": "..." }
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
    "cores_roupa": ["cor 1", "cor 2", "cor 3"],
    "pecas_chave": ["peça 1", "peça 2", "peça 3", "peça 4", "peça 5"],
    "acessorios": ["acessório 1", "acessório 2", "acessório 3"],
    "cabelo": "Orientação detalhada de estilo de cabelo",
    "maquiagem_grooming": "Orientação de maquiagem (feminino) ou grooming/barba (masculino) ou versão neutra",
    "evitar": ["item a evitar 1", "item a evitar 2"]
  },
  "simbolos": {
    "primary": { "nome": "...", "simbolo": "...", "significado": "...", "aplicacao": "..." },
    "secondary": { "nome": "...", "simbolo": "...", "significado": "...", "aplicacao": "..." },
    "tertiary": { "nome": "...", "simbolo": "...", "significado": "...", "aplicacao": "..." }
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

Regras para o campo "figurino":
- O figurino deve ser 100% baseado na COMBINAÇÃO dos 3 arquétipos da marca
- Gênero do cliente: ${genderLabel}
- Se o gênero for "Feminino": gerar maquiagem feminina (batom, sombra, blush, etc.), acessórios femininos (brincos, colares, bolsas, etc.), penteados femininos
- Se o gênero for "Masculino": gerar grooming masculino (barba, skincare, etc.), acessórios masculinos (relógio, gravata, etc.), cortes de cabelo masculinos
- Se o gênero for "Não informado" ou "Prefiro não informar": gerar versão neutra/unissex
- As peças-chave devem ser específicas (ex: "blazer de linho bege", não apenas "blazer")
- As cores de roupa devem ser alinhadas à paleta de cores da marca
- Incluir pelo menos 5 peças-chave e 3 acessórios

Regras para o campo "simbolos":
- Cada arquétipo tem um símbolo clássico (ex: Herói = espada/escudo, Mago = varinha/cristal, Explorador = bússola, etc.)
- O campo "simbolo" deve ser o emoji ou nome do símbolo principal
- O campo "significado" explica o que o símbolo representa
- O campo "aplicacao" descreve como usar o símbolo na comunicação visual (posts, stories, logo, etc.)

Regras para o campo "editorial":
- OBRIGATORIAMENTE 7 dias (day 1 a 7)
- Cada dia deve ter um tema diferente e relevante
- O campo "caption" deve conter a LEGENDA COMPLETA pronta para copiar e colar no Instagram
- O campo "card_copy": para formato "carrossel", deve ser um ARRAY com o texto completo de CADA SLIDE (mínimo 5 slides); para formato "post", deve ser um array com 1 item contendo o texto visual do card; para "reels" e "stories", pode ser array vazio []
- O campo "script" deve conter o ROTEIRO COMPLETO para Reels (gancho de abertura, desenvolvimento, CTA final). Para outros formatos, descrever o conteúdo visual de cada slide/frame
- O campo "cta" deve ser específico e acionável
- Varie os formatos ao longo da semana

Regras para "visual_identity.palette":
- EXATAMENTE 5 cores
- Cada cor deve ter hex válido, nome descritivo em português e uso recomendado (ex: "Cor de fundo principal", "Cor de destaque para CTAs", "Cor de texto secundário")

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

Gênero do cliente: ${genderLabel}

Arquétipos principais (calculados pela aplicação — use EXATAMENTE estes nomes):
- Primário: ${archetypes.primary?.archetype_name || archetypes.primary?.name} (pontuação: ${archetypes.primary?.score}/30)
- Secundário: ${archetypes.secondary?.archetype_name || archetypes.secondary?.name} (pontuação: ${archetypes.secondary?.score}/30)
- Terciário: ${archetypes.tertiary?.archetype_name || archetypes.tertiary?.name} (pontuação: ${archetypes.tertiary?.score}/30)

Gere o relatório completo em JSON agora.`;

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
          { role: "user", content: userPrompt },
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

    let reportContent: any;
    try {
      const cleaned = rawContent.replace(/^```json?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
      reportContent = JSON.parse(cleaned);
    } catch {
      reportContent = rawContent;
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
