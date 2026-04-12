

## Plano: Corrigir salvamento do gênero e dados do perfil no cadastro

### Problema
O trigger `handle_new_user` cria o perfil quando o usuário se registra. Logo após, o código tenta fazer um `UPDATE` no perfil com os campos extras (gender, profession, niche, etc.). Porém, como o e-mail ainda não foi confirmado, o usuário não tem sessão autenticada — o RLS bloqueia o update silenciosamente, e os dados se perdem.

### Solução
Passar todos os campos extras via `raw_user_meta_data` no `signUp`, e modificar o trigger `handle_new_user` para extrair esses campos ao criar o perfil.

### Alterações

**1. Editar `src/pages/Signup.tsx`**
- Mover profession, niche, whatsapp, main_goal e gender para `options.data` no `signUp`
- Remover o `update` do perfil após signup (não é mais necessário)

**2. Migração: atualizar trigger `handle_new_user`**
- Extrair `profession`, `niche`, `whatsapp`, `main_goal` e `gender` de `NEW.raw_user_meta_data`
- Incluir esses campos no `INSERT INTO profiles`

| Ação | Arquivo |
|------|---------|
| Editar | `src/pages/Signup.tsx` |
| Migração | Atualizar função `handle_new_user` |

