import type Database from "better-sqlite3";

export function createCatalogSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT NOT NULL UNIQUE,
      barcode TEXT,
      name_en TEXT NOT NULL,
      name_ru TEXT NOT NULL,
      description_en TEXT,
      description_ru TEXT,
      brand TEXT,
      category_id TEXT NOT NULL,
      subcategory_id TEXT NOT NULL,
      price REAL NOT NULL,
      previous_price REAL,
      currency TEXT NOT NULL DEFAULT 'USD',
      unit_type TEXT NOT NULL,
      package_quantity REAL,
      net_weight REAL,
      weight_unit TEXT,
      estimated_weight INTEGER NOT NULL DEFAULT 0,
      ingredients TEXT NOT NULL DEFAULT '[]',
      allergens TEXT NOT NULL DEFAULT '[]',
      dietary_tags TEXT NOT NULL DEFAULT '[]',
      search_terms TEXT NOT NULL DEFAULT '[]',
      stock INTEGER NOT NULL,
      in_stock INTEGER NOT NULL,
      low_stock INTEGER NOT NULL,
      image_value TEXT NOT NULL,
      storage_instructions TEXT,
      country_of_origin TEXT,
      popularity_score REAL NOT NULL,
      data_quality_flags TEXT NOT NULL DEFAULT '[]'
    );
    CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id, in_stock);
    CREATE INDEX IF NOT EXISTS products_price_idx ON products(price);
    CREATE VIRTUAL TABLE IF NOT EXISTS products_fts USING fts5(
      product_id UNINDEXED, name_en, name_ru, brand, description_en, description_ru,
      ingredients, search_terms, tokenize='unicode61 remove_diacritics 2'
    );
    CREATE TABLE IF NOT EXISTS catalog_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      locale TEXT NOT NULL,
      address TEXT NOT NULL,
      slot TEXT NOT NULL,
      payment_last4 TEXT NOT NULL,
      comment TEXT,
      subtotal REAL NOT NULL,
      delivery_fee REAL NOT NULL,
      total REAL NOT NULL,
      items_json TEXT NOT NULL,
      status TEXT NOT NULL
    );
  `);
}
