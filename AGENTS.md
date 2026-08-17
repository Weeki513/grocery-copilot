# AGENTS.md — Grocery Copilot

Этот файл — стартовая карта проекта для следующего агента. Он действует для всего репозитория `/Users/wk513/Projects/Grocery Copilot`.

Последняя проверка документа: 2026-07-15 06:30, Asia/Tbilisi (UTC+4).

## 1. Что это за проект

Grocery Copilot — локальный pitch-ready прототип продуктового магазина с AI-ассистентом. Пользователь описывает блюдо или бытовую задачу естественным языком. Приложение должно либо решить задачу товарами из реального локального каталога, либо честно объяснить, почему это невозможно.

Основной продуктовый принцип:

> Помочь пользователю решить исходную задачу и добавить подходящие товары в корзину, не выдумывая ассортимент, свойства, цены, наличие, безопасность или назначение товара.

Десктопный экран разделён на две части:

- слева — интерактивное grocery-приложение в рамке телефона;
- справа — AI Inspector с реальными безопасными событиями workflow.

Интерфейс двуязычный: EN/RU. Цены каталога хранятся и отображаются в USD. Пользовательский бюджет может быть указан в любой распознаваемой валюте и детерминированно переводится в USD.

## 2. Текущее подтверждённое состояние

- Next.js 16.2.10, React 19, TypeScript, Zustand, LangGraph.js, OpenAI Responses API, Zod, SQLite/FTS5.
- В `data/grocery-copilot.db` находится ровно 10 000 SKU.
- Основная модель: `gpt-5.6-luna`; fallback: `gpt-5.6-terra`.
- Каталог, поиск, карточка товара, профиль, корзина, checkout, история чатов и AI Inspector работают локально.
- AI выдаёт только структурированные решения; цены, остатки и товарные данные перечитываются с сервера.
- Последняя полная проверка: 77 тестов, typecheck, lint и production build прошли.
- Последний живой сценарий: обед на 50 человек. Результат в UI показал 42 упаковки, 8,25 кг курицы при требовании 8 кг и итог $166.56; browser console и Next.js overlay были чистыми.
- Репозиторий сейчас не инициализирован как Git-репозиторий. Не рассчитывай на `git log` как источник истории.

## 3. Что читать в начале задачи

Не перечитывай весь проект без необходимости.

1. Сначала этот файл.
2. Для истории решений и известных проблем — `CHANGELOG.md`.
3. Для исходных продуктовых требований — только релевантный раздел `spec.md`.
4. Для команд запуска — `package.json` и раздел команд ниже.
5. Затем открой только файлы подсистемы, которую меняешь.

`README.md` полезен как обзор, но частично устарел: в нём всё ещё упомянуты `MemorySaver`, checkpoint/resume и graph interrupt. В текущем коде их нет. Актуальная схема описана ниже.

## 4. Быстрый запуск

```bash
npm install
npm run db:migrate
npm run catalog:generate
npm run catalog:validate
npm run dev
```

Открыть:

- `http://localhost:3000/en`
- `http://localhost:3000/ru`

Если каталог уже содержит ровно 10 000 SKU, повторная генерация не нужна.

## 5. Переменные окружения

Локальный `.env` уже создан и игнорируется Git. Никогда не выводи его содержимое и не логируй ключ.

```dotenv
OPENAI_API_KEY=
OPENAI_PRIMARY_MODEL=gpt-5.6-luna
OPENAI_FALLBACK_MODEL=gpt-5.6-terra
CHAT_RATE_LIMIT_PER_MINUTE=5
CHAT_DAILY_REQUEST_LIMIT=50
CHAT_MAX_CONCURRENT_REQUESTS=2
CHAT_MAX_MESSAGE_CHARS=600
CHAT_MAX_BODY_BYTES=50000
OPENAI_MAX_CALLS_PER_DAY=120
OPENAI_MAX_OUTPUT_TOKENS=1600
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
DATABASE_URL="file:./data/grocery-copilot.db"
```

