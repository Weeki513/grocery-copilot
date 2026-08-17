import { getDb, closeDb, databasePath } from "../src/server/db";
import { generateCatalog } from "../src/server/catalog/generator";

const force = process.argv.includes("--force");
const result = generateCatalog(getDb(), { force, seed: 513 });
console.log(result.skipped ? `Catalog already contains ${result.total.toLocaleString()} SKU.` : `Generated exactly ${result.total.toLocaleString()} SKU at ${databasePath()}.`);
closeDb();
