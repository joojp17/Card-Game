import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { brDeckSeed } from "./seed-data/br-deck.js";

const prisma = new PrismaClient();

async function main() {
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

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