Дополнительные fallback-курсы можно задать через `GEL_PER_USD` и `RUB_PER_USD`.

После изменения `.env` перезапусти dev server.

Для публичной публикации `/api/chat` уже защищён серверными лимитами: IP/session rate limit, дневной cap запросов, concurrency cap, ограничения размера входа, дневной cap OpenAI-вызовов и `max_output_tokens`. При заданных `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` IP/session и дневные caps общие между инстансами; без них локальная разработка работает на process-local fallback. Provider-level spend/rate limits всё равно обязательны.

## 6. Карта файлов

### UI

- `src/components/grocery-app.tsx` — переключает экраны и объединяет phone app с Inspector.
- `src/components/phone-shell.tsx` — рамка устройства, status bar и нижняя навигация.
- `src/components/home-screen.tsx` — главная, переход в поиск с автофокусом и карточка ассистента.
- `src/components/catalog-screen.tsx` — поиск, категории, pagination и доказательство 10 000 SKU.
- `src/components/assistant-screen.tsx` — home/chat/history, SSE-клиент, продолжение существующей подборки, карточка результата.
- `src/components/cart-screen.tsx` — обычные quantity controls, очистка корзины и суммы.
- `src/components/product-screen.tsx` — карточка SKU и локализованные метаданные.
- `src/components/profile-screen.tsx` — рабочий локальный профиль и переключатель языка.
- `src/components/inspector.tsx` — визуализация событий графа.
- `src/store/grocery-store.ts` — persisted Zustand state.
- `src/app/globals.css` — почти весь CSS; файл плотный, много правил записано в длинные строки.

### Chat/API

- `src/app/api/chat/route.ts` — SSE route, business routing, currency gate, direct catalog branch и запуск LangGraph.
- `src/server/ai/openai.ts` — OpenAI clients, system contracts, business router, planning и selection calls.
- `src/server/ai/schemas.ts` — Zod structured outputs.
- `src/server/ai/graph.ts` — реальный StateGraph и переходы.
- `src/server/ai/state.ts` — Annotation state.
- `src/server/ai/events.ts` — in-process emitter событий Inspector.

### Бизнес-ограничения

- `src/server/business/capabilities.ts` — допустимые функции бизнеса и товарных семейств.
- `src/server/business/resolve-request.ts` — детерминированное выполнение catalog/unsupported/clarify запросов.
- `src/server/business/budget.ts` — парсинг валют, локализованных сумм, live FX и строгие budget gates.
- `src/server/business/servings.ts` — детерминированное извлечение числа людей/порций до 500.
- `src/server/business/audience.ts` — разбиение общей аудитории на standard/vegetarian/vegan подгруппы.
- `src/server/business/quantities.ts` — умножение per-serving нормы на покрываемое число людей.

### Каталог и валидация

- `src/server/catalog/families.ts` — товарные семейства и синонимы.
- `src/server/catalog/generator.ts` — seed-based генерация SKU, натуральных описаний и контролируемой грязи данных.
- `src/server/catalog/repository.ts` — единственный слой доступа к SQLite.
- `src/server/catalog/retrieval.ts` — FTS5, фильтры, constraints и shortlist.
- `src/server/catalog/planning-context.ts` — компактный список доступных семейств для планировщика.
- `src/server/validation/selection.ts` — серверная проверка и детерминированный repair.
- `src/lib/product-quantity.ts` — ёмкость упаковки и человекочитаемая разбивка количества.
- `src/lib/product-metadata.ts` — локализованные строки карточки товара.

### Проверки

- `tests/catalog.test.ts` — 10 000 SKU, категории, поиск и качество данных.
- `tests/validation.test.ts` — SKU safety, stock, allergens, quantity coverage и repair.
- `tests/business.test.ts` — capabilities, валюты, группы людей и метаданные.
- `tests/schemas.test.ts` — строгие structured outputs.
- `tests/product-quantity.test.ts` — доказательство упаковок и общего веса.
- `evals/cases.ts` — 20 стабильных продуктовых сценариев.

## 7. Актуальная архитектура запроса

