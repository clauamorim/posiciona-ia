
## Corrigir o falso “Provedor principal indisponível” nos retratos

### Diagnóstico
O backend não está conseguindo resolver o modelo atual porque o identificador usado está incorreto.

Hoje a função `generate-portrait` usa:
- `PULID_MODEL = "zsxkib/pulid-flux"`

Mas os logs mostram:
- `resolve-version FAIL status=404 body={"detail":"Model not found."}`

A documentação pública do modelo aponta para o identificador canônico:
- `bytedance/flux-pulid`

Ou seja: o token está válido, a conta responde, mas a resolução da versão falha antes da geração principal. Isso força o fallback para Gemini e dispara o toast “Provedor principal indisponível”.

### O que será implementado

#### 1. Corrigir o modelo principal no backend
Arquivo:
- `supabase/functions/generate-portrait/index.ts`

Mudanças:
- Trocar `PULID_MODEL = "zsxkib/pulid-flux"` por `PULID_MODEL = "bytedance/flux-pulid"`
- Manter a chamada correta do Replicate via:
  - `GET /v1/models/{owner}/{name}` para resolver `latest_version.id`
  - `POST /v1/predictions` com `{ version, input }`

#### 2. Ajustar a geração principal para o schema do modelo correto
Manter a estratégia já planejada para PuLID sobre Flux:
- 1 `main_face_image`
- até 3 referências auxiliares
- prompt focado em cenário, iluminação e figurino
- parâmetros de fidelidade facial já configurados

Também vou alinhar os nomes de inputs ao schema documentado do modelo canônico para evitar incompatibilidades silenciosas.

#### 3. Melhorar a lógica de fallback sem expor detalhe técnico ao usuário
Arquivo:
- `src/pages/PortraitGenerator.tsx`

Mudanças:
- Remover o toast com linguagem técnica:
  - “Retrato gerado com motor reserva”
  - “Provedor principal indisponível...”
- Substituir por uma mensagem neutra e premium quando a geração concluir com sucesso
- Manter erro visível apenas quando a geração realmente falhar nos dois caminhos

Resultado:
- se o principal voltar a funcionar, nenhum fallback será mostrado
- se houver fallback bem-sucedido, o usuário continua vendo um sucesso normal, sem detalhe interno de infraestrutura

#### 4. Preservar regras atuais de cobrança e histórico
Sem mudar:
- débito de 1 crédito apenas em geração bem-sucedida
- registro em `credit_logs`
- persistência em `portrait_generations`
- payload atual:
  - `portrait`
  - `provider`
  - `used_fallback`
  - `style_index`

### Validação esperada
Após a correção, ao gerar 1 retrato em `/portraits`, o esperado é:

```text
[portrait] resolved pulid-flux version=<hash>
[portrait] calling replicate model=bytedance/flux-pulid refs=N
[portrait] provider=pulid-flux status=succeeded latency=15-20s
```

Na interface:
- não deve mais aparecer “Provedor principal indisponível”
- o retrato deve sair pelo modelo principal
- o toast final deve ser apenas de sucesso

### Sem mudanças
- frontend de upload e preview
- banco de dados e migrations
- checkout de pacotes
- fluxo de histórico

### Detalhes técnicos
- Causa raiz: identificador de modelo inválido, não problema de token
- Endpoint correto continua sendo `POST /v1/predictions` com `version`
- O modelo canônico disponível publicamente é `bytedance/flux-pulid`
- O fallback para Gemini continua existindo como redundância operacional, mas sem expor essa troca ao usuário final
