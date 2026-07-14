## Objetivo

Refazer o deploy explícito da edge function **`stripe-webhook`** (não a `stripe-checkout`) e confirmar o horário via logs.

## Passos

1. **Redeploy** da `stripe-webhook` sem alterar nenhum arquivo — apenas dispara nova versão em produção com o código atual do repositório (que já usa `constructEventAsync`).
2. **Verificar logs** em `function_edge_logs` filtrando por `boot`/`shutdown` da `stripe-webhook` para capturar timestamp + `deployment_id` + `version` da nova instância.
3. **Reportar** o horário exato (UTC + BRT) e a versão implantada.

## Se os logs não aparecerem

Se a pipeline de logs estiver com delay (como aconteceu antes), reporto isso claramente e aguardo alguns minutos antes de reconsultar — sem refazer deploy em loop.

## Nada muda no código

Nenhum arquivo é editado. É apenas redeploy + verificação.

Aprova?