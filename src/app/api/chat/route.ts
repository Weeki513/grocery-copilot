import type { AssistantResult, ChatMessage, InspectorNode, Locale, RecipePlan } from "@/lib/types";
import { resolveBudgetConstraint } from "@/server/business/budget";
import { resolveBusinessRoute, type BusinessSelectionContext } from "@/server/business/resolve-request";
import { minimumInStockPrice } from "@/server/catalog/repository";
import { emitInspector, inspectorEvent, registerEmitter, unregisterEmitter } from "@/server/ai/events";
import { groceryGraph } from "@/server/ai/graph";
import { AiConfigurationError, primaryModel, routeBusinessRequest } from "@/server/ai/openai";
import { AiBudgetLimitError, AiProtectionUnavailableError, acquireChatLease, chatProtectionConfig } from "@/server/ai/usage-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function frame(type: string, payload: unknown) { return `event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`; }

function errorDetails(error: unknown) {
  const candidate = error && typeof error === "object" ? error as Record<string, unknown> : {};
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    status: typeof candidate.status === "number" ? candidate.status : undefined,
    code: typeof candidate.code === "string" ? candidate.code : undefined,
    type: typeof candidate.type === "string" ? candidate.type : undefined,
  };
}

export function safeRecipe(value: unknown): RecipePlan | undefined {
  if (!value || typeof value !== "object") return undefined;
  const recipe = value as Partial<RecipePlan>;
  if (!recipe.title?.en || !recipe.title.ru || !recipe.summary?.en || !recipe.summary.ru || !Array.isArray(recipe.steps?.en) || !Array.isArray(recipe.steps.ru)) return undefined;
  return {
    title: { en: String(recipe.title.en).slice(0, 120), ru: String(recipe.title.ru).slice(0, 120) },
    summary: { en: String(recipe.summary.en).slice(0, 260), ru: String(recipe.summary.ru).slice(0, 260) },
    servings: Math.max(1, Math.min(500, Number(recipe.servings || 1))),
    cookingTimeMinutes: Math.max(0, Math.min(300, Number(recipe.cookingTimeMinutes || 0))),
    steps: { en: recipe.steps.en.slice(0, 8).map((step) => String(step).slice(0, 240)), ru: recipe.steps.ru.slice(0, 8).map((step) => String(step).slice(0, 240)) },
  };
}

function emitDirectWorkflow(sessionId: string, result: AssistantResult) {
  const skip = (node: InspectorNode, en: string, ru: string) => emitInspector(sessionId, inspectorEvent(node, "skipped", en, ru, en, ru));
  for (const [node, en, ru] of [
    ["interpret_request", "Recipe interpretation was not required", "Анализ рецепта не требовался"],
    ["ask_clarification", "Clarification was not required", "Уточнение не требовалось"],
    ["plan_recipe", "Recipe planning was not required", "Рецепт не требовался"],
    ["repair_plan", "Recipe replanning was not required", "Пересборка рецепта не требовалась"],
    ["normalize_ingredients", "Ingredient sizing was not required", "Расчёт ингредиентов не требовался"],
  ] as Array<[InspectorNode, string, string]>) skip(node, en, ru);

  emitInspector(sessionId, inspectorEvent("retrieve_products", "completed", "Catalog capability checked", "Возможности каталога проверены", "Matched the goal against verified catalog uses.", "Цель сопоставлена с проверенными назначениями товаров."));
  if (result.items?.length) {
    emitInspector(sessionId, inspectorEvent("select_products", "completed", "In-stock product selected", "Товар в наличии выбран", `${result.items.length} verified product selected.`, `Выбрано проверенных товаров: ${result.items.length}.`, { candidates: result.items.length }));
  } else {
    skip("select_products", "No safe product could be selected", "Безопасный товар не найден");
  }
  emitInspector(sessionId, inspectorEvent("validate_selection", "completed", "Business constraints enforced", "Ограничения бизнеса проверены", "Only products with a verified matching use were allowed.", "Разрешены только товары с подтверждённым подходящим назначением."));
  skip("repair_selection", "Selection repair was not required", "Замена товара не требовалась");
  skip("fallback_model", "Fallback model was not required", "Резервная модель не требовалась");
  if (result.items?.length) emitInspector(sessionId, inspectorEvent("build_cart", "completed", "Cart selection prepared", "Подбор для корзины готов", `${result.items.length} product ready to add.`, `Готово к добавлению товаров: ${result.items.length}.`));
  else skip("build_cart", "No unrelated cart was created", "Несвязанная корзина не создавалась");
  emitInspector(sessionId, inspectorEvent("compose_user_response", "completed", "Decision explained", "Решение объяснено", result.message, result.message));
}

function emitBudgetDecisionWorkflow(sessionId: string, result: AssistantResult) {
  const skip = (node: InspectorNode, en: string, ru: string) => emitInspector(sessionId, inspectorEvent(node, "skipped", en, ru, en, ru));
  for (const [node, en, ru] of [
    ["interpret_request", "Recipe interpretation stopped at the budget gate", "Анализ рецепта остановлен на проверке бюджета"],
    ["ask_clarification", "Recipe clarification was not reached", "Уточнение рецепта не выполнялось"],
    ["plan_recipe", "No recipe was planned beyond the verified budget", "Рецепт за пределами подтверждённого бюджета не создавался"],
    ["repair_plan", "Replanning cannot overcome the minimum SKU price", "Пересборка не может обойти минимальную цену товара"],
    ["normalize_ingredients", "Ingredient sizing was not required", "Расчёт ингредиентов не требовался"],
    ["retrieve_products", "Catalog retrieval was not required", "Поиск товаров не требовался"],
    ["select_products", "No products were selected", "Товары не выбирались"],
  ] as Array<[InspectorNode, string, string]>) skip(node, en, ru);
  emitInspector(sessionId, inspectorEvent("validate_selection", "completed", "Currency and budget checked", "Валюта и бюджет проверены", result.message, result.message));
  skip("repair_selection", "Selection repair was not required", "Замена товаров не требовалась");
  skip("fallback_model", "Fallback model was not required", "Резервная модель не требовалась");
  skip("build_cart", "No over-budget cart was created", "Корзина сверх бюджета не создавалась");
  emitInspector(sessionId, inspectorEvent("compose_user_response", "completed", "Budget decision explained", "Решение по бюджету объяснено", result.message, result.message));
}

