import { describe, expect, it } from "vitest";
import { POST as checkout } from "@/app/api/checkout/route";
import { POST as chat, safeRecipe } from "@/app/api/chat/route";

describe("public API hardening", () => {
  it("preserves large-party recipe servings in continuation context", () => {
    const recipe = safeRecipe({
      title: { en: "Large dinner", ru: "Большой ужин" },
      summary: { en: "A shared meal", ru: "Общий ужин" },
      servings: 500,
      cookingTimeMinutes: 45,
      steps: { en: ["Cook"], ru: ["Приготовить"] },
    });
    expect(recipe?.servings).toBe(500);
  });

  it("rejects malformed checkout JSON without throwing", async () => {
    const response = await checkout(new Request("https://demo.example/api/checkout", { method: "POST", body: "not-json" }));
    expect(response.status).toBe(400);
  });

  it("rejects oversized checkout requests before schema processing", async () => {
    const response = await checkout(new Request("https://demo.example/api/checkout", {
      method: "POST",
      headers: { "content-length": "50001" },
      body: "{}",
    }));
    expect(response.status).toBe(413);
  });

  it("bounds the client-controlled chat session identifier", async () => {
    const response = await chat(new Request("https://demo.example/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "x".repeat(121), locale: "en", message: "Build dinner" }),
    }));
    expect(response.status).toBe(400);
  });
});
