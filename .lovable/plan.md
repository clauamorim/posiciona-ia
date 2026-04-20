

## Fluxo de senha completo

Vou adicionar dois fluxos: **recuperação pública** ("Esqueci minha senha") e **alteração na área logada** ("Alterar senha").

## 1. Recuperação pública (esqueceu a senha)

### Página `/forgot-password` (nova)
- Campo de e-mail + botão "Enviar link de recuperação".
- Chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${origin}/reset-password })`.
- Após envio: tela de confirmação ("Verifique seu e-mail") com instruções e link para voltar ao login.
- Tom premium, mesmo layout visual do `/login`.

### Página `/reset-password` (nova, pública)
- Detecta `type=recovery` no hash da URL (Supabase já cria sessão temporária via link do e-mail).
- Dois campos: nova senha + confirmação.
- Validação: mínimo 8 caracteres, senhas iguais.
- Chama `supabase.auth.updateUser({ password })`.
- Em sucesso: toast + redireciona para `/dashboard`.
- Se acessar sem token válido: mensagem de "Link expirado" + botão para `/forgot-password`.

### Link em `/login`
- Adicionar "Esqueci minha senha" abaixo do campo de senha, alinhado à direita, tom discreto.

## 2. Alteração na área logada

### Nova seção em `HelpPage` (ou nova rota `/account`)
Proposta: criar um **card "Segurança"** dentro de `HelpPage.tsx` (já é a área de configurações do usuário) com:
- Campo "Nova senha" + "Confirmar nova senha".
- Botão "Atualizar senha".
- Chama `supabase.auth.updateUser({ password })`.
- Toast de sucesso/erro.

Não exigirei a senha atual porque o Supabase Auth não valida a senha antiga em `updateUser` — a sessão já está autenticada. Se quiser camada extra de segurança (re-autenticação antes de trocar), posso adicionar depois.

## 3. Roteamento

Em `src/App.tsx`:
- `/forgot-password` → pública
- `/reset-password` → pública (não pode estar atrás de `ProtectedRoute`, senão usuários não logados vindos do e-mail não conseguem acessar)

## 4. E-mail de recuperação

Hoje o Supabase envia o e-mail de recuperação com template padrão (em inglês, marca Supabase). Para manter o padrão premium da marca, **recomendo** customizar o template de auth e-mails (vai exigir configurar domínio de e-mail próprio em Cloud → Emails). 

**Não vou fazer isso nesse plano** — fica como passo opcional separado depois que confirmar que o fluxo funcional está OK.

## Arquivos afetados

- `src/pages/ForgotPassword.tsx` (novo)
- `src/pages/ResetPassword.tsx` (novo)
- `src/pages/Login.tsx` (adicionar link "Esqueci minha senha")
- `src/pages/HelpPage.tsx` (adicionar card "Segurança" com troca de senha)
- `src/App.tsx` (registrar duas rotas novas)

## Fora do escopo

- Customização visual do e-mail de recuperação (Lovable Auth Email Templates).
- Re-autenticação com senha atual antes de trocar.
- 2FA / autenticação em dois fatores.

