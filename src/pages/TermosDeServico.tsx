import LegalPageLayout from "@/components/LegalPageLayout";

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-display text-xl md:text-2xl font-semibold text-foreground mt-10 mb-4">{children}</h2>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-3">{children}</p>
);

const TermosDeServico = () => {
  return (
    <LegalPageLayout
      title="Termos de Serviço — Posiciona"
      metaTitle="Termos de Serviço | Posiciona"
      metaDescription="Leia os Termos de Serviço do Posiciona."
      lastUpdated="15/04/2026"
      breadcrumb="Termos de Serviço"
      path="/termos-de-servico"
    >
      <H2>1. Quem somos</H2>
      <P>
        Estes Termos de Serviço regulam o acesso e o uso da plataforma <strong className="text-foreground">Posiciona</strong>, disponível em <code className="text-gold">posiciona.ia.br</code>, oferecida por <strong className="text-foreground">Cláudia Macedo Amorim</strong>.
      </P>
      <P>
        Ao criar uma conta, contratar um plano, acessar ou utilizar a plataforma, o usuário declara que leu, compreendeu e concorda com estes Termos e com a Política de Privacidade. Estes Termos são regidos pela legislação brasileira aplicável, incluindo o Código de Defesa do Consumidor, a Lei Geral de Proteção de Dados Pessoais e o Marco Civil da Internet.
      </P>

      <H2>2. O que é o Posiciona</H2>
      <P>
        O Posiciona é uma plataforma digital com recursos de inteligência artificial voltados ao posicionamento estratégico de marca, comunicação e presença digital.
      </P>
      <P>Os serviços e funcionalidades podem incluir, entre outros:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>questionários e diagnósticos;</li>
        <li>análise de arquétipos e posicionamento;</li>
        <li>geração de narrativa de marca;</li>
        <li>análise de perfil do Instagram;</li>
        <li>criação de linha editorial e calendário de conteúdo;</li>
        <li>geração de conteúdos prontos para publicação;</li>
        <li>geração de retratos e imagens de marca com apoio de inteligência artificial;</li>
        <li>recursos de edição, personalização e acompanhamento da jornada do usuário.</li>
      </ul>
      <P>
        A plataforma poderá evoluir, incluir, limitar, remover ou alterar funcionalidades a qualquer tempo, por razões técnicas, operacionais, comerciais, legais ou de segurança.
      </P>

      <H2>3. Cadastro e acesso</H2>
      <P>
        Para utilizar determinadas funcionalidades, o usuário deverá criar uma conta com informações verdadeiras, completas e atualizadas.
      </P>
      <P>O usuário é responsável por:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>manter a confidencialidade de sua senha e credenciais;</li>
        <li>responder pelas atividades realizadas em sua conta;</li>
        <li>manter seus dados atualizados;</li>
        <li>utilizar a plataforma de forma lícita e compatível com estes Termos.</li>
      </ul>
      <P>
        O Posiciona poderá suspender, limitar ou encerrar contas em caso de indícios de fraude, informações falsas, uso indevido, violação destes Termos, inadimplência quando aplicável, ou risco técnico, jurídico ou reputacional relevante.
      </P>

      <H2>4. Planos, créditos e pagamentos</H2>
      <P>
        O Posiciona pode oferecer planos gratuitos, pagos, pontuais, recorrentes, promocionais ou baseados em créditos.
      </P>
      <P>Os planos atualmente podem incluir, por exemplo:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li><strong className="text-foreground">Semana de Conteúdo</strong> — acesso pontual com pagamento único;</li>
        <li><strong className="text-foreground">Presença Mensal</strong> — assinatura recorrente mensal;</li>
        <li><strong className="text-foreground">Autoridade Total</strong> — plano completo com recursos ampliados.</li>
      </ul>
      <P>
        Os recursos disponíveis, limites de uso, créditos, reanálises, retratos, ciclos e ajustes dependerão do plano contratado ou da oferta vigente no momento da compra.
      </P>
      <P>Salvo previsão expressa em contrário:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>créditos não são transferíveis entre contas;</li>
        <li>créditos podem não ser cumulativos entre períodos;</li>
        <li>upgrades, downgrades e compras adicionais podem seguir regras próprias informadas no checkout ou na área da conta;</li>
        <li>a renovação de planos recorrentes poderá ocorrer automaticamente até cancelamento, conforme a oferta aceita pelo usuário.</li>
      </ul>

      <H2>5. Cancelamento e reembolso</H2>
      <P>
        O usuário poderá cancelar sua assinatura a qualquer momento, hipótese em que o acesso permanecerá ativo até o fim do período já pago, salvo disposição diversa na oferta contratada.
      </P>
      <P>Pedidos de cancelamento, estorno ou reembolso serão analisados conforme:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>a legislação aplicável;</li>
        <li>a oferta contratada;</li>
        <li>a política comercial vigente no momento da compra.</li>
      </ul>
      <P>
        Nas contratações realizadas pela internet, poderão ser observados os direitos aplicáveis ao consumidor, inclusive o direito de arrependimento nas hipóteses cabíveis. O CDC prevê o direito de arrependimento em até 7 dias em contratações fora do estabelecimento comercial, e o Decreto nº 7.962/2013 determina que esse direito possa ser exercido pela mesma ferramenta usada na contratação, sem prejuízo de outros meios.
      </P>

      <H2>6. Uso permitido e uso proibido</H2>
      <P>O usuário concorda em não:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>utilizar a plataforma para fins ilícitos, fraudulentos, abusivos ou contrários à legislação;</li>
        <li>enviar vírus, códigos maliciosos ou tentar acessar sistemas de forma não autorizada;</li>
        <li>praticar scraping, engenharia reversa, automações abusivas ou qualquer conduta que comprometa a estabilidade do serviço;</li>
        <li>reproduzir, revender, sublicenciar, copiar ou explorar comercialmente a plataforma sem autorização;</li>
        <li>utilizar a plataforma para violar direitos de terceiros, inclusive direitos autorais, imagem, marca, privacidade e proteção de dados.</li>
      </ul>

      <H2>7. Conteúdo enviado pelo usuário</H2>
      <P>
        O usuário declara que possui os direitos, autorizações e bases legais necessários para enviar à plataforma quaisquer textos, imagens, retratos, prints, logos, materiais de referência, links, respostas de questionários ou dados de terceiros.
      </P>
      <P>
        O usuário permanece titular do conteúdo que enviar, mas concede ao Posiciona licença não exclusiva, gratuita e limitada ao funcionamento do serviço para armazenar, processar, organizar, transformar e exibir tais materiais ao próprio usuário, bem como gerar saídas necessárias à prestação do serviço.
      </P>

      <H2>8. Conteúdo gerado por inteligência artificial</H2>
      <P>
        A plataforma pode utilizar inteligência artificial, automações e recursos computacionais para gerar análises, relatórios, textos, diretrizes, imagens, retratos, sugestões e outros materiais.
      </P>
      <P>O usuário reconhece que:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>os conteúdos gerados podem conter imprecisões, generalizações, inconsistências ou resultados semelhantes aos gerados para outros usuários;</li>
        <li>não há garantia de exclusividade, originalidade absoluta ou adequação integral ao caso concreto;</li>
        <li>todo material gerado deve ser revisado pelo usuário antes de publicação, uso comercial, contratação, campanha, aconselhamento profissional ou decisão relevante;</li>
        <li>o Posiciona não garante resultado financeiro, comercial, estético, jurídico, reputacional, de alcance, engajamento ou conversão.</li>
      </ul>

      <H2>9. Propriedade intelectual</H2>
      <P>
        A marca Posiciona, o software, o código-fonte, o layout, os fluxos, a metodologia, a documentação, os textos institucionais, a interface e os demais elementos da plataforma pertencem ao Posiciona ou a seus licenciantes, salvo os conteúdos de titularidade do usuário.
      </P>
      <P>
        É proibido copiar, adaptar, desmontar, reproduzir, distribuir ou explorar qualquer elemento da plataforma sem autorização prévia e expressa, exceto quando permitido por lei.
      </P>

      <H2>10. Disponibilidade da plataforma</H2>
      <P>
        O Posiciona envidará esforços comercialmente razoáveis para manter a plataforma disponível e segura, mas não garante funcionamento ininterrupto, livre de falhas ou compatível com todos os dispositivos, navegadores ou integrações de terceiros.
      </P>
      <P>
        Poderão ocorrer indisponibilidades por manutenção, atualização, falhas de terceiros, medidas de segurança, caso fortuito, força maior ou outros eventos fora do controle razoável do Posiciona.
      </P>

      <H2>11. Privacidade e proteção de dados</H2>
      <P>
        O tratamento de dados pessoais realizado no contexto da plataforma observará a legislação aplicável e a Política de Privacidade do Posiciona, que integra estes Termos para todos os fins. A LGPD regula o tratamento de dados pessoais, inclusive em meios digitais, por pessoas físicas e jurídicas.
      </P>

      <H2>12. Limitação de responsabilidade</H2>
      <P>Na máxima extensão permitida pela legislação aplicável:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>o Posiciona não se responsabiliza por decisões tomadas pelo usuário com base nos materiais gerados;</li>
        <li>não responde por falhas, indisponibilidades ou limitações de serviços de terceiros, como gateways de pagamento, hospedagem, provedores de IA, redes sociais, internet ou integrações externas;</li>
        <li>não se responsabiliza por conteúdo inserido pelo usuário sem autorização ou em desacordo com a lei;</li>
        <li>não garante desempenho comercial ou resultado específico.</li>
      </ul>
      <P>Nada nestes Termos exclui responsabilidade que não possa ser legalmente afastada.</P>

      <H2>13. Alterações destes Termos</H2>
      <P>
        O Posiciona poderá atualizar estes Termos a qualquer momento para refletir mudanças legais, operacionais, técnicas ou comerciais.
      </P>
      <P>
        A versão vigente estará sempre disponível na plataforma com a respectiva data de atualização. Quando necessário, mudanças relevantes poderão ser comunicadas por e-mail, aviso na plataforma ou outro meio razoável.
      </P>

      <H2>14. Lei aplicável e foro</H2>
      <P>Estes Termos serão regidos pelas leis da República Federativa do Brasil.</P>
      <P>
        Fica eleito o foro da comarca de <strong className="text-foreground">Goiânia/GO</strong>, com renúncia a qualquer outro, por mais privilegiado que seja, ressalvadas as hipóteses de foro legalmente obrigatório.
      </P>

      <H2>15. Contato</H2>
      <P>Em caso de dúvidas, solicitações ou suporte:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
         <li>
          <strong className="text-foreground">Contato geral e suporte:</strong>{" "}
          <a href="mailto:suporte@posiciona.ia.br" className="text-gold hover:text-gold-hover transition-colors">suporte@posiciona.ia.br</a>
        </li>
      </ul>
    </LegalPageLayout>
  );
};

export default TermosDeServico;
