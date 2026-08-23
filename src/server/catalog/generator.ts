import type Database from "better-sqlite3";
import type { Product } from "@/lib/types";
import { CATEGORIES, CATEGORY_TOTAL } from "./taxonomy";
import { FAMILIES, type Family } from "./families";
import { packageSizesForFamily } from "./packaging";
import { createCatalogSchema } from "./schema";

export const CATALOG_VERSION = 7;

const BRANDS = ["Northfield", "Daymark", "Common Table", "Blue Harbor", "Greenhouse", "Morrow", "Juniper", "Field & Fork", "Noma", "Riverside"];
const ORIGINS = ["Italy", "Spain", "United States", "Greece", "Turkey", "France", "Netherlands", "Mexico"];
const VARIANTS = ["Classic", "Organic", "Everyday", "Select", "Farmhouse", "Original", "Premium", "Simple"];

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)];
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function productDescription(family: Family, categoryId: string, index: number) {
  const descriptions: Record<string, Array<[string, string]>> = {
    pantry: [
      [`${family.en} with a reliable texture and flavour for soups, sides and weeknight recipes.`, `${family.ru}: универсальная основа для супов, гарниров и домашних блюд.`],
      [`A practical pack of ${family.en.toLowerCase()} for keeping the pantry ready for everyday meals.`, `${family.ru} в удобной упаковке — продукт, который полезно держать в запасе.`],
    ],
    drinks: [[`A refreshing ${family.en.toLowerCase()} with a clean taste, ready to chill and serve.`, `${family.ru} с чистым освежающим вкусом — охладите перед подачей.`]],
    dairy: [[`${family.en} with a smooth, fresh taste for breakfasts, sauces and baking.`, `${family.ru} с мягким свежим вкусом — для завтраков, соусов и выпечки.`]],
    snacks: [[`${family.en} with a satisfying bite, packed for sharing or a quick snack.`, `${family.ru} с приятной текстурой — удобно взять с собой или разделить с близкими.`]],
    produce: [
      [`${family.en}, selected for good texture, colour and dependable freshness.`, `«${family.ru}»: свежий отборный продукт с хорошей текстурой и ровным качеством.`],
      [`Carefully selected ${family.en.toLowerCase()}, suitable for roasting, simmering or serving fresh.`, `«${family.ru}»: подходит для запекания, тушения или подачи в свежем виде.`],
    ],
    meat: [[`Fresh ${family.en.toLowerCase()} with a clean cut and versatile flavour for roasting, grilling or pan cooking.`, `Свежее мясо «${family.ru}» с аккуратной разделкой — для жарки, запекания или гриля.`]],
    seafood: [[`${family.en} with a delicate flavour and firm texture, suitable for quick pan or oven cooking.`, `${family.ru} с нежным вкусом и плотной текстурой — для быстрой жарки или запекания.`]],
    frozen: [[`${family.en} frozen soon after preparation to preserve texture and make meal prep convenient.`, `${family.ru}: заморожено для сохранения текстуры и удобного приготовления без лишней подготовки.`]],
    ready: [[`${family.en} prepared for a quick, satisfying meal when there is no time to cook from scratch.`, `${family.ru}: готовое решение для быстрого и сытного приёма пищи.`]],
    bakery: [[`Freshly packed ${family.en.toLowerCase()} with a soft centre and balanced crust.`, `${family.ru} со свежим мякишем и приятной корочкой, аккуратно упакован для доставки.`]],
    condiments: [[`${family.en} for adding a clear, balanced accent to marinades, dressings and cooked dishes.`, `${family.ru} помогает точно дополнить вкус маринадов, заправок и горячих блюд.`]],
    breakfast: [[`${family.en} for a quick breakfast with an easy texture and straightforward preparation.`, `${family.ru}: простой и удобный вариант для быстрого завтрака.`]],
    baby: [[`${family.en} with a smooth consistency in a portion designed for convenient feeding.`, `${family.ru} с однородной текстурой в удобной порции для кормления.`]],
    cleaning: [[`${family.en} formulated for routine kitchen cleaning and removing everyday marks from washable surfaces.`, `${family.ru}: средство для регулярной уборки кухни и удаления бытовых загрязнений с моющихся поверхностей.`]],
    personal: [[`${family.en} with a gentle cleansing formula suitable for frequent everyday use.`, `${family.ru} с мягкой очищающей формулой для частого ежедневного использования.`]],
    pets: [[`${family.en} in a practical serving format for a familiar, convenient pet meal.`, `${family.ru} в удобном формате порции для привычного ежедневного кормления питомца.`]],
    household: [[`Strong, absorbent ${family.en.toLowerCase()} for wiping counters, handling spills and everyday household tasks.`, `${family.ru}: прочные впитывающие листы для столешниц, пролитой жидкости и повседневных домашних задач.`]],
  };
  const options = descriptions[categoryId] || [[`${family.en} in a practical pack with clear product information.`, `${family.ru} в практичной упаковке с понятной информацией о товаре.`]];
  const [en, ru] = options[index % options.length];
  return { en, ru };
}

