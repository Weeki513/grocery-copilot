import type { Locale } from "@/lib/types";
import { FAMILIES } from "./families";

const FOOD_CATEGORIES = ["pantry", "drinks", "dairy", "snacks", "produce", "meat", "seafood", "frozen", "ready", "bakery", "condiments", "breakfast"] as const;

export function catalogPlanningContext(locale: Locale) {
  const families = FOOD_CATEGORIES.flatMap((category) => FAMILIES[category] || []);
  const available = [...new Set(families.map((family) => family[locale]))].sort((a, b) => a.localeCompare(b, locale));
  const proteins = [...new Set(families.filter((family) => family.roles?.includes("protein")).map((family) => family[locale]))].sort((a, b) => a.localeCompare(b, locale));
  return { available, proteins };
}
