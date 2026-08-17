import type { Locale, Product } from "./types";

const NON_FOOD_CATEGORIES = new Set(["cleaning", "personal", "household"]);

const COUNTRY_NAMES: Record<string, Record<Locale, string>> = {
  Italy: { en: "Italy", ru: "Италия" },
  Spain: { en: "Spain", ru: "Испания" },
  "United States": { en: "United States", ru: "США" },
  Greece: { en: "Greece", ru: "Греция" },
  Turkey: { en: "Turkey", ru: "Турция" },
  France: { en: "France", ru: "Франция" },
  Netherlands: { en: "Netherlands", ru: "Нидерланды" },
  Mexico: { en: "Mexico", ru: "Мексика" },
};

const INGREDIENT_NAMES: Record<string, string> = {
  "durum wheat": "пшеница твёрдых сортов",
  wheat: "пшеница",
  gluten: "глютен",
  milk: "молоко",
  egg: "яйцо",
  soy: "соя",
  nuts: "орехи",
  shellfish: "ракообразные",
  fish: "рыба",
};

function translateList(values: string[] | undefined, locale: Locale) {
  if (!values?.length) return undefined;
  return values.map((value) => locale === "ru" ? INGREDIENT_NAMES[value.toLowerCase()] || value : value).join(", ");
}

function baseProductName(product: Product, locale: Locale) {
  return product.localeData[locale].name.split("·")[0].trim();
}

function composition(product: Product, locale: Locale) {
  if (product.categoryId === "household") {
    return locale === "ru" ? "Переработанное бумажное волокно" : "Recycled paper fibre";
  }
  if (product.categoryId === "cleaning") {
    return locale === "ru"
      ? "Очищающая формула для моющихся кухонных поверхностей"
      : "Cleaning formula for washable kitchen surfaces";
  }
  if (product.categoryId === "personal") {
    return locale === "ru" ? "Мягкая моющая основа" : "Gentle cleansing base";
  }
  if (product.categoryId === "pets") {
    return locale === "ru" ? "Курица и компоненты полноценного рациона" : "Chicken and complete-feed ingredients";
  }
  if (product.categoryId === "baby") {
    return locale === "ru" ? "Яблочное пюре" : "Apple purée";
  }
  if (locale === "ru" && product.ingredients?.some((value) => !INGREDIENT_NAMES[value.toLowerCase()])) {
    return baseProductName(product, locale);
  }
  return translateList(product.ingredients, locale) || baseProductName(product, locale);
}

function storage(product: Product, locale: Locale) {
  if (!product.storageInstructions) return "—";
  if (locale === "en") return product.storageInstructions;
  if (product.storageInstructions === "Keep refrigerated at 0–5°C") return "Хранить в холодильнике при 0–5 °C";
  if (product.storageInstructions === "Store in a cool, dry place") return "Хранить в сухом прохладном месте";
  return product.storageInstructions;
}

export type ProductMetadataRow = { label: string; value: string };

export function productMetadata(product: Product, locale: Locale): ProductMetadataRow[] {
  const materialLabel = product.categoryId === "household"
    ? (locale === "ru" ? "Материал" : "Material")
    : (locale === "ru" ? "Состав" : "Ingredients");
  const rows: ProductMetadataRow[] = [{ label: materialLabel, value: composition(product, locale) }];

  if (!NON_FOOD_CATEGORIES.has(product.categoryId)) {
    rows.push({
      label: locale === "ru" ? "Аллергены" : "Allergens",
      value: translateList(product.allergens, locale) || (locale === "ru" ? "Не заявлены" : "None declared"),
    });
  }

  rows.push(
    { label: locale === "ru" ? "Хранение" : "Storage", value: storage(product, locale) },
    {
      label: locale === "ru" ? "Страна" : "Origin",
      value: product.countryOfOrigin ? COUNTRY_NAMES[product.countryOfOrigin]?.[locale] || product.countryOfOrigin : "—",
    },
  );
  return rows;
}
