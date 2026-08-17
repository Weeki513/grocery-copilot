import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/types";
import { purchaseBreakdown } from "@/lib/product-quantity";

const product = {
  unitType: "weight",
  packageQuantity: 1,
  netWeight: 80,
  weightUnit: "g",
} as Product;

describe("purchase quantity evidence", () => {
  it("shows both the number of packs and the total purchased weight", () => {
    expect(purchaseBreakdown(product, 63, "ru")).toBe("63 уп. × 80 г = 5,04 кг");
    expect(purchaseBreakdown(product, 63, "en")).toBe("63 packs × 80 g = 5.04 kg");
  });
});
