import { describe, expect, it } from "vitest";
import { ProductSelectionSchema } from "@/server/ai/schemas";

describe("structured product selection", () => {
  it("accepts only IDs, quantities, mappings, confidence, and reasons", () => {
    const valid = { selectedItems: [{ productId: "prd_00001", quantity: 1, ingredientKey: "pasta", confidence: .93, reason: "Covers the required amount." }], unresolvedIngredients: [], requiresFallback: false };
    expect(ProductSelectionSchema.safeParse(valid).success).toBe(true);
    expect(ProductSelectionSchema.safeParse({ ...valid, total: 42 }).success).toBe(false);
    expect(ProductSelectionSchema.safeParse({ ...valid, selectedItems: [{ ...valid.selectedItems[0], price: 4.99 }] }).success).toBe(false);
  });

  it("allows a verified large-party pack count instead of truncating it to twenty", () => {
    const selection = { selectedItems: [{ productId: "prd_00001", quantity: 63, ingredientKey: "chicken", confidence: .9, reason: "Covers 50 servings." }], unresolvedIngredients: [], requiresFallback: false };
    expect(ProductSelectionSchema.safeParse(selection).success).toBe(true);
  });
});
