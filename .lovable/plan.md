# Redeploy da edge function `admin-manage-user`

## Objetivo
Atualizar a versão em produção da edge function `admin-manage-user` para o código do commit `90e515f` do repositório.

## Passos
1. Verificar se o repositório local está sincronizado com o commit `90e515f` da branch `main` (git pull se necessário).
2. Fazer o deploy da edge function `admin-manage-user` (`supabase/functions/admin-manage-user`) via ferramenta de deploy do Supabase.
3. Confirmar que o deploy foi publicado com sucesso e que a função em produção reflete o código do commit `90e515f`.

## Resultado esperado
A edge function `admin-manage-user` estará rodando a versão mais recente do repositório, alinhada ao commit `90e515f`, sem alterações manuais no código.
