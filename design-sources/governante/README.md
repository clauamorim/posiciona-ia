# Cards — Arquétipo Governante

Origem: **Claude Design** (Research Preview), maio/2026.
Projeto Posiciona Editorial, sessão "Cards do Governante".

Material-fonte de templates editoriais pro carrossel de Instagram do arquétipo
**Governante**. Não é código de produção — é o ponto de partida que será
adaptado pra componentes React/TypeScript do editor do Posiciona.

## Conteúdo

| Arquivo | O que é |
|---|---|
| `cards-data.jsx` | Paleta, conteúdo dos 7 cards (cover + 5 cláusulas + close) e mini-componentes compartilhados (eyebrow, rule, diamond). É o "design system" do arquétipo. |
| `cards-sertao.jsx` | **Variação A — Sertão Profundo**: fundo verde cerrado, tipografia em areia, ouro como acento. Editorial clássico com hairline rules. |
| `cards-cartorio.jsx` | **Variação B — Cartório de Bolso**: fundo creme, títulos em verde, numeração em mogno. Grade assimétrica com número gigante na margem. |
| `cards-manuscrito.jsx` | **Variação C — Manuscrito**: split panel verde/areia com proporção variável por card. Numeral dourado atravessando a divisória. |
| `design-canvas.jsx` | UI do canvas estilo Figma usada no Claude Design (NÃO vai pro Posiciona; serve só de referência da intenção visual). |
| `app.jsx` | Composição final que monta 3 variações × 2 formatos no canvas (também só referência). |
| `manifest.json` | **Spec consumível** pelo Posiciona: descreve variações, slots de conteúdo, tokens tweakáveis, formatos, paleta, fontes. |

## Tecnologia de origem vs destino

Esses arquivos rodam **Babel-in-browser com globals em `window`** (padrão do
Claude Design pra prototipagem rápida). Pra entrar em produção no Posiciona,
precisam ser refatorados pra:

- React 18 + TypeScript com imports proper
- Componentes parametrizados via props (não via globals)
- Fontes carregadas no shell do app (não inline)
- Compatibilidade com o sistema de tokens dinâmicos do editor

O `manifest.json` é o contrato entre os dois mundos.

## Variações × Estilos × Formatos

| Variação | Estilo do plano editorial | Formatos | Cards |
|---|---|---|---|
| Sertão Profundo | Minimalista (sem foto) | 4:5, 9:16 | 7 (cover + 5 + close) |
| Cartório de Bolso | Minimalista (sem foto) | 4:5, 9:16 | 7 |
| Manuscrito | Minimalista (sem foto) | 4:5, 9:16 | 7 |

Os estilos **"com foto"** e **"em branco"** previstos no plano editorial maior
ainda precisam ser gerados em sessões futuras do Claude Design.

## Próximos passos

1. ✅ Salvar source + manifest (este commit)
2. Lovable refatora `cards-data.jsx` + `cards-sertao.jsx` em componentes
   React/TS no diretório `src/components/post-templates/governante/`
3. PostCanvas passa a aceitar `template_id` e renderizar via componente
4. Gerador de conteúdo (process-content-generation-job) passa a retornar
   slots compatíveis com o manifest
5. Repetir 1–4 pros outros 11 arquétipos (Mago, Sábio, etc.)
