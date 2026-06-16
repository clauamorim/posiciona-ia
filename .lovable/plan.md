## Diagnóstico

A mensagem `permission denied for function has_role` apareceu porque:

1. A tabela `profiles` tem policies de admin ("Admins can view/update all profiles") que chamam `public.has_role(auth.uid(), 'admin')`.
2. O PostgREST avalia **todas** as policies aplicáveis a uma operação (mesmo as do admin) usando o papel da requisição.
3. Em uma migração antiga (`20260513215650`) o `EXECUTE` em `has_role` foi revogado de `anon` e mantido só para `authenticated` e `service_role`.
4. Quando a cliente abriu o formulário pós-cadastro sem ter ainda uma sessão `authenticated` consolidada (caso típico: e-mail não confirmado, ou a UI tentou salvar antes do token ser persistido pelo SDK), a requisição saiu com o papel `anon` → ao avaliar a policy de admin, o Postgres tentou executar `has_role` como `anon` e bloqueou tudo.

A função é `SECURITY DEFINER`, retorna apenas booleano e só lê `public.user_roles` para um `uuid` informado. Conceder EXECUTE ao `anon` não expõe dados — apenas permite que a expressão da policy seja avaliada (retorna `false` para `auth.uid()` nulo) e a operação seja corretamente negada/permitida pelas demais policies.

## Mudança

Migração única:

```sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon;
```

## Por que isso é seguro

- `has_role` é `SECURITY DEFINER` com `search_path = public` fixo.
- Não revela conteúdo de `user_roles`: aceita um `uuid` e devolve apenas `true`/`false`.
- Com `auth.uid()` nulo (anon), sempre devolve `false`, então policies que dependem dela continuam negando acesso administrativo.
- Restaura o comportamento padrão do Lovable Cloud, onde `has_role` é executável por qualquer papel que possa atingir o PostgREST.

## Validação após aplicar

1. Pedir à cliente para reabrir o cadastro (ou nós reproduzimos com uma conta de teste nova) e preencher "Antes de começar".
2. Confirmar que o `profiles` salva sem erro.
3. Olhar os logs do Postgres para garantir que `permission denied for function has_role` desapareceu.

## Observação paralela

Vale também investigar por que a sessão estava como `anon` no momento do submit (provavelmente a opção de confirmação de e-mail está exigindo confirmação antes do login). Se quiser, em um próximo passo posso: (a) garantir que o onboarding só apareça quando `session?.user` existir, ou (b) ajustar o fluxo para enviar a cliente para `/verify-email` antes do formulário. Mas isso é melhoria de UX — o erro técnico se resolve com o GRANT acima.