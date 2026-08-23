import type { ServingGroup } from "./audience";
import type { BaseQuantityUnit } from "@/lib/product-quantity";

export function servingsCoveredByIngredient(groupIds: string[], totalServings: number, groups: ServingGroup[]) {
  if (!groupIds.length || groupIds.includes("all")) return totalServings;
  const requested = new Set(groupIds);
  const matched = groups.filter((group) => requested.has(group.id));
  if (!matched.length) return totalServings;
  return Math.min(totalServings, matched.reduce((sum, group) => sum + group.servings, 0));
}

export function normalizeScaledQuantity(quantity: number, unit: BaseQuantityUnit) {
  const rounded = Math.round(quantity * 1000) / 1000;
  if (unit !== "piece") return rounded;

  const nearestWhole = Math.round(rounded);
  const tolerance = Math.max(0.001, Math.abs(nearestWhole) * 0.02);
  return nearestWhole > 0 && Math.abs(rounded - nearestWhole) <= tolerance ? nearestWhole : rounded;
}

export function scalePerServingQuantity(quantityPerServing: number, groupIds: string[], totalServings: number, groups: ServingGroup[], unit: BaseQuantityUnit) {
  const servingsCovered = servingsCoveredByIngredient(groupIds, totalServings, groups);
  const quantity = normalizeScaledQuantity(quantityPerServing * servingsCovered, unit);
  return { quantity, quantityPerServing, servingsCovered };
}
