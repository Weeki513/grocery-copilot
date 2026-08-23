import { END, START, StateGraph } from "@langchain/langgraph";
import type { CartItem, IngredientRequirement, RecipePlan } from "@/lib/types";
import { formatBaseQuantity, productCapacity, productCapacityUnit } from "@/lib/product-quantity";
import { scalePerServingQuantity } from "@/server/business/quantities";
import { getProductsByIds } from "@/server/catalog/repository";
import { normalizeDietaryTags, productAllowedForConstraints, retrieveForIngredients } from "@/server/catalog/retrieval";
import { canonicalUnitForIngredient } from "@/server/catalog/units";
import { repairSelection, validateSelection } from "@/server/validation/selection";
import { emitInspector, inspectorEvent } from "./events";
import { fallbackModel, interpretAndPlan, primaryModel, selectProducts } from "./openai";
import type { ProductSelection } from "./schemas";
import { GroceryState, type GroceryAgentState } from "./state";

function startEvent(state: GroceryAgentState, node: Parameters<typeof inspectorEvent>[0], en: string, ru: string) {
  const event = inspectorEvent(node, "active", en, ru, en, ru);
  emitInspector(state.sessionId, event);
  return { started: performance.now(), events: [event] };
}

function finishEvent(state: GroceryAgentState, node: Parameters<typeof inspectorEvent>[0], started: number, titleEn: string, titleRu: string, detailEn: string, detailRu: string, extra = {}) {
  const event = inspectorEvent(node, "completed", titleEn, titleRu, detailEn, detailRu, { durationMs: Math.round(performance.now() - started), ...extra });
  emitInspector(state.sessionId, event);
  return event;
}

async function interpretRequest(state: GroceryAgentState) {
  const { started, events } = startEvent(state, "interpret_request", "Understanding your request", "Анализирую запрос");
  const { data, tokens } = await interpretAndPlan(state.userRequest, state.locale, state.conversation, { forcePlan: true, budgetConstraint: state.budgetConstraint });
  const interpreted = data.interpretedRequest;
  const detailEn = data.clarification.required ? "One detail is needed before planning." : `Detected ${interpreted.servings || data.recipe?.servings || 2} servings${interpreted.budget ? ` and a $${interpreted.budget} budget` : ""}.`;
  const detailRu = data.clarification.required ? "Для планирования нужна одна деталь." : `Определено порций: ${interpreted.servings || data.recipe?.servings || 2}${interpreted.budget ? `, бюджет $${interpreted.budget}` : ""}.`;
  events.push(finishEvent(state, "interpret_request", started, "Request interpreted", "Запрос понят", detailEn, detailRu, { model: primaryModel(), tokens, input: { locale: state.locale, requestLength: state.userRequest.length }, output: { servings: interpreted.servings, budget: interpreted.budget, exclusions: interpreted.excludedIngredients.length } }));
  return {
    interpretationBundle: data,
    interpretedRequest: interpreted,
    clarification: { required: data.clarification.required, question: state.locale === "ru" ? data.clarification.questionRu || undefined : data.clarification.questionEn || undefined },
    activeModel: primaryModel(), retryCount: 0, planningRetryCount: 0, missingIngredientKeys: [], validationErrors: [], inspectorEvents: events,
  };
}

function askClarification(state: GroceryAgentState) {
  const question = state.clarification?.question || (state.locale === "ru" ? "Что именно вы хотите приготовить и на сколько человек?" : "What would you like to cook, and for how many people?");
  const waiting = inspectorEvent("ask_clarification", "warning", "Waiting for one detail", "Жду одну деталь", question, question);
  emitInspector(state.sessionId, waiting);
  return { response: { status: "waiting" as const, message: question }, inspectorEvents: [waiting] };
}

