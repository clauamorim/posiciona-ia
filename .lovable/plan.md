## Plano de Alteracoes nos Prompts de Retrato

### Arquivos e Mudancas

1. **`supabase/functions/generate-portrait/index.ts`**
   - **Linha ~266**: alterar `const MAX_REFERENCES_TO_SEND = 5;` para `3`.
   - **Linhas ~111-114**: dentro de `generateOnePortrait`, inverter a ordem do array `userContent` para que as imagens de referencia sejam inseridas **antes** do bloco de texto do prompt. Isso segue a recomendacao de que o Gemini presta mais atencao ao conteudo que vem primeiro.

2. **`supabase/functions/_shared/portraitPrompts.ts`**
   - **Linha ~713**: no primeiro item de `sceneParts`, substituir a diretriz `PHOTOGRAPHIC REALISM ONLY... Canon EOS R5...` por `DOCUMENTARY PORTRAIT PHOTOGRAPH... Kodak Portra 400 35mm film... press archive portrait`.
   - **Linha ~743**: substituir a diretriz de `Lighting: soft natural studio lighting from a large softbox...` por uma versao que enfatiza luz de janela simples, sombras visiveis sob o maxilar/nariz (sem preenchimento total), um unico catchlight por olho e advertencia explicita contra o "beauty ad lighting" artificial.

### Fora do Escopo
Nenhuma outra logica de geracao, cobranca, polling, upload ou prompt sera alterada.