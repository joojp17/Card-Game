-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "watermark" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlackCard" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "pick" INTEGER NOT NULL DEFAULT 1,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlackCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhiteCard" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhiteCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Deck_slug_key" ON "Deck"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BlackCard_externalId_key" ON "BlackCard"("externalId");

-- CreateIndex
CREATE INDEX "BlackCard_deckId_order_idx" ON "BlackCard"("deckId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "WhiteCard_externalId_key" ON "WhiteCard"("externalId");

-- CreateIndex
CREATE INDEX "WhiteCard_deckId_order_idx" ON "WhiteCard"("deckId", "order");

-- AddForeignKey
ALTER TABLE "BlackCard" ADD CONSTRAINT "BlackCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhiteCard" ADD CONSTRAINT "WhiteCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
