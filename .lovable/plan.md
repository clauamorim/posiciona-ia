## Escopo

Apenas ajustes de UI/UX nos arquivos listados. Identidade visual preservada (dark navy, roxo `#7C3AED`, dourado, serifa nos headlines). Nenhuma mudança de fluxo, regra de negócio ou backend.

---

### 1. FAB do Assistente — `src/components/assistant/AssistantButton.tsx`

- Ao montar em qualquer rota visível, iniciar em estado **expandido**, mostrando o ícone ✦ + rótulo "Assistente IA" lado a lado, dentro de uma pílula arredondada (`rounded-full`, `bg-primary`, `text-primary-foreground`, padding horizontal maior).
- Após **3s**, animar para o estado colapsado (apenas o ícone circular atual). Animação de largura suave (transition-all, duration ~400ms).
- Manter cor, sombra, animação de hover e o `pulse` de hint atual.
- **Mobile (lg:hidden)**: subir o FAB para `bottom-20` (acima do `BackToTopButton` que fica em `bottom-6`) para não sobrepor. No desktop manter `bottom-5`.
- Ajustar também o offset do `showHint` chip para acompanhar o novo posicionamento mobile.

---

### 2. Dashboard — `src/pages/Dashboard.tsx`

- Remover o parágrafo de subtítulo (`<p>` com `${completedSteps} de ${journeySteps.length} etapas concluídas` / "Sua estratégia está completa…") logo abaixo do `Olá, {nome}` (linhas 206–210).
- Manter o card "Próximo Passo" intacto — ele já contém a frase equivalente.
- O `<h1>` de saudação permanece.

---

### 3. Retratos de Marca — `src/pages/PortraitGenerator.tsx`

Reordenar a região superior da página:

1. **1º** — Card "Saldo de Retratos" (mover o bloco atual das linhas 430–445 para logo abaixo do título).
2. **2º** — Card "Estúdio Pessoal" com botão de gerar (já existe nas linhas 461+, permanece em sequência).
3. **3º** — Botão "Comprar Retratos" como ação secundária, abaixo do Estúdio Pessoal, em variante mais discreta:
   - Remover do header (sair do flex `justify-between` na linha 392).
   - Re-renderizar o `<Dialog>` "Comprar Retratos" como bloco isolado depois do card Estúdio Pessoal, com `variant="outline"`, tamanho `sm`, alinhado à esquerda ou em um wrapper centralizado, opacidade levemente reduzida (`text-muted-foreground` no rótulo) para deixar claro que é ação secundária.
- O header passa a conter apenas título + descrição (sem o botão à direita).

---

### 4. Sidebar — `src/components/DashboardLayout.tsx`

Reorganizar `userGroups` e `footerItems` em 3 grupos com separador visual entre eles:

- **SUA JORNADA** (já existe, mantido): Diagnóstico, Sua História, Arquétipos, Resultados, Narrativa da Marca, Relatório, Instagram, Linha Editorial, Retratos de Marca.
- **CONTEÚDO** (novo grupo dentro de `userGroups`): Meus Designs, Minha Galeria, Histórico.
- **CONTA** (novo grupo, substitui o footer atual): Plano e Créditos, Ajuda, Termos, Privacidade, Sair.

Mudanças concretas:
- Adicionar os dois novos grupos ao array `userGroups` com o mesmo padrão de `label` em uppercase já usado.
- Mover Termos / Privacidade (hoje em link inline) e Sair (hoje botão dedicado) para o grupo CONTA, como itens de menu normais (Sair com ícone `LogOut` e `onClick={signOut}`; Termos / Privacidade como `<Link>` para suas rotas).
- Esvaziar o footer: manter apenas o e-mail do usuário e o `safe-area` padding. Ou remover também o e-mail do footer e exibi-lo acima do grupo CONTA — manter o e-mail no rodapé é ok para preservar UX atual.
- Inserir um `<Separator>` (`@/components/ui/separator`) ou `border-t border-border my-2` entre cada grupo para reforçar a divisão.
- O grupo Dashboard (label vazio) permanece como está, no topo.

