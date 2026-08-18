# Redeploy da edge function `stripe-webhook`

## Objetivo

Publicar a versão mais recente do repositório da edge function `stripe-webhook` (commit `ed93549`, já sincronizado no ambiente) no Supabase/Lovable Cloud, sem alterar código.

## Passos

1. Executar o deploy da função `stripe-webhook` via `supabase--deploy_edge_functions`.
2. Aguardar a confirmação de sucesso do deploy.
3. Reportar ao usuário que o redeploy foi concluído e que a versão publicada corresponde ao código atual do repositório (commit `ed93549`).

## Nada muda no código

Nenhum arquivo será editado. É apenas o redeploy explícito da função a partir do código já presente no repositório.
