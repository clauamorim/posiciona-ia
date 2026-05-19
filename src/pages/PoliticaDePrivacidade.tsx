import LegalPageLayout from "@/components/LegalPageLayout";

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-display text-xl md:text-2xl font-semibold text-foreground mt-10 mb-4">{children}</h2>
);

const H3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-display text-lg font-semibold text-foreground mt-6 mb-3">{children}</h3>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="mb-3">{children}</p>
);

const PoliticaDePrivacidade = () => {
  return (
    <LegalPageLayout
      title="Política de Privacidade — Posiciona"
      metaTitle="Política de Privacidade | Posiciona"
      metaDescription="Saiba como o Posiciona coleta, utiliza e protege seus dados."
      lastUpdated="15/04/2026"
      breadcrumb="Política de Privacidade"
      path="/politica-de-privacidade"
    >
      <H2>1. Apresentação</H2>
      <P>
        Esta Política de Privacidade descreve como o Posiciona coleta, utiliza, armazena, compartilha e protege dados pessoais de usuários da plataforma, em conformidade com a legislação brasileira aplicável, especialmente a Lei Geral de Proteção de Dados Pessoais e o Marco Civil da Internet.
      </P>

      <H2>2. Quem é o responsável pelo tratamento</H2>
      <P>O controlador dos dados pessoais tratados no contexto da plataforma é:</P>
      <P>
        <strong className="text-foreground">Cláudia Macedo Amorim</strong><br />
        <strong className="text-foreground">E-mail de contato:</strong>{" "}
        <a href="mailto:contato@posiciona.ia.br" className="text-gold hover:text-gold-hover transition-colors">contato@posiciona.ia.br</a>
      </P>
      <P>
        A ANPD prevê que agentes de tratamento de pequeno porte podem ser dispensados da indicação formal de encarregado, desde que disponibilizem canal de comunicação com o titular.
      </P>

      <H2>3. Quais dados podemos coletar</H2>
      <P>Podemos coletar, conforme a relação do usuário com a plataforma:</P>

      <H3>a) Dados cadastrais</H3>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>nome;</li>
        <li>e-mail;</li>
        <li>telefone ou WhatsApp, se informado;</li>
        <li>empresa, cargo, profissão, segmento ou informações profissionais;</li>
        <li>credenciais de acesso ou identificadores de autenticação.</li>
      </ul>

      <H3>b) Dados contratuais e de cobrança</H3>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>plano contratado;</li>
        <li>histórico de assinatura;</li>
        <li>status de pagamento;</li>
        <li>identificadores de transação;</li>
        <li>dados necessários à cobrança processados por parceiros de pagamento.</li>
      </ul>

      <H3>c) Dados fornecidos em questionários e briefings</H3>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>respostas sobre negócio, posicionamento, público, comunicação, objetivos, diferenciais, dores, imagem, branding, conteúdo e estratégia.</li>
      </ul>

      <H3>d) Conteúdos enviados pelo usuário</H3>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>textos;</li>
        <li>imagens;</li>
        <li>retratos;</li>
        <li>prints;</li>
        <li>links;</li>
        <li>arquivos;</li>
        <li>referências visuais;</li>
        <li>informações relativas a perfis em redes sociais.</li>
      </ul>

      <H3>e) Dados de uso e navegação</H3>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>endereço IP;</li>
        <li>logs de acesso;</li>
        <li>data e hora de uso;</li>
        <li>páginas ou telas acessadas;</li>
        <li>cliques;</li>
        <li>informações de navegador, dispositivo e sistema operacional;</li>
        <li>cookies e tecnologias similares, quando aplicáveis.</li>
      </ul>

      <H3>f) Dados de suporte e atendimento</H3>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>mensagens trocadas com suporte;</li>
        <li>histórico de solicitações, dúvidas e reclamações.</li>
      </ul>

      <H2>4. Para que usamos os dados</H2>
      <P>Utilizamos os dados pessoais para:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>criar e administrar contas;</li>
        <li>autenticar acessos;</li>
        <li>disponibilizar as funcionalidades contratadas;</li>
        <li>processar diagnósticos, questionários, análises e resultados;</li>
        <li>gerar conteúdos, relatórios, imagens, retratos e demais saídas da plataforma;</li>
        <li>processar pagamentos e administrar assinaturas;</li>
        <li>prestar suporte;</li>
        <li>enviar comunicações operacionais e avisos sobre o serviço;</li>
        <li>melhorar desempenho, segurança, estabilidade e experiência de uso;</li>
        <li>prevenir fraudes, abusos e acessos indevidos;</li>
        <li>cumprir obrigações legais, regulatórias e contratuais;</li>
        <li>exercer direitos em processos administrativos, arbitrais ou judiciais.</li>
      </ul>

      <H2>5. Bases legais</H2>
      <P>Quando aplicável, o tratamento de dados poderá se apoiar em bases legais como:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>execução de contrato ou de procedimentos preliminares relacionados ao contrato;</li>
        <li>cumprimento de obrigação legal ou regulatória;</li>
        <li>exercício regular de direitos;</li>
        <li>legítimo interesse, observados os direitos e liberdades do titular;</li>
        <li>consentimento, quando necessário.</li>
      </ul>
      <P>A LGPD exige a identificação da base legal que justifica as atividades de tratamento de dados pessoais.</P>

      <H2>6. Compartilhamento de dados</H2>
      <P>O Posiciona não vende dados pessoais.</P>
      <P>Os dados poderão ser compartilhados, quando necessário, com:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>provedores de hospedagem, nuvem, armazenamento e infraestrutura;</li>
        <li>processadores de pagamento e antifraude;</li>
        <li>ferramentas de autenticação, analytics, comunicação, atendimento e suporte;</li>
        <li>provedores de inteligência artificial e processamento automatizado;</li>
        <li>parceiros operacionais necessários à prestação do serviço;</li>
        <li>autoridades públicas, regulatórias ou judiciais, quando houver obrigação legal.</li>
      </ul>
      <P>O compartilhamento será limitado ao necessário para cada finalidade.</P>

      <H2>7. Transferência internacional</H2>
      <P>
        Alguns fornecedores de tecnologia, nuvem, comunicação, analytics ou inteligência artificial podem tratar dados fora do Brasil.
      </P>
      <P>
        Quando isso ocorrer, o Posiciona buscará adotar medidas razoáveis para que o tratamento observe padrões adequados de segurança e proteção compatíveis com a legislação aplicável.
      </P>

      <H2>8. Cookies e tecnologias similares</H2>
      <P>A plataforma pode utilizar cookies e tecnologias similares para:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>autenticação;</li>
        <li>funcionamento técnico;</li>
        <li>segurança;</li>
        <li>análise de uso;</li>
        <li>personalização da experiência.</li>
      </ul>

      <H2>9. Retenção e armazenamento</H2>
      <P>Os dados pessoais serão mantidos:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>pelo tempo necessário à prestação dos serviços;</li>
        <li>enquanto a conta estiver ativa, quando aplicável;</li>
        <li>pelo prazo necessário ao cumprimento de obrigações legais, regulatórias e contratuais;</li>
        <li>pelo período necessário ao exercício regular de direitos, inclusive em demandas judiciais, administrativas ou arbitrais;</li>
        <li>pelo prazo compatível com políticas de segurança, prevenção a fraudes e auditoria.</li>
      </ul>
      <P>Depois disso, os dados poderão ser eliminados, anonimizados ou bloqueados, quando cabível.</P>

      <H2>10. Segurança</H2>
      <P>
        O Posiciona adota medidas técnicas e organizacionais razoáveis para proteger os dados pessoais contra acesso não autorizado, destruição, perda, alteração, comunicação ou difusão indevida.
      </P>
      <P>
        Apesar disso, nenhum sistema é totalmente invulnerável. Por isso, o usuário também deve adotar boas práticas de segurança, como proteger suas credenciais e evitar o compartilhamento indevido de acesso.
      </P>

      <H2>11. Direitos do titular</H2>
      <P>Nos termos da LGPD, o titular poderá solicitar, quando cabível:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>confirmação da existência de tratamento;</li>
        <li>acesso aos dados;</li>
        <li>correção de dados incompletos, inexatos ou desatualizados;</li>
        <li>anonimização, bloqueio ou eliminação de dados desnecessários, excessivos ou tratados em desconformidade;</li>
        <li>portabilidade, quando aplicável;</li>
        <li>eliminação de dados tratados com consentimento, quando cabível;</li>
        <li>informação sobre compartilhamentos;</li>
        <li>revogação do consentimento, nos casos em que essa for a base legal;</li>
        <li>revisão de decisões tomadas unicamente com base em tratamento automatizado, quando aplicável.</li>
      </ul>
      <P>Os direitos do titular estão previstos na LGPD.</P>

      <H2>12. Dados de terceiros enviados pelo usuário</H2>
      <P>
        Se o usuário inserir dados pessoais, imagens, perfis, retratos, prints ou quaisquer materiais relativos a terceiros, declara possuir autorização, base legal ou outra justificativa legítima para esse envio, assumindo responsabilidade por tal conduta.
      </P>

      <H2>13. Conteúdo gerado por inteligência artificial</H2>
      <P>As saídas da plataforma podem decorrer de processamento automatizado e uso de inteligência artificial.</P>
      <P>Essas saídas:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>podem refletir os dados e materiais fornecidos pelo usuário;</li>
        <li>podem variar conforme o contexto, as respostas e os insumos enviados;</li>
        <li>devem ser revisadas antes de uso público, comercial, contratual, publicitário ou profissional.</li>
      </ul>

      <H2>14. Menores de idade</H2>
      <P>
        A plataforma é destinada a pessoas com 18 anos ou mais. O Posiciona não busca coletar intencionalmente dados pessoais de menores de idade. Caso identifique tratamento indevido dessa natureza, poderá adotar medidas para exclusão ou bloqueio dos dados, quando cabível.
      </P>

      <H2>15. Exclusão da conta</H2>
      <P>O usuário pode solicitar a exclusão da conta por meio dos canais informados nesta Política.</P>
      <P>
        A exclusão da conta não implica necessariamente remoção imediata de todos os dados, que poderão ser mantidos quando houver necessidade de retenção para:
      </P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>cumprimento de obrigação legal ou regulatória;</li>
        <li>prevenção a fraudes e incidentes de segurança;</li>
        <li>exercício regular de direitos;</li>
        <li>cumprimento contratual ainda pendente.</li>
      </ul>

      <H2>16. Alterações desta Política</H2>
      <P>
        Esta Política poderá ser atualizada periodicamente para refletir mudanças legais, técnicas, operacionais ou comerciais.
      </P>
      <P>A versão vigente estará sempre disponível na plataforma com a respectiva data de atualização.</P>

      <H2>17. Contato</H2>
      <P>Para dúvidas, solicitações ou exercício de direitos relacionados a dados pessoais:</P>
      <ul className="list-disc pl-6 space-y-1.5 mb-3">
        <li>
          <strong className="text-foreground">Contato geral e suporte:</strong>{" "}
          <a href="mailto:suporte@posiciona.ia.br" className="text-gold hover:text-gold-hover transition-colors">suporte@posiciona.ia.br</a>
        </li>
      </ul>
    </LegalPageLayout>
  );
};

export default PoliticaDePrivacidade;
