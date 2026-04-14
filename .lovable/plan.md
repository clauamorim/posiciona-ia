

# Plano: Correção de Reanálise, Exibição de Relatório e PDF Estilizado

## Problemas Identificados

1. **Reanálise não regenera relatório**: Quando o usuário desbloqueia os questionários (via reanálise) e resubmete, `Results.tsx` verifica `status === "completed"` no relatório existente e pula toda a geração. Nenhum código reseta o status do relatório para permitir nova geração.

2. **Relatório não mostra figurino/símbolos**: Relatórios gerados antes da adição dessas seções no prompt não possuem os campos `figurino` e `simbolos` no JSON salvo. A interface renderiza condicionalmente (`{content.figurino && ...}`), então esses blocos ficam invisíveis.

3. **PDF não obedece formatação da página**: O PDF atual usa `jsPDF` com texto puro (sem cores, sem paleta visual, sem cards). Precisa ser substituído por `html2canvas` + `html2pdf.js` para capturar a formatação real da tela.

---

## Correções

### 1. Reanálise: resetar status do relatório

**Arquivos:** `src/pages/ArchetypeQuestionnaire.tsx`, `src/pages/BusinessQuestionnaire.tsx`

Quando o usuário executa `handleReanalysis`, após desbloquear o questionário, **também resetar o relatório**:
```ts
await supabase.from("reports").update({ status: "pending", content: null })
  .eq("user_id", user.id).eq("version", 1);
```
Isso garante que ao navegar para `/results`, o sistema detecta que não há relatório `completed` e executa toda a pipeline novamente.

### 2. Relatório sem figurino/símbolos: oferecer regeneração

**Arquivo:** `src/pages/Report.tsx`

Adicionar um aviso no topo do relatório quando `content.figurino` ou `content.simbolos` estiver ausente:
- Mensagem: "Seu relatório foi gerado em uma versão anterior e não inclui figurino e símbolos. Regenere seu relatório para incluir essas seções."
- Botão "Regenerar relatório" que chama a edge function `generate-report` e atualiza o conteúdo no banco.

### 3. PDF com formatação visual (html2canvas + html2pdf.js)

**Arquivo:** `src/pages/Report.tsx`

Substituir o `handleDownloadPDF` atual (jsPDF com texto puro) por:
- Usar `html2canvas` para capturar o container do relatório
- Usar `html2pdf.js` para converter em PDF multi-página
- O PDF refletirá a paleta de cores, cards, badges e toda a formatação visual da tela
- Instalar `html2pdf.js` como dependência

---

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/pages/ArchetypeQuestionnaire.tsx` | Adicionar reset do relatório no `handleReanalysis` |
| `src/pages/BusinessQuestionnaire.tsx` | Adicionar reset do relatório no `handleReanalysis` |
| `src/pages/Report.tsx` | Aviso de seções faltantes + botão regenerar + PDF via html2canvas |
| `package.json` | Adicionar `html2pdf.js` |

