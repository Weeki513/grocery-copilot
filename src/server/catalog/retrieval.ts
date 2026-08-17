import type { IngredientRequirement, Product } from "@/lib/types";
import { searchProducts } from "./repository";

export type CandidateGroup = { ingredientKey: string; requiredQuantity: number; unit: string; required: boolean; products: Product[] };

export type ProductConstraints = {
  allergies: string[];
  excluded: string[];
  requiredDietaryTags?: string[];
  maxPrice?: number;
};

const ALLERGEN_ALIASES: Record<string, string[]> = {
  dairy: ["milk"], молоко: ["milk"], молочные: ["milk"], nuts: ["nuts"], орехи: ["nuts"],
  shellfish: ["shellfish"], морепродукты: ["shellfish"], egg: ["egg"], яйца: ["egg"], gluten: ["gluten"], глютен: ["gluten"],
};

export function normalizedForbidden(values: string[]) {
  const all = values.flatMap((value) => [value.toLowerCase(), ...(ALLERGEN_ALIASES[value.toLowerCase()] || [])]);
  return new Set(all.filter((value) => value.length > 1));
}

export function productHaystack(product: Product) {
  return `${product.localeData.en.name} ${product.localeData.ru.name} ${(product.ingredients || []).join(" ")} ${product.searchTerms.join(" ")}`.toLowerCase();
}

export function normalizeDietaryTags(values: string[]) {
  return [...new Set(values.flatMap((value) => {
    const normalized = value.toLowerCase().trim().replaceAll("_", "-");
    if (/цел(?:иакия|иак)|gluten|глютен/.test(normalized)) return ["gluten-free"];
    if (/vegan|веган/.test(normalized)) return ["vegan"];
    if (/vegetarian|вегетариан/.test(normalized)) return ["vegetarian"];
    if (/dairy[- ]?free|без\s+молок|безмолоч/.test(normalized)) return ["dairy-free"];
    if (/halal|халяль/.test(normalized)) return ["halal"];
    if (/kosher|кошер/.test(normalized)) return ["kosher"];
    if (/organic|органик/.test(normalized)) return ["organic"];
    return [];
  }))];
}

function hasVerifiedDietaryTag(product: Product, required: string) {
  const tags = new Set((product.dietaryTags || []).map((tag) => tag.toLowerCase()));
  if (required === "vegetarian") return tags.has("vegetarian") || tags.has("vegan");
  if (required === "dairy-free") return tags.has("dairy-free") || tags.has("vegan");
  return tags.has(required);
}

export function productAllowedForConstraints(product: Product, constraints: ProductConstraints) {
  const allergens = normalizedForbidden(constraints.allergies);
  const forbiddenTerms = normalizedForbidden([...constraints.allergies, ...constraints.excluded]);
  if (!product.inStock || product.stock <= 0) return false;
  if ((product.allergens || []).some((item) => allergens.has(item.toLowerCase()))) return false;
  const haystack = productHaystack(product);
  if ([...forbiddenTerms].some((item) => haystack.includes(item))) return false;
  return normalizeDietaryTags(constraints.requiredDietaryTags || []).every((tag) => hasVerifiedDietaryTag(product, tag));
}

export function retrieveForIngredients(requirements: IngredientRequirement[], constraints: ProductConstraints) {
  let scannedAfterFilters = 0;
  const groups: CandidateGroup[] = requirements.map((requirement) => {
    const query = requirement.searchTerms.join(" ");
    const initial = searchProducts({ query, inStock: true, maxPrice: constraints.maxPrice, limit: 30 });
    const requirementConstraints = {
      ...constraints,
      requiredDietaryTags: [...new Set([...(constraints.requiredDietaryTags || []), ...(requirement.requiredDietaryTags || [])])],
    };
    const filtered = initial.filter((product) => productAllowedForConstraints(product, requirementConstraints));
    const specificTerms = [...new Set([...requirement.searchTerms, requirement.displayName.en, requirement.displayName.ru]
      .map((term) => term.trim().toLowerCase()).filter((term) => term.length > 1))]
      .sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length || b.length - a.length);
    const bestTerm = specificTerms.find((term) => filtered.some((product) => productHaystack(product).includes(term)));
    const products = (bestTerm ? filtered.filter((product) => productHaystack(product).includes(bestTerm)) : filtered).slice(0, 12);
    scannedAfterFilters += initial.length;
    return { ingredientKey: requirement.key, requiredQuantity: requirement.quantity, unit: requirement.unit, required: requirement.required, products };
  });
  return { groups, scannedAfterFilters, shortlistSize: groups.reduce((sum, group) => sum + group.products.length, 0) };
}
