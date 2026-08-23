import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/types";
import { productMetadata } from "@/lib/product-metadata";
import type { BusinessRoute } from "@/server/ai/schemas";
import { clearFxCacheForTests, parseBudgetInput, resolveBudgetConstraint } from "@/server/business/budget";
import { parseServingGroups } from "@/server/business/audience";
import { parseRequestedServings } from "@/server/business/servings";
import { normalizeScaledQuantity, scalePerServingQuantity } from "@/server/business/quantities";
import { catalogCapabilities, validatedFamilies } from "@/server/business/capabilities";
import { resolveBusinessRoute } from "@/server/business/resolve-request";
import { getProductsBySubcategory } from "@/server/catalog/repository";
import { catalogPlanningContext } from "@/server/catalog/planning-context";
import { canonicalUnitForIngredient } from "@/server/catalog/units";

function route(overrides: Partial<BusinessRoute>): BusinessRoute {
  return {
    mode: "catalog",
    action: "add",
    capability: "wipe_or_absorb",
    targetFamilyIds: ["household-recycled-kitchen-towels"],
    match: "functional",
    goalEn: "Add something suitable for wiping the table",
    goalRu: "Добавить подходящий товар для вытирания стола",
    explanationEn: "Paper towels safely serve the requested wiping purpose.",
    explanationRu: "Бумажные полотенца безопасно решают задачу вытирания.",
    budgetAmount: null,
    budgetCurrencyCode: null,
    budgetCurrencyDisplay: null,
    budgetCurrencyAmbiguous: false,
    allergies: [],
    excludedIngredients: [],
    requiredDietaryTags: [],
    ...overrides,
  };
}

describe("business-aware request handling", () => {
  it("maps every catalog family to a declared capability", () => {
    const families = catalogCapabilities();
    expect(families.length).toBeGreaterThan(0);
    expect(families.every((family) => family.capability !== "other")).toBe(true);
    expect(families.find((family) => family.familyId === "household-recycled-kitchen-towels")?.capability).toBe("wipe_or_absorb");
  });

  it("allows a verified wiping alternative but never a food substitution", () => {
    const result = resolveBusinessRoute(route({}), "ru", { items: [] });
    expect(result?.status).toBe("completed");
    expect(result?.kind).toBe("shopping");
    expect(result?.items).toHaveLength(1);
    expect(result?.items?.[0].product.categoryId).toBe("household");
  });

  it("rejects a kitchen cleaner as an unverified floor-cleaning substitute", () => {
    expect(validatedFamilies("clean_floor", ["cleaning-kitchen-surface-cleaner"])).toHaveLength(0);
    const result = resolveBusinessRoute(route({
      capability: "clean_floor",
      targetFamilyIds: ["cleaning-kitchen-surface-cleaner"],
      match: "functional",
      goalRu: "Помыть пол",
      explanationRu: "Нужен товар с назначением для мытья пола.",
    }), "ru", { items: [] });
    expect(result?.status).toBe("waiting");
    expect(result?.items).toBeUndefined();
    expect(result?.message).toContain("нет товара с подтверждённым назначением");
  });

  it("does not turn a vehicle purchase into a grocery recommendation", () => {
    const result = resolveBusinessRoute(route({
      mode: "unsupported",
      action: "none",
      capability: "vehicle_purchase",
      targetFamilyIds: [],
      match: "none",
      goalRu: "Купить новый Mercedes",
      explanationRu: "Автомобили не входят в ассортимент.",
    }), "ru", { items: [] });
    expect(result?.status).toBe("waiting");
    expect(result?.items).toBeUndefined();
    expect(result?.message).toContain("Автомобили не входят в ассортимент");
  });

  it("asks one clean question for an ambiguous catalog request", () => {
    const result = resolveBusinessRoute(route({
      mode: "clarify",
      action: "none",
      capability: "other",
      targetFamilyIds: [],
      match: "none",
      explanationRu: "Какие пакеты вам нужны: мусорные, для хранения продуктов или пакеты-майки?",
    }), "ru", { items: [] });
    expect(result?.status).toBe("waiting");
    expect(result?.message).toBe("Какие пакеты вам нужны: мусорные, для хранения продуктов или пакеты-майки?");
    expect(result?.message).not.toContain("нет товара");
  });
});

