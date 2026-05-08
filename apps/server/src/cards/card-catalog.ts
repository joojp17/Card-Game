import { PrismaClient } from "@prisma/client";
import { blackCards as fallbackBlackCards, whiteCards as fallbackWhiteCards, type BlackCard, type WhiteCard } from "@cards-against-jewels/shared";

export type CardCatalog = {
  blackCards: BlackCard[];
  whiteCards: WhiteCard[];
};

export const fallbackCardCatalog: CardCatalog = {
  blackCards: fallbackBlackCards,
  whiteCards: fallbackWhiteCards
};

export async function loadCardCatalogFromDatabase(): Promise<CardCatalog | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  const prisma = new PrismaClient();

  try {
    const deck = await prisma.deck.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      include: {
        blackCards: { orderBy: { order: "asc" } },
        whiteCards: { orderBy: { order: "asc" } }
      }
    });

    if (!deck || deck.blackCards.length === 0 || deck.whiteCards.length === 0) {
      return null;
    }

    return {
      blackCards: deck.blackCards.map((card) => ({
        id: card.externalId,
        text: card.text,
        pick: normalizePick(card.pick)
      })),
      whiteCards: deck.whiteCards.map((card) => ({
        id: card.externalId,
        text: card.text
      }))
    };
  } finally {
    await prisma.$disconnect();
  }
}

function normalizePick(pick: number): number {
  return Math.min(3, Math.max(1, pick));
}