export async function POST(request: Request) {
  const protection = chatProtectionConfig();
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > protection.maxBodyBytes) return Response.json({ error: "request_too_large", message: "The request is too large." }, { status: 413 });
  let body: {
    sessionId?: string; locale?: Locale; message?: string; conversation?: ChatMessage[];
    selectionContext?: { recipe?: RecipePlan; kind?: "meal" | "shopping"; total?: number; items?: Array<{ id?: string; name?: string; quantity?: number; unitPrice?: number; ingredientKey?: string }> };
  };
  try {
    body = await request.json() as typeof body;
  } catch {
    return Response.json({ error: "invalid_json", message: "The request body must be valid JSON." }, { status: 400 });
  }
  if (Buffer.byteLength(JSON.stringify(body), "utf8") > protection.maxBodyBytes) return Response.json({ error: "request_too_large", message: "The request is too large." }, { status: 413 });
  if (typeof body.sessionId !== "string" || body.sessionId.length > 120 || typeof body.message !== "string" || !body.message.trim() || !["en", "ru"].includes(body.locale || "")) {
    return Response.json({ error: "Invalid sessionId, locale, or message." }, { status: 400 });
  }
  const sessionId = body.sessionId.trim();
  const requestId = crypto.randomUUID();
  const locale = body.locale as Locale;
  const message = body.message.trim();
  if (message.length > protection.maxMessageChars) {
    return Response.json({ error: "message_too_long", message: locale === "ru" ? `Сообщение слишком длинное. Ограничьте его ${protection.maxMessageChars} символами.` : `The message is too long. Keep it under ${protection.maxMessageChars} characters.` }, { status: 413 });
  }
  const lease = await acquireChatLease(request, sessionId);
  if (!lease.allowed) {
    const message = locale === "ru"
      ? lease.reason === "protection_unconfigured" ? "Публичная защита AI ещё не настроена. Добавьте общий Redis-лимитер и повторите запрос."
        : lease.reason === "protection_unavailable" ? "Общий лимитер AI временно недоступен. Повторите через несколько секунд."
        : lease.reason === "daily_limit" ? "Дневной лимит AI для этой демо-версии исчерпан. Попробуйте завтра."
        : lease.reason === "concurrency_limit" ? "Сейчас выполняется слишком много AI-запросов. Повторите через несколько секунд."
          : "Слишком много запросов. Повторите через минуту."
      : lease.reason === "protection_unconfigured" ? "Public AI protection is not configured yet. Add a shared Redis limiter and try again."
        : lease.reason === "protection_unavailable" ? "The shared AI limiter is temporarily unavailable. Try again shortly."
        : lease.reason === "daily_limit" ? "The daily AI limit for this demo has been reached. Try again tomorrow."
        : lease.reason === "concurrency_limit" ? "Too many AI requests are running right now. Try again in a few seconds."
          : "Too many requests. Try again in a minute.";
    const protectionUnavailable = lease.reason === "protection_unconfigured" || lease.reason === "protection_unavailable";
    return Response.json({ error: protectionUnavailable ? "shared_usage_protection_unavailable" : "usage_protection", message }, { status: protectionUnavailable ? 503 : 429, headers: { "Retry-After": String(lease.retryAfterSeconds) } });
  }
  const conversation = Array.isArray(body.conversation) ? body.conversation
    .filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
    .slice(-12)
    .map((item) => ({ ...item, content: item.content.slice(0, 1200) })) : [];
  let currentSelection: Array<{ productId: string; ingredientKey: string; quantity: number }> = [];
  let businessSelection: BusinessSelectionContext = { items: [] };
  if (body.selectionContext?.items?.length) {
    const safeSelection = {
      recipe: safeRecipe(body.selectionContext.recipe), kind: body.selectionContext.kind,
      total: Number(body.selectionContext.total || 0),
      items: body.selectionContext.items.slice(0, 30).map((item) => ({
        id: String(item.id || "").slice(0, 80), name: String(item.name || "").slice(0, 160),
        quantity: Math.max(1, Math.min(500, Number(item.quantity || 1))), unitPrice: Number(item.unitPrice || 0),
        ingredientKey: String(item.ingredientKey || "").slice(0, 64),
      })),
    };
    currentSelection = safeSelection.items.filter((item) => item.id && item.ingredientKey).map((item) => ({ productId: item.id, ingredientKey: item.ingredientKey, quantity: item.quantity }));
    businessSelection = { recipe: safeSelection.recipe, kind: safeSelection.kind, items: currentSelection };
    conversation.push({ id: "current-selection", role: "assistant", content: `Current editable grocery selection: ${JSON.stringify({ recipe: safeSelection.recipe?.title, total: safeSelection.total, items: safeSelection.items })}`, createdAt: new Date().toISOString() });
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, payload: unknown) => controller.enqueue(encoder.encode(frame(type, payload)));
      registerEmitter(sessionId, (event) => send("inspector", event));
      send("status", { status: "running", sessionId });
      try {
        const routeStarted = performance.now();
        emitInspector(sessionId, inspectorEvent("route_business_request", "active", "Checking business fit", "Проверяю задачу", "Matching the goal to verified catalog capabilities.", "Сопоставляю цель с проверенными возможностями каталога."));
        const routed = await routeBusinessRequest(message, locale, conversation, Boolean(currentSelection.length));
        emitInspector(sessionId, inspectorEvent("route_business_request", "completed", "Business route selected", "Маршрут выбран", routed.data.mode === "meal" || routed.data.mode === "meal_edit" ? "Continue with grocery planning." : routed.data.explanationEn, routed.data.mode === "meal" || routed.data.mode === "meal_edit" ? "Продолжаю подбор продуктов." : routed.data.explanationRu, { durationMs: Math.round(performance.now() - routeStarted), model: primaryModel(), tokens: routed.tokens, output: { mode: routed.data.mode, capability: routed.data.capability, match: routed.data.match, families: routed.data.targetFamilyIds } }));
        const budgetResolution = await resolveBudgetConstraint(message, {
          amount: routed.data.budgetAmount,
          currencyCode: routed.data.budgetCurrencyCode,
          currencyDisplay: routed.data.budgetCurrencyDisplay,
          ambiguous: routed.data.budgetCurrencyAmbiguous,
        });
        if (budgetResolution.status === "invalid") {
          const result: AssistantResult = { status: "waiting", kind: routed.data.mode === "catalog" ? "shopping" : "meal", message: locale === "ru"
            ? "Бюджет должен быть больше нуля. Укажите положительный лимит — я не буду превращать нулевую или отрицательную сумму в другой бюджет."
            : "The budget must be greater than zero. Provide a positive limit; I will not turn a zero or negative amount into a different budget." };
          emitBudgetDecisionWorkflow(sessionId, result); send("result", result); return;
        }
        if (budgetResolution.status === "ambiguous") {
          const result: AssistantResult = { status: "waiting", kind: "meal", message: locale === "ru"
            ? `Уточните валюту бюджета «${budgetResolution.input.display}» трёхбуквенным кодом, например USD, EUR, SEK или NOK.`
            : `Please clarify the budget currency “${budgetResolution.input.display}” with a three-letter code such as USD, EUR, SEK, or NOK.` };
          emitBudgetDecisionWorkflow(sessionId, result); send("result", result); return;
        }
        if (budgetResolution.status === "unsupported" || budgetResolution.status === "unavailable") {
          const code = budgetResolution.input.currencyCode || budgetResolution.input.display;
          const result: AssistantResult = { status: "waiting", kind: "meal", message: locale === "ru"
            ? `Не удалось получить проверенный курс для ${code}. Укажите бюджет в другой валюте или повторите запрос позже — я не буду угадывать курс.`
            : `I could not obtain a verified exchange rate for ${code}. Use another currency or try again later; I will not guess the rate.` };
          emitBudgetDecisionWorkflow(sessionId, result); send("result", result); return;
        }
        const parsedBudget = budgetResolution.status === "resolved" ? budgetResolution.budget : undefined;
        const direct = resolveBusinessRoute(routed.data, locale, businessSelection, parsedBudget);
        if (direct) {
          emitDirectWorkflow(sessionId, direct);
          send("result", direct);
          return;
        }
        const priceFloor = minimumInStockPrice();
        if (parsedBudget && parsedBudget.usdAmount < priceFloor) {
          const budgetLabel = parsedBudget.currency === "USD" ? `$${parsedBudget.usdAmount.toFixed(2)}` : `${parsedBudget.amount} ${parsedBudget.currency} (~$${parsedBudget.usdAmount.toFixed(2)})`;
          const message = locale === "ru"
            ? `Бюджет ${budgetLabel} ниже минимальной цены любого доступного товара ($${priceFloor.toFixed(2)}). Собрать ужин в этом лимите невозможно. Увеличьте бюджет — тогда я предложу самый доступный полноценный вариант.`
            : `The ${budgetLabel} budget is below the lowest price of any available product ($${priceFloor.toFixed(2)}). A dinner cannot be built within that limit. Increase the budget and I will propose the cheapest complete option.`;
          const result: AssistantResult = { status: "waiting", kind: "meal", message };
          emitBudgetDecisionWorkflow(sessionId, result);
          send("result", result);
          return;
        }
        const result = await groceryGraph.invoke({
          sessionId, locale, userRequest: message, conversation,
          currentSelection, budgetConstraint: parsedBudget,
          retryCount: 0, planningRetryCount: 0, missingIngredientKeys: [], validationErrors: [], inspectorEvents: [], cartItems: [], candidateGroups: [], ingredientRequirements: [],
        }, { recursionLimit: 30 });
        send("result", result.response || { status: "failed", message: locale === "ru" ? "Не удалось сформировать ответ." : "The response could not be prepared." });
      } catch (error) {
        const configuration = error instanceof AiConfigurationError;
        const budgetLimit = error instanceof AiBudgetLimitError;
        const protectionUnavailable = error instanceof AiProtectionUnavailableError;
        console.error("[api/chat] workflow failed", { requestId, sessionId, ...errorDetails(error) });
        const message = budgetLimit
          ? (locale === "ru" ? "Дневной лимит AI достигнут. Новые AI-запросы временно остановлены для защиты API-баланса." : "The daily AI limit has been reached. New AI requests are paused to protect the API budget.")
          : configuration
          ? (locale === "ru" ? "Добавьте OPENAI_API_KEY в файл .env.local и перезапустите приложение." : "Add OPENAI_API_KEY to .env.local and restart the app.")
          : protectionUnavailable
          ? (locale === "ru" ? "Общий лимитер AI временно недоступен. Повторите запрос позже." : "The shared AI limiter is temporarily unavailable. Try again later.")
          : (locale === "ru" ? "AI-сервис временно недоступен. Проверьте модель и повторите запрос." : "The AI service is temporarily unavailable. Check the configured model and try again.");
        send("error", { error: budgetLimit ? "ai_budget_limit" : configuration ? "missing_api_key" : protectionUnavailable ? "shared_usage_protection_unavailable" : "ai_request_failed", message, requestId });
      } finally {
        unregisterEmitter(sessionId);
        lease.release();
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
