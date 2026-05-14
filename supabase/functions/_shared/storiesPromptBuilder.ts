// Helpers compartilhados para o "Estágio B" (geração das 7 stories da semana).
// Usados tanto pelo worker principal (process-content-generation-job) quanto
// pelo worker de recuperação (process-stories-generation-job) para garantir
// que a regeneração de stories use exatamente o mesmo prompt do fluxo original.

export const FEED_DAYS = [1, 3, 5, 7];

export interface StoryDay {
  day: number;
  theme: string;
  frames: string[];
  is_personal?: boolean;
  mirrors_feed?: boolean;
}

export function buildStoriesSystemPrompt(feedSummary: string, mirrorDays: number[]): string {
  return `Você é um especialista em copy para Instagram Stories. Domina StoryBrand, Obviously Awesome e Made to Stick (descritos ao final).

Sua tarefa: gerar EXATAMENTE 7 sugestões de STORIES para a semana, uma por dia (dias 1 a 7).

⚠️ CRÍTICO — FORMATO DE SAÍDA: array começando com "[" e terminando com "]". SEM \`\`\`, sem texto fora do JSON, sem vírgula final.

ESPELHAMENTO DE TEMA (CRÍTICO):
Nos dias ${mirrorDays.join(", ")} a marca terá um post no feed (resumo abaixo). O story DESSES DIAS deve ABORDAR O MESMO TEMA do post de feed daquele dia, complementando-o (bastidor, dúvida frequente, enquete, depoimento, mini-prova). NÃO copie a copy do feed — explore o tema em formato Stories.

Nos OUTROS 3 dias (sem feed), os stories são livres e devem ter PREDOMINÂNCIA PESSOAL: cenas do cotidiano do criador, hobbies, opiniões, micro-aprendizados, perguntas para a audiência.

# RESUMO DOS POSTS DE FEED DA SEMANA (espelhe nos dias indicados)
${feedSummary}

REGRA DE LINGUAGEM:
PROIBIDO escrever rótulos de framework: "Problema Externo", "O Plano", "Chamada à Ação", "O Herói", "StoryBrand", "Framework", "Posicionamento", "Categoria", "Made to Stick", "Obviously Awesome", "SUCCES".
NUNCA prefixe frames com "Frame 1:", "Story 1:", etc.

ESTILO STORIES:
- Linguagem direta, falada, em primeira pessoa.
- Cada story tem 3 a 5 frames (telas).
- Use formatos típicos do Stories: enquete, caixa de pergunta, slider, quiz, depoimento, bastidor, mini-tutorial, opinião quente.
- Storytelling pessoal: ver bloco "LIMITE PESSOAL PARA STORIES" abaixo (regra crítica).
- Toda evidência concreta (número, caso, métrica) precisa vir do bloco FATOS VERIFICÁVEIS. Sem fato disponível, use pergunta/hipótese sinalizada ("e se...", "imagine que...").
- Nos dias com feed, mirrors_feed=true. Nos demais, mirrors_feed=false.

OUTPUT — array com EXATAMENTE 7 objetos, na ordem dos dias 1..7:
[
  {
    "day": 1,
    "theme": "tema do story",
    "frames": ["texto frame 1", "texto frame 2", "texto frame 3"],
    "is_personal": true,
    "mirrors_feed": false
  }
]

REGRAS ESTRUTURAIS:
- 7 objetos, "day" de 1 a 7 sequencial.
- "frames": 3 a 5 itens, cada um com texto curto (até ~120 caracteres) representando o que vai na tela.
- Português brasileiro.

🟥 LIMITE PESSOAL PARA STORIES (CRÍTICO):
- NO MÁXIMO 1 das 7 stories da semana pode ser pessoal (is_personal=true).
- As demais stories devem ser de TIPOS NÃO-PESSOAIS, escolhendo entre:
  • Dúvida frequente da audiência (com pergunta literal entre aspas)
  • Observação técnica/profissional do nicho (sem vivência pessoal)
  • Comentário sobre uma decisão/erro/acerto comum no mercado
  • Dica prática aplicável (sem narrativa pessoal)
  • Bastidor do TRABALHO (não da vida pessoal): mostrar etapa de atendimento, decisão técnica, ferramenta usada
- NUNCA use hobby, esporte, família, rotina doméstica ou ritual matinal em mais de 1 story por semana.
- Se "bastidor" não estiver sub-representado nesta semana (ver ROTAÇÃO DE PILARES), NENHUMA story pode ser pessoal.`;
}

/**
 * Recuperação robusta de objetos JSON parciais de um array possivelmente
 * truncado. Usa scanner balanceado de chaves (respeita strings/escapes).
 */
export function extractPartialDayObjects(raw: string): any[] {
  const out: any[] = [];
  if (!raw) return out;
  const len = raw.length;
  let i = 0;
  while (i < len) {
    if (raw[i] !== "{") { i++; continue; }
    let depth = 0;
    let inStr = false;
    let escape = false;
    const start = i;
    let end = -1;
    for (let j = i; j < len; j++) {
      const c = raw[j];
      if (escape) { escape = false; continue; }
      if (c === "\\") { escape = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) { end = j; break; }
      }
    }
    if (end === -1) break;
    const slice = raw.slice(start, end + 1);
    try {
      const obj = JSON.parse(slice);
      if (obj && typeof obj === "object" && typeof obj.day === "number") {
        out.push(obj);
      }
    } catch { /* ignora objeto malformado */ }
    i = end + 1;
  }
  return out;
}
