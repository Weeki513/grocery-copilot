import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ChatMessage, Locale, Product } from "@/lib/types";
import { capabilityContext } from "@/server/business/capabilities";
import type { BudgetConstraint } from "@/server/business/budget";
import { parseServingGroups } from "@/server/business/audience";
import { parseRequestedServings } from "@/server/business/servings";
import { catalogPlanningContext } from "@/server/catalog/planning-context";
import { BusinessRouteSchema, InterpretationBundleSchema, ProductSelectionSchema, type BusinessRoute, type InterpretationBundle, type ProductSelection } from "./schemas";
import { chatProtectionConfig, withModelCallBudget } from "./usage-guard";

let client: OpenAI | null = null;

export class AiConfigurationError extends Error {
  constructor(message = "OPENAI_API_KEY is not configured") { super(message); this.name = "AiConfigurationError"; }
}

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY?.trim()) throw new AiConfigurationError();
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export const primaryModel = () => process.env.OPENAI_PRIMARY_MODEL || "gpt-5.6-luna";
export const fallbackModel = () => process.env.OPENAI_FALLBACK_MODEL || "gpt-5.6-terra";

export async function routeBusinessRequest(request: string, locale: Locale, conversation: ChatMessage[] = [], hasSelection = false): Promise<{ data: BusinessRoute; tokens: number }> {
  const capabilities = capabilityContext(locale);
  const response = await withModelCallBudget(() => getOpenAI().responses.parse({
    model: primaryModel(), reasoning: { effort: "low" }, max_output_tokens: chatProtectionConfig().maxOutputTokens,
    input: [{
      role: "system",
      content: `Route a user's request for a grocery and household retail assistant. The business can only sell the catalog families listed below. Choose meal for a new food/recipe request, meal_edit for a change to food ingredients in an existing meal, catalog for finding/adding/removing a standalone retail item or solving a non-cooking household task, unsupported for goals outside this retailer, and clarify only when the user's goal itself is unknowable. For clarify mode, explanationEn and explanationRu must contain exactly one concise question that resolves the ambiguity; do not make an availability claim before the answer is known. Infer the user's underlying functional goal, not just words. A functional substitute is allowed only when its declared capability safely achieves the same goal. Never substitute across capabilities: food cannot replace household paper, kitchen cleaner cannot be claimed as floor cleaner, and no grocery can replace a car. If no catalog family has the required capability, return no family IDs and explain honestly. targetFamilyIds must come verbatim from the supplied list. Extract any stated budget into budgetAmount and the ISO 4217 three-letter code in budgetCurrencyCode, regardless of the language used for the currency name. Preserve the user's currency phrase in budgetCurrencyDisplay. Set all three to null when no budget is stated. Set budgetCurrencyAmbiguous true and currency code null only when the currency genuinely cannot be determined, such as an unqualified kr or ¥ symbol; a plain $ means USD in this application. Extract user-declared allergens and excluded ingredients into allergies and excludedIngredients. requiredDietaryTags may contain only verified product-level claims required by the request, normalized to lowercase English tags such as vegan, vegetarian, dairy-free, gluten-free, halal, kosher, or organic. Include gluten-free for celiac disease. A request for certified halal, kosher, or organic products requires the corresponding tag; never infer certification from a recipe name. Existing editable selection: ${hasSelection}. Catalog capabilities: ${JSON.stringify(capabilities)}`,
    }, ...conversation.slice(-10).map((message) => ({ role: message.role, content: message.content })), { role: "user", content: request }],
    text: { format: zodTextFormat(BusinessRouteSchema, "business_route") },
  }));
  if (!response.output_parsed) throw new Error("The model did not return a valid business route.");
  return { data: response.output_parsed, tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0) };
}

