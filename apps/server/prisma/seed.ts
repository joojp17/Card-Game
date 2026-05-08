import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const localSeedModulePath = "./seed-data/br-deck.js";

type DeckSeed = {
  slug: string;
  name: string;
  description?: string;
  watermark?: string;
  blackCards: Array<{
    id: string;
    text: string;
    pick: number;
  }>;
  whiteCards: Array<{
    id: string;
    text: string;
  }>;
};

async function main() {
  const brDeckSeed = await loadLocalDeckSeed();
  const deck = await prisma.deck.upsert({
    where: { slug: brDeckSeed.slug },
    create: {
      slug: brDeckSeed.slug,
      name: brDeckSeed.name,
      description: brDeckSeed.description,
      watermark: brDeckSeed.watermark,
      isActive: true
    },
    update: {
      name: brDeckSeed.name,
      description: brDeckSeed.description,
      watermark: brDeckSeed.watermark,
      isActive: true
    }
  });

  await prisma.blackCard.deleteMany({ where: { deckId: deck.id } });
  await prisma.whiteCard.deleteMany({ where: { deckId: deck.id } });

  await prisma.blackCard.createMany({
    data: brDeckSeed.blackCards.map((card, index) => ({
      externalId: card.id,
      deckId: deck.id,
      text: card.text,
      pick: card.pick,
      order: index
    }))
  });

  await prisma.whiteCard.createMany({
    data: brDeckSeed.whiteCards.map((card, index) => ({
      externalId: card.id,
      deckId: deck.id,
      text: card.text,
      order: index
    }))
  });

  console.log(
    `Seeded ${brDeckSeed.name}: ${brDeckSeed.blackCards.length} black cards and ${brDeckSeed.whiteCards.length} white cards.`
  );
}

async function loadLocalDeckSeed(): Promise<DeckSeed> {
  try {
    const seedModule = (await import(localSeedModulePath)) as { brDeckSeed?: DeckSeed };

    if (!seedModule.brDeckSeed) {
      throw new Error("O arquivo local precisa exportar `brDeckSeed`.");
    }

    return seedModule.brDeckSeed;
  } catch (error) {
    throw new Error(
      [
        "Seed local não encontrado.",
        "Crie `apps/server/prisma/seed-data/br-deck.ts` a partir de `apps/server/prisma/seed-data.example.ts`.",
        "Esse arquivo é ignorado pelo Git para não publicar cartas privadas.",
        error instanceof Error ? `Erro original: ${error.message}` : ""
      ]
        .filter(Boolean)
        .join(" ")
    );
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
