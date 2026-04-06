

# ArcheBrand — Posicionamento de Imagem no Instagram

## Visão Geral
Aplicação SaaS completa para posicionamento de marca no Instagram, combinando arquétipos de marca com a metodologia StoryBrand. O usuário preenche questionários, o sistema calcula seus arquétipos dominantes, envia para IA e gera um relatório estratégico personalizado.

## Stack
- **Frontend**: React + TypeScript + Tailwind + shadcn/ui
- **Backend**: Lovable Cloud (Supabase) — auth, banco, edge functions
- **IA**: Lovable AI Gateway (Gemini) via edge function
- **PDF**: Geração client-side com jsPDF

---

## Banco de Dados

### Tabelas
1. **user_roles** — RBAC (enum: admin, user)
2. **profiles** — nome, telefone, profissão, nicho (trigger on signup)
3. **business_questionnaires** — 12 campos do questionário do negócio, user_id, versão, timestamps
4. **archetype_questions** — id, número (1-72), texto da afirmação, archetype_name
5. **archetype_answers** — user_id, questionnaire_version, question_id, score (1-5)
6. **archetype_scores** — user_id, versão, archetype_name, total_score (calculado)
7. **user_top_archetypes** — user_id, versão, archetype_name, rank (1/2/3), score
8. **reports** — user_id, versão, conteúdo (JSON/texto), status, timestamps

### RLS
- Usuário normal: SELECT/INSERT/UPDATE apenas onde `user_id = auth.uid()`
- Admin: acesso total via função `has_role(auth.uid(), 'admin')`

---

## Telas Principais

### Autenticação
- **Login** — email + senha
- **Cadastro** — nome, email, senha, profissão, nicho

### Fluxo do Usuário (stepper com barra de progresso)
1. **Dashboard** — resumo: status dos questionários, último relatório, ações rápidas
2. **Questionário do Negócio** — formulário com 12 perguntas em etapas (autosave)
3. **Questionário de Arquétipos** — 72 afirmações com slider 1-5, agrupadas em páginas de 12
4. **Resultados** — pontuação de todos os 12 arquétipos (gráfico radar), top 3 destacados
5. **Relatório** — estratégia StoryBrand completa, visualização em tela, botão de download PDF
6. **Histórico** — lista de versões anteriores, comparação

### Painel Administrativo (rota `/admin`)
- **Dashboard Admin** — métricas: total usuários, questionários completos, relatórios gerados
- **Lista de Usuários** — tabela com filtros (nome, email, profissão, nicho, data), ações (ver, bloquear, excluir)
- **Detalhe do Usuário** — todas as respostas, scores, relatórios
- **Exportação** — CSV/Excel de usuários e dados

---

## Lógica de Cálculo dos Arquétipos

Mapeamento fixo das 72 questões para 12 arquétipos (6 questões cada). Soma das respostas por arquétipo → ordenação → top 3 classificados como primário, secundário e terciário. Campo de desempate reservado para regra futura.

---

## Integração com IA (Edge Function)

### Payload enviado
```json
{
  "business": { /* 12 respostas do questionário */ },
  "niche": "área de atuação",
  "archetypes": {
    "primary": { "name": "Herói", "score": 28 },
    "secondary": { "name": "Explorador", "score": 25 },
    "tertiary": { "name": "Criador", "score": 23 }
  }
}
```

### System prompt
Instrução detalhada para gerar relatório StoryBrand com: descrição dos arquétipos, paleta de cores, tipografia, tom de voz, figurino, linha editorial de 7 dias (tema, formato, legenda, CTA).

### Resposta
Texto estruturado em seções, salvo na tabela `reports`.

---

## Relatório Final (exibição + PDF)

Seções:
1. **Arquétipos** — top 3 com descrição e aplicação visual
2. **Identidade Visual** — paleta, tipografia, figurino
3. **Tom de Voz** — diretrizes de comunicação
4. **StoryBrand** — herói, guia, problema, plano, CTA, sucesso, fracasso
5. **Linha Editorial** — 7 dias de conteúdo com tema, formato, legenda e CTA

---

## Permissões (RBAC)

- Rotas `/admin/*` protegidas — redireciona se não for admin
- Todas as queries filtram por `user_id` no lado do banco (RLS)
- Admin bypass via `has_role()` security definer

---

## UX

- Stepper visual com progresso percentual
- Autosave a cada mudança de campo (debounced)
- Skeleton loaders durante carregamento
- Toasts para feedback de ações
- Responsivo mobile-first
- Navegação por sidebar no dashboard, tabs no admin

