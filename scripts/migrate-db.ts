import { getDb, closeDb, databasePath } from "../src/server/db";
import { createCatalogSchema } from "../src/server/catalog/schema";

createCatalogSchema(getDb());
console.log(`SQLite schema is ready at ${databasePath()}.`);
closeDb();
