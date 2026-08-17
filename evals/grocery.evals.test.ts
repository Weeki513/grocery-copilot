import { describe, expect, it } from "vitest";
import { evalCases } from "./cases";

describe("reproducible grocery eval suite", () => {
  it("contains the required 20-case distribution", () => {
    expect(evalCases).toHaveLength(20);
    expect(evalCases.filter((item) => item.kind === "normal")).toHaveLength(8);
    expect(evalCases.filter((item) => item.kind === "constraint")).toHaveLength(4);
    expect(evalCases.filter((item) => item.kind === "stock")).toHaveLength(3);
    expect(evalCases.filter((item) => item.kind === "budget")).toHaveLength(3);
    expect(evalCases.filter((item) => item.kind === "fallback")).toHaveLength(2);
  });

  it.each(evalCases)("$id has stable, actionable expectations", (testCase) => {
    expect(testCase.prompt.length).toBeGreaterThan(12);
    if (testCase.kind === "budget") expect(testCase.budget).toBeGreaterThan(0);
    if (testCase.kind === "constraint") expect(testCase.forbidden?.length).toBeGreaterThan(0);
    if (testCase.kind === "fallback") expect(testCase.expectFallback).toBe(true);
  });
});
