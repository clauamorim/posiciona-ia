import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { SeoHead } from "@/components/SeoHead";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle, Search, Mail, MessageCircle, Copy, Check, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { openAssistant } from "@/lib/assistantBus";

const HELP_TOPICS = [
  {
    id: "archetypes",
    title: "O que são Arquétipos de Marca?",
    content:
      "Arquétipos de marca são padrões universais de personalidade baseados nos estudos de Carl Jung. Existem 12 arquétipos principais (Herói, Mago, Sábio, Explorador, etc.), e cada marca possui uma combinação de 3 arquétipos dominantes — primário, secundário e terciário. Eles definem a personalidade, o tom de voz e a identidade visual da sua marca, tornando sua comunicação mais autêntica e memorável.",
  },
  {
    id: "storybrand",
    title: "Como funciona a Narrativa da Marca?",
    content:
      "O framework de Narrativa da Marca, baseado no método StoryBrand de Donald Miller, estrutura a comunicação da sua marca como uma narrativa. Nela, o seu CLIENTE é o herói da história, e a sua MARCA é o guia que o ajuda a superar desafios. O framework identifica: o problema externo, interno e filosófico do cliente; como sua marca o guia; qual o plano de ação; a chamada para ação; e os resultados de sucesso vs. fracasso. Isso cria uma mensagem clara e persuasiva.",
  },
  {
    id: "editorial",
    title: "Como usar a Linha Editorial?",
    content:
      "A Linha Editorial é um planejamento semanal de conteúdo gerado com base nos seus arquétipos e narrativa de marca. Cada semana contém 7 dias de conteúdo com formatos variados (carrossel, post, reels, stories). Você pode: gerar novas semanas usando seus ciclos semanais; ajustar posts individuais; e criar posts visuais prontos no editor integrado. Os conteúdos são sempre únicos e alinhados à sua estratégia.",
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
      "A análise do Instagram avalia seu perfil com base nos seus arquétipos e narrativa de marca. Para usar: faça um print da tela principal do seu perfil no Instagram; faça upload da imagem; e receba uma análise detalhada com sugestões de melhoria para bio, destaques, feed, legendas e mais. Cada aspecto mostra a situação atual e uma sugestão prática de melhoria. Você pode baixar a análise em PDF.",
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
      "O Posiciona funciona com um sistema de créditos:\n\n• Ciclos semanais: para gerar novas semanas de conteúdo na linha editorial\n• Créditos de ajuste de conteúdo: para substituir posts individuais na linha editorial\n• Créditos de reanálise: para refazer seus questionários e gerar nova estratégia\n• Créditos de retratos: para gerar novas sessões de retratos de marca\n\nSeu saldo aparece no Dashboard. Os créditos são renovados de acordo com seu plano.",
  },
  {
    id: "questionnaires",
    title: "Como funcionam os Questionários?",
    content:
      "Existem dois questionários principais:\n\n1. Questionário do Negócio: coleta informações sobre sua empresa, público-alvo, serviços, problemas que resolve, provas de autoridade, etc. Essas informações alimentam a narrativa de marca.\n\n2. Questionário de Arquétipos: uma série de afirmações que você avalia de 1 a 5, revelando quais arquétipos são mais fortes na sua personalidade de marca.\n\nApós completar ambos, você gera suas análises (relatório completo). Os questionários ficam bloqueados após a geração — para editá-los, use a função 'Refazer análise' (consome 1 crédito de reanálise).",
  },
  {
    id: "cancel-subscription",
    title: "Como cancelar minha assinatura?",
    content:
      "Acesse Conta > seção Assinatura > Gerenciar assinatura. Você será redirecionada ao portal externo do Stripe, onde pode cancelar a renovação automática a qualquer momento. Ao cancelar, você continua com acesso até o fim do ciclo já pago.",
  },
  {
    id: "change-plan",
    title: "Como mudar de plano (upgrade ou downgrade)?",
    content:
      "Acesse Plano e Créditos no menu lateral. No momento, mudanças de plano são feitas por contato com o suporte para preservar seu histórico de créditos e ciclos pagos. Use o WhatsApp ou e-mail abaixo para solicitar.",
  },
  {
    id: "update-profile",
    title: "Como atualizar meus dados (profissão, nicho, e-mail)?",
    content:
      "Profissão e Nicho são alterados editando o Diagnóstico do Negócio (consome 1 crédito de reanálise para refazer a análise). Para alterar o e-mail de login, entre em contato com o suporte por segurança — não fazemos pela interface.",
  },
  {
    id: "refund",
    title: "Política de reembolso",
    content:
      "Conforme o Código de Defesa do Consumidor, você tem direito a desistir da compra em até 7 dias corridos do pagamento (direito de arrependimento). Após esse prazo, créditos já consumidos não são reembolsáveis, mas créditos não-usados podem ser analisados caso a caso. Entre em contato com o suporte.",
  },
  {
    id: "edit-questionnaire",
    title: "Posso editar minhas respostas dos questionários depois?",
    content:
      "Sim. Após sua estratégia ser gerada, os questionários ficam marcados como 'Em uso'. Para editar respostas, é necessário consumir 1 crédito de reanálise — isso reaproveita seu progresso, regerando o relatório com as novas respostas.",
  },
  {
    id: "lgpd",
    title: "LGPD: meus dados pessoais",
    content:
      "Você pode solicitar a qualquer momento: (1) acesso aos seus dados pessoais, (2) correção de dados incorretos, (3) portabilidade (exportação dos dados), (4) exclusão da conta e remoção dos dados (em até 15 dias úteis, conforme LGPD). Para excluir conta vá em Conta > Zona de perigo. Para os outros direitos, entre em contato com o suporte.",
  },
];