Входящий запрос сначала проходит общий business router, а не сразу recipe graph.

```text
POST /api/chat
  → routeBusinessRequest
  → resolveBudgetConstraint
  → invalid / ambiguous / unavailable budget? → waiting response
  → resolveBusinessRoute
      catalog / clarify / unsupported → direct deterministic response
      meal / meal_edit               → groceryGraph.invoke
```

Meal graph:

```text
START
  → interpret_request
  → clarification required?
      yes → ask_clarification → END
      no  → plan_recipe
  → normalize_ingredients
  → retrieve_products
  → select_products OR fallback_model
  → validate_selection
      valid → build_cart
      budget problem → repair_plan (до лимита)
      repairable → repair_selection
      repeated model failure → fallback_model
  → compose_user_response
  → END
```

Важно: уточнение сейчас завершает invocation. Следующее сообщение приходит новым API-вызовом вместе с последними сообщениями клиента. Durable checkpoint и настоящий graph resume не реализованы.

## 8. Ключевые инварианты

### 8.1 Сервер — единственный источник истины

Модель может вернуть только `productId`, количество упаковок, `ingredientKey`, confidence и короткую причину. Она не имеет права определять итоговую цену, наличие, название или скидку.

После model selection сервер обязан:

- перечитать SKU из SQLite;
- проверить, что SKU был в shortlist;
- проверить stock/inStock;
- проверить аллергены, исключения и обязательные dietary tags;
- проверить достаточность объёма;
- рассчитать total по цене базы;
- отклонить или repair-ить невалидную подборку.

### 8.2 Количество ингредиентов задаётся на одну порцию

В `InterpretationBundleSchema` используется `quantityPerServing`, а не общий `quantity`.

```text
total requirement = quantityPerServing × servings covered by servingGroupIds
```

- `servingGroupIds: ["all"]` покрывает всех.
- Group-specific ингредиент покрывает только сумму указанных групп.
- Нельзя возвращаться к неоднозначному полю `quantity`: именно оно привело к корзине, где 80 г курицы считались достаточными для 50 человек.

### 8.3 Частичное ограничение не распространяется автоматически на остальных

Если 10 из 30 гостей — вегетарианцы:

- shared sides могут покрывать всех 30;
- vegetarian protein должен покрыть 10;
- обычный мясной/рыбный protein должен покрыть оставшихся 20;
- глобальные аллергены остаются глобальными для общей кухни.

### 8.4 Capability прежде названия

Ассистент должен понимать функциональную цель пользователя.

- Бумажное полотенце может быть функциональной заменой салфетки для вытирания.
- Кухонный cleaner нельзя объявлять средством для пола без подтверждённого назначения.
- Огурец, хлеб или вода не могут заменять салфетки, средство для пола или мусорные пакеты.
- Grocery catalog не может решить покупку Mercedes.

Если безопасной функциональной замены нет, ответ должен быть честным `waiting`, а корзина не должна мутировать.

### 8.5 Сертификационные claims требуют данных SKU

Halal, kosher, organic, gluten-free при целиакии и подобные требования нельзя выводить из названия блюда или состава «на глаз». Требуется соответствующий verified `dietaryTag` в SKU. При отсутствии подтверждения ассистент отказывает, а не обещает безопасность.

### 8.6 Бюджет строгий

- Ноль и отрицательное значение не превращаются в другой бюджет.
- Валюта не угадывается при реальной неоднозначности (`500 kr`, голый `¥`).
- Любой распознанный ISO 4217 budget переводится через Frankfurter; GEL/RUB имеют настраиваемый fallback.
- Если бюджет ниже минимальной цены SKU, recipe graph не запускается.
- Нельзя молча превысить budget.

### 8.7 Пользователь подтверждает добавление

AI result — редактируемая подборка. Она не попадает в основную корзину, пока пользователь не нажмёт «Добавить всё в корзину».

## 9. Клиентское состояние и чаты

Zustand persist key: `ladle-grocery-state`, текущая версия 2.

Сохраняются:

- locale;
- cart;
- chatSessions;
- активные messages/inspectorEvents;
- assistantResult;
- sessionId;
- последний локальный order.

Новый запрос из assistant home вызывает `startNewChat()` и создаёт отдельную историю. Продолжение внутри существующего chat отправляет `selectionContext`, чтобы модель могла пересобрать текущий заказ.

Inspector хранит максимум 80 клиентских событий на активный chat.

## 10. Каталог

- Генератор детерминирован seed `513`.
- База: `data/grocery-copilot.db`.
- SQLite-файл и WAL игнорируются Git.
- Поиск: bilingual FTS5 + category/stock/constraint filters.
- В модель передаётся максимум 12 кандидатов на ingredient group, а не весь каталог.
- Catalog API поддерживает `limit`/`offset`; UI загружает по 40 товаров.
- Доказательство масштаба отображает database total, число категорий, in-stock total и прогресс показанных результатов.

После изменения generator/families/schema:

```bash
npm run catalog:generate -- --force
npm run catalog:validate
npm run catalog:report
npm test
```

Не редактируй SQLite вручную, если проблему можно исправить в generator/repository и воспроизвести по seed.

## 11. Команды проверки

```bash
npm run typecheck
npm test
npm run lint
npm run build
npm run evals
npm run catalog:validate
npm run catalog:report
```

Минимум после обычного кода: typecheck + затронутые тесты. Перед передачей крупного изменения: typecheck + все tests + lint + build.

Для живой проверки SSE:

```bash
curl -N -sS --max-time 180 \
  -X POST http://localhost:3000/api/chat \
  -H 'Content-Type: application/json' \
  --data-binary '{
    "sessionId":"manual-check",
    "locale":"ru",
    "message":"Собери ужин на двоих до 25 USD",
    "conversation":[]
  }'
```

Проверяй не только финальный текст, но и:

- `normalize_ingredients`;
- shortlist size;
- validation errors/repair;
- item quantities против package capacity;
- total против database price;
- отсутствие API/system secrets в Inspector.

Для UI после изменения TSX/CSS сделай browser check: meaningful DOM, отсутствие Next.js overlay, отсутствие console errors, ключевые controls видимы и работают.

## 12. Типовые изменения и обязательные места

### Изменяется structured schema

Проверь одновременно:

- `src/server/ai/schemas.ts`;
- prompt/contract в `src/server/ai/openai.ts`;
- normalization в `src/server/ai/graph.ts`;
- типы в `src/lib/types.ts`;
- route sanitization в `src/app/api/chat/route.ts`;
- schema и integration tests.

### Изменяется логика количества

Не дублируй capacity math. Используй `src/lib/product-quantity.ts`. Проверь:

- g/kg и ml/l normalization;
- piece/package quantity;
- stock ceiling;
- UI breakdown `packs × pack size = total`;
- exact leftover calculation.

### Добавляется новая бытовая задача

Не делай prompt-only fix. Добавь/уточни:

- business capability;
- mapping товарного family;
- verified purpose;
- deterministic resolver/test;
- поведение при отсутствии подходящего SKU.

### Изменяется валюта

Не добавляй ad-hoc ветку только для одного слова, если работает ISO/model hint. Проверь localized separators, символы до/после суммы, ambiguity, zero/negative и отсутствие live rate.

### Изменяется assistant continuation

Проверь новый chat и existing chat отдельно. Selection context должен содержать текущие количества и ingredient keys. Запрос с `mode: new` не должен наследовать предыдущую корзину ассистента.

## 13. Диагностика

### AI отвечает общей ошибкой

1. Посмотри server output с `[api/chat] workflow failed` и `requestId`.
2. Определи этап по последнему Inspector event.
3. Проверь `.env` и доступность model ID, не печатая ключ.
4. Повтори запрос через `curl` и сохрани SSE trace.
5. Не лечи модельную ошибку заранее записанным ответом.

### Подбор не покрывает нужный объём

Проверь последовательно:

1. `quantityPerServing` модели.
2. `servingsCovered` после normalization.
3. required quantity в candidate group.
4. `productCapacity(product) × selected quantity`.
5. stock выбранного SKU.

### Нелепая замена

Сначала выясни функциональную цель, затем `BusinessCapability`, `targetFamilyIds`, `validatedFamilies`. Не расширяй searchTerms несвязанными товарами ради одного примера.

### Hydration warning на `<html>`

В проекте уже установлен `suppressHydrationWarning` на root `<html>`, потому что LanguageTool/похожие extensions добавляли `data-lt-installed` до hydration. Если предупреждение содержит только extension attributes, это не SSR business bug. Если отличаются реальные app attributes/text, ищи nondeterminism и неправильную HTML-вложенность.

### CSS assistant quantity control снова вертикальный

Старое правило `.selected-row div` затрагивает вложенные `div`. Внизу CSS есть более специфичный override `.selected-row .quantity-control{flex-direction:row}`. При рефакторинге лучше заменить слишком широкий selector, а не добавлять ещё глобальные overrides.

## 14. Известные ограничения и технический долг

Не скрывай эти пункты в следующем чате:

1. `safeRecipe()` в `src/app/api/chat/route.ts` ограничивает `selectionContext.recipe.servings` максимумом 20, хотя новый meal request поддерживает до 500. Продолжение уже собранного заказа на 50 человек может потерять исходное число порций. Это нужно исправить отдельной задачей и покрыть regression test.
2. Partial audience parser детерминированно понимает только vegetarian/vegan и только одну такую подгруппу. Аллергии остаются глобальными; сложные несколько подгрупп пока зависят от модели.
3. После ручного уменьшения количества прямо в карточке AI-result клиент пересчитывает цену, но не запускает повторную server validation. Пользователь может сделать подборку недостаточной и затем добавить её в cart.
4. Размер порции задаётся моделью под prompt-guardrails и затем масштабируется сервером. Отдельной nutrition/calorie validation пока нет.
5. Цены и ассортимент синтетические и детерминированные, а не рыночные. Математика корзины проверяема, но external price realism не заявлен.
6. Результаты model planning могут отличаться между одинаковыми запросами; server invariants должны оставаться стабильными.
7. Для валют, которых нет в GEL/RUB fallback, недоступность Frankfurter приводит к честному отказу, а не offline-конвертации.
8. Chat/session persistence только в browser local storage; server-side durable history нет.
9. Inspector emitter in-process; события не переживают restart и не подходят для нескольких server instances.
10. Нет настоящего LangGraph checkpoint/resume, несмотря на старое описание README.
11. Checkout фиктивный, authentication/payment/delivery backend отсутствуют.
12. Product images — emoji.
13. `README.md` требует синхронизации с текущей business-routing, currency, audience и quantity архитектурой.

## 15. Что нельзя делать

- Не отправлять полный каталог в модель.
- Не позволять модели быть источником цены, stock или total.
- Не показывать chain of thought, system prompt, API key или полный внутренний state.
- Не подменять отсутствие подходящего товара несвязанной рекомендацией.
- Не объявлять dietary certification без SKU evidence.
- Не молча превышать бюджет.
- Не лечить общий класс ошибок одной новой фразой в prompt или одним hardcoded product synonym.
- Не удалять пользовательский `.env` или локальную базу без явной необходимости.
- Не регенерировать 10 000 SKU на каждом запуске.
- Не считать успешный build доказательством UI: для визуальных изменений нужен browser check.

## 16. Definition of Done для следующего изменения

Изменение завершено, когда:

1. Исправлен класс проблемы, а не только присланный пример.
2. Сохранены server-authoritative price/stock/quantity/safety invariants.
3. Добавлен regression test на исходный failure mode.
4. Пройдены релевантные тесты и typecheck; для крупной работы также lint/build.
5. AI/UI изменение проверено живым запросом и/или браузером.
6. `AGENTS.md`/`CHANGELOG.md` обновлены, если изменилась архитектура, инварианты или заметная продуктовая история.