async function planRecipe(state: GroceryAgentState) {
  const { started, events } = startEvent(state, "plan_recipe", "Planning the meal", "Планирую блюдо");
  let bundle = state.interpretationBundle;
  let tokens = 0;
  if (!bundle?.recipe) {
    const result = await interpretAndPlan(state.userRequest, state.locale, state.conversation, { forcePlan: true, budgetConstraint: state.budgetConstraint });
    bundle = result.data; tokens = result.tokens;
  }
  if (!bundle.recipe) throw new Error("A recipe could not be planned after clarification.");
  const recipe: RecipePlan = {
    title: { en: bundle.recipe.titleEn, ru: bundle.recipe.titleRu }, summary: { en: bundle.recipe.summaryEn, ru: bundle.recipe.summaryRu },
    servings: bundle.recipe.servings, cookingTimeMinutes: bundle.recipe.cookingTimeMinutes,
    steps: { en: bundle.recipe.stepsEn, ru: bundle.recipe.stepsRu },
  };
  events.push(finishEvent(state, "plan_recipe", started, "Recipe planned", "Рецепт готов", `${recipe.title.en} · ${recipe.cookingTimeMinutes} min`, `${recipe.title.ru} · ${recipe.cookingTimeMinutes} мин`, { model: primaryModel(), tokens, output: { servings: recipe.servings, cookingTimeMinutes: recipe.cookingTimeMinutes } }));
  return { interpretationBundle: bundle, interpretedRequest: bundle.interpretedRequest, recipe, inspectorEvents: events };
}

function normalizeIngredients(state: GroceryAgentState) {
  const { started, events } = startEvent(state, "normalize_ingredients", "Sizing ingredients", "Рассчитываю ингредиенты");
  const totalServings = state.recipe?.servings || state.interpretedRequest?.servings || 2;
  const servingGroups = state.interpretedRequest?.servingGroups || [];
  const ingredients: IngredientRequirement[] = (state.interpretationBundle?.ingredients || []).map((item) => {
    const scaled = scalePerServingQuantity(item.quantityPerServing, item.servingGroupIds, totalServings, servingGroups, item.unit);
    return {
      key: item.key, displayName: { en: item.nameEn, ru: item.nameRu }, quantity: scaled.quantity, unit: item.unit, required: item.required,
      quantityPerServing: scaled.quantityPerServing, servingsCovered: scaled.servingsCovered,
      servingGroupIds: item.servingGroupIds, requiredDietaryTags: item.requiredDietaryTags,
      searchTerms: [...new Set([...item.searchTerms, item.nameEn, item.nameRu])],
    };
  });
  events.push(finishEvent(state, "normalize_ingredients", started, "Ingredients normalized", "Ингредиенты рассчитаны", `${ingredients.length} ingredient requirements generated.`, `Сформировано требований: ${ingredients.length}.`, { output: { count: ingredients.length, units: [...new Set(ingredients.map((item) => item.unit))] } }));
  return { ingredientRequirements: ingredients, inspectorEvents: events };
}

function unitMismatchFeedback(state: GroceryAgentState) {
  const mismatches = state.ingredientRequirements.flatMap((item) => {
    const expected = canonicalUnitForIngredient({ nameEn: item.displayName.en, nameRu: item.displayName.ru, searchTerms: item.searchTerms });
    return expected && expected !== item.unit ? [`${item.displayName.en}: use ${expected}, not ${item.unit}`] : [];
  });
  return mismatches.length
    ? `The previous ingredient plan used incompatible catalog units: ${mismatches.join("; ")}. Keep the intended ingredient families, correct each unit to the canonical catalog unit, and choose a realistic per-person quantity in that unit.`
    : undefined;
}

