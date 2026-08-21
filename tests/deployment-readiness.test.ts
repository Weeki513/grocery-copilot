import { afterEach, describe, expect, it } from "vitest";
import { isCatalogBuild, isCatalogReadOnly } from "@/server/db";

describe("Vercel demo deployment mode", () => {
  afterEach(() => {
    delete process.env.CATALOG_BUILD;
    delete process.env.CATALOG_READ_ONLY;
    delete process.env.VERCEL;
  });

  it("opens the catalog read-only on Vercel runtime", () => {
    process.env.VERCEL = "1";
    expect(isCatalogBuild()).toBe(false);
    expect(isCatalogReadOnly()).toBe(true);
  });

  it("allows the Vercel build step to create the catalog artifact", () => {
    process.env.VERCEL = "1";
    process.env.CATALOG_BUILD = "1";
    process.env.CATALOG_READ_ONLY = "1";
    expect(isCatalogBuild()).toBe(true);
    expect(isCatalogReadOnly()).toBe(false);
  });

  it("supports an explicit read-only local smoke mode", () => {
    process.env.CATALOG_READ_ONLY = "1";
    expect(isCatalogReadOnly()).toBe(true);
  });
});
