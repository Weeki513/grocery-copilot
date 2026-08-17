import type { ServingGroup } from "./audience";

export function servingsCoveredByIngredient(groupIds: string[], totalServings: number, groups: ServingGroup[]) {
  if (!groupIds.length || groupIds.includes("all")) return totalServings;
  const requested = new Set(groupIds);
  const matched = groups.filter((group) => requested.has(group.id));
  if (!matched.length) return totalServings;
  return Math.min(totalServings, matched.reduce((sum, group) => sum + group.servings, 0));
}

export function scalePerServingQuantity(quantityPerServing: number, groupIds: string[], totalServings: number, groups: ServingGroup[]) {
  const servingsCovered = servingsCoveredByIngredient(groupIds, totalServings, groups);
  const quantity = Math.round(quantityPerServing * servingsCovered * 1000) / 1000;
  return { quantity, quantityPerServing, servingsCovered };
}
