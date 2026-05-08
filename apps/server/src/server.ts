import "dotenv/config";
import { buildApp } from "./app.js";
import { loadCardCatalogFromDatabase } from "./cards/card-catalog.js";

const port = Number(process.env.PORT ?? 3333);
const host = process.env.HOST ?? "0.0.0.0";
const cardCatalog = await loadCardCatalogFromDatabase();
const { app } = buildApp({ cardCatalog: cardCatalog ?? undefined });

await app.listen({ port, host });