const SUPPORT_EMAIL = "contato@posiciona.ia.br";
const SUPPORT_WHATSAPP_DISPLAY = "(62) 99440-0707";
const SUPPORT_WHATSAPP_LINK = "https://wa.me/5562994400707";

const HelpPage = () => {
  const [search, setSearch] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 1500);
      toast({ title: "E-mail copiado", description: SUPPORT_EMAIL });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const filtered = HELP_TOPICS.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.content.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <SeoHead title="Ajuda · Posiciona" description="Suporte e perguntas frequentes." path="/help" />
      <div className="space-y-6 lg:max-w-[1100px] lg:mx-auto">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-muted-foreground" /> Ajuda
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

        {/* Assistente IA callout */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Não achou sua resposta?</p>
                <p className="text-xs text-muted-foreground">
                  Pergunte ao Assistente IA — ele conhece seu plano, arquétipos e a metodologia da Posiciona.
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => openAssistant()} className="gap-2 shrink-0">
              <Sparkles className="h-4 w-4" /> Abrir Assistente IA
            </Button>
          </CardContent>
        </Card>

        {/* Rodapé de suporte humano */}
        <div className="mt-10 pt-6 border-t border-border space-y-4">
          <div>
            <h2 className="text-base font-semibold">Falar com o suporte</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Para dúvidas que exigem atendimento humano (mudança de plano, reembolso, alteração de e-mail, LGPD).
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {/* WhatsApp */}
            <a
              href={SUPPORT_WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-card transition-colors"
            >
              <div className="h-9 w-9 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                <MessageCircle className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">WhatsApp</p>
                <p className="text-sm font-medium truncate">{SUPPORT_WHATSAPP_DISPLAY}</p>
              </div>
            </a>

            {/* E-mail */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">E-mail</p>
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-sm font-medium hover:underline truncate block">
                  {SUPPORT_EMAIL}
                </a>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={copyEmail}
                aria-label="Copiar e-mail"
              >
                {copiedEmail ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default HelpPage;
