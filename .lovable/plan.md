# Plano: Geração resiliente em background + CTA pós-relatório

## Problemas identificados

**1. Geração para quando muda de aba**
- **Relatório**: a edge function `generate-report` enfileira um job assíncrono no servidor (status persistido em `reports.status`), então a geração de fato **não para** quando você sai da aba. Mas a página `Report.tsx` só lê o status uma única vez no `useEffect` inicial (sem polling nem realtime). Resultado: ao voltar, a tela continua mostrando "Gerando seu relatório..." mesmo já tendo terminado, dando impressão de travamento.
- **Retratos**: a função `generate-portrait` é chamada com `supabase.functions.invoke(...)` de forma **síncrona**. A edge function continua executando no servidor (e salvando em `portrait_generations`), mas se o usuário sai da página `PortraitGenerator`, o `useState` (`generating`, `portraits`, `generationId`) é perdido. Ao voltar, a UI volta ao estado inicial e o usuário acha que "parou".

**2. Falta de direção pós-relatório**
- Quando o relatório termina e o usuário cai em `/report`, não há um CTA claro indicando o próximo passo (gerar a Linha Editorial). O usuário se perde.

## O que será feito

### A. Relatório: polling enquanto está "generating"
Em `src/pages/Report.tsx`:
- Após o fetch inicial, se `report.status === "generating" || "pending"`, iniciar um `setInterval` (a cada 4s) que re-consulta apenas `status`, `content`, `editorial_weeks`, `error_message` e `updated_at` da última versão do relatório.
- Quando o status virar `completed` ou `failed`, parar o polling, atualizar o estado e exibir um toast ("Relatório pronto!").
- Limpar o interval no unmount.
- Isso garante que ao voltar para a aba o usuário sempre vê o estado real, mesmo que tenha saído e voltado várias vezes.

### B. Retratos: persistir estado e retomar geração em andamento
Em `src/pages/PortraitGenerator.tsx`:
- Ao montar a página, antes de mostrar o estado vazio, consultar `portrait_generations` do usuário ordenado por `created_at desc limit 1`.
- Se a geração mais recente foi criada há menos de ~5 minutos e ainda não foi exibida nesta sessão, hidratar o grid com aqueles retratos (URLs do bucket) — assim o usuário que saiu durante a geração volta e encontra o resultado salvo.
- Marcar `generating = true` apenas quando a invocação está realmente em curso na sessão atual; ao voltar à aba sem invocação ativa, mostrar o último resultado salvo (se houver) com um aviso suave "Resultado da última geração — clique em Gerar para criar novos".
- Não é necessário polling porque a função salva atomicamente no DB ao terminar.

### C. CTA "Gere agora sua Linha Editorial" no fim do relatório
Em `src/pages/Report.tsx`, ao final do bloco renderizado quando `report.status === "completed"`:
- Adicionar uma seção destacada (Card editorial premium, fora do PDF via `data-hide-pdf`) com:
  - Título: "Próximo passo: sua Linha Editorial"
  - Texto curto: "Transforme sua estratégia em 6 semanas de conteúdo prontas para postar."
  - Botão primário: "Gerar Linha Editorial" → navega para `/editorial`.
- Se `editorial_weeks` já existe e tem conteúdo, trocar o CTA para "Acessar sua Linha Editorial" (mesmo destino).
- Esconder a seção quando estiver gerando ou em fallback.

## Arquivos afetados

- `src/pages/Report.tsx` — polling de status + CTA Linha Editorial
- `src/pages/PortraitGenerator.tsx` — hidratação da última geração ao montar
- (Sem mudanças em edge functions ou banco — a infra de persistência já existe)

## Detalhes técnicos

- Polling: 4s de intervalo, `useEffect` com cleanup, condicional ao status atual.
- Hidratação de retratos: SELECT em `portrait_generations` filtrando por `kept_indices` (respeitando o sistema de descarte já implementado).
- CTA usa `useNavigate` do `react-router-dom` (já importado no projeto).
- Microcopy alinhado à memória do projeto (sem emojis, tom editorial).
