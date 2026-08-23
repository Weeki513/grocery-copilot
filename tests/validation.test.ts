import { describe, expect, it } from "vitest";
import { productCapacityUnit } from "@/lib/product-quantity";
import type { IngredientRequirement } from "@/lib/types";
import { preserveCurrentSelection } from "@/server/ai/graph";
import { retrieveForIngredients } from "@/server/catalog/retrieval";
import { repairSelection, validateSelection } from "@/server/validation/selection";

const requirement: IngredientRequirement = { key: "shrimp", displayName: { en: "shrimp", ru: "креветки" }, quantity: 250, unit: "g", required: true, searchTerms: ["shrimp", "prawns", "креветки"] };

describe("server selection validation", () => {
  it.each([
    ["shrimp", "креветки", "g", "ml"],
    ["whole milk", "молоко", "ml", "piece"],
    ["free range eggs", "яйца", "piece", "g"],
  ] as const)("only retrieves SKU capacities compatible with %s requirements", (nameEn, nameRu, unit, incompatibleUnit) => {
    const compatible: IngredientRequirement = { key: nameEn.replaceAll(" ", "_"), displayName: { en: nameEn, ru: nameRu }, quantity: 1, unit, required: true, searchTerms: [nameEn, nameRu] };
    const compatibleProducts = retrieveForIngredients([compatible], { allergies: [], excluded: [] }).groups[0].products;
    expect(compatibleProducts.length).toBeGreaterThan(0);
    expect(compatibleProducts.every((product) => productCapacityUnit(product) === unit)).toBe(true);
    expect(retrieveForIngredients([{ ...compatible, unit: incompatibleUnit }], { allergies: [], excluded: [] }).groups[0].products).toHaveLength(0);
  });

  it("keeps piece requirements and piece-pack capacities in the same unit", () => {
    const avocado: IngredientRequirement = { key: "avocado", displayName: { en: "ripe avocado", ru: "спелый авокадо" }, quantity: 1, unit: "piece", required: true, searchTerms: ["avocado", "авокадо"] };
    const { groups } = retrieveForIngredients([avocado], { allergies: [], excluded: [] });
    expect(groups[0].products.length).toBeGreaterThan(0);
    expect(groups[0].products.every((product) => productCapacityUnit(product) === "piece")).toBe(true);
    const repaired = repairSelection({ selectedItems: [], unresolvedIngredients: [avocado.key], requiresFallback: true }, [avocado], groups, { allergies: [], excluded: [] });
    expect(repaired.selectedItems).toHaveLength(1);
    expect(repaired.selectedItems[0].quantity).toBe(1);
    expect(repaired.unresolvedIngredients).toHaveLength(0);
    expect(validateSelection(repaired, [avocado], groups, { allergies: [], excluded: [] }).valid).toBe(true);
  });

  it("fails closed instead of dividing grams by pieces", () => {
    const pieceRequirement: IngredientRequirement = { key: "avocado", displayName: { en: "ripe avocado", ru: "спелый авокадо" }, quantity: 1, unit: "piece", required: true, searchTerms: ["avocado", "авокадо"] };
    const pieceGroup = retrieveForIngredients([pieceRequirement], { allergies: [], excluded: [] }).groups[0];
    const product = pieceGroup.products[0];
    const gramRequirement: IngredientRequirement = { ...pieceRequirement, quantity: 105, unit: "g" };
    expect(retrieveForIngredients([gramRequirement], { allergies: [], excluded: [] }).groups[0].products).toHaveLength(0);

    const incompatibleGroup = [{ ...pieceGroup, requiredQuantity: gramRequirement.quantity, unit: gramRequirement.unit }];
    const proposed = { selectedItems: [{ productId: product.id, quantity: 9, ingredientKey: gramRequirement.key, confidence: .8, reason: "bad unit math" }], unresolvedIngredients: [], requiresFallback: false };
    const validation = validateSelection(proposed, [gramRequirement], incompatibleGroup, { allergies: [], excluded: [] });
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((error) => error.code === "unit_mismatch")).toBe(true);

    const repaired = repairSelection(proposed, [gramRequirement], incompatibleGroup, { allergies: [], excluded: [] });
    expect(repaired.selectedItems).toHaveLength(0);
    expect(repaired.unresolvedIngredients).toEqual([gramRequirement.key]);
    expect(repaired.requiresFallback).toBe(true);
  });

  it("rejects an invented SKU", () => {
    const { groups } = retrieveForIngredients([requirement], { allergies: [], excluded: [] });
    const result = validateSelection({ selectedItems: [{ productId: "invented", quantity: 1, ingredientKey: "shrimp", confidence: 1, reason: "test" }], unresolvedIngredients: [], requiresFallback: false }, [requirement], groups, { allergies: [], excluded: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === "unknown_product")).toBe(true);
  });

  it("rejects forbidden shellfish deterministically", () => {
    const { groups } = retrieveForIngredients([requirement], { allergies: [], excluded: [] });
    const product = groups[0].products[0];
    const result = validateSelection({ selectedItems: [{ productId: product.id, quantity: 2, ingredientKey: "shrimp", confidence: .9, reason: "test" }], unresolvedIngredients: [], requiresFallback: false }, [requirement], groups, { allergies: ["shellfish"], excluded: [] });
    expect(result.errors.some((error) => error.code === "allergen")).toBe(true);
  });

  it("uses database prices rather than model-provided arithmetic", () => {
    const small: IngredientRequirement = { ...requirement, quantity: 50 };
    const { groups } = retrieveForIngredients([small], { allergies: [], excluded: [] });
    const product = groups[0].products[0];
    const result = validateSelection({ selectedItems: [{ productId: product.id, quantity: 1, ingredientKey: "shrimp", confidence: .9, reason: "test" }], unresolvedIngredients: [], requiresFallback: false }, [small], groups, { allergies: [], excluded: [] });
    expect(result.total).toBe(product.price);
  });

  it("keeps an unchanged valid SKU while editing an existing order", () => {
    const small: IngredientRequirement = { ...requirement, quantity: 50 };
    const { groups } = retrieveForIngredients([small], { allergies: [], excluded: [] });
    expect(groups[0].products.length).toBeGreaterThan(1);
    const current = groups[0].products[1];
    const proposed = { selectedItems: [{ productId: groups[0].products[0].id, quantity: 1, ingredientKey: "shrimp", confidence: .8, reason: "model choice" }], unresolvedIngredients: [], requiresFallback: false };
    const preserved = preserveCurrentSelection({ currentSelection: [{ productId: current.id, ingredientKey: "shrimp", quantity: 1 }], candidateGroups: groups, ingredientRequirements: [small] }, proposed);
    expect(preserved.selectedItems[0].productId).toBe(current.id);
  });

  it("treats free-form food allergies as deterministic SKU exclusions", () => {
    const paprika: IngredientRequirement = { key: "paprika", displayName: { en: "paprika", ru: "паприка" }, quantity: 8, unit: "g", required: true, searchTerms: ["paprika", "паприка"] };
    const allowed = retrieveForIngredients([paprika], { allergies: [], excluded: [] }).groups[0];
    expect(allowed.products.length).toBeGreaterThan(0);
    const blocked = retrieveForIngredients([paprika], { allergies: ["паприка"], excluded: [] }).groups[0];
    expect(blocked.products).toHaveLength(0);
    const product = allowed.products[0];
    const result = validateSelection({ selectedItems: [{ productId: product.id, quantity: 1, ingredientKey: "paprika", confidence: 1, reason: "test" }], unresolvedIngredients: [], requiresFallback: false }, [paprika], [allowed], { allergies: ["паприка"], excluded: [] });
    expect(result.errors.some((error) => error.code === "allergen")).toBe(true);
  });

  it("applies dietary tags per ingredient group instead of to the whole order", () => {
    const standardChicken: IngredientRequirement = { key: "standard_chicken", displayName: { en: "chicken breast", ru: "куриная грудка" }, quantity: 3000, unit: "g", required: true, servingGroupIds: ["standard"], searchTerms: ["chicken breast", "куриная грудка"] };
    const vegetarianChicken: IngredientRequirement = { ...standardChicken, key: "vegetarian_chicken", servingGroupIds: ["vegetarian"], requiredDietaryTags: ["vegetarian"] };
    const vegetarianChickpeas: IngredientRequirement = { key: "vegetarian_chickpeas", displayName: { en: "chickpeas", ru: "нут" }, quantity: 1500, unit: "g", required: true, servingGroupIds: ["vegetarian"], requiredDietaryTags: ["vegetarian"], searchTerms: ["chickpeas", "нут"] };
    expect(retrieveForIngredients([standardChicken], { allergies: [], excluded: [] }).groups[0].products.length).toBeGreaterThan(0);
    expect(retrieveForIngredients([vegetarianChicken], { allergies: [], excluded: [] }).groups[0].products).toHaveLength(0);
    expect(retrieveForIngredients([vegetarianChickpeas], { allergies: [], excluded: [] }).groups[0].products.length).toBeGreaterThan(0);
  });

  it("repairs a hearty chicken dinner with potatoes and carrots", () => {
    const requirements: IngredientRequirement[] = [
      { key: "chicken", displayName: { en: "chicken", ru: "курица" }, quantity: 400, unit: "g", required: true, searchTerms: ["chicken", "курица"] },
      { key: "potatoes", displayName: { en: "potatoes", ru: "картофель" }, quantity: 500, unit: "g", required: true, searchTerms: ["potato", "potatoes", "картофель"] },
      { key: "carrots", displayName: { en: "carrots", ru: "морковь" }, quantity: 200, unit: "g", required: true, searchTerms: ["carrot", "carrots", "морковь"] },
      { key: "onion", displayName: { en: "onion", ru: "лук" }, quantity: 150, unit: "g", required: true, searchTerms: ["onion", "лук"] },
      { key: "garlic", displayName: { en: "garlic", ru: "чеснок" }, quantity: 20, unit: "g", required: true, searchTerms: ["garlic", "чеснок"] },
      { key: "oil", displayName: { en: "olive oil", ru: "оливковое масло" }, quantity: 30, unit: "ml", required: true, searchTerms: ["olive oil", "оливковое масло"] },
      { key: "paprika", displayName: { en: "paprika", ru: "паприка" }, quantity: 8, unit: "g", required: true, searchTerms: ["paprika", "паприка"] },
      { key: "black_pepper", displayName: { en: "black pepper", ru: "чёрный перец" }, quantity: 4, unit: "g", required: true, searchTerms: ["black pepper", "ground pepper", "чёрный перец"] },
      { key: "salt", displayName: { en: "salt", ru: "соль" }, quantity: 5, unit: "g", required: true, searchTerms: ["salt", "соль"] },
    ];
    const { groups } = retrieveForIngredients(requirements, { allergies: [], excluded: [] });
    expect(groups.every((group) => group.products.length > 0)).toBe(true);
    const repaired = repairSelection({ selectedItems: [], unresolvedIngredients: requirements.map((item) => item.key), requiresFallback: true }, requirements, groups, { allergies: [], excluded: [] });
    const result = validateSelection(repaired, requirements, groups, { allergies: [], excluded: [] });
    expect(repaired.selectedItems).toHaveLength(requirements.length);
    expect(result.valid).toBe(true);
    const pepper = result.products.get(repaired.selectedItems.find((item) => item.ingredientKey === "black_pepper")?.productId || "");
    expect(pepper?.localeData.en.name).toContain("Black Pepper");
  });

  it("repairs each requirement using the lowest total purchase cost", () => {
    const needed: IngredientRequirement = { ...requirement, quantity: 500 };
    const { groups } = retrieveForIngredients([needed], { allergies: [], excluded: [] });
    const repaired = repairSelection({ selectedItems: [], unresolvedIngredients: [needed.key], requiresFallback: true }, [needed], groups, { allergies: [], excluded: [] });
    const selected = repaired.selectedItems[0];
    const selectedProduct = groups[0].products.find((product) => product.id === selected.productId)!;
    const capacity = (product: typeof selectedProduct) => {
      const value = product.netWeight || product.packageQuantity || 1;
      return product.weightUnit === "kg" || product.weightUnit === "l" ? value * 1000 : value;
    };
    const selectedCost = selected.quantity * selectedProduct.price;
    const minimumCost = Math.min(...groups[0].products.map((product) => Math.ceil(needed.quantity / capacity(product)) * product.price));
    expect(selectedCost).toBe(minimumCost);
  });

  it("does not choose a replacement whose stock cannot cover a large group", () => {
    const largeOrder: IngredientRequirement = { key: "group_chicken", displayName: { en: "chicken breast", ru: "куриная грудка" }, quantity: 4000, unit: "g", required: true, servingGroupIds: ["standard"], searchTerms: ["chicken breast", "куриная грудка"] };
    const { groups } = retrieveForIngredients([largeOrder], { allergies: [], excluded: [] });
    const repaired = repairSelection({ selectedItems: [], unresolvedIngredients: [largeOrder.key], requiresFallback: true }, [largeOrder], groups, { allergies: [], excluded: [] });
    expect(repaired.selectedItems).toHaveLength(1);
    const selected = repaired.selectedItems[0];
    const product = groups[0].products.find((candidate) => candidate.id === selected.productId)!;
    expect(selected.quantity).toBeLessThanOrEqual(product.stock);
    expect(validateSelection(repaired, [largeOrder], groups, { allergies: [], excluded: [] }).valid).toBe(true);
  });
});