describe("budget normalization", () => {
  it.each([
    ["ужин за один цент", "USD", 0.01],
    ["dinner for 25 cents", "USD", 0.25],
    ["ужин за один лари", "GEL", 0.37],
    ["завтрак на пятерых до 2000 рублей", "RUB", 22.22],
    ["breakfast under ₽1800", "RUB", 20],
    ["dinner under $10", "USD", 10],
  ] as const)("normalizes %s", (request, currency, usdAmount) => {
    const parsed = parseBudgetInput(request);
    expect(parsed?.currencyCode).toBe(currency);
    const rates: Record<string, number> = { USD: 1, GEL: 2.72, RUB: 90 };
    expect(parsed?.amount && parsed.currencyCode ? parsed.amount / rates[parsed.currencyCode] : undefined).toBeCloseTo(usdAmount, 2);
  });

  it.each([
    ["ужин до 5000 KZT", "KZT", 5000],
    ["breakfast for €35", "EUR", 35],
    ["ужин до ₹1200", "INR", 1200],
    ["ужин за 3000 иен", "JPY", 3000],
  ] as const)("recognizes %s without a currency-specific parser branch", (request, currency, amount) => {
    expect(parseBudgetInput(request)).toMatchObject({ amount, currencyCode: currency, ambiguous: false });
  });

  it("accepts a model ISO hint for a currency name in any language", () => {
    expect(parseBudgetInput("ужин до тысячи исландских крон", { amount: 1000, currencyCode: "ISK", currencyDisplay: "1000 исландских крон" }))
      .toMatchObject({ amount: 1000, currencyCode: "ISK", ambiguous: false });
  });

  it.each([
    ["Make a quick dinner for 2 in 20 min"],
    ["omelet with 3 eggs"],
    ["meal for 2 pax"],
  ])("does not mistake ordinary three-letter words for ISO currency in %s", (request) => {
    expect(parseBudgetInput(request)).toBeUndefined();
  });

  it.each([
    ["€1,000", "EUR", 1000],
    ["€1.000,50", "EUR", 1000.5],
    ["1,234.56 USD", "USD", 1234.56],
    ["1 234,56 EUR", "EUR", 1234.56],
    ["1’234.56 CHF", "CHF", 1234.56],
    ["2\u00a0000 RUB", "RUB", 2000],
  ] as const)("parses localized money %s", (request, currencyCode, amount) => {
    expect(parseBudgetInput(request)).toMatchObject({ currencyCode, amount });
  });

  it("rejects zero and negative budgets instead of changing their value", async () => {
    await expect(resolveBudgetConstraint("dinner under -$10")).resolves.toMatchObject({ status: "invalid", input: { amount: -10 } });
    await expect(resolveBudgetConstraint("dinner under $0")).resolves.toMatchObject({ status: "invalid", input: { amount: 0 } });
  });

  it("keeps an ambiguous currency unresolved instead of guessing", () => {
    expect(parseBudgetInput("ужин до 500 kr", { amount: 500, currencyCode: null, currencyDisplay: "500 kr", ambiguous: true }))
      .toMatchObject({ amount: 500, display: "500 kr", ambiguous: true });
  });

  it("converts a supported ISO currency through the cached live-rate shape", async () => {
    clearFxCacheForTests();
    const fakeFetch = async () => new Response(JSON.stringify([{ date: "2026-07-15", base: "USD", quote: "ISK", rate: 125 }]), { status: 200 });
    const result = await resolveBudgetConstraint("1000 ISK", {}, fakeFetch as typeof fetch);
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.budget).toMatchObject({ currency: "ISK", usdAmount: 8, provider: "frankfurter" });
  });
});