---

### 5. Landing Page — `src/pages/LandingPage.tsx` (linhas 420–427)

Atualizar o botão "Ver como funciona":

```tsx
className="bg-white/10 border border-white/30 text-white hover:bg-white/15 text-base h-12 px-8 backdrop-blur-sm"
```

Remover as classes `border-landing-purple/50 text-landing-purple hover:bg-landing-purple/10 hover:text-landing-text`. Manter `variant="outline"` e o tamanho.

---

### 6. Login — `src/pages/Login.tsx`

- **Centralização vertical**: o container já usa `flex min-h-screen items-center justify-center`. O excesso de espaço vem do `<CardHeader>` com logo + título grandes e do botão "Página inicial" absoluto. Ajuste:
  - Reduzir `space-y` do `CardHeader` (de `space-y-2` para `space-y-1`) e o `mb-2` do bloco do logo para `mb-1`.
  - Diminuir o tamanho da logo (`h-12 w-12` → `h-10 w-10`) e do título "Posiciona" (`text-3xl` → `text-2xl`) para reduzir altura total do card.
- **Bordas dos inputs**: aumentar contraste alterando o componente local — adicionar `className="border-white/25 focus-visible:border-white/40"` aos `<Input>` de e-mail e senha. Manter o restante do estilo do `Input` global.

---

### 7. Modal de seleção de estilo — `src/components/post-editor/StyleSelectionModal.tsx`

Três ajustes na primeira etapa (cards Minimalista / Com foto / Com foto IA):

a. **Altura uniforme dos previews no mobile**:
   - Reduzir o padding interno dos cards de `p-3` para `p-2.5`.
   - Trocar o cálculo de `previewSize` para alturas menores e iguais no mobile, mantendo o aspect-ratio no desktop:
     - portrait: `h-24 sm:h-auto sm:aspect-[9/16]`
     - square: `h-24 sm:h-auto sm:aspect-square`
   - Reduzir os ícones internos do preview Minimalista (avatar `w-10 h-10` → `w-8 h-8`, barras com `mb-1` ao invés de `mb-1.5`) para caber melhor.
   - Resultado: no mobile os 3 cards têm preview no topo, título abaixo, sem scroll dentro do card.

b. **Micro-copy quando nada selecionado**: no `DialogFooter` da primeira etapa, abaixo do botão "Abrir com este estilo", renderizar condicionalmente quando `!selected`:

```tsx
{!selected && (
  <p className="text-[11px] text-muted-foreground/60 text-right sm:absolute sm:right-6 sm:-bottom-5">
    Selecione um estilo acima para continuar
  </p>
)}
```

Solução mais simples: posicionar o texto dentro do mesmo footer, abaixo do conjunto de botões, com `w-full text-right` ou em um wrapper que envolva botão + caption.

c. **Reduzir destaque do "Pular e abrir editor vazio"**: trocar classes do `<Button variant="ghost" size="sm">` para incluir `text-xs opacity-50 hover:opacity-80`.

---

## Detalhes técnicos

- Nenhuma alteração em hooks, queries, edge functions, schema ou regras de negócio.
- Tokens semânticos (`bg-card`, `text-muted-foreground`, `border-border`, `text-primary`) preservados; cores landing usam `landing-*` ou os utilitários `white/10` no caso do botão secundário do hero conforme pedido.
- `BackToTopButton` permanece intacto; somente o offset do FAB do assistente sobe no mobile.
- Sidebar mantém `BackToTopButton` e demais comportamentos — mudança é puramente de agrupamento de itens.

## Arquivos a editar

- `src/components/assistant/AssistantButton.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/PortraitGenerator.tsx`
- `src/components/DashboardLayout.tsx`
- `src/pages/LandingPage.tsx`
- `src/pages/Login.tsx`
- `src/components/post-editor/StyleSelectionModal.tsx`
