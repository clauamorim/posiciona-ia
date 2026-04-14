import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

async function fetchReferencePdfs(): Promise<{ mime_type: string; data: string }[]> {
  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: docs } = await supabaseAdmin
      .from("reference_documents")
      .select("file_path, file_size")
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .limit(5);
    if (!docs?.length) return [];

    const parts: { mime_type: string; data: string }[] = [];
    let totalSize = 0;
    const MAX_TOTAL = 8 * 1024 * 1024;

    for (const doc of docs) {
      if (totalSize + doc.file_size > MAX_TOTAL) break;
      const { data: fileData, error } = await supabaseAdmin.storage
        .from("reference-pdfs")
        .download(doc.file_path);
      if (error || !fileData) continue;
      const arrayBuf = await fileData.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));
      parts.push({ mime_type: "application/pdf", data: b64 });
      totalSize += doc.file_size;
    }
    return parts;
  } catch (e) {
    console.error("Error fetching reference PDFs:", e);
    return [];
  }
}

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
    "sapatos": ["sapato 1", "sapato 2", "sapato 3"],
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

⚠️ REGRA CRÍTICA SOBRE GÊNERO — OBRIGATÓRIO SEGUIR:
O gênero do cliente é: **${genderLabel}**
TODO o figurino DEVE ser gerado para o gênero "${genderLabel}". NÃO gere figurino para outro gênero.

Regras para o campo "figurino":
- O figurino deve ser 100% baseado na COMBINAÇÃO dos 3 arquétipos da marca
- GÊNERO: ${genderLabel} — TODAS as recomendações devem ser para este gênero
- Se o gênero for "Feminino": OBRIGATORIAMENTE gerar maquiagem feminina (batom, sombra, blush, delineador, etc.), acessórios femininos (brincos, colares, pulseiras, bolsas, scarpin, etc.), penteados femininos (ondas, coque, babyliss, etc.). NÃO mencionar barba, grooming masculino, gravata ou relógio masculino.
- Se o gênero for "Masculino": OBRIGATORIAMENTE gerar grooming masculino (barba, skincare, cabelo curto, etc.), acessórios masculinos (relógio, gravata, abotoaduras, etc.). NÃO mencionar maquiagem, batom, sombra, brincos femininos ou bolsas femininas.
- Se o gênero for "Não informado" ou "Prefiro não informar": gerar versão neutra/unissex
- As peças-chave devem ser específicas (ex: "blazer de linho bege", não apenas "blazer")
- As cores de roupa devem ser alinhadas à paleta de cores da marca
- Incluir pelo menos 5 peças-chave, 3 sapatos e 3 acessórios
- O campo "sapatos" deve ter recomendações específicas (ex: "scarpin nude de salto médio", "tênis branco minimalista")

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
