import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const API_URL = "https://ai-gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { business, niche, archetypes } = await req.json();

    if (!business || !archetypes) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Você é um especialista em branding, arquétipos de marca e metodologia StoryBrand. 
Gere um relatório estratégico completo e personalizado para posicionamento de marca no Instagram.

O relatório deve conter as seguintes seções em formato estruturado:

1. **Arquétipos Principais**: Descreva os 3 arquétipos do usuário (primário, secundário e terciário), suas características e como se aplicam ao negócio.

2. **Identidade Visual**: Sugira paleta de cores (com códigos hex), tipografia recomendada, estilo de figurino/visual para fotos e vídeos.

3. **Tom de Voz**: Diretrizes de comunicação alinhadas aos arquétipos — como falar, que palavras usar, que emoções evocar.

4. **Estratégia StoryBrand**: Aplique o framework completo:
   - O Herói (cliente)
   - O Guia (marca)
   - O Problema (externo, interno, filosófico)
   - O Plano (etapas claras)
   - A Chamada para Ação
   - O Sucesso (transformação)
   - O Fracasso (o que acontece se não agir)

5. **Linha Editorial de 7 Dias**: Para cada dia, forneça:
   - Tema do conteúdo
   - Formato (reels, carrossel, stories, post estático)
   - Legenda sugerida
   - CTA específico

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

Arquétipos principais:
- Primário: ${archetypes.primary?.name} (pontuação: ${archetypes.primary?.score}/30)
- Secundário: ${archetypes.secondary?.name} (pontuação: ${archetypes.secondary?.score}/30)
- Terciário: ${archetypes.tertiary?.name} (pontuação: ${archetypes.tertiary?.score}/30)

Gere o relatório completo agora.`;

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
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const reportContent = data.choices?.[0]?.message?.content || "Erro ao gerar relatório";

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
