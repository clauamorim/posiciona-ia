# Diagnóstico

A tipografia por arquétipo já está implementada corretamente no `PostCanvas` (via `getArchetypeTypography`) e a prop `primaryArchetype` é propagada de `PostEditorPage` → `CarouselEditor` → `PostCanvas`.

O bug está na **extração inicial do nome do arquétipo** em `src/pages/PostEditorPage.tsx` (linha 320):

```ts
const primaryArchetype: string | null =
  content?.archetypes?.["1"]?.name ||
  content?.archetypes?.[1]?.name ||
  null;
```

Mas a estrutura real do relatório (gerada em `process-report-generation-job/index.ts` linha 293) usa as chaves `primary | secondary | tertiary`, **não** `1 | 2 | 3`:

```ts
archetypes: {
  primary:   { name, description, ... },
  secondary: { ... },
  tertiary:  { ... },
}
```

Resultado: `primaryArchetype` é sempre `null`, `getArchetypeTypography(null)` retorna o `DEFAULT_TYPO`, e nenhum arquétipo afeta o título visualmente.

# Caminho completo do dado

1. **Origem (Supabase)**: tabela `reports`, coluna `content` (JSONB).
   Estrutura: `content.archetypes.primary.name` (ex.: "Sábio").
2. **Hidratação**: `PostEditorPage.tsx` carrega o relatório e parseia `content` via `reportParser`.
3. **Derivação**: linha 320 monta `primaryArchetype` (ponto bugado).
4. **Propagação**: passado como prop para `CarouselEditor` (l. 1343/1369) e daí para `PostCanvas`.
5. **Uso**: `PostCanvas` chama `getArchetypeTypography(primaryArchetype)`.

# Correção

## 1. `src/pages/PostEditorPage.tsx` (linha 319-323)

Trocar a leitura de chaves numéricas pela estrutura `primary/secondary/tertiary`, com fallback defensivo para `user_top_archetypes` (caso já esteja em contexto) e para as chaves antigas, por segurança:

```ts
const primaryArchetype: string | null =
  content?.archetypes?.primary?.name ||
  content?.archetypes?.["1"]?.name ||
  content?.archetypes?.[1]?.name ||
  null;
```

## 2. `src/components/post-editor/PostCanvas.tsx`

Adicionar `console.log` temporário logo após a resolução de `typo`:

```ts
const typo = getArchetypeTypography(primaryArchetype);
// TEMP debug — remover depois de validar
console.log("[PostCanvas] primaryArchetype:", primaryArchetype, "→ typo:", typo);
```

# Verificação

Abrir um post no editor e conferir no console:
- `primaryArchetype` deve aparecer com o nome real (ex.: "Sábio").
- `typo.titleWeight` deve refletir a configuração do arquétipo (ex.: 300 para Sábio em vez de 400 do default).
- Visualmente, o título do post deve mudar de peso/tamanho conforme o arquétipo do usuário.

# Escopo

Mudanças mínimas, somente apresentação:
- 1 linha de extração corrigida em `PostEditorPage.tsx`.
- 1 `console.log` temporário em `PostCanvas.tsx` para validação.

Nenhuma alteração de regra de negócio, schema ou edge function.
