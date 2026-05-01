## Plano para corrigir o histórico de retratos

### Diagnóstico
- As gerações existem no banco e têm 3 retratos salvos em `portrait_generations`.
- Os arquivos também existem no bucket privado `portrait-outputs`.
- O problema provável está na resolução das URLs assinadas no front: o histórico tenta gerar signed URLs diretamente pelo cliente. Como os objetos foram gravados pela função de backend, aparecem com `owner_id` nulo no storage; isso pode fazer a política de acesso do storage bloquear a geração/uso das URLs no navegador.

### Correção proposta
1. **Criar uma função de backend para listar retratos do histórico**
   - Nova função `portrait-history`.
   - Ela valida o usuário logado.
   - Busca `portrait_generations` do próprio usuário.
   - Extrai retratos nos dois formatos:
     - legado: string/base64/path
     - novo: objeto com `storage_path` e metadados
   - Gera signed URLs com credencial de backend, evitando falha por política de storage.

2. **Atualizar `HistoryPage.tsx`**
   - Trocar a leitura direta de `portrait_generations` + `resolvePortraitUrls` por chamada à função `portrait-history`.
   - Manter relatórios e análises como estão.
   - Renderizar os retratos retornados já com URL válida.
   - Se a função falhar, mostrar o estado vazio sem quebrar a página.

3. **Atualizar também o editor de posts**
   - O editor (`PostEditorPage.tsx`) tem o mesmo padrão antigo: só pega strings e ignora objetos novos.
   - Reutilizar `portrait-history` ali para que os retratos gerados também apareçam no seletor de imagens do editor.

4. **Ajuste complementar de estabilidade**
   - Criar um pequeno normalizador compartilhado no front, se necessário, para evitar duplicar parsing.
   - Preservar downloads e preview como estão.

### O que não muda
- Não altera schema do banco.
- Não apaga nem migra retratos existentes.
- Não mexe na geração dos retratos nem nos créditos.
- Não expõe bucket publicamente; continua privado.