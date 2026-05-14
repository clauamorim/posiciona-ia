// Referências determinísticas por arquétipo — usadas no fallback de relatório
// quando a IA falha em todas as tentativas. Evita o "Apple/Nike/Chanel para
// todo mundo" do template antigo.
//
// As chaves usam os nomes EXATOS dos arquétipos definidos em src/lib/archetypes.ts.

export interface ArchetypeReference {
  characteristics: string[];
  brands: string[];
  people: string[];
}

export const ARCHETYPE_REFERENCES: Record<string, ArchetypeReference> = {
  "Inocente": {
    characteristics: ["otimismo", "simplicidade", "pureza", "esperança", "leveza"],
    brands: ["Coca-Cola", "Dove", "McDonald's", "Disney", "Aveeno"],
    people: ["Doris Day", "Audrey Hepburn", "Fred Rogers", "Forrest Gump", "Maria Montessori"],
  },
  "Cara-comum": {
    characteristics: ["pertencimento", "autenticidade", "simplicidade", "empatia", "praticidade"],
    brands: ["IKEA", "Levi's", "Havaianas", "Casas Bahia", "Volkswagen"],
    people: ["Tom Hanks", "Luciano Huck", "Jamie Oliver", "Anitta", "Drauzio Varella"],
  },
  "Herói": {
    characteristics: ["coragem", "determinação", "disciplina", "superação", "ação"],
    brands: ["Nike", "BMW", "Adidas", "Duracell", "Gatorade"],
    people: ["Cristiano Ronaldo", "Serena Williams", "Anderson Silva", "David Goggins", "Bethany Hamilton"],
  },
  "Cuidador": {
    characteristics: ["acolhimento", "generosidade", "responsabilidade", "compaixão", "presença"],
    brands: ["Johnson & Johnson", "UNICEF", "Pampers", "Volvo", "Natura"],
    people: ["Madre Teresa", "Drauzio Varella", "Michelle Obama", "Mister Rogers", "Ana Maria Braga"],
  },
  "Explorador": {
    characteristics: ["curiosidade", "autenticidade", "independência", "movimento", "descoberta"],
    brands: ["Patagonia", "Jeep", "National Geographic", "The North Face", "Land Rover"],
    people: ["Bear Grylls", "Amyr Klink", "Neil Armstrong", "Yuval Noah Harari", "Anthony Bourdain"],
  },
  "Amante": {
    characteristics: ["sensualidade", "intimidade", "estética", "desejo", "presença"],
    brands: ["Chanel", "Victoria's Secret", "Häagen-Dazs", "Alfa Romeo", "Dior"],
    people: ["Sophia Loren", "Marina Ruy Barbosa", "Beyoncé", "Ricardo Montaner", "Penélope Cruz"],
  },
  "Rebelde": {
    characteristics: ["coragem", "ruptura", "voz disruptiva", "lealdade a valores", "mobilização"],
    brands: ["Harley-Davidson", "Oatly", "Liquid Death", "Virgin", "Nubank"],
    people: ["Elon Musk", "Virgil Abloh", "Gary Vaynerchuk", "Frida Kahlo", "Madonna"],
  },
  "Criador": {
    characteristics: ["originalidade", "imaginação", "estética", "expressão", "construção"],
    brands: ["Lego", "Adobe", "Apple", "Pinterest", "Etsy"],
    people: ["Leonardo da Vinci", "Frida Kahlo", "Hayao Miyazaki", "Tarsila do Amaral", "Tim Burton"],
  },
  "Governante": {
    characteristics: ["autoridade", "ordem", "excelência", "controle", "responsabilidade"],
    brands: ["Rolex", "Mercedes-Benz", "American Express", "Louis Vuitton", "Microsoft"],
    people: ["Rainha Elizabeth II", "Anna Wintour", "Luiza Trajano", "Warren Buffett", "Angela Merkel"],
  },
  "Mago": {
    characteristics: ["transformação", "método", "visão sistêmica", "domínio técnico", "conexão entre mundos"],
    brands: ["Apple", "Dyson", "Tesla", "Masterclass", "Pixar"],
    people: ["Steve Jobs", "Oprah Winfrey", "Carl Sagan", "Walt Disney", "Deepak Chopra"],
  },
  "Sábio": {
    characteristics: ["clareza", "análise", "profundidade", "verdade", "discernimento"],
    brands: ["Google", "Harvard", "BBC", "TED", "The Economist"],
    people: ["Yuval Noah Harari", "Mario Sergio Cortella", "Carl Jung", "Leandro Karnal", "Malcolm Gladwell"],
  },
  "Bobo-da-corte": {
    characteristics: ["humor", "leveza", "espontaneidade", "ousadia", "presença"],
    brands: ["Skol", "Old Spice", "Ben & Jerry's", "Mailchimp", "Burger King"],
    people: ["Whindersson Nunes", "Tatá Werneck", "Ricky Gervais", "Paulo Vieira", "Jimmy Fallon"],
  },
};

export function getArchetypeReference(name: string): ArchetypeReference {
  return ARCHETYPE_REFERENCES[name] || {
    characteristics: ["clareza", "presença", "consistência", "autoridade", "diferenciação"],
    brands: ["Patagonia", "Apple", "Natura"],
    people: ["Oprah Winfrey", "Steve Jobs", "Luiza Trajano"],
  };
}
