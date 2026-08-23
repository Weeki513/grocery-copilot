import type { IngredientRequirement, Product } from "@/lib/types";
import { productCapacity, productCapacityUnit } from "@/lib/product-quantity";
import type { ProductSelection } from "@/server/ai/schemas";
import { normalizeDietaryTags, normalizedForbidden, productAllowedForConstraints, productHaystack, type CandidateGroup, type ProductConstraints } from "@/server/catalog/retrieval";
import { getProductsByIds } from "@/server/catalog/repository";

export type ValidationError = {
  code: "unknown_product" | "out_of_stock" | "stock_exceeded" | "allergen" | "excluded" | "dietary_claim" | "unit_mismatch" | "insufficient_quantity" | "budget_exceeded" | "missing_ingredient" | "duplicate";
  productId?: string;
  ingredientKey?: string;
  detail: string;
};

function packsNeeded(requirement: IngredientRequirement, product: Product) {
  if (productCapacityUnit(product) !== requirement.unit) return undefined;
  return Math.max(1, Math.ceil(requirement.quantity / productCapacity(product)));
}

export function validateSelection(selection: ProductSelection, requirements: IngredientRequirement[], groups: CandidateGroup[], constraints: ProductConstraints & { budget?: number }) {
  const errors: ValidationError[] = [];
  const ids = selection.selectedItems.map((item) => item.productId);
  const products = getProductsByIds(ids);
  const productMap = new Map(products.map((product) => [product.id, product]));
  const seen = new Set<string>();
  const allergenSet = normalizedForbidden(constraints.allergies);
  const excludedSet = normalizedForbidden(constraints.excluded);

  for (const item of selection.selectedItems) {
    const product = productMap.get(item.productId);
    if (!product) { errors.push({ code: "unknown_product", productId: item.productId, detail: "Product does not exist." }); continue; }
    const duplicateKey = `${item.productId}:${item.ingredientKey}`;
    if (seen.has(duplicateKey)) errors.push({ code: "duplicate", productId: item.productId, detail: "Product was selected twice for one ingredient." });
    seen.add(duplicateKey);
    if (!product.inStock || product.stock <= 0) errors.push({ code: "out_of_stock", productId: product.id, detail: "Product is no longer available." });
    if (item.quantity > product.stock) errors.push({ code: "stock_exceeded", productId: product.id, detail: "Quantity exceeds current stock." });
    const haystack = productHaystack(product);
    const hasForbiddenAllergen = product.allergens?.some((allergen) => allergenSet.has(allergen.toLowerCase())) || [...allergenSet].some((allergen) => haystack.includes(allergen));
    if (hasForbiddenAllergen) errors.push({ code: "allergen", productId: product.id, detail: "Contains or matches a user-declared allergen." });
    if ([...excludedSet].some((excluded) => haystack.includes(excluded))) errors.push({ code: "excluded", productId: product.id, detail: "Matches an excluded ingredient." });
    if (normalizeDietaryTags(constraints.requiredDietaryTags || []).length && !productAllowedForConstraints(product, constraints)) {
      errors.push({ code: "dietary_claim", productId: product.id, detail: "Product metadata does not verify every required dietary claim." });
    }
    const requirement = requirements.find((req) => req.key === item.ingredientKey);
    if (requirement && productCapacityUnit(product) !== requirement.unit) {
      errors.push({ code: "unit_mismatch", productId: product.id, ingredientKey: item.ingredientKey, detail: `Product capacity is measured in ${productCapacityUnit(product)}, but the requirement is measured in ${requirement.unit}.` });
    } else if (requirement && productCapacity(product) * item.quantity < requirement.quantity) {
      errors.push({ code: "insufficient_quantity", productId: product.id, ingredientKey: item.ingredientKey, detail: "Selected packages do not cover the required amount." });
    }
    const allowed = groups.find((group) => group.ingredientKey === item.ingredientKey)?.products.some((candidate) => candidate.id === item.productId);
    if (!allowed) errors.push({ code: "unknown_product", productId: item.productId, detail: "Product was not in the candidate shortlist." });
  }
  for (const requirement of requirements.filter((req) => req.required)) {
    if (!selection.selectedItems.some((item) => item.ingredientKey === requirement.key)) errors.push({ code: "missing_ingredient", ingredientKey: requirement.key, detail: "Required ingredient is not covered." });
  }
  const total = selection.selectedItems.reduce((sum, item) => sum + (productMap.get(item.productId)?.price || 0) * item.quantity, 0);
  if (constraints.budget && total > constraints.budget) errors.push({ code: "budget_exceeded", detail: `Selection costs ${total.toFixed(2)} against a ${constraints.budget.toFixed(2)} budget.` });
  return { valid: errors.length === 0, errors, total: Math.round(total * 100) / 100, products: productMap };
}

export function repairSelection(selection: ProductSelection, requirements: IngredientRequirement[], groups: CandidateGroup[], _constraints: ProductConstraints & { budget?: number }): ProductSelection {
  void _constraints;
  void selection;
  const byKey = new Map<string, ProductSelection["selectedItems"][number]>();
  const unresolvedIngredients: string[] = [];
  for (const requirement of requirements.filter((item) => item.required)) {
    const group = groups.find((candidateGroup) => candidateGroup.ingredientKey === requirement.key);
    if (!group?.products.length) { unresolvedIngredients.push(requirement.key); continue; }
    const purchaseCost = (product: Product) => (packsNeeded(requirement, product) ?? Number.POSITIVE_INFINITY) * product.price;
    const candidates = [...group.products]
      .filter((product) => {
        const quantity = packsNeeded(requirement, product);
        return quantity !== undefined && quantity <= product.stock;
      })
      .sort((a, b) => purchaseCost(a) - purchaseCost(b) || a.price / productCapacity(a) - b.price / productCapacity(b));
    if (!candidates.length) { unresolvedIngredients.push(requirement.key); continue; }
    const chosen = candidates[0];
    const quantity = packsNeeded(requirement, chosen)!;
    byKey.set(requirement.key, { productId: chosen.id, quantity, ingredientKey: requirement.key, confidence: 0.78, reason: "Deterministic repair selected the best available value that covers the requirement." });
  }
  return { selectedItems: [...byKey.values()], unresolvedIngredients, requiresFallback: unresolvedIngredients.length > 0 };
}
