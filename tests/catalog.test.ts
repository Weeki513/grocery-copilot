import { describe, expect, it } from "vitest";
import { catalogStats, searchProductPage, searchProducts } from "@/server/catalog/repository";
import { catalogPlanningContext } from "@/server/catalog/planning-context";
import { CATEGORIES, CATEGORY_TOTAL } from "@/server/catalog/taxonomy";

describe("catalog", () => {
  it("contains exactly the specified 10,000 SKU", () => {
    const stats = catalogStats();
    expect(CATEGORY_TOTAL).toBe(10000);
    expect(stats.total).toBe(10000);
    expect(stats.categories).toHaveLength(17);
    for (const category of CATEGORIES) expect(stats.categories.find((item) => item.id === category.id)?.count).toBe(category.count);
  });

  it("finds real bilingual grocery products through FTS", () => {
    const shrimp = searchProducts({ query: "shrimp prawns креветки", inStock: true, limit: 12 });
    expect(shrimp.length).toBeGreaterThan(0);
    expect(shrimp.every((product) => product.categoryId === "seafood")).toBe(true);
    expect(shrimp.every((product) => product.currency === "USD" && product.stock > 0)).toBe(true);
  });

  it("keeps realistic quality flags below the critical damage threshold", () => {
    const stats = catalogStats();
    expect(stats.dirty).toBeGreaterThan(100);
    expect(stats.dirty).toBeLessThan(1500);
  });

  it("exposes all 10,000 SKU through deterministic pagination", () => {
    const first = searchProductPage({ limit: 75, offset: 0 });
    const last = searchProductPage({ limit: 75, offset: 9975 });
    expect(first.total).toBe(10000);
    expect(first.products).toHaveLength(75);
    expect(last.total).toBe(10000);
    expect(last.products).toHaveLength(25);
    expect(new Set([...first.products, ...last.products].map((product) => product.id)).size).toBe(100);
  });

  it("stores natural bilingual descriptions for catalog products", () => {
    const household = searchProductPage({ category: "household", limit: 20 }).products;
    expect(household).toHaveLength(20);
    for (const product of household) {
      expect(product.localeData.en.description).toContain("absorbent");
      expect(product.localeData.ru.description).toContain("впитывающие");
      expect(product.localeData.ru.description).not.toContain("Описание уточняется");
      expect(product.localeData.ru.description).not.toContain("повседневных блюд");
    }
  });

  it("grounds abstract protein goals in actual catalog families", () => {
    const en = catalogPlanningContext("en");
    const ru = catalogPlanningContext("ru");
    expect(en.proteins).toContain("Chicken Breast");
    expect(en.proteins).toContain("Free Range Eggs");
    expect(en.proteins).toContain("Red Kidney Beans");
    expect(ru.proteins).toContain("Куриная грудка");
    expect(ru.proteins).toContain("Яйца свободного выгула");
    expect(en.proteins).not.toContain("Quinoa");
  });

  it("contains ordinary dairy milk as a real searchable SKU family", () => {
    const milk = searchProducts({ query: "whole milk цельное молоко", inStock: true, limit: 20 });
    expect(milk.some((product) => product.subcategoryId === "dairy-whole-milk")).toBe(true);
    const planning = catalogPlanningContext("ru");
    expect(planning.available).toContain("Цельное молоко");
  });
});
