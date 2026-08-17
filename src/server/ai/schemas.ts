import { z } from "zod";
import { BUSINESS_CAPABILITIES } from "@/server/business/capabilities";

export const BusinessRouteSchema = z.object({
  mode: z.enum(["meal", "meal_edit", "catalog", "unsupported", "clarify"]),
  action: z.enum(["add", "find", "remove", "replace", "none"]),
  capability: z.enum(BUSINESS_CAPABILITIES),
  targetFamilyIds: z.array(z.string().max(100)).max(5),
  match: z.enum(["exact", "functional", "none"]),
  goalEn: z.string().max(220),
  goalRu: z.string().max(220),
  explanationEn: z.string().max(320),
  explanationRu: z.string().max(320),
  budgetAmount: z.number().nonnegative().max(1_000_000_000_000).nullable(),
  budgetCurrencyCode: z.string().regex(/^[A-Z]{3}$/).nullable(),
  budgetCurrencyDisplay: z.string().max(80).nullable(),
  budgetCurrencyAmbiguous: z.boolean(),
  allergies: z.array(z.string().max(80)).max(20),
  excludedIngredients: z.array(z.string().max(80)).max(20),
  requiredDietaryTags: z.array(z.string().max(80)).max(10),
}).strict();

export const InterpretationBundleSchema = z.object({
  interpretedRequest: z.object({
    servings: z.number().int().min(1).max(500).nullable(),
    budget: z.number().nonnegative().max(1_000_000_000_000).nullable(),
    maxCookingTimeMinutes: z.number().int().positive().max(300).nullable(),
    excludedIngredients: z.array(z.string()).max(20),
    allergies: z.array(z.string()).max(20),
    dietaryPreferences: z.array(z.string()).max(20),
    servingGroups: z.array(z.object({
      id: z.string().regex(/^[a-z0-9_-]+$/).max(40),
      servings: z.number().int().min(1).max(500),
      dietaryPreferences: z.array(z.string().max(80)).max(10),
    }).strict()).max(8),
    requestedDish: z.string().max(160).nullable(),
    isComplex: z.boolean(),
  }).strict(),
  clarification: z.object({
    required: z.boolean(),
    questionEn: z.string().max(220).nullable(),
    questionRu: z.string().max(220).nullable(),
  }).strict(),
  recipe: z.object({
    titleEn: z.string().max(120),
    titleRu: z.string().max(120),
    summaryEn: z.string().max(260),
    summaryRu: z.string().max(260),
    servings: z.number().int().min(1).max(500),
    cookingTimeMinutes: z.number().int().positive().max(300),
    stepsEn: z.array(z.string().max(240)).min(1).max(8),
    stepsRu: z.array(z.string().max(240)).min(1).max(8),
  }).strict().nullable(),
  ingredients: z.array(z.object({
    key: z.string().regex(/^[a-z0-9_-]+$/).max(64),
    nameEn: z.string().max(100),
    nameRu: z.string().max(100),
    quantityPerServing: z.number().positive(),
    unit: z.enum(["g", "ml", "piece"]),
    required: z.boolean(),
    servingGroupIds: z.array(z.string().regex(/^[a-z0-9_-]+$/).max(40)).min(1).max(8),
    requiredDietaryTags: z.array(z.string().max(80)).max(10),
    searchTerms: z.array(z.string().max(80)).min(1).max(8),
  }).strict()).max(16),
}).strict();

export const ProductSelectionSchema = z.object({
  selectedItems: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive().max(500),
    ingredientKey: z.string(),
    confidence: z.number().min(0).max(1),
    reason: z.string().max(240),
  }).strict()).max(30),
  unresolvedIngredients: z.array(z.string()),
  requiresFallback: z.boolean(),
}).strict();

export type InterpretationBundle = z.infer<typeof InterpretationBundleSchema>;
export type ProductSelection = z.infer<typeof ProductSelectionSchema>;
export type BusinessRoute = z.infer<typeof BusinessRouteSchema>;
