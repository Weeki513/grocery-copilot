import type { Locale } from "@/lib/types";
import { FAMILIES, type Family } from "@/server/catalog/families";

export const BUSINESS_CAPABILITIES = [
  "food_or_meal", "drink", "wipe_or_absorb", "clean_kitchen_surface", "clean_floor",
  "personal_hygiene", "pet_feeding", "baby_feeding", "vehicle_purchase", "other",
] as const;

export type BusinessCapability = typeof BUSINESS_CAPABILITIES[number];

const FOOD_CATEGORIES = new Set(["pantry", "dairy", "snacks", "produce", "meat", "seafood", "frozen", "ready", "bakery", "condiments", "breakfast"]);

const CAPABILITY_BY_CATEGORY: Record<string, BusinessCapability> = {
  drinks: "drink", baby: "baby_feeding", cleaning: "clean_kitchen_surface", personal: "personal_hygiene",
  pets: "pet_feeding", household: "wipe_or_absorb",
};

const PURPOSES: Partial<Record<BusinessCapability, Record<Locale, string>>> = {
  food_or_meal: { en: "food or an ingredient for a meal", ru: "еда или ингредиент для блюда" },
  drink: { en: "a beverage for drinking", ru: "напиток" },
  wipe_or_absorb: { en: "absorb spills and wipe household or table surfaces with disposable paper", ru: "впитывать жидкость и протирать бытовые или столовые поверхности одноразовой бумагой" },
  clean_kitchen_surface: { en: "clean washable kitchen counters and surfaces; not certified for floors", ru: "мыть моющиеся поверхности кухни; назначение для полов не заявлено" },
  personal_hygiene: { en: "wash hands for personal hygiene", ru: "мыть руки для личной гигиены" },
  pet_feeding: { en: "feed a cat", ru: "кормить кошку" },
  baby_feeding: { en: "feed a baby age-appropriate purée", ru: "кормить ребёнка детским пюре" },
};

export function familyId(category: string, family: Family) {
  return `${category}-${family.en.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export type CatalogCapability = {
  familyId: string;
  category: string;
  capability: BusinessCapability;
  name: Record<Locale, string>;
  purpose: Record<Locale, string>;
};

export function catalogCapabilities(): CatalogCapability[] {
  return Object.entries(FAMILIES).flatMap(([category, families]) => families.map((family) => {
    const capability = FOOD_CATEGORIES.has(category) ? "food_or_meal" : CAPABILITY_BY_CATEGORY[category] || "other";
    return {
      familyId: familyId(category, family), category, capability,
      name: { en: family.en, ru: family.ru },
      purpose: PURPOSES[capability] || { en: "no verified functional use is defined", ru: "проверенное функциональное назначение не определено" },
    };
  }));
}

export function capabilityContext(locale: Locale) {
  return catalogCapabilities().map((item) => ({ id: item.familyId, category: item.category, capability: item.capability, name: item.name[locale], purpose: item.purpose[locale] }));
}

export function validatedFamilies(capability: BusinessCapability, ids: string[]) {
  const requested = new Set(ids);
  return catalogCapabilities().filter((item) => requested.has(item.familyId) && item.capability === capability);
}