describe("serving normalization", () => {
  it("grounds ingredient units in catalog families before pack selection", () => {
    const context = catalogPlanningContext("en");
    expect(context.units).toContainEqual({ name: "Ripe Avocado", unit: "piece" });
    expect(context.units).toContainEqual({ name: "Whole Milk", unit: "ml" });
    expect(context.units).toContainEqual({ name: "Basmati Rice", unit: "g" });
    expect(canonicalUnitForIngredient({ nameEn: "avocado", nameRu: "авокадо", searchTerms: ["ripe avocado"] })).toBe("piece");
    expect(canonicalUnitForIngredient({ nameEn: "whole milk", nameRu: "молоко", searchTerms: ["milk"] })).toBe("ml");
    expect(canonicalUnitForIngredient({ nameEn: "rice", nameRu: "рис", searchTerms: ["basmati rice"] })).toBe("g");
  });

  it.each([
    ["Собери ужин на 25 человек", 25],
    ["Make dinner for 40 people", 40],
    ["Нужно 120 порций", 120],
  ] as const)("preserves explicit group size in %s", (request, servings) => {
    expect(parseRequestedServings(request)).toBe(servings);
  });

  it("keeps a partial vegetarian preference scoped to its audience group", () => {
    expect(parseServingGroups("Обед для 30 мужчин, ещё 10 — вегетарианцы", 30)).toEqual([
      { id: "standard", servings: 20, dietaryPreferences: [] },
      { id: "vegetarian", servings: 10, dietaryPreferences: ["vegetarian"] },
    ]);
  });

  it("scales per-serving ingredient amounts for the whole party", () => {
    expect(scalePerServingQuantity(160, ["all"], 50, [], "g")).toEqual({
      quantity: 8000,
      quantityPerServing: 160,
      servingsCovered: 50,
    });
  });

  it("scales a group-specific protein only for that audience segment", () => {
    const groups = [
      { id: "standard", servings: 20, dietaryPreferences: [] },
      { id: "vegetarian", servings: 10, dietaryPreferences: ["vegetarian"] },
    ];
    expect(scalePerServingQuantity(180, ["standard"], 30, groups, "g").quantity).toBe(3600);
    expect(scalePerServingQuantity(150, ["vegetarian"], 30, groups, "g").quantity).toBe(1500);
    expect(scalePerServingQuantity(80, ["all"], 30, groups, "g").quantity).toBe(2400);
  });

  it("snaps piece totals near whole numbers without hiding meaningful fractions", () => {
    expect(scalePerServingQuantity(0.33, ["all"], 3, [], "piece").quantity).toBe(1);
    expect(normalizeScaledQuantity(1.98, "piece")).toBe(2);
    expect(normalizeScaledQuantity(3.01, "piece")).toBe(3);
    expect(normalizeScaledQuantity(1.5, "piece")).toBe(1.5);
    expect(normalizeScaledQuantity(0.99, "g")).toBe(0.99);
  });
});

describe("direct catalog constraints", () => {
  it("adds ketchup to an existing selection instead of leaving the cart unchanged", () => {
    const existing = getProductsBySubcategory("bakery-sourdough-loaf", 1)[0];
    const result = resolveBusinessRoute(route({
      mode: "catalog", action: "add", capability: "food_or_meal",
      targetFamilyIds: ["condiments-tomato-ketchup"], match: "exact",
      goalEn: "Add ketchup", goalRu: "Добавить кетчуп",
      explanationEn: "Ketchup was requested.", explanationRu: "Пользователь попросил кетчуп.",
    }), "en", {
      kind: "meal",
      recipe: {
        title: { en: "Chicken toast", ru: "Тост с курицей" }, summary: { en: "Toast", ru: "Тост" },
        servings: 2, cookingTimeMinutes: 15, steps: { en: ["Assemble."], ru: ["Собрать."] },
      },
      items: [{ productId: existing.id, ingredientKey: "bread", quantity: 1 }],
    });
    expect(result).toMatchObject({ status: "completed", kind: "meal" });
    expect(result?.items).toHaveLength(2);
    expect(result?.items?.some((item) => item.product.subcategoryId === "condiments-tomato-ketchup")).toBe(true);
    expect(result?.items?.some((item) => item.product.id === existing.id)).toBe(true);
  });

  it("does not mutate a catalog selection above its strict budget", () => {
    const result = resolveBusinessRoute(route({ targetFamilyIds: ["dairy-whole-milk"], capability: "food_or_meal", match: "exact" }), "ru", { items: [] }, {
      amount: 1, currency: "USD", usdAmount: 1, source: "$1", provider: "native",
    });
    expect(result).toMatchObject({ status: "waiting", error: "budget_infeasible" });
    expect(result?.items).toBeUndefined();
  });

  it("requires verified gluten-free SKU data for a celiac request", () => {
    const result = resolveBusinessRoute(route({
      targetFamilyIds: ["breakfast-rolled-oats"], capability: "food_or_meal", match: "exact",
      allergies: ["gluten"], requiredDietaryTags: ["gluten-free"],
    }), "ru", { items: [] });
    expect(result?.status).toBe("waiting");
    expect(result?.items).toBeUndefined();
    expect(result?.message).toContain("данные SKU");
  });
});

describe("category-aware product metadata", () => {
  it("uses household semantics and localized values for paper goods", () => {
    const product = getProductsBySubcategory("household-recycled-kitchen-towels", 1)[0] as Product;
    const rows = productMetadata(product, "ru");
    expect(rows.find((row) => row.label === "Материал")?.value).toBe("Переработанное бумажное волокно");
    expect(rows.some((row) => row.label === "Аллергены")).toBe(false);
    expect(rows.find((row) => row.label === "Хранение")?.value).toBe("Хранить в сухом прохладном месте");
    expect(rows.find((row) => row.label === "Страна")?.value).not.toBe(product.countryOfOrigin);
  });
});
