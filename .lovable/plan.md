## Plano

Corrigir apenas a barra flutuante de B/I/U, mantendo a barra lateral como está.

### O que será ajustado

1. **Evento dos botões da barra flutuante**
   - Trocar a aplicação de formatação de `onMouseDown` para `onPointerDown` nos botões.
   - Isso evita que o `preventDefault` do wrapper bloqueie o evento antes do comando ser executado.

2. **Wrapper da barra flutuante**
   - Manter a proteção contra perda de seleção, mas sem impedir que o evento chegue corretamente aos botões.
   - Marcar os botões com `data-inline-format-control`, igual à barra lateral, para o `onBlur` do editor não encerrar a edição.

3. **Sincronização pós-formatação**
   - Após aplicar `bold`, `italic` ou `underline`, preservar a seleção ativa e atualizar o estado pelo `inlineFormatBus`, igual já funciona na barra lateral.

4. **Validação no preview**
   - Selecionar texto no título e aplicar B/I/U pela barra flutuante.
   - Selecionar texto no corpo e aplicar B/I/U pela barra flutuante.
   - Confirmar que apenas o trecho selecionado muda.