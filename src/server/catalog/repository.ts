import type { Product } from "@/lib/types";
import { getDb, isCatalogReadOnly } from "@/server/db";
import { CATALOG_VERSION, generateCatalog } from "./generator";
import { createCatalogSchema } from "./schema";

type ProductRow = Record<string, string | number | null>;

function parseArray(value: unknown): string[] {
  try { return JSON.parse(String(value || "[]")) as string[]; } catch { return []; }
}

export function rowToProduct(row: ProductRow): Product {
  return {
    id: String(row.id), sku: String(row.sku), barcode: row.barcode ? String(row.barcode) : undefined,
    localeData: {
      en: { name: String(row.name_en), description: row.description_en ? String(row.description_en) : undefined },
      ru: { name: String(row.name_ru), description: row.description_ru ? String(row.description_ru) : undefined },
    },
    brand: row.brand ? String(row.brand) : undefined, categoryId: String(row.category_id), subcategoryId: String(row.subcategory_id),
    price: Number(row.price), previousPrice: row.previous_price ? Number(row.previous_price) : undefined, currency: "USD",
    unitType: String(row.unit_type) as Product["unitType"], packageQuantity: row.package_quantity ? Number(row.package_quantity) : undefined,
    netWeight: row.net_weight ? Number(row.net_weight) : undefined, weightUnit: row.weight_unit ? String(row.weight_unit) as Product["weightUnit"] : undefined,
    estimatedWeight: Boolean(row.estimated_weight), ingredients: parseArray(row.ingredients), allergens: parseArray(row.allergens),
    dietaryTags: parseArray(row.dietary_tags), searchTerms: parseArray(row.search_terms), stock: Number(row.stock),
    inStock: Boolean(row.in_stock), lowStock: Boolean(row.low_stock), imageType: "emoji", imageValue: String(row.image_value),
    storageInstructions: row.storage_instructions ? String(row.storage_instructions) : undefined,
    countryOfOrigin: row.country_of_origin ? String(row.country_of_origin) : undefined,
    popularityScore: Number(row.popularity_score), dataQualityFlags: parseArray(row.data_quality_flags),
  };
}

export function ensureCatalog() {
  const db = getDb();
  if (!isCatalogReadOnly()) createCatalogSchema(db);
  const count = (db.prepare("SELECT COUNT(*) AS count FROM products").get() as { count: number }).count;
  const version = Number((db.prepare("SELECT value FROM catalog_meta WHERE key = 'catalog_version'").get() as { value?: string } | undefined)?.value || 0);
  if (count !== 10000 || version !== CATALOG_VERSION) {
    if (isCatalogReadOnly()) throw new Error(`Catalog artifact is invalid: expected 10,000 SKU at version ${CATALOG_VERSION}, got ${count} at version ${version}.`);
    generateCatalog(db, { force: true, seed: 513 });
  }
  return db;
}

export function getProduct(id: string) {
  const row = ensureCatalog().prepare("SELECT * FROM products WHERE id = ?").get(id) as ProductRow | undefined;
  return row ? rowToProduct(row) : undefined;
}

export function getProductsByIds(ids: string[]) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const rows = ensureCatalog().prepare(`SELECT * FROM products WHERE id IN (${placeholders})`).all(...ids) as ProductRow[];
  const map = new Map(rows.map((row) => [String(row.id), rowToProduct(row)]));
  return ids.flatMap((id) => map.get(id) || []);
}

export function getProductsBySubcategory(subcategoryId: string, limit = 20) {
  const rows = ensureCatalog().prepare(`SELECT * FROM products WHERE subcategory_id = ? AND in_stock = 1 AND stock > 0
    ORDER BY price ASC, popularity_score DESC LIMIT ?`).all(subcategoryId, Math.min(Math.max(limit, 1), 100)) as ProductRow[];
  return rows.map(rowToProduct);
}

export function minimumInStockPrice() {
  return Number((ensureCatalog().prepare("SELECT MIN(price) AS price FROM products WHERE in_stock = 1 AND stock > 0").get() as { price: number | null }).price || 0);
}

function ftsQuery(raw: string) {
  return raw.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 1).slice(0, 8).map((word) => `"${word.replaceAll('"', '""')}"*`).join(" OR ");
}

export type SearchProductOptions = { query?: string; category?: string; limit?: number; offset?: number; inStock?: boolean; maxPrice?: number };

export function searchProductPage(options: SearchProductOptions = {}) {
  const db = ensureCatalog();
  const limit = Math.min(Math.max(options.limit || 24, 1), 150);
  const offset = Math.min(Math.max(options.offset || 0, 0), 9999);
  const where: string[] = [];
  const params: Array<string | number> = [];
  if (options.category && options.category !== "all") { where.push("p.category_id = ?"); params.push(options.category); }
  if (options.inStock) where.push("p.in_stock = 1");
  if (options.maxPrice) { where.push("p.price <= ?"); params.push(options.maxPrice); }
  const query = options.query?.trim();
  if (query) {
    const match = ftsQuery(query);
    if (!match) return { products: [], total: 0, limit, offset };
    const total = (db.prepare(`SELECT COUNT(*) AS count
      FROM products_fts JOIN products p ON p.id = products_fts.product_id
      WHERE products_fts MATCH ? ${where.length ? `AND ${where.join(" AND ")}` : ""}`).get(match, ...params) as { count: number }).count;
    const rows = db.prepare(`SELECT p.*, bm25(products_fts, 0, 5, 5, 1, 2, 2, 1, 3) AS rank
      FROM products_fts JOIN products p ON p.id = products_fts.product_id
      WHERE products_fts MATCH ? ${where.length ? `AND ${where.join(" AND ")}` : ""}
      ORDER BY rank ASC, p.popularity_score DESC LIMIT ? OFFSET ?`).all(match, ...params, limit, offset) as ProductRow[];
    return { products: rows.map(rowToProduct), total, limit, offset };
  }
  const total = (db.prepare(`SELECT COUNT(*) AS count FROM products p ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`).get(...params) as { count: number }).count;
  const rows = db.prepare(`SELECT p.* FROM products p ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY p.in_stock DESC, (p.previous_price IS NOT NULL) DESC, p.popularity_score DESC LIMIT ? OFFSET ?`).all(...params, limit, offset) as ProductRow[];
  return { products: rows.map(rowToProduct), total, limit, offset };
}

export function searchProducts(options: SearchProductOptions = {}) {
  return searchProductPage(options).products;
}

export function catalogStats() {
  const db = ensureCatalog();
  const total = (db.prepare("SELECT COUNT(*) AS count FROM products").get() as { count: number }).count;
  const inStock = (db.prepare("SELECT COUNT(*) AS count FROM products WHERE in_stock = 1").get() as { count: number }).count;
  const dirty = (db.prepare("SELECT COUNT(*) AS count FROM products WHERE data_quality_flags != '[]'").get() as { count: number }).count;
  const categories = db.prepare("SELECT category_id AS id, COUNT(*) AS count FROM products GROUP BY category_id ORDER BY category_id").all() as { id: string; count: number }[];
  return { total, inStock, dirty, categories };
}
