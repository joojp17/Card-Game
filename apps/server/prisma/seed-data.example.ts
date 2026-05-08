export const brDeckSeed = {
  slug: "meu-baralho",
  name: "Meu Baralho Local",
  description: "Deck privado usado apenas no meu ambiente.",
  watermark: "LOCAL",
  blackCards: [
    {
      id: "meu-baralho-black-001",
      text: "Exemplo de carta preta com ____.",
      pick: 1
    }
  ],
  whiteCards: [
    {
      id: "meu-baralho-white-001",
      text: "Exemplo de carta branca"
    }
  ]
} as const;