export async function interpretAndPlan(request: string, locale: Locale, conversation: ChatMessage[] = [], options: { unavailableIngredients?: string[]; failureFeedback?: string; forcePlan?: boolean; budgetConstraint?: BudgetConstraint } = {}): Promise<{ data: InterpretationBundle; tokens: number }> {
  const recentConversation = conversation.slice(-12).map((message) => ({ role: message.role, content: message.content }));
  const catalog = catalogPlanningContext(locale);
  const unavailable = options.unavailableIngredients?.length ? ` A previous plan could not find these required ingredients: ${options.unavailableIngredients.join(", ")}. Replace them with suitable available families.` : "";
  const failureFeedback = options.failureFeedback ? ` A previous plan failed deterministic business checks: ${options.failureFeedback}. Change the plan itself, not only product packs.` : "";
  const deterministicBudget = options.budgetConstraint ? ` Deterministic budget: ${options.budgetConstraint.source} = $${options.budgetConstraint.usdAmount.toFixed(2)} USD using the application's verified conversion. This exact USD ceiling overrides any other budget interpretation.` : "";
  const requestedServings = parseRequestedServings(request);
  const deterministicGroups = parseServingGroups(request, requestedServings);
  const deterministicAudience = deterministicGroups?.length
    ? ` Deterministic serving groups: ${JSON.stringify(deterministicGroups)}. This split is authoritative. A dietary preference attached to only one group must not restrict the other groups.`
    : "";
  const quantityContract = " quantityPerServing is always the edible amount for ONE person in the covered serving group, never a package size and never the total for the whole party. Use realistic adult portions: roughly 120–200 g raw meat or fish per unrestricted adult main-meal serving and 60–100 g dry grains per adult when they are a main side. The server multiplies quantityPerServing by the covered serving count. Do not pre-multiply it yourself.";
  const planningDirective = options.forcePlan
    ? " The upstream business router has already confirmed this is an actionable meal request. Do not ask the user to choose a specific dish or preference: set clarification.required to false, apply reasonable defaults for unspecified details, and produce the most useful complete plan now."
    : "";
  const response = await withModelCallBudget(() => getOpenAI().responses.parse({
    model: primaryModel(), max_output_tokens: chatProtectionConfig().maxOutputTokens,
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content: `You plan practical grocery recipes grounded in a live grocery catalog. Interpret the request, then either ask exactly one concrete clarification question or produce a normalized recipe and ingredient requirements. Respond bilingually in fields, but prioritize ${locale}. Use USD only. Do not invent products or prices. Every required ingredient must map to one of the available catalog families below; optional garnishes may be omitted. Treat goals such as high-protein, light, filling, or quick as constraints and choose suitable available foods rather than turning the goal into a specific ingredient. Available protein families: ${catalog.proteins.join(", ")}. Available food families: ${catalog.available.join(", ")}. Do not require tap water or drinking water as a purchased cooking ingredient. For tight budgets, choose a fundamentally inexpensive dish, minimize the number of required purchases, prefer beans, chickpeas, eggs, oats, rice or potatoes over expensive proteins, and mark seasonings/oil/garnishes optional unless essential. Clarify only when the goal itself cannot be inferred; missing subjective preferences are not a reason to pause. dietaryPreferences contains only constraints that apply to every serving. Put partial-audience constraints into servingGroups. When only a subset is vegetarian or vegan and the remaining group is unrestricted, build compatible split main-protein variants by default: a meat or fish option sized for the unrestricted group and a vegetarian or vegan protein sized for the restricted group. Do not make the whole order vegetarian merely because one subgroup is. Shared sides may use servingGroupIds ["all"]; group-specific ingredients must reference their group IDs and be sized only for those servings. Set requiredDietaryTags on every group-specific ingredient so downstream SKU checks enforce the correct group's constraints. Hard allergens in a shared kitchen should remain global unless individually sealed alternatives make separation explicit. When the conversation contains a Current editable grocery selection and the user asks to add, remove, replace, or change something, edit that existing meal instead of starting a different dish. Preserve its servings, budget, allergies, exclusions, and all prior user constraints unless the user explicitly changes them; apply only the requested delta and return the complete revised recipe and ingredient list. For a requested ingredient that is an available catalog family, choose a sensible culinary quantity from the dish and servings. Never ask the user for package size, package price, or stock metadata: downstream retrieval selects real packages and database prices. Never claim that package metadata is unavailable. Never reintroduce anything described anywhere in the conversation as an allergy or exclusion. A meta-question must not silently mutate the cart. Keep recipes realistic and ingredients searchable in a supermarket. Mark multi-dish or heavily constrained optimization as complex.${quantityContract}${planningDirective}${unavailable}${failureFeedback}${deterministicBudget}${deterministicAudience}`,
      },
      ...recentConversation,
      { role: "user" as const, content: request },
    ],
    text: { format: zodTextFormat(InterpretationBundleSchema, "grocery_request") },
  }));
  if (!response.output_parsed) throw new Error("The model did not return a valid request plan.");
  const data = response.output_parsed;
  if (options.budgetConstraint) data.interpretedRequest.budget = options.budgetConstraint.usdAmount;
  if (requestedServings) {
    data.interpretedRequest.servings = requestedServings;
    if (data.recipe) data.recipe.servings = requestedServings;
  }
  if (deterministicGroups?.length) {
    data.interpretedRequest.servingGroups = deterministicGroups;
    const partialTags = new Set(deterministicGroups.filter((group) => group.servings < (requestedServings || 0)).flatMap((group) => group.dietaryPreferences));
    data.interpretedRequest.dietaryPreferences = data.interpretedRequest.dietaryPreferences.filter((preference) => ![...partialTags].some((tag) => preference.toLowerCase().includes(tag)));
    const groupMap = new Map(deterministicGroups.map((group) => [group.id, group]));
    for (const ingredient of data.ingredients) {
      const groupTags = ingredient.servingGroupIds.flatMap((id) => groupMap.get(id)?.dietaryPreferences || []);
      ingredient.requiredDietaryTags = [...new Set([...ingredient.requiredDietaryTags, ...groupTags])];
    }
  }
  return { data, tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0) };
}