function retrieveProducts(state: GroceryAgentState) {
  const { started, events } = startEvent(state, "retrieve_products", "Searching 10,000 products", "Ищу среди 10 000 товаров");
  const interpreted = state.interpretedRequest;
  const constraints = {
    allergies: interpreted?.allergies || [], excluded: interpreted?.excludedIngredients || [],
    requiredDietaryTags: interpreted?.dietaryPreferences || [],
    maxPrice: interpreted?.budget ? Math.max(interpreted.budget * 0.55, 5) : undefined,
  };
  const result = retrieveForIngredients(state.ingredientRequirements, constraints);
  const existingProducts = new Map(getProductsByIds(state.currentSelection.map((item) => item.productId)).map((product) => [product.id, product]));
  const groups = result.groups.map((group) => {
    const current = state.currentSelection.find((item) => item.ingredientKey === group.ingredientKey);
    const product = current ? existingProducts.get(current.productId) : undefined;
    if (!product || !productAllowedForConstraints(product, constraints) || productCapacityUnit(product) !== group.unit) return group;
    return { ...group, products: [product, ...group.products.filter((candidate) => candidate.id !== product.id)].slice(0, 12) };
  });
  const requiredKeys = new Set(state.ingredientRequirements.filter((item) => item.required).map((item) => item.key));
  const missingGroups = groups.filter((group) => requiredKeys.has(group.ingredientKey) && !group.products.length).map((group) => group.ingredientKey);
  const shortlistSize = groups.reduce((sum, group) => sum + group.products.length, 0);
  events.push(finishEvent(state, "retrieve_products", started, "Catalog retrieval complete", "Поиск завершён", `10,000 SKU indexed · ${result.scannedAfterFilters} passed retrieval · ${shortlistSize} shortlisted.`, `Индексировано 10 000 SKU · после поиска: ${result.scannedAfterFilters} · shortlist: ${shortlistSize}.`, { candidates: shortlistSize, input: { catalogSize: 10000, ingredientCount: state.ingredientRequirements.length, preferredProducts: state.currentSelection.length }, output: { filtered: result.scannedAfterFilters, shortlist: shortlistSize, missingGroups } }));
  return { candidateGroups: groups, missingIngredientKeys: missingGroups, scannedAfterFilters: result.scannedAfterFilters, shortlistSize, inspectorEvents: events };
}

async function repairPlan(state: GroceryAgentState) {
  const { started, events } = startEvent(state, "repair_plan", "Replanning for business constraints", "Пересобираю план под ограничения");
  const unavailableIngredients = state.missingIngredientKeys.map((key) => state.ingredientRequirements.find((item) => item.key === key)?.displayName[state.locale] || key);
  const budgetExceeded = state.validationErrors.some((error) => error.code === "budget_exceeded");
  const budget = state.interpretedRequest?.budget;
  const failureFeedback = budgetExceeded
    ? `The verified cart cost $${state.total.toFixed(2)} against a strict $${(budget || 0).toFixed(2)} ceiling. Choose a different, substantially cheaper meal with at most 2–4 required purchases. Prefer inexpensive proteins and omit optional pantry staples.`
    : unitMismatchFeedback(state);
  const unitMismatchKeys = new Set(state.ingredientRequirements.filter((item) => {
    const expected = canonicalUnitForIngredient({ nameEn: item.displayName.en, nameRu: item.displayName.ru, searchTerms: item.searchTerms });
    return expected && expected !== item.unit;
  }).map((item) => item.key));
  const genuinelyUnavailable = state.missingIngredientKeys.filter((key) => !unitMismatchKeys.has(key)).map((key) => state.ingredientRequirements.find((item) => item.key === key)?.displayName[state.locale] || key);
  const { data, tokens } = await interpretAndPlan(state.userRequest, state.locale, state.conversation, { unavailableIngredients: genuinelyUnavailable, failureFeedback, forcePlan: true, budgetConstraint: state.budgetConstraint });
  if (!data.recipe) throw new Error("The catalog-grounded replan did not produce a recipe.");
  const detailEn = budgetExceeded ? `Rebuilt the meal for a $${(budget || 0).toFixed(2)} ceiling.` : unitMismatchKeys.size ? `Corrected ${unitMismatchKeys.size} incompatible ingredient units.` : `Replaced ${genuinelyUnavailable.length} unavailable required ingredients with stocked families.`;
  const detailRu = budgetExceeded ? `Блюдо пересобрано под лимит $${(budget || 0).toFixed(2)}.` : unitMismatchKeys.size ? `Исправлено несовместимых единиц: ${unitMismatchKeys.size}.` : `Недоступных обязательных ингредиентов заменено: ${genuinelyUnavailable.length}.`;
  events.push(finishEvent(state, "repair_plan", started, "Plan changed to satisfy constraints", "План изменён под ограничения", detailEn, detailRu, { model: primaryModel(), tokens, input: { unavailableIngredients, budget, previousTotal: state.total, failureCodes: state.validationErrors.map((error) => error.code) }, output: { recipe: data.recipe.titleEn, requiredIngredients: data.ingredients.filter((item) => item.required).length } }));
  return {
    interpretationBundle: data, interpretedRequest: data.interpretedRequest,
    clarification: { required: false }, planningRetryCount: state.planningRetryCount + 1,
    missingIngredientKeys: [], candidateGroups: [], selection: undefined, validationErrors: [], retryCount: 0, inspectorEvents: events,
  };
}

export function preserveCurrentSelection(state: Pick<GroceryAgentState, "currentSelection" | "candidateGroups" | "ingredientRequirements">, proposed: ProductSelection): ProductSelection {
  const byIngredient = new Map(proposed.selectedItems.map((item) => [item.ingredientKey, item]));
  for (const current of state.currentSelection) {
    const requirement = state.ingredientRequirements.find((item) => item.key === current.ingredientKey);
    const product = state.candidateGroups.find((group) => group.ingredientKey === current.ingredientKey)?.products.find((candidate) => candidate.id === current.productId);
    if (!requirement || !product) continue;
    if (productCapacityUnit(product) !== requirement.unit) continue;
    const minimumQuantity = Math.max(1, Math.ceil(requirement.quantity / productCapacity(product)));
    const quantity = Math.max(current.quantity, minimumQuantity);
    if (quantity > product.stock) continue;
    byIngredient.set(current.ingredientKey, {
      productId: product.id, ingredientKey: current.ingredientKey, quantity,
      confidence: 1, reason: "Kept the valid product from the editable selection to minimize cart changes.",
    });
  }
  return { ...proposed, selectedItems: [...byIngredient.values()] };
}

async function modelSelection(state: GroceryAgentState, useFallback = false) {
  const node = useFallback ? "fallback_model" : "select_products";
  const model = useFallback ? fallbackModel() : primaryModel();
  const { started, events } = startEvent(state, node, useFallback ? "Switching to the fallback model" : "Choosing the best packs", useFallback ? "Переключаюсь на резервную модель" : "Выбираю подходящие упаковки");
  const interpreted = state.interpretedRequest;
  const { data, tokens } = await selectProducts(state.candidateGroups, {
    budget: interpreted?.budget || undefined, allergies: interpreted?.allergies || [], excluded: interpreted?.excludedIngredients || [], locale: state.locale,
    preferredProductIds: state.currentSelection.map((item) => item.productId),
  }, model);
  const selection = preserveCurrentSelection(state, data);
  events.push(finishEvent(state, node, started, useFallback ? "Fallback selection complete" : "Product selection complete", useFallback ? "Резервный подбор готов" : "Товары выбраны", `${selection.selectedItems.length} products selected from ${state.shortlistSize} candidates.`, `Выбрано товаров: ${selection.selectedItems.length} из ${state.shortlistSize} кандидатов.`, { model, tokens, candidates: state.shortlistSize, output: { selected: selection.selectedItems.length, preserved: state.currentSelection.filter((item) => selection.selectedItems.some((selected) => selected.productId === item.productId)).length, unresolved: selection.unresolvedIngredients.length, requiresFallback: selection.requiresFallback } }));
  return { selection, activeModel: model, retryCount: useFallback ? state.retryCount + 1 : state.retryCount, inspectorEvents: events };
}

const selectPrimary = (state: GroceryAgentState) => modelSelection(state, false);
const selectFallback = (state: GroceryAgentState) => modelSelection(state, true);

function validate(state: GroceryAgentState) {
  const { started, events } = startEvent(state, "validate_selection", "Checking every cart rule", "Проверяю корзину");
  if (!state.selection) throw new Error("No product selection is available for validation.");
  const interpreted = state.interpretedRequest;
  const result = validateSelection(state.selection, state.ingredientRequirements, state.candidateGroups, {
    budget: interpreted?.budget || undefined, allergies: interpreted?.allergies || [], excluded: interpreted?.excludedIngredients || [], requiredDietaryTags: interpreted?.dietaryPreferences || [],
  });
  const status = result.valid ? "completed" : "warning";
  const event = inspectorEvent("validate_selection", status, result.valid ? "Selection validated" : "Selection needs repair", result.valid ? "Подбор проверен" : "Нужна замена", result.valid ? `All server checks passed · $${result.total.toFixed(2)}.` : `${result.errors.length} deterministic checks failed.`, result.valid ? `Все серверные проверки пройдены · $${result.total.toFixed(2)}.` : `Не пройдено проверок: ${result.errors.length}.`, { durationMs: Math.round(performance.now() - started), input: { selected: state.selection.selectedItems.length }, output: { valid: result.valid, total: result.total, errors: result.errors.map((error) => ({ code: error.code, ingredientKey: error.ingredientKey })) } });
  emitInspector(state.sessionId, event); events.push(event);
  return { validationErrors: result.errors, total: result.total, inspectorEvents: events };
}

function repair(state: GroceryAgentState) {
  const { started, events } = startEvent(state, "repair_selection", "Finding safe replacements", "Ищу безопасные замены");
  if (!state.selection) throw new Error("No selection is available to repair.");
  const interpreted = state.interpretedRequest;
  const repaired = repairSelection(state.selection, state.ingredientRequirements, state.candidateGroups, {
    budget: interpreted?.budget || undefined, allergies: interpreted?.allergies || [], excluded: interpreted?.excludedIngredients || [], requiredDietaryTags: interpreted?.dietaryPreferences || [],
  });
  events.push(finishEvent(state, "repair_selection", started, "Repair attempt complete", "Замены подобраны", `Rebuilt selection from verified candidates after ${state.validationErrors.length} validation errors.`, `Подбор перестроен после ${state.validationErrors.length} ошибок проверки.`, { output: { selected: repaired.selectedItems.length, attempt: state.retryCount + 1 } }));
  return { selection: repaired, retryCount: state.retryCount + 1, inspectorEvents: events };
}

function buildCart(state: GroceryAgentState) {
  const { started, events } = startEvent(state, "build_cart", "Building your cart", "Собираю корзину");
  if (!state.selection) throw new Error("No validated selection is available.");
  const products = getProductsByIds(state.selection.selectedItems.map((item) => item.productId));
  const productMap = new Map(products.map((product) => [product.id, product]));
  const items: CartItem[] = state.selection.selectedItems.flatMap((item) => {
    const product = productMap.get(item.productId);
    return product ? [{ product, quantity: item.quantity, reason: item.reason, ingredientKey: item.ingredientKey }] : [];
  });
  const total = Math.round(items.reduce((sum, item) => sum + item.product.price * item.quantity, 0) * 100) / 100;
  events.push(finishEvent(state, "build_cart", started, "Cart created", "Корзина собрана", `${items.length} products · $${total.toFixed(2)}.`, `${items.length} товаров · $${total.toFixed(2)}.`, { output: { itemCount: items.length, total } }));
  return { cartItems: items, total, inspectorEvents: events };
}

function composeResponse(state: GroceryAgentState) {
  const { started, events } = startEvent(state, "compose_user_response", "Preparing the summary", "Готовлю итог");
  const budget = state.interpretedRequest?.budget;
  const sourceBudget = state.budgetConstraint;
  const budgetLabelRu = budget ? sourceBudget && sourceBudget.currency !== "USD"
    ? `${sourceBudget.amount} ${sourceBudget.currency} (≈ $${budget.toFixed(2)})`
    : `$${budget.toFixed(2)}` : "";
  const budgetLabelEn = budget ? sourceBudget && sourceBudget.currency !== "USD"
    ? `${sourceBudget.amount} ${sourceBudget.currency} (about $${budget.toFixed(2)})`
    : `$${budget.toFixed(2)}` : "";
  const budgetTextRu = budget ? ` при бюджете ${budgetLabelRu}` : "";
  const budgetTextEn = budget ? ` against a ${budgetLabelEn} budget` : "";
  const skipped: Array<["ask_clarification" | "repair_plan" | "repair_selection" | "fallback_model", string, string]> = [
    ["ask_clarification", "Clarification was not needed", "Уточнение не потребовалось"],
    ["repair_plan", "Catalog replan was not needed", "Пересборка плана не потребовалась"],
    ["repair_selection", "Repair was not needed", "Замена не потребовалась"],
    ["fallback_model", "Fallback was not needed", "Резервная модель не потребовалась"],
  ];
  for (const [node, en, ru] of skipped) {
    if (!state.inspectorEvents.some((event) => event.node === node)) {
      const event = inspectorEvent(node, "skipped", en, ru, en, ru);
      emitInspector(state.sessionId, event); events.push(event);
    }
  }
  if (state.validationErrors.length) {
    const budgetError = state.validationErrors.find((error) => error.code === "budget_exceeded");
    if (budgetError && budget) {
      const suggested = Math.ceil(state.total * 100) / 100;
      const message = state.locale === "ru"
        ? `Строгий бюджет ${budgetLabelRu} не покрывает даже самый дешёвый проверенный вариант этого ужина — $${suggested.toFixed(2)}. Я не буду превышать лимит молча. Увеличьте бюджет хотя бы до $${suggested.toFixed(2)} или попросите ещё более простой вариант.`
        : `The strict ${budgetLabelEn} budget does not cover even the cheapest verified version of this dinner at $${suggested.toFixed(2)}. I will not silently exceed the limit. Raise the budget to at least $${suggested.toFixed(2)} or ask for an even simpler option.`;
      const event = inspectorEvent("compose_user_response", "warning", "Budget decision needed", "Нужно решение по бюджету", message, message, { durationMs: Math.round(performance.now() - started), output: { budget, verifiedMinimum: suggested } });
      emitInspector(state.sessionId, event); events.push(event);
      return { response: { status: "waiting" as const, kind: "meal" as const, message, error: "budget_infeasible" }, inspectorEvents: events };
    }
    const missingKeys = [...new Set(state.validationErrors.filter((error) => error.code === "missing_ingredient").map((error) => error.ingredientKey).filter(Boolean))];
    const missingNames = missingKeys.map((key) => state.ingredientRequirements.find((item) => item.key === key)?.displayName[state.locale] || key).join(", ");
    const dietaryClaims = normalizeDietaryTags(state.interpretedRequest?.dietaryPreferences || []);
    const message = dietaryClaims.length
      ? (state.locale === "ru" ? `В данных SKU нет товаров, подтверждающих все обязательные требования: ${dietaryClaims.join(", ")}. Я не буду называть корзину подходящей без такого подтверждения.` : `The SKU data has no products verifying every required claim: ${dietaryClaims.join(", ")}. I will not label the cart suitable without that evidence.`)
      : missingNames
      ? (state.locale === "ru" ? `В каталоге не нашлись обязательные ингредиенты: ${missingNames}. Попробуйте изменить блюдо или разрешить замену.` : `Required ingredients were not found in the catalog: ${missingNames}. Try changing the dish or allowing a substitution.`)
      : (state.locale === "ru" ? "Не удалось собрать безопасную корзину с текущими ограничениями. Попробуйте увеличить бюджет или изменить исключения." : "I couldn’t build a safe cart under the current constraints. Try increasing the budget or changing an exclusion.");
    const event = inspectorEvent("compose_user_response", "failed", "Request could not be completed", "Не удалось завершить подбор", message, message, { durationMs: Math.round(performance.now() - started) });
    emitInspector(state.sessionId, event); events.push(event);
    return { response: dietaryClaims.length
      ? { status: "waiting" as const, kind: "meal" as const, message, error: "unverified_dietary_claim" }
      : { status: "failed" as const, message, error: "validation_failed" }, inspectorEvents: events };
  }
  const title = state.recipe?.title[state.locale] || (state.locale === "ru" ? "ваше блюдо" : "your meal");
  const servings = state.recipe?.servings || 2;
  const portionLabel = servings % 10 === 1 && servings % 100 !== 11 ? "порцию" : servings % 10 >= 2 && servings % 10 <= 4 && (servings % 100 < 12 || servings % 100 > 14) ? "порции" : "порций";
  const leftovers = state.cartItems.flatMap((item) => {
    const requirement = state.ingredientRequirements.find((candidate) => candidate.key === item.ingredientKey);
    if (!requirement || productCapacityUnit(item.product) !== requirement.unit) return [];
    const purchased = productCapacity(item.product) * item.quantity;
    const excess = Math.round((purchased - requirement.quantity) * 1000) / 1000;
    return excess > 0.001 ? [{ item, requirement, purchased, excess }] : [];
  }).sort((a, b) => a.excess / a.purchased - b.excess / b.purchased)[0];
  const leftoverRu = leftovers ? ` Для «${leftovers.item.product.localeData.ru.name}» нужно ${formatBaseQuantity(leftovers.requirement.quantity, leftovers.requirement.unit, "ru")}; куплено ${formatBaseQuantity(leftovers.purchased, leftovers.requirement.unit, "ru")} (${leftovers.item.quantity} уп.) — остаток ${formatBaseQuantity(leftovers.excess, leftovers.requirement.unit, "ru")}.` : "";
  const leftoverEn = leftovers ? ` ${formatBaseQuantity(leftovers.requirement.quantity, leftovers.requirement.unit, "en")} of ${leftovers.item.product.localeData.en.name} is needed; ${formatBaseQuantity(leftovers.purchased, leftovers.requirement.unit, "en")} was purchased (${leftovers.item.quantity} packs), leaving ${formatBaseQuantity(leftovers.excess, leftovers.requirement.unit, "en")}.` : "";
  const message = state.locale === "ru"
    ? `Готово. Собрал «${title}» на ${servings} ${portionLabel} за $${state.total.toFixed(2)}${budgetTextRu}.${leftoverRu}`
    : `Done. I built ${title} for ${servings} ${servings === 1 ? "serving" : "servings"} for $${state.total.toFixed(2)}${budgetTextEn}.${leftoverEn}`;
  events.push(finishEvent(state, "compose_user_response", started, "Ready to review", "Всё готово", message, message, { model: state.activeModel, output: { total: state.total, itemCount: state.cartItems.length } }));
  return { response: { status: "completed" as const, kind: "meal" as const, message, recipe: state.recipe, items: state.cartItems, total: state.total }, inspectorEvents: events };
}

