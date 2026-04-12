import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle, Search } from "lucide-react";

const HELP_TOPICS = [
  {
    id: "archetypes",
    title: "O que são Arquétipos de Marca?",
    content:
      "Arquétipos de marca são padrões universais de personalidade baseados nos estudos de Carl Jung. Existem 12 arquétipos principais (Herói, Mago, Sábio, Explorador, etc.), e cada marca possui uma combinação de 3 arquétipos dominantes — primário, secundário e terciário. Eles definem a personalidade, o tom de voz e a identidade visual da sua marca, tornando sua comunicação mais autêntica e memorável.",
  },
  {
    id: "storybrand",
    title: "Como funciona o StoryBrand?",
    content:
      "O framework StoryBrand, criado por Donald Miller, estrutura a comunicação da sua marca como uma narrativa. Nela, o seu CLIENTE é o herói da história, e a sua MARCA é o guia que o ajuda a superar desafios. O framework identifica: o problema externo, interno e filosófico do cliente; como sua marca o guia; qual o plano de ação; a chamada para ação; e os resultados de sucesso vs. fracasso. Isso cria uma mensagem clara e persuasiva.",
  },
  {
    id: "editorial",
    title: "Como usar a Linha Editorial?",
    content:
      "A Linha Editorial é um planejamento semanal de conteúdo gerado com base nos seus arquétipos e StoryBrand. Cada semana contém 7 dias de conteúdo com formatos variados (carrossel, post, reels, stories). Você pode: gerar novas semanas usando seus ciclos semanais; regenerar posts individuais; e criar posts visuais prontos no editor integrado. Os conteúdos são sempre únicos e alinhados à sua estratégia.",
  },
  {
    id: "editor",
    title: "Como editar posts no Editor Visual?",
    content:
      "O Editor Visual permite personalizar seus posts antes de publicar. Você pode: alterar cores de fundo usando sua paleta; trocar o layout (centralizado, topo ou dividido); editar textos diretamente no canvas; fazer upload de logo e fotos; adicionar elementos gráficos decorativos; redimensionar e mover elementos (clique para selecionar, arraste para mover, use os cantos para redimensionar); deletar elementos selecionados com a tecla Delete; e baixar em PNG ou ZIP (para carrosséis).",
  },
  {
    id: "instagram",
    title: "Análise do Instagram",
    content:
      "A análise do Instagram avalia seu perfil com base nos seus arquétipos e StoryBrand. Para usar: faça um print da tela principal do seu perfil no Instagram; faça upload da imagem; e receba uma análise detalhada com sugestões de melhoria para bio, destaques, feed, legendas e mais. Cada aspecto mostra a situação atual e uma sugestão prática de melhoria. Você pode baixar a análise em PDF.",
  },
  {
    id: "portraits",
    title: "Retratos de Marca",
    content:
      "Os Retratos de Marca são imagens profissionais geradas por IA, estilizadas de acordo com os seus arquétipos. Eles simulam uma sessão de fotos em estúdio com iluminação e figurino adequados à personalidade da sua marca. Você pode gerar diferentes estilos e baixar as imagens para usar no seu perfil e materiais de marketing.",
  },
  {
    id: "credits",
    title: "Créditos e Planos",
    content:
      "O Posiciona funciona com um sistema de créditos:\n\n• Ciclos semanais: para gerar novas semanas de conteúdo na linha editorial\n• Créditos de regeneração: para substituir posts individuais na linha editorial\n• Créditos de reanálise: para refazer seus questionários e gerar nova estratégia\n• Créditos de retratos: para gerar novas sessões de retratos de marca\n\nSeu saldo aparece no Dashboard. Os créditos são renovados de acordo com seu plano.",
  },
  {
    id: "questionnaires",
    title: "Como funcionam os Questionários?",
    content:
      "Existem dois questionários principais:\n\n1. Questionário do Negócio: coleta informações sobre sua empresa, público-alvo, serviços, problemas que resolve, provas de autoridade, etc. Essas informações alimentam o StoryBrand.\n\n2. Questionário de Arquétipos: uma série de afirmações que você avalia de 1 a 5, revelando quais arquétipos são mais fortes na sua personalidade de marca.\n\nApós completar ambos, você gera suas análises (relatório completo). Os questionários ficam bloqueados após a geração — para editá-los, use a função 'Refazer análise' (consome 1 crédito de reanálise).",
  },
];

const HelpPage = () => {
  const [search, setSearch] = useState("");

  const filtered = HELP_TOPICS.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <HelpCircle className="h-6 w-6" /> Ajuda
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Encontre respostas sobre conceitos e como usar o Posiciona
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar tópicos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhum tópico encontrado para "{search}"</p>
          </div>
        ) : (
          <Accordion type="multiple" className="space-y-2">
            {filtered.map((topic) => (
              <AccordionItem key={topic.id} value={topic.id} className="border rounded-lg px-4">
                <AccordionTrigger className="text-sm font-medium hover:no-underline">
                  {topic.title}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                  {topic.content}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </DashboardLayout>
  );
};

export default HelpPage;
