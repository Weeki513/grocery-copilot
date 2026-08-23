import { describe, expect, it } from "vitest";
import { createProduct } from "@/server/catalog/generator";
import { FAMILIES } from "@/server/catalog/families";
import { packageSizesForFamily, PACKAGING_PROFILES } from "@/server/catalog/packaging";

function baseSize(product: ReturnType<typeof createProduct>) {
  if (product.packageQuantity && !product.netWeight) return product.packageQuantity;
  if (!product.netWeight || !product.weightUnit) return undefined;
  return product.netWeight * (product.weightUnit === "kg" || product.weightUnit === "l" ? 1000 : 1);
}

describe("catalog packaging profiles", () => {
  it("defines a realistic packaging profile for every catalog family", () => {
    const families = Object.values(FAMILIES).flat();
    expect(Object.keys(PACKAGING_PROFILES)).toHaveLength(families.length);
    for (const family of families) {
      const sizes = packageSizesForFamily(family);
      expect(sizes.length, family.en).toBeGreaterThan(1);
      expect(sizes.every((size) => Number.isFinite(size) && size > 0), family.en).toBe(true);
    }
  });

  it("cycles through every family-specific size instead of fixing one size per family", () => {
    for (const [categoryId, families] of Object.entries(FAMILIES)) {
      for (let familyIndex = 0; familyIndex < families.length; familyIndex += 1) {
        const family = families[familyIndex];
        const expected = packageSizesForFamily(family);
        const generated = expected.map((_, variantIndex) => {
          const categoryIndex = familyIndex + variantIndex * families.length;
          let globalIndex = 10_000 + categoryIndex;
          if (globalIndex % 89 === 0) globalIndex += 1;
          return baseSize(createProduct(categoryId, categoryIndex, globalIndex));
        });
        expect(generated, family.en).toEqual(expected);
      }
    }
  });

  it("offers small retail packs for individually selected produce", () => {
    expect(PACKAGING_PROFILES["Ripe Avocado"][0]).toBe(1);
    expect(PACKAGING_PROFILES["Lemon"][0]).toBe(1);
    expect(PACKAGING_PROFILES["Lime"][0]).toBe(1);
  });
});
