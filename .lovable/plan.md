

# Plano: Tela de confirmação de e-mail após cadastro

## Problema
Após o cadastro, o usuário recebe apenas um toast discreto no canto inferior e é redirecionado para `/login`, onde pode não perceber que precisa confirmar o e-mail.

## Solução
Em vez de redirecionar para `/login` com um toast, redirecionar para uma **página dedicada de confirmação de e-mail** (`/verify-email`) com uma mensagem clara e visível, similar à página `CheckoutSuccess` já existente.

## O que será feito

1. **Criar página `VerifyEmail.tsx`** — Tela centralizada com:
   - Ícone de e-mail grande
   - Título: "Verifique seu e-mail"
   - Mensagem: "Enviamos um link de confirmação para **{email}**. Acesse sua caixa de entrada e clique no link para ativar sua conta."
   - Botão "Ir para o Login"
   - Estilo premium consistente com o restante do app

2. **Alterar `Signup.tsx`** — Após cadastro bem-sucedido, navegar para `/verify-email?email={email}` em vez de `/login`

3. **Adicionar rota em `App.tsx`** — Rota pública `/verify-email`

| Arquivo | Ação |
|---------|------|
| `src/pages/VerifyEmail.tsx` | Criar página |
| `src/pages/Signup.tsx` | Redirecionar para `/verify-email` |
| `src/App.tsx` | Adicionar rota |