type CandidateGroup = { ingredientKey: string; requiredQuantity: number; unit: string; required: boolean; products: Product[] };

export async function selectProducts(groups: CandidateGroup[], context: { budget?: number; allergies: string[]; excluded: string[]; locale: Locale; preferredProductIds?: string[] }, model = primaryModel()): Promise<{ data: ProductSelection; tokens: number }> {
  const compact = groups.map((group) => ({
    ingredientKey: group.ingredientKey,
    requiredQuantity: group.requiredQuantity,
    unit: group.unit,
    required: group.required,
    candidates: group.products.map((p) => ({
      id: p.id,
      name: p.localeData[context.locale].name,
      price: p.price,
      stock: p.stock,
      netWeight: p.netWeight,
      weightUnit: p.weightUnit,
      packageQuantity: p.packageQuantity,
      allergens: p.allergens,
      qualityFlags: p.dataQualityFlags,
    })),
  }));
  const response = await withModelCallBudget(() => getOpenAI().responses.parse({
    model, max_output_tokens: chatProtectionConfig().maxOutputTokens,
    reasoning: { effort: model === fallbackModel() ? "medium" : "low" },
    input: [
      {
        role: "system",
        content: "Select only product IDs present in the candidate lists. Choose enough packs to cover every required ingredient while respecting the budget, stock, allergies, exclusions, and minimizing leftovers. Do not purchase optional groups unless the user explicitly requested them or the complete required cart remains comfortably within budget; pantry seasonings, oil, and garnish should normally be omitted. preferredProductIds are products already present in the user's editable selection: keep them for unchanged ingredient groups whenever they remain valid, and minimize SKU changes. Return IDs and quantities only with short operational reasons. Never calculate or return prices or names. Set requiresFallback when constraints cannot be satisfied confidently.",
      },
      { role: "user", content: JSON.stringify({ ...context, groups: compact }) },
    ],
    text: { format: zodTextFormat(ProductSelectionSchema, "product_selection") },
  }));
  if (!response.output_parsed) throw new Error("The model did not return a valid product selection.");
  return { data: response.output_parsed, tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0) };
}
