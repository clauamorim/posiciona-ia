## Objetivo

Resolver três problemas no Admin:
1. Após login, admin cai em `/dashboard` (vazio para ele) em vez de `/admin`.
2. A tabela de usuários fica espremida em `max-w-4xl` (4xl ≈ 896px), forçando scroll horizontal — só dá pra navegar com seta do teclado.
3. No mobile, a tabela é praticamente inutilizável (muitas colunas, scroll horizontal).

## Mudanças

### 1. Login redireciona admin para `/admin`
**Arquivo:** `src/pages/Login.tsx`
- No `useEffect` que escuta `loginTriggered + user`, verificar `isAdmin` do `useAuth()` e redirecionar para `/admin` se for admin, senão `/dashboard`.

### 2. Layout admin em largura total
**Arquivo:** `src/components/DashboardLayout.tsx`
- Adicionar prop opcional `wide?: boolean` (default `false`).
- Quando `wide`, trocar `max-w-4xl mx-auto` por `max-w-[1400px] mx-auto` (mantém respiro nas telas muito largas, mas libera espaço real para tabelas).

### 3. AdminUsers: tabela densa no desktop, cards no mobile
**Arquivo:** `src/pages/admin/AdminUsers.tsx`
- Passar `wide` para `<DashboardLayout wide>`.
- **Desktop (lg+)**: manter `<Table>` mas:
  - Compactar colunas: juntar "Plano" + "Status" numa coluna só (ex: badge "Premium · Ativo" / "—  · Bloqueado").
  - Encurtar "Último Login" para `dd/mm/aa` (sem hora) — economiza largura.
  - Substituir os 5 botões-ícone de ação por um único botão `···` que abre um `DropdownMenu` com: Ver detalhes, Atribuir plano, Editar créditos, Confirmar e-mail, Bloquear/Desbloquear, Excluir.
  - Aplicar `whitespace-nowrap` em colunas curtas e `truncate max-w-[200px]` em e-mail/nome para evitar quebras feias.
- **Mobile (<lg)**: esconder a `<Table>` (`hidden lg:block` no wrapper) e renderizar uma lista de `<Card>` empilhados, cada um mostrando:
  - Nome + profissão/nicho
  - E-mail
  - Plano + Status (badges)
  - Último login
  - Badges de jornada (BQ, QA, RE, NM, IG, LE, RT)
  - Botão "Ações" (mesmo dropdown do desktop)

### 4. AdminDashboard, AdminDocuments, AdminGallery em largura total
- Passar `wide` para `<DashboardLayout wide>` nos três para consistência (sem outras mudanças estruturais agora).

## Fora de escopo
- Não vou refazer o design do AdminDashboard nem mexer na lógica de carregamento de dados.
- Não vou criar paginação na tabela (o filtro por nome/e-mail/profissão já existe).

## Resultado esperado
- Admin loga e cai direto em `/admin` (lista de usuários).
- Tabela ocupa até 1400px de largura, sem scroll horizontal em telas ≥1280px.
- No mobile, cada usuário vira um card legível com todas as ações acessíveis via menu `···`.
