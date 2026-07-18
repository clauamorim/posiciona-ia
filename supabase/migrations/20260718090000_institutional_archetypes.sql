-- ============================================================================
-- Arquétipos institucionais — Etapa 2 (marca institucional)
-- Adiciona brand_type a archetype_questions e insere os 36 itens da bateria
-- de marca (3 por arquétipo, aprovados pela Cláudia em docs/
-- questionario-arquetipos-institucional.md). question_number 1001-1036 para
-- nunca colidir com o range 1-72 do questionário pessoal. Idempotente.
--
-- IMPORTANTE: archetype_name usa os 12 nomes CANÔNICOS já em uso no produto
-- (ARCHETYPE_MAP/ARCHETYPE_COLORS em src/lib/archetypes.ts), não os nomes
-- "de leitura" do rascunho aprovado (ex.: rascunho "Prestativo" -> canônico
-- "Cuidador"; "Fora-da-Lei" -> "Rebelde"; "Bobo da Corte" -> "Bobo-da-corte";
-- "Cara Comum" -> "Cara-comum"). O conteúdo das perguntas não muda, só o
-- rótulo interno de arquétipo usado para somar a pontuação.
-- ============================================================================

alter table public.archetype_questions
  add column if not exists brand_type public.brand_type not null default 'pessoal';

-- As 72 perguntas existentes já nascem 'pessoal' pelo default acima.

insert into public.archetype_questions (question_number, statement, archetype_name, brand_type) values
  (1001, 'Nossa marca é reconhecida pela originalidade do que produz — não seguimos o que o concorrente faz.', 'Criador', 'institucional'),
  (1002, 'Ajudamos nossos clientes a tirar ideias do papel e dar forma ao que imaginaram.', 'Criador', 'institucional'),
  (1003, 'Aqui, autoria e inovação valem mais do que repetir modelos comprovados.', 'Criador', 'institucional'),

  (1004, 'Nossa marca coloca a necessidade do cliente acima da venda, mesmo quando isso custa caro.', 'Cuidador', 'institucional'),
  (1005, 'Cuidar e proteger quem atendemos é o centro do nosso negócio.', 'Cuidador', 'institucional'),
  (1006, 'Nossos clientes nos procuram quando precisam de alguém em quem confiar de olhos fechados.', 'Cuidador', 'institucional'),

  (1007, 'Nossa marca transmite autoridade: quando falamos, o nosso mercado escuta.', 'Governante', 'institucional'),
  (1008, 'Ajudamos nossos clientes a ter controle, ordem e previsibilidade na área em que atuamos.', 'Governante', 'institucional'),
  (1009, 'Ser a referência premium do segmento importa mais para nós do que ser a opção mais acessível.', 'Governante', 'institucional'),

  (1010, 'Nossa marca usa humor e leveza para falar até dos assuntos sérios.', 'Bobo-da-corte', 'institucional'),
  (1011, 'Nossos clientes se divertem ao interagir com a gente — e voltam também por isso.', 'Bobo-da-corte', 'institucional'),
  (1012, 'Preferimos ser espontâneos a parecer formais e protocolares.', 'Bobo-da-corte', 'institucional'),

  (1013, 'Nossa marca fala de igual para igual, sem jargão e sem se colocar acima do cliente.', 'Cara-comum', 'institucional'),
  (1014, 'Fazemos questão de ser acessíveis — qualquer pessoa se sente bem-vinda aqui.', 'Cara-comum', 'institucional'),
  (1015, 'Nosso cliente nos escolhe porque se identifica com a gente, não porque nos admira de longe.', 'Cara-comum', 'institucional'),

  (1016, 'Nossa marca constrói relações próximas e duradouras — cliente aqui é tratado como único.', 'Amante', 'institucional'),
  (1017, 'Estética, prazer e experiência importam tanto quanto o resultado do que entregamos.', 'Amante', 'institucional'),
  (1018, 'Ajudamos nossos clientes a se sentirem mais valorizados, atraentes ou especiais.', 'Amante', 'institucional'),

  (1019, 'Nossa marca existe para vencer desafios que outros consideram difíceis demais.', 'Herói', 'institucional'),
  (1020, 'Ajudamos nossos clientes a alcançar resultados que exigem disciplina e coragem.', 'Herói', 'institucional'),
  (1021, 'Assumimos metas ambiciosas publicamente e nos cobramos por elas.', 'Herói', 'institucional'),

  (1022, 'Nossa marca questiona abertamente regras e práticas estabelecidas do nosso setor.', 'Rebelde', 'institucional'),
  (1023, 'Atraímos clientes que estão cansados do jeito tradicional de fazer as coisas.', 'Rebelde', 'institucional'),
  (1024, 'Preferimos romper um padrão do mercado a segui-lo só porque "sempre foi assim".', 'Rebelde', 'institucional'),

  (1025, 'Nossa marca promove transformações: o cliente termina diferente de como começou.', 'Mago', 'institucional'),
  (1026, 'Fazemos o complexo parecer simples — quase mágica — na experiência do cliente.', 'Mago', 'institucional'),
  (1027, 'Vendemos uma visão de futuro e mostramos o caminho para realizá-la.', 'Mago', 'institucional'),

  (1028, 'Nossa marca comunica de forma simples e transparente, sem letras miúdas nem promessas infladas.', 'Inocente', 'institucional'),
  (1029, 'Ajudamos nossos clientes a recuperar a confiança de que as coisas podem dar certo.', 'Inocente', 'institucional'),
  (1030, 'Preferimos soluções honestas e diretas a estratégias complexas ou agressivas.', 'Inocente', 'institucional'),

  (1031, 'Nossa marca incentiva o cliente a trilhar o próprio caminho, sem fórmulas prontas.', 'Explorador', 'institucional'),
  (1032, 'Estamos sempre experimentando caminhos novos antes do restante do mercado.', 'Explorador', 'institucional'),
  (1033, 'Nosso cliente ideal valoriza liberdade e autonomia acima de segurança e convenção.', 'Explorador', 'institucional'),

  (1034, 'Nossa marca ensina: o cliente sai de cada contato entendendo mais do que entrava.', 'Sábio', 'institucional'),
  (1035, 'Baseamos nossas recomendações em estudo, dados e análise — não em modismos.', 'Sábio', 'institucional'),
  (1036, 'Ajudamos o cliente a decidir melhor porque passa a enxergar o cenário com clareza.', 'Sábio', 'institucional')
on conflict (question_number) do nothing;
