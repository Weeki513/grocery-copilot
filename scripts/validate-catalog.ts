import { getDb, closeDb } from "../src/server/db";
import { createCatalogSchema } from "../src/server/catalog/schema";
import { CATEGORIES } from "../src/server/catalog/taxonomy";

const db = getDb();
createCatalogSchema(db);
const errors: string[] = [];
const total = (db.prepare("SELECT COUNT(*) AS count FROM products").get() as { count: number }).count;
if (total !== 10000) errors.push(`Expected 10,000 products, found ${total}.`);
for (const category of CATEGORIES) {
  const actual = (db.prepare("SELECT COUNT(*) AS count FROM products WHERE category_id = ?").get(category.id) as { count: number }).count;
  if (actual !== category.count) errors.push(`${category.id}: expected ${category.count}, found ${actual}.`);
}
const invalidPrice = (db.prepare("SELECT COUNT(*) AS count FROM products WHERE price <= 0 OR currency != 'USD'").get() as { count: number }).count;
if (invalidPrice) errors.push(`${invalidPrice} products have invalid price or currency.`);
const critical = (db.prepare("SELECT COUNT(*) AS count FROM products WHERE name_en = '' OR name_ru = '' OR category_id = ''").get() as { count: number }).count;
if (critical / Math.max(total, 1) > 0.02) errors.push(`Critical data damage exceeds 2% (${critical} records).`);
if (errors.length) { console.error(errors.join("\n")); closeDb(); process.exit(1); }
console.log(`Catalog valid: ${total.toLocaleString()} SKU, 17 categories, USD pricing, deterministic data quality flags.`);
closeDb();
