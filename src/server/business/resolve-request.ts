import type { AssistantResult, CartItem, Locale, RecipePlan } from "@/lib/types";
import type { BusinessRoute } from "@/server/ai/schemas";
import { getProductsByIds, getProductsBySubcategory } from "@/server/catalog/repository";
import { productAllowedForConstraints } from "@/server/catalog/retrieval";
import type { BudgetConstraint } from "./budget";
import { validatedFamilies } from "./capabilities";

export type BusinessSelectionContext = {
  kind?: "meal" | "shopping";
  recipe?: RecipePlan;
  items: Array<{ productId: string; ingredientKey: string; quantity: number }>;
};

function unavailableMessage(route: BusinessRoute, locale: Locale) {
  const explanation = locale === "ru" ? route.explanationRu : route.explanationEn;
  if (route.mode === "clarify") return explanation;
  if (route.mode === "unsupported") {
    return locale === "ru"
      ? `${explanation} Grocery Copilot работает с продуктами, товарами для дома, гигиены и питомцев. Я могу помочь решить задачу только в пределах этого ассортимента.`
      : `${explanation} Grocery Copilot sells groceries, household, personal-care, and pet products. I can only solve the request within that assortment.`;
  }
  return locale === "ru"
    ? `${explanation} В текущем ассортименте нет товара с подтверждённым назначением для этой задачи. Я не буду подменять его несвязанным продуктом.`
    : `${explanation} The current assortment has no product with a verified use for this task. I will not replace it with an unrelated item.`;
}

function shoppingPlan(route: BusinessRoute): RecipePlan {
  return {
    title: { en: route.goalEn, ru: route.goalRu }, summary: { en: route.explanationEn, ru: route.explanationRu },
    servings: 1, cookingTimeMinutes: 0,
    steps: {
      en: ["Review the selected product and quantity.", "Add it to the cart when it fits your task."],
      ru: ["Проверьте выбранный товар и количество.", "Добавьте его в корзину, если он подходит для вашей задачи."],
    },
  };
}

export function resolveBusinessRoute(route: BusinessRoute, locale: Locale, context: BusinessSelectionContext, budget?: BudgetConstraint): AssistantResult | undefined {
  if (!["catalog", "unsupported", "clarify"].includes(route.mode)) return undefined;
  const families = validatedFamilies(route.capability, route.targetFamilyIds);
  if (route.mode !== "catalog" || !families.length) return { status: "waiting", kind: context.kind, message: unavailableMessage(route, locale) };

  const existingProducts = new Map(getProductsByIds(context.items.map((item) => item.productId)).map((product) => [product.id, product]));
  let items: CartItem[] = context.items.flatMap((item) => {
    const product = existingProducts.get(item.productId);
    return product ? [{ product, quantity: item.quantity, ingredientKey: item.ingredientKey }] : [];
  });

  const familyIds = new Set(families.map((family) => family.familyId));
  if (route.action === "remove") {
    const previousCount = items.length;
    items = items.filter((item) => !familyIds.has(item.product.subcategoryId));
    if (items.length === previousCount) return { status: "waiting", kind: context.kind, message: unavailableMessage(route, locale) };
  } else {
    const constraints = { allergies: route.allergies, excluded: route.excludedIngredients, requiredDietaryTags: route.requiredDietaryTags };
    const additions = families.flatMap((family) => getProductsBySubcategory(family.familyId, 100)
      .filter((product) => productAllowedForConstraints(product, constraints)).map((product) => ({ product, family })));
    if (!additions.length) {
      const requested = [...route.allergies, ...route.excludedIngredients, ...route.requiredDietaryTags].join(", ");
      const message = locale === "ru"
        ? `В этой категории нет товара, у которого данные SKU подтверждают все ограничения${requested ? `: ${requested}` : ""}. Я не буду называть неподтверждённый товар безопасным.`
        : `No product in this category has SKU data verifying every constraint${requested ? `: ${requested}` : ""}. I will not call an unverified product safe.`;
      return { status: "waiting", kind: context.kind, message };
    }
    const existingTotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const selectedAdditions: typeof additions = [];
    let runningTotal = existingTotal;
    for (const family of families) {
      const candidates = additions.filter((item) => item.family.familyId === family.familyId);
      const chosen = candidates.find((item) => !budget || runningTotal + item.product.price <= budget.usdAmount + 1e-9);
      if (!chosen) {
        const cheapest = candidates[0]?.product.price;
        const source = budget?.currency === "USD" ? `$${budget.usdAmount.toFixed(2)}` : `${budget?.amount} ${budget?.currency} (~$${budget?.usdAmount.toFixed(2)})`;
        const message = locale === "ru"
          ? `Строгий бюджет ${source} не покрывает выбранный товар${cheapest ? `: самый дешёвый проверенный вариант стоит $${cheapest.toFixed(2)}` : ""}. Корзина не изменена.`
          : `The strict ${source} budget does not cover the selected product${cheapest ? `; the cheapest verified option costs $${cheapest.toFixed(2)}` : ""}. The cart was not changed.`;
        return { status: "waiting", kind: context.kind, message, error: "budget_infeasible" };
      }
      selectedAdditions.push(chosen);
      runningTotal += chosen.product.price;
    }
    for (const { product, family } of selectedAdditions) {
      const existing = items.find((item) => item.product.id === product.id);
      if (existing) existing.quantity = Math.min(existing.quantity + 1, product.stock);
      else items.push({ product, quantity: 1, ingredientKey: `catalog:${family.familyId}`, reason: locale === "ru" ? route.explanationRu : route.explanationEn });
    }
  }

  const total = Math.round(items.reduce((sum, item) => sum + item.product.price * item.quantity, 0) * 100) / 100;
  const recipe = context.recipe || shoppingPlan(route);
  const selectedNames = families.map((family) => family.name[locale]).join(", ");
  const message = locale === "ru"
    ? `${route.match === "functional" ? "Точного товара нет, но подобрал функционально подходящую альтернативу с проверенными ограничениями" : "Подобрал товар из каталога"}: ${selectedNames}. Итог обновлённой корзины — $${total.toFixed(2)}.`
    : `${route.match === "functional" ? "The exact item is unavailable, but I found a functionally suitable alternative with verified constraints" : "I found a catalog item"}: ${selectedNames}. The updated cart total is $${total.toFixed(2)}.`;
  return { status: "completed", kind: context.recipe ? context.kind || "meal" : "shopping", message, recipe, items, total };
}
