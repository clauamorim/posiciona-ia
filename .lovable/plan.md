

## Pacote 10 — Linha editorial mais persuasiva, copy do Diagnóstico e Admin com lista de usuários como tela inicial

### 1. Linha editorial e análise do Instagram mais persuasivas (uso real dos PDFs de referência)

**O que muda hoje vs. o que vai mudar:**
- Hoje as edge functions já buscam até 5 PDFs ativos da tabela `reference_documents` e mandam para o Gemini, mas o **prompt não instrui o modelo a usar Obviously Awesome (posicionamento) e Made to Stick (copy memorável)** como referências práticas. O resultado fica genérico para o nicho.
- Agora os prompts vão exigir, explicitamente, que a IA aplique:
  - **StoryBrand**: clareza narrativa (já existe, vai ser reforçado).
  - **Obviously Awesome (April Dunford)**: posicionamento específico — categoria, alternativas, atributos únicos, valor diferenciado para o nicho.
  - **Made to Stick (Heath brothers)**: princípios SUCCES (Simples, Inesperado, Concreto, Crível, Emocional, Histórias) para ganchos, manchetes e legendas.

**Edge function `generate-content-week`:**
- Aumentar `limit(5)` no fetch de PDFs e passar a enviar os PDFs **em todas as semanas**, não só na primeira (semana 1 era a única que recebia o contexto). Mantém o cap de 8MB.
- Reescrever o `systemPrompt` com uma seção "ESTRATÉGIA DE COPY" que obriga:
  - Ganchos no estilo Made to Stick (inesperado + concreto).
  - Posicionamento específico do nicho via Obviously Awesome (citar categoria, alternativa rejeitada, valor único).
  - Proibir abertura genérica do tipo "Você sabia que…", "5 dicas para…", "A importância de…".
  - Cada `caption` deve abrir com gancho específico do nicho do cliente (não da indústria em geral).
  - Cada `card_copy` de carrossel deve ter slide 1 = gancho concreto, slide 2 = problema sentido, slide do meio = insight ou prova, último = CTA específico.
- Adicionar exemplos de "ERRADO (genérico)" vs. "CERTO (específico para o nicho do cliente)" no prompt para calibrar o modelo.
- Bumpar `EDITORIAL_GENERATOR_VERSION` (ex.: `2026-04-24-v2`) em `supabase/functions/_shared/generatorVersion.ts` e em `src/lib/generatorVersion.ts` para que conteúdos antigos fiquem marcados como desatualizados e ganhem regeneração gratuita.

**Edge function `analyze-instagram`:**
- Atualizar o `systemPrompt` para exigir que a sugestão de cada aspecto (Bio, CTA, Destaques, Posts fixados, etc.) seja **fundamentada em pelo menos um dos três PDFs**: StoryBrand, Obviously Awesome ou Made to Stick — sem citar os títulos no texto final, só usá-los como base de raciocínio.
- Reforçar que as 3 opções de bio devem usar princípios de posicionamento (categoria + diferencial + público) e não frases-clichê.

**Edge function `regenerate-single-post`:**
- Aplicar o mesmo reforço no prompt para manter coerência quando o usuário regera um único post.

### 2. Aviso ao usuário durante o Diagnóstico do Negócio

No topo do `src/pages/BusinessQuestionnaire.tsx`, abaixo do header "Diagnóstico do Negócio", adicionar um **callout sóbrio (estilo premium, sem emoji)** com texto:

> Quanto mais detalhadas e específicas forem suas respostas, mais precisa será a análise estratégica e mais persuasiva será a linha editorial gerada para o seu negócio.

- Visual: card discreto com borda lateral (`border-l-2 border-primary/40`), fundo `bg-primary/5`, texto `text-sm text-muted-foreground`.
- Aparece apenas em estado `draft` (não polui quando já está concluído ou em uso).
- Adicionar também uma linha-guia menor em **cada pergunta**, abaixo do `help`, dizendo: "Respostas mais detalhadas geram análises mais precisas." — ou só manter o callout do topo, para evitar repetição. Vou pelo callout no topo + uma frase fina no card da pergunta apenas no step 0.

### 3. Painel Admin com lista de usuários como tela inicial

Hoje `/admin` carrega `AdminDashboard` (cards de métricas + últimos relatórios). Você quer abrir já na lista de usuários.

**Mudanças:**
- Em `src/App.tsx`: trocar o componente da rota `/admin` para `AdminUsers` (ou redirecionar para `/admin/users`). Manter `/admin/users` funcionando como antes.
- Em `src/components/DashboardLayout.tsx`: o item "Painel Admin" do menu admin passa a apontar para `/admin` mas com label **"Usuários"** ou manter "Painel Admin" exibindo a lista. Vamos manter `/admin` → lista de usuários, e remover o item duplicado "Usuários" do menu, deixando só:
  - Painel Admin (lista de usuários) `/admin`
  - Documentos LLM `/admin/documents`
  - Galeria `/admin/gallery`
- Mover o conteúdo atual do `AdminDashboard` (métricas + últimos relatórios) para uma rota nova `/admin/metrics` com link **secundário** dentro da página de usuários (botão "Ver métricas" no canto superior direito), preservando os dados sem poluir a navegação.

### Arquivos envolvidos

- `supabase/functions/generate-content-week/index.ts` — prompt reforçado + PDFs em todas as semanas + bump de versão.
- `supabase/functions/analyze-instagram/index.ts` — prompt reforçado com 3 referências.
- `supabase/functions/regenerate-single-post/index.ts` — alinhar prompt.
- `supabase/functions/_shared/generatorVersion.ts` — bump da versão.
- `src/lib/generatorVersion.ts` — bump da versão (espelho cliente).
- `src/pages/BusinessQuestionnaire.tsx` — callout de orientação.
- `src/App.tsx` — `/admin` agora aponta para `AdminUsers`; nova rota `/admin/metrics` para o painel atual.
- `src/components/DashboardLayout.tsx` — limpar item duplicado do menu admin.
- `src/pages/admin/AdminUsers.tsx` — adicionar botão "Ver métricas" levando para `/admin/metrics`.
- `src/pages/admin/AdminDashboard.tsx` — manter como página acessível em `/admin/metrics`.

### Resultado esperado

- Linha editorial e análise do Instagram passam a usar **StoryBrand + Obviously Awesome + Made to Stick** como base obrigatória, com copy mais específica para o nicho do cliente e ganchos menos genéricos.
- Conteúdos antigos ficam marcados como desatualizados e podem ser regenerados gratuitamente.
- Usuário lê, durante o Diagnóstico, que respostas mais detalhadas geram análises mais precisas.
- Admin abre direto na **lista de usuários**; métricas continuam acessíveis em uma rota dedicada.

