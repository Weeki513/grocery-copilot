import type { Locale } from "./types";

export const copy = {
  en: {
    brand: "Grocery Copilot", delivery: "Delivery to", address: "24 Garden Street", search: "Search 10,000 products",
    home: "Home", browse: "Browse", assistant: "Assistant", cart: "Cart", profile: "Profile",
    hello: "Good evening", headline: "What are we cooking?", aiTitle: "Your Grocery Copilot", aiBody: "Describe the meal. I’ll plan it, check every item, and build the cart.", tryIt: "Plan a meal",
    categories: "Shop by category", seeAll: "See all", popular: "Popular tonight", deals: "Fresh deals", add: "Add", added: "Added",
    catalog: "All groceries", filters: "Filters", inStock: "In stock", results: "products", noResults: "No products found", clearSearch: "Clear search",
    assistantTitle: "Grocery Copilot", assistantSub: "One request, a checked cart", input: "Describe a meal or ask for a change…", send: "Send",
    thinking: "Working on your cart", addAll: "Add all to cart", recipe: "Cooking plan", selection: "Selected groceries", why: "Why this one",
    emptyChat: "Tell me what you want to cook", emptyChatBody: "Include servings, budget, time, or foods to avoid. I’ll ask one question if something essential is missing.",
    cartTitle: "Your cart", emptyCart: "Your cart is empty", emptyCartBody: "Browse the store or let the copilot build a meal.", subtotal: "Subtotal", deliveryFee: "Delivery", savings: "You save", total: "Total", checkout: "Continue to checkout",
    checkoutTitle: "Checkout", deliveryAddress: "Delivery address", deliveryTime: "Delivery time", payment: "Payment", comment: "Courier note", placeOrder: "Place order", free: "Free",
    confirmed: "Demo order confirmed", confirmedBody: "This is a fictional demo checkout. No payment or delivery was submitted.", orderNumber: "Demo order number", backHome: "Back to home",
    inspector: "AI Inspector", inspectorSub: "Live workflow, safe to share", idle: "Idle", running: "Running", waiting: "Waiting", completed: "Completed", failed: "Failed",
    steps: "steps", catalogSize: "Catalog", shortlist: "Shortlist", model: "Model", events: "Execution log", noEvents: "Send a request to see the workflow run.",
    about: "About this product", allergens: "Allergens", ingredients: "Ingredients", storage: "Storage", origin: "Origin", stock: "in stock", lowStock: "Only a few left", unavailable: "Unavailable", similar: "You may also like",
  },
  ru: {
    brand: "Grocery Copilot", delivery: "Доставка по адресу", address: "Garden Street, 24", search: "Поиск среди 10 000 товаров",
    home: "Главная", browse: "Каталог", assistant: "Ассистент", cart: "Корзина", profile: "Профиль",
    hello: "Добрый вечер", headline: "Что сегодня готовим?", aiTitle: "Ваш продуктовый помощник", aiBody: "Опишите блюдо — я составлю план, всё проверю и соберу корзину.", tryIt: "Подобрать продукты",
    categories: "Категории", seeAll: "Все", popular: "Популярное сегодня", deals: "Свежие скидки", add: "Добавить", added: "Добавлено",
    catalog: "Все продукты", filters: "Фильтры", inStock: "В наличии", results: "товаров", noResults: "Ничего не найдено", clearSearch: "Очистить поиск",
    assistantTitle: "Продуктовый помощник", assistantSub: "Один запрос — проверенная корзина", input: "Опишите блюдо или попросите что-то изменить…", send: "Отправить",
    thinking: "Собираю вашу корзину", addAll: "Добавить всё в корзину", recipe: "План приготовления", selection: "Выбранные продукты", why: "Почему этот товар",
    emptyChat: "Расскажите, что хотите приготовить", emptyChatBody: "Укажите порции, бюджет, время или исключения. Если не хватит важной детали, я задам один вопрос.",
    cartTitle: "Ваша корзина", emptyCart: "Корзина пуста", emptyCartBody: "Выберите продукты в каталоге или попросите помощника собрать блюдо.", subtotal: "Товары", deliveryFee: "Доставка", savings: "Экономия", total: "Итого", checkout: "Перейти к оформлению",
    checkoutTitle: "Оформление", deliveryAddress: "Адрес доставки", deliveryTime: "Время доставки", payment: "Оплата", comment: "Комментарий курьеру", placeOrder: "Подтвердить заказ", free: "Бесплатно",
    confirmed: "Демо-заказ подтверждён", confirmedBody: "Это демонстрационное оформление. Платёж и реальная доставка не создавались.", orderNumber: "Номер демо-заказа", backHome: "На главную",
    inspector: "AI Inspector", inspectorSub: "Ход работы в реальном времени", idle: "Ожидание", running: "Выполняется", waiting: "Ждёт ответа", completed: "Завершено", failed: "Ошибка",
    steps: "шагов", catalogSize: "Каталог", shortlist: "Shortlist", model: "Модель", events: "Журнал выполнения", noEvents: "Отправьте запрос, чтобы увидеть работу графа.",
    about: "О товаре", allergens: "Аллергены", ingredients: "Состав", storage: "Хранение", origin: "Страна", stock: "в наличии", lowStock: "Осталось мало", unavailable: "Нет в наличии", similar: "Похожие товары",
  },
} as const;

export function t(locale: Locale) { return copy[locale]; }
export function price(value: number) { return `$${value.toFixed(2)}`; }