function packageFor(family: Family, familyVariantIndex: number) {
  const sizes = packageSizesForFamily(family);
  const amount = sizes[familyVariantIndex % sizes.length];
  if (family.unit === "piece") {
    return { packageQuantity: amount, netWeight: undefined, weightUnit: undefined, suffixEn: `${amount} pc`, suffixRu: `${amount} шт` } as const;
  }
  const unit = amount >= 1000 ? (family.unit === "ml" ? "l" : "kg") : family.unit;
  const display = amount >= 1000 ? amount / 1000 : amount;
  return {
    packageQuantity: 1,
    netWeight: amount >= 1000 ? amount / 1000 : amount,
    weightUnit: unit,
    suffixEn: `${display} ${unit}`,
    suffixRu: `${display} ${unit === "l" ? "л" : unit === "kg" ? "кг" : unit === "ml" ? "мл" : "г"}`,
  } as const;
}

export function createProduct(categoryId: string, categoryIndex: number, globalIndex: number, seed = 513): Product {
  const random = mulberry32(seed + globalIndex * 9973);
  const familyCount = FAMILIES[categoryId].length;
  const family = FAMILIES[categoryId][categoryIndex % familyCount];
  const familyVariantIndex = Math.floor(categoryIndex / familyCount);
  const variant = VARIANTS[familyVariantIndex % VARIANTS.length];
  const brand = globalIndex % 41 === 0 ? undefined : pick(BRANDS, random);
  const pack = packageFor(family, familyVariantIndex);
  const priceProfile: Record<string, [number, number]> = {
    seafood: [6, 6], meat: [4, 5], produce: [.9, 2.6], pantry: [.9, 2.8],
    condiments: [1.4, 3.4], dairy: [1.8, 3.8], bakery: [1.2, 2.5], frozen: [1.7, 3.8],
    snacks: [1.3, 3.5], drinks: [1.1, 3.2], breakfast: [1.2, 3], ready: [2.8, 4.8],
  };
  const [basePrice, spread] = priceProfile[categoryId] || [1.2, 4.5];
  const price = money(basePrice + random() * spread + (pack.netWeight || pack.packageQuantity || 1) / 900);
  const hasDiscount = globalIndex % 9 === 0;
  const outOfStock = globalIndex % 29 === 0;
  const stock = outOfStock ? 0 : 2 + Math.floor(random() * 46);
  const qualityFlags: string[] = [];
  const weightOnlyInName = globalIndex % 89 === 0;
  const mismatchedLowStock = globalIndex % 97 === 0;
  const duplicateLike = globalIndex % 127 === 0;
  if (weightOnlyInName) qualityFlags.push("weight_in_name_only");
  if (mismatchedLowStock) qualityFlags.push("stock_flag_mismatch");
  if (duplicateLike) qualityFlags.push("near_duplicate");
  if (globalIndex % 211 === 0) qualityFlags.push("incomplete_ingredients");

  const cleanEn = `${variant} ${family.en}`;
  const cleanRu = `${family.ru} ${variant === "Organic" ? "органик" : variant === "Classic" ? "классические" : ""}`.trim();
  const nameEn = `${cleanEn} · ${pack.suffixEn}`;
  const nameRu = `${cleanRu} · ${pack.suffixRu}`;
  const id = `prd_${String(globalIndex + 1).padStart(5, "0")}`;
  const description = productDescription(family, categoryId, globalIndex);

  return {
    id,
    sku: `SKU-${String(globalIndex + 1).padStart(5, "0")}`,
    barcode: `840${String(1000000000 + globalIndex).slice(-10)}`,
    localeData: {
      en: { name: duplicateLike ? nameEn.replace(variant, "Original") : nameEn, description: description.en },
      ru: { name: nameRu, description: description.ru },
    },
    brand,
    categoryId,
    subcategoryId: `${categoryId}-${family.en.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    price,
    previousPrice: hasDiscount || globalIndex % 101 === 0 ? money(price * (1.1 + random() * 0.22)) : undefined,
    currency: "USD",
    unitType: family.unit === "piece" ? "pack" : categoryId === "produce" && globalIndex % 4 === 0 ? "weight" : "pack",
    packageQuantity: pack.packageQuantity,
    netWeight: weightOnlyInName ? undefined : pack.netWeight,
    weightUnit: weightOnlyInName ? undefined : pack.weightUnit,
    estimatedWeight: categoryId === "produce" && globalIndex % 4 === 0,
    ingredients: globalIndex % 211 === 0 ? undefined : family.ingredients || [family.en.toLowerCase()],
    allergens: family.allergens || [],
    dietaryTags: family.tags || [],
    searchTerms: [...family.terms, family.en.toLowerCase(), family.ru.toLowerCase(), variant.toLowerCase()],
    stock,
    inStock: stock > 0,
    lowStock: mismatchedLowStock ? stock > 12 : stock > 0 && stock < 6,
    imageType: "emoji",
    imageValue: family.emoji,
    storageInstructions: categoryId === "dairy" || categoryId === "meat" || categoryId === "seafood" ? "Keep refrigerated at 0–5°C" : "Store in a cool, dry place",
    countryOfOrigin: pick(ORIGINS, random),
    popularityScore: Math.round(random() * 1000) / 10,
    dataQualityFlags: qualityFlags,
  };
}

export function generateCatalog(db: Database.Database, options: { force?: boolean; seed?: number } = {}) {
  createCatalogSchema(db);
  const existing = (db.prepare("SELECT COUNT(*) AS count FROM products").get() as { count: number }).count;
  const version = Number((db.prepare("SELECT value FROM catalog_meta WHERE key = 'catalog_version'").get() as { value?: string } | undefined)?.value || 0);
  if (existing === CATEGORY_TOTAL && version === CATALOG_VERSION && !options.force) return { created: 0, total: existing, skipped: true };

  const insert = db.prepare(`
    INSERT INTO products (
      id, sku, barcode, name_en, name_ru, description_en, description_ru, brand, category_id, subcategory_id,
      price, previous_price, currency, unit_type, package_quantity, net_weight, weight_unit, estimated_weight,
      ingredients, allergens, dietary_tags, search_terms, stock, in_stock, low_stock, image_value,
      storage_instructions, country_of_origin, popularity_score, data_quality_flags
    ) VALUES (
      @id, @sku, @barcode, @nameEn, @nameRu, @descriptionEn, @descriptionRu, @brand, @categoryId, @subcategoryId,
      @price, @previousPrice, 'USD', @unitType, @packageQuantity, @netWeight, @weightUnit, @estimatedWeight,
      @ingredients, @allergens, @dietaryTags, @searchTerms, @stock, @inStock, @lowStock, @imageValue,
      @storageInstructions, @countryOfOrigin, @popularityScore, @dataQualityFlags
    )
  `);
  const insertFts = db.prepare(`INSERT INTO products_fts
    (product_id, name_en, name_ru, brand, description_en, description_ru, ingredients, search_terms)
    VALUES (@id, @nameEn, @nameRu, @brand, @descriptionEn, @descriptionRu, @ingredients, @searchTerms)`);

  const run = db.transaction(() => {
    db.exec("DELETE FROM products_fts; DELETE FROM products;");
    let globalIndex = 0;
    for (const category of CATEGORIES) {
      for (let categoryIndex = 0; categoryIndex < category.count; categoryIndex += 1) {
        const p = createProduct(category.id, categoryIndex, globalIndex, options.seed);
        const row = {
          id: p.id, sku: p.sku, barcode: p.barcode ?? null,
          nameEn: p.localeData.en.name, nameRu: p.localeData.ru.name,
          descriptionEn: p.localeData.en.description ?? null, descriptionRu: p.localeData.ru.description ?? null,
          brand: p.brand ?? null, categoryId: p.categoryId, subcategoryId: p.subcategoryId,
          price: p.price, previousPrice: p.previousPrice ?? null, unitType: p.unitType,
          packageQuantity: p.packageQuantity ?? null, netWeight: p.netWeight ?? null, weightUnit: p.weightUnit ?? null,
          estimatedWeight: p.estimatedWeight ? 1 : 0, ingredients: JSON.stringify(p.ingredients || []),
          allergens: JSON.stringify(p.allergens || []), dietaryTags: JSON.stringify(p.dietaryTags || []),
          searchTerms: JSON.stringify(p.searchTerms), stock: p.stock, inStock: p.inStock ? 1 : 0,
          lowStock: p.lowStock ? 1 : 0, imageValue: p.imageValue, storageInstructions: p.storageInstructions ?? null,
          countryOfOrigin: p.countryOfOrigin ?? null, popularityScore: p.popularityScore,
          dataQualityFlags: JSON.stringify(p.dataQualityFlags),
        };
        insert.run(row);
        insertFts.run(row);
        globalIndex += 1;
      }
    }
    db.prepare("INSERT INTO catalog_meta (key, value) VALUES ('catalog_version', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(CATALOG_VERSION));
  });
  run();
  return { created: CATEGORY_TOTAL, total: CATEGORY_TOTAL, skipped: false };
}