function routeAfterInterpret(state: GroceryAgentState) { return state.clarification?.required ? "ask_clarification" : "plan_recipe"; }
function routeAfterRetrieval(state: GroceryAgentState) {
  if (state.missingIngredientKeys.length && state.planningRetryCount < 2) return "repair_plan";
  return state.interpretedRequest?.isComplex ? "fallback_model" : "select_products";
}
function routeAfterValidation(state: GroceryAgentState) {
  if (!state.validationErrors.length) return "build_cart";
  if (state.validationErrors.some((error) => error.code === "budget_exceeded") && state.planningRetryCount < 2) return "repair_plan";
  if (state.retryCount < 1) return "repair_selection";
  if (state.activeModel !== fallbackModel()) return "fallback_model";
  if (state.retryCount < 3) return "repair_selection";
  return "compose_user_response";
}

export const groceryGraph = new StateGraph(GroceryState)
  .addNode("interpret_request", interpretRequest)
  .addNode("ask_clarification", askClarification)
  .addNode("plan_recipe", planRecipe)
  .addNode("repair_plan", repairPlan)
  .addNode("normalize_ingredients", normalizeIngredients)
  .addNode("retrieve_products", retrieveProducts)
  .addNode("select_products", selectPrimary)
  .addNode("validate_selection", validate)
  .addNode("repair_selection", repair)
  .addNode("fallback_model", selectFallback)
  .addNode("build_cart", buildCart)
  .addNode("compose_user_response", composeResponse)
  .addEdge(START, "interpret_request")
  .addConditionalEdges("interpret_request", routeAfterInterpret, ["ask_clarification", "plan_recipe"])
  .addEdge("ask_clarification", END)
  .addEdge("plan_recipe", "normalize_ingredients")
  .addEdge("normalize_ingredients", "retrieve_products")
  .addConditionalEdges("retrieve_products", routeAfterRetrieval, ["repair_plan", "select_products", "fallback_model"])
  .addEdge("repair_plan", "plan_recipe")
  .addEdge("select_products", "validate_selection")
  .addEdge("repair_selection", "validate_selection")
  .addEdge("fallback_model", "validate_selection")
  .addConditionalEdges("validate_selection", routeAfterValidation, ["build_cart", "repair_plan", "repair_selection", "fallback_model", "compose_user_response"])
  .addEdge("build_cart", "compose_user_response")
  .addEdge("compose_user_response", END)
  .compile();
