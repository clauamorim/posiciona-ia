

# Retratos de Marca via Upload de Selfies

## Visão geral

Nova página onde o usuário faz upload de 1 a 5 selfies. A IA gera retratos estilizados aplicando as características visuais do relatório (paleta de cores, estilo visual, tipografia) e a personalidade dos arquétipos (ex: "Mago" = tons místicos, "Governante" = postura autoritária, "Rebelde" = estilo ousado).

## Fluxo do usuário

1. Acessa "Retratos de Marca" no menu lateral
2. Faz upload de 1-5 selfies (arrastando ou clicando)
3. Vê preview das imagens selecionadas
4. Clica "Gerar Retratos"
5. A edge function busca arquétipos + identidade visual do relatório
6. Para cada selfie, chama o modelo de edição de imagem (Gemini 3.1 Flash Image) com prompt baseado nos dados de marca
7. Retratos gerados aparecem em grid com botão de download individual e "Baixar Todos" (ZIP)

## Alterações

### Nova edge function: `supabase/functions/generate-portrait/index.ts`
- Recebe `{ selfies: string[] }` (array de base64, 1-5 imagens)
- Busca `user_top_archetypes` (top 3) e `reports.content.visual_identity` do usuário
- Monta prompt de edição baseado em: paleta de cores, estilo visual, arquétipos dominantes
- Para cada selfie, chama `google/gemini-3.1-flash-image-preview` (edit-image) via Lovable AI Gateway
- Retorna array de imagens base64 geradas
- Trata erros 429/402

### Nova página: `src/pages/PortraitGenerator.tsx`
- Upload múltiplo (1-5 imagens, máx 5MB cada)
- Preview das selfies com opção de remover individualmente
- Verificação de pré-requisitos (arquétipos + relatório completo)
- Grid dos retratos gerados com download individual (PNG) e "Baixar Todos" (ZIP via jszip)
- Loading state com progresso (ex: "Gerando retrato 2 de 3...")

### `src/App.tsx`
- Adicionar rota `/portraits`

### `src/components/DashboardLayout.tsx`
- Adicionar item "Retratos de Marca" no menu lateral

## Detalhes técnicos

- **Modelo**: `google/gemini-3.1-flash-image-preview` — rápido e com qualidade pro para edição
- **Prompt de edição**: construído dinamicamente a partir dos dados do usuário, ex: "Transform this selfie into a professional brand portrait. Apply a color palette of [cores]. The style should evoke [arquétipo primário] archetype: [descrição]. Maintain facial features and likeness. Style: [visual_identity.style]"
- **Limite**: 5 selfies por vez para controlar custo/tempo
- **ZIP**: usa `jszip` (já instalado) para download em lote

| Arquivo | Ação |
|---------|------|
| `supabase/functions/generate-portrait/index.ts` | Criar — edge function de geração |
| `src/pages/PortraitGenerator.tsx` | Criar — página de upload e galeria |
| `src/App.tsx` | Adicionar rota `/portraits` |
| `src/components/DashboardLayout.tsx` | Adicionar menu item |

