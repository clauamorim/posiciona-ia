export const ARCHETYPE_MAP: Record<string, number[]> = {
  "Inocente": [1, 4, 7, 10, 13, 16],
  "Cara-comum": [2, 5, 8, 11, 14, 17],
  "Herói": [3, 6, 9, 12, 15, 18],
  "Cuidador": [19, 22, 25, 28, 31, 34],
  "Explorador": [20, 23, 26, 29, 32, 35],
  "Amante": [21, 24, 27, 30, 33, 36],
  "Rebelde": [37, 40, 43, 46, 49, 52],
  "Criador": [38, 41, 44, 47, 50, 53],
  "Governante": [39, 42, 45, 48, 51, 54],
  "Mago": [55, 58, 61, 64, 67, 70],
  "Sábio": [56, 59, 62, 65, 68, 71],
  "Bobo-da-corte": [57, 60, 63, 66, 69, 72],
};

export const ARCHETYPE_COLORS: Record<string, string> = {
  "Inocente": "hsl(48, 96%, 53%)",
  "Cara-comum": "hsl(25, 75%, 47%)",
  "Herói": "hsl(0, 72%, 51%)",
  "Cuidador": "hsl(152, 56%, 40%)",
  "Explorador": "hsl(200, 80%, 45%)",
  "Amante": "hsl(330, 65%, 55%)",
  "Rebelde": "hsl(0, 0%, 20%)",
  "Criador": "hsl(262, 60%, 50%)",
  "Governante": "hsl(45, 85%, 45%)",
  "Mago": "hsl(270, 50%, 40%)",
  "Sábio": "hsl(210, 50%, 40%)",
  "Bobo-da-corte": "hsl(38, 92%, 50%)",
};

export interface ArchetypeScore {
  name: string;
  score: number;
}

export function calculateScores(
  questions: { id: string; question_number: number }[],
  answers: Record<string, number>
): ArchetypeScore[] {
  const questionMap = new Map(questions.map(q => [q.question_number, q.id]));

  return Object.entries(ARCHETYPE_MAP).map(([name, numbers]) => {
    const score = numbers.reduce((sum, num) => {
      const qId = questionMap.get(num);
      return sum + (qId ? (answers[qId] || 0) : 0);
    }, 0);
    return { name, score };
  }).sort((a, b) => b.score - a.score);
}

export function getTop3(scores: ArchetypeScore[]) {
  return scores.slice(0, 3).map((s, i) => ({
    ...s,
    rank: i + 1,
    classification: i === 0 ? "Primário" : i === 1 ? "Secundário" : "Terciário",
  }));
}
