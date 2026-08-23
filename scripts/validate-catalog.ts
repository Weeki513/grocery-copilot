import { getDb, closeDb } from "../src/server/db";
import { FAMILIES } from "../src/server/catalog/families";
import { packageSizesForFamily } from "../src/server/catalog/packaging";
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

for (const [categoryId, families] of Object.entries(FAMILIES)) {
  for (const family of families) {
    const subcategoryId = `${categoryId}-${family.en.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const rows = db.prepare(`
      SELECT package_quantity AS packageQuantity, net_weight AS netWeight, weight_unit AS weightUnit
      FROM products
      WHERE subcategory_id = ? AND data_quality_flags NOT LIKE '%weight_in_name_only%'
    `).all(subcategoryId) as Array<{ packageQuantity: number | null; netWeight: number | null; weightUnit: string | null }>;
    const actualSizes = new Set(rows.map((row) => {
      if (family.unit === "piece") return Number(row.packageQuantity);
      const multiplier = row.weightUnit === "kg" || row.weightUnit === "l" ? 1000 : 1;
      return Number(row.netWeight) * multiplier;
    }));
    const expectedSizes = packageSizesForFamily(family);
    const unexpected = [...actualSizes].filter((size) => !expectedSizes.includes(size));
    const missing = expectedSizes.filter((size) => !actualSizes.has(size));
    if (unexpected.length || missing.length) {
      errors.push(`${family.en}: packaging profile mismatch (missing: ${missing.join(", ") || "none"}; unexpected: ${unexpected.join(", ") || "none"}).`);
    }
  }
}

if (errors.length) { console.error(errors.join("\n")); closeDb(); process.exit(1); }
console.log(`Catalog valid: ${total.toLocaleString()} SKU, 17 categories, family-specific packaging, USD pricing, deterministic data quality flags.`);
closeDb();
