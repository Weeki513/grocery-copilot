# Grocery Copilot build log

Это narrative engineering log, а не список релизов по SemVer. Он сохраняет продуктовые решения, ошибки, способы обнаружения, причины и проверки как материал для кейс-стади и pitch deck.

## Как читать временные метки

- Часовой пояс всей истории: Asia/Tbilisi, UTC+4.
- `точно` — время взято из имени пользовательского скриншота, runtime trace или filesystem timestamp.
- `интервал` — изменение происходило между двумя подтверждёнными артефактами.
- Ранние записи относятся к периоду до первой публикации репозитория и были восстановлены по исходным файлам, времени модификации, скриншотам и последовательности тестов.
- Одинаковый пользовательский запрос может дать другой рецепт и цену из-за модели; серверные инварианты должны оставаться одинаковыми.

---

## 2026-08-21

### Demo checkout CTA visibility

- Кнопка перехода к фиктивному оформлению теперь находится в потоке корзины и не перекрывается нижней навигацией телефона.
- Подпись desktop demo больше не называет приложение только локальным прототипом; checkout по-прежнему явно сообщает, что платёж и доставка не создаются.
- Футер AI Inspector получил ссылки на `pivnev.design` и GitHub-репозиторий проекта.

### Public release preparation

- Внутренние root-инструкции удалены, а продуктовые требования и narrative build log перенесены в `docs/`.
- Добавлены PolyForm Strict License 1.0.0, чистый clone setup через `.env.local` и Vercel deployment notes.
- Checkout получил bounded JSON handling, а continuation сохраняет recipes до 500 servings.

## 2026-08-17

### Vercel non-commercial engineering demo hardening

- Production build теперь сначала создаёт детерминированный 10 000-SKU SQLite/FTS5 artifact с `CATALOG_BUILD=1`; Vercel runtime автоматически открывает его read-only и не пытается создавать каталог в immutable filesystem.
- `ensureCatalog()` проверяет count/version read-only artifact и падает явно при повреждённом build output вместо тихой регенерации.
- Checkout сохранил server-authoritative SKU/stock/price validation, но убрал server-side `INSERT` в SQLite; confirmation остаётся фиктивным и browser-local.
- `/api/chat` получил `maxDuration = 60` и fail-closed поведение в Vercel при отсутствии или недоступности общего Upstash Redis limiter.
- UI и README явно называют checkout fictional demo flow; добавлены regression tests для build/runtime catalog modes.
- Проверка после изменения: 85 тестов, typecheck и lint прошли; production build и read-only runtime smoke подтверждают готовность инженерного demo-режима.

## 2026-07-15

### 00:16:30 — создана исходная спецификация (`точно`)

Сформулирован замысел AI Grocery Assistant Demo:

- законченный consumer grocery product вместо технического чата;
- мобильное приложение внутри desktop demo;
- реальный AI Inspector справа;
- один runtime LangGraph workflow;
- настоящий OpenAI API;
- 10 000 локальных SKU;
- компактный retrieval вместо передачи каталога модели;
- Zod structured outputs;
- серверная проверка SKU, цены, stock, бюджета, аллергенов и упаковок;
- RU/EN UI;
- рабочие catalog, cart и fictional checkout;
- 20 eval cases;
- цель полной корзины за 8–12 секунд.

Спецификация сразу задала важный архитектурный принцип: LLM предлагает, но детерминированный сервер рассчитывает и проверяет.

### Защита API перед публичной публикацией

Добавлены server-side rate limits по IP/session, ограничение параллельных запросов и размера входа, дневной лимит chat-запросов, дневной cap OpenAI-вызовов и ограничение output tokens. При достижении лимита новые AI-вызовы останавливаются. Для multi-instance deployment остаётся обязательной provider-level защита расходов и общий rate-limit слой.

### 00:30–00:35 — инициализация локального проекта и ENV (`интервал`)

Создан Next.js-проект `grocery-copilot`, установлены React 19, LangGraph, OpenAI SDK, Zod, Zustand, SQLite driver и тестовый стек.

Для локальной разработки предусмотрен ignored `.env.local`, куда можно добавить API key. Также добавлены:

- `.env.example` с `OPENAI_API_KEY`, Luna, Terra и SQLite URL;
- `.gitignore`, исключающий секреты, generated DB, `.next`, `node_modules` и TypeScript build info.

Security-решение: ключ читается только server code, не возвращается клиенту и не попадает в Inspector.

### 00:38–00:56 — первый end-to-end каркас (`точные границы по файлам`)

Реализованы основные подсистемы.

#### Каталог

- Procedural generator с фиксированным seed `513`.
- Ровно 10 000 SKU и 17 grocery/household категорий.
- Поля продукта по спецификации: bilingual content, price, previous price, unit/package metadata, ingredients, allergens, dietary tags, stock, emoji, storage, origin и quality flags.
- Воспроизводимая «грязь» контент-менеджмента: пустые бренды, missing descriptions, масса только в названии, near duplicates, inconsistent flags и другие дефекты.
- SQLite repository и FTS5.
- Scripts для migrate/generate/validate/report.

#### AI и orchestration

- StateGraph с interpretation, recipe planning, ingredient normalization, catalog retrieval, product selection, validation, repair, fallback, cart build и response composition.
- OpenAI Responses API с `responses.parse`.
- Строгие schemas: model selection возвращает только ID, количество, ingredient mapping, confidence и reason.
- Inspector event emitter через SSE.

#### Приложение

- Главная Grocery Copilot.
- Каталог, product cards и product details.
- AI Assistant с suggested prompts и streaming state.
- Корзина и fictional checkout.
- Phone frame и desktop Inspector.
- EN/RU copy и language toggle.
- Zustand persisted state.

#### Тесты и evals

- Тесты каталога, schemas и server validation.
- 20 eval scenarios в требуемом распределении.

### 00:54–00:56 — первый reproducible запуск (`точно`)

Обновлены `README.md`, `package.json`, TypeScript/Vitest configuration и database bootstrap. Проект получил команды для development, build, lint, typecheck, tests, evals и catalog operations.

---

### 02:55:49 — hydration warning из-за browser extension (`точно`)

#### Симптом

React сообщил, что server-rendered `<html>` не совпал с client properties. В diff появились:

- `suppresshydrationwarning="true"`;
- `data-lt-installed="true"`.

#### Как обнаружили

Пользователь прислал полный Next.js hydration overlay и call stack. Атрибут `data-lt-installed` указывал, что LanguageTool или похожее расширение модифицировало DOM до React hydration.

#### Решение

На root `<html>` установлен `suppressHydrationWarning`. Это локализовало известное внешнее расхождение и не скрывало ошибки внутри всего дерева.

#### Вывод

Не каждый hydration warning означает nondeterministic app render. Сначала нужно сравнить конкретные атрибуты и отделить extension mutation от SSR bug.

---

### 03:02:13–03:02:43 — исправлены базовые UX-переходы (`точно`)

#### Проблемы

- Кнопка Profile была нерабочей.
- Home search переводил в каталог, но не ставил фокус в search input.
- При открытии ассистента phone frame визуально уезжал вверх.
- Back внутри assistant должен был возвращать на assistant home, а не сразу покидать ассистента.
- На assistant home отсутствовал input для кастомного запроса.

#### Решения

- Добавлен полноценный `ProfileScreen` с локальными интерактивными разделами и language toggle.
- В Zustand введён `catalogAutofocus`; каталог фокусирует input после перехода через `requestAnimationFrame`.
- Исправлена структура/позиционирование phone screen и assistant layout.
- Assistant получил внутренние состояния `home | chat | history` и корректную семантику Back.
- На assistant home добавлен composer.

#### Продуктовый вывод

Навигационный элемент считается рабочим только тогда, когда выполняет ожидаемое действие, а не просто меняет визуальное состояние.

---

### 03:23:21–03:23:29 — повторный запрос разрушал смысл истории (`точно по скриншотам`)

#### Симптом

Запрос «Плотный ужин с курицей на двоих» дважды отправлялся в один и тот же экран и дважды завершался общим сообщением о невозможности собрать безопасную корзину. Пользователь не мог понять, это новая попытка или продолжение старого чата.

#### Дополнительная потребность

Нужна история чатов, а запрос из assistant home должен всегда начинать отдельный чат.

#### Решение

- Zustand store обновлён до persisted schema version 2.
- Добавлен `ChatSession` с title, timestamps, messages, Inspector events, status и result.
- Добавлены создание нового чата, открытие сохранённого и миграция старого single-chat state.
- Assistant home отправляет `mode: new`; внутри chat используется `mode: continue`.
- Добавлена history button и отдельный экран списка чатов.

#### Вывод

Conversation identity — часть корректности AI-продукта. Без явного new/continue одинаковые запросы дают непроверяемое поведение и загрязняют контекст.

---

### 03:41:51–03:53:24 — результат ассистента стал редактируемым (`точно по скриншотам и файлам`)

#### Проблемы на готовом подборе

1. После результата нельзя было написать следующее сообщение и попросить пересобрать заказ.
2. Нельзя было изменить количество отдельных позиций до добавления в cart.
3. В cart не было отдельной кнопки полной очистки.

#### Решение

- Composer остаётся доступным после completed result.
- При продолжении в API отправляется `selectionContext` с recipe, текущими SKU, quantities, unit prices и ingredient keys.
- Model prompt получил правило редактировать существующий meal и сохранять прежние ограничения, если пользователь явно их не менял.
- В result card переиспользован `QuantityControl` из cart.
- Zustand пересчитывает total после локального изменения AI selection.
- В cart header добавлена кнопка `clearCart()`.

#### Проверка

Пользователь смог последовательно изменить блюдо: убрать паприку/кинзу, добавить молоко и продолжить диалог в том же заказе.

#### Оставшийся долг

Ручное уменьшение количества в result card пока не запускает повторную server validation. Это ограничение теперь отражено в разделе Current limitations в `README.md`.

---

### 03:44:31 — обнаружено ingredient bias модели (`точно по скриншоту`)

#### Симптом

На запрос «Высокобелковый ужин на одного» модель заявила, что обязательна сухая киноа, и отказалась от подбора, хотя каталог содержал курицу и другие источники белка.

#### Почему локальный synonym-fix был бы неправильным

Проблема была не в отсутствии слова «киноа» в конкретной карточке. Модель превратила пользовательскую цель «высокобелковый» в заранее выбранный ингредиент и стала считать его обязательным.

#### Системное решение

- Добавлен `catalogPlanningContext` со списком реально доступных food/protein families.
- Prompt получил правило интерпретировать high-protein/light/filling/quick как ограничения цели, а не конкретные обязательные ингредиенты.
- При недоступном required ingredient graph может перестроить сам рецепт, а не только искать похожую упаковку.

#### Вывод

Планировщик должен выбирать из возможностей бизнеса, а не пытаться доказать собственный первоначальный рецепт.

---

### 03:55:05–03:57:15 — доказательство реальных 10 000 SKU (`точно`)

#### Проблема доверия

Хотя Inspector показывал «10,000», каталог визуально содержал лишь несколько десятков карточек. Пользователь обоснованно потребовал доказательство, что остальные SKU действительно доступны.

#### Решение

- Catalog API стал возвращать `catalogTotal`, `inStockTotal`, filtered total и страницы результатов.
- UI показывает database-verified 10 000 SKU, число категорий, число SKU в наличии и сколько результатов загружено.
- Добавлена кнопка Load more с offset pagination по 40 товаров.
- Поиск и категории работают поверх всей базы, а не initial page.

#### Проверка

SQLite query подтверждает `select count(*) from products = 10000`; catalog tests проверяют точные category counts и bilingual FTS.

---

### 04:10:38–04:10:59 — неустойчивость follow-up запроса (`точно по скриншотам`)

#### Симптом

В длинном диалоге после вопроса о молоке появился общий ответ «AI-сервис временно недоступен», но следующий запрос всё же завершил пересборку.

#### Диагностический вывод

Общая клиентская ошибка не показывала, на каком именно model/API этапе возник сбой, и могла визуально смешиваться с текущим running state.

#### Усиления

- Server route логирует structured error details вместе с `requestId` и `sessionId`, не раскрывая ключ.
- SSE различает `status`, `inspector`, `result` и `error`.
- Клиент завершает running state только после финального SSE result/error.
- Existing selection явно добавляется в conversation как безопасный compact context.

#### Принцип

Нельзя подменять реальный AI failure заранее записанным успешным ответом. Ошибка должна быть честной, диагностируемой и не разрушать сохранённую предыдущую подборку.

---

### 04:14:34–04:15:27 — натуральные описания товаров (`точно`)

#### Симптом

Каталог был заполнен повторяющимися текстами вроде «Описание уточняется поставщиком» и абсурдными шаблонами, где бумажные полотенца описывались как упаковка для сохранения свежести блюда.

#### Причина

Один общий product-description template применялся к семантически разным категориям.

#### Решение

- Generator получил category-aware description templates для produce, meat, seafood, frozen, bakery, condiments, breakfast, cleaning, household, personal care, pets и других категорий.
- Descriptions стали естественными и привязанными к реальному назначению товара.
- Seed-based генерация сохранила воспроизводимость.
- Catalog tests проверяют отсутствие прежних универсальных заглушек.

#### Вывод

Натуральность каталога — это не только разнообразие строк, но и семантическое соответствие категории.

---

### 04:26:44–04:26:52 — repair выбирал товар, которого не хватало по stock (`точно по скриншотам`)

#### Симптом

Запрос «диетический ужин на одного до $10» прошёл planning и shortlist, затем validation нашёл недостаточный объём. Repair сообщал, что замены подобраны после семи ошибок, но итог снова завершался общим отказом.

#### Причина

Детерминированный repair сравнивал цену/ёмкость, но мог выбрать упаковку, для которой требуемое число единиц превышало stock.

#### Решение

- Перед ранжированием repair candidates фильтруются по условию `ceil(required / capacity) <= stock`.
- Validation отдельно проверяет `stock_exceeded` и `insufficient_quantity`.
- Добавлен regression test для large requirement, где дешёвый кандидат не способен покрыть объём наличием.

#### Вывод

«Товар есть» и «товара достаточно для заказа» — разные инварианты.

---

### 04:29:23 — катастрофическая функциональная замена салфеток (`точно по скриншоту`)

#### Симптом

Пользователь попросил добавить салфетки. Когда exact item не нашёлся, ассистент предложил хлеб, булочки, огурец или газированную воду.

#### Почему это критично

Search similarity и наличие в каталоге не доказывают, что товар решает исходную задачу. Тот же класс ошибки мог привести к предложению еды вместо средства для пола или grocery item вместо автомобиля.

#### Системное решение, 04:39:08–04:40:30 (`точно`)

- Введён слой `BusinessCapability`.
- Каждое catalog family получает проверенное функциональное назначение.
- Отдельный business router классифицирует запрос как meal, meal_edit, catalog, unsupported или clarify.
- `validatedFamilies()` пропускает только families с совпадающей capability.
- Direct deterministic resolver добавляет functional substitute только когда назначение действительно совпадает.
- Если совпадения нет, возвращается честный waiting response и cart не меняется.

Покрытые примеры:

- салфетки → бумажные полотенца допустимы для впитывания/вытирания;
- floor cleaner → kitchen surface cleaner не считается подтверждённой заменой;
- Mercedes → unsupported retail goal;
- мусорные пакеты → нельзя заменять несвязанным продуктом.

#### Вывод

Главный safety-layer retail assistant — не similarity, а проверенная связь «задача → функциональная возможность → family → SKU».

---

### 04:29:34–04:45:24 — исправлена карточка household SKU (`точно по скриншоту и файлам`)

#### Симптом

Карточка бумажных полотенец показывала сырые/неподходящие поля:

- `Состав: recycled kitchen towels`;
- English storage text внутри RU interface;
- country без локализации;
- food-like metadata labels для household товара.

#### Решение

- Добавлен `productMetadata()` с category-aware semantics.
- Для household отображается материал, а не пищевой состав.
- Storage и country локализуются.
- Нерелевантная строка аллергенов скрывается.
- Карточка использует нормализованные display rows вместо прямого вывода raw fields.

---

### 04:59:09 — проверка границ ассортимента на бытовой задаче (`точно по скриншоту`)

#### Сценарий

После breakfast order пользователь попросил добавить стиральный порошок, затем «пакеты» и уточнил «мусорные пакеты».

#### Наблюдаемое корректное поведение

- Не найденный laundry detergent не был заменён несвязанным товаром.
- Неоднозначное слово «пакеты» вызвало один конкретный clarification question.
- После уточнения «мусорные пакеты» ассистент честно сообщил, что подходящего SKU нет.

#### Вывод

Хороший assistant не обязан завершать каждое сообщение добавлением товара. Он обязан не ухудшать исходную задачу и не создавать ложное ощущение решения.

---

### 05:12:10–05:40:33 — универсальные валюты и строгий budget gate (`точные границы по файлам`)

#### Исходная проблема

Пользователь может указать не только рубли, но любую валюту, включая слова, символы, ISO codes и локальные форматы чисел. Также возможны нереалистичные бюджеты: один цент, один лари, ноль, отрицательная сумма или неоднозначные `kr`/`¥`.

#### Решение

- Парсер поддерживает ISO 4217 codes, распространённые symbols и RU/EN aliases.
- Распознаются `€1,000`, `€1.000,50`, `1 234,56 EUR`, `1’234.56 CHF`, non-breaking spaces и отрицательные значения.
- Model router может передать ISO hint для названия валюты на любом языке.
- Live rate берётся из Frankfurter и кэшируется на шесть часов.
- GEL/RUB имеют configurable fallback rates.
- При неясной валюте ассистент просит ISO code и не угадывает.
- Ноль/отрицательный budget отклоняются.
- Budget ниже minimum in-stock SKU блокируется до expensive meal planning.
- Direct catalog modification не меняет корзину, если новый SKU не помещается в strict budget.

#### Edge cases, покрытые тестами

- one cent;
- one lari;
- RUB/GEL/EUR/GBP/KZT/INR/JPY/CHF и другие ISO currencies;
- ambiguous `500 kr`;
- localized thousands/decimal separators;
- обычные слова из трёх букв не принимаются за ISO currency.

#### Вывод

Currency normalization должна быть отдельным deterministic boundary, а не скрытой догадкой recipe model.

---

### 05:36:43–06:01:50 — детерминированное число порций (`точно`)

#### Проблема

Model interpretation могла потерять или изменить количество людей, особенно в русских формах «30 мужчин», «50 человек», «120 порций».

#### Решение

- Добавлен `parseRequestedServings()` с RU/EN формами people/persons/guests/pax/servings/мужчин/женщин/порций.
- Диапазон ограничен 1–500.
- Deterministic value переписывает model servings и recipe servings.

#### Вывод

Числовые ограничения, которые можно извлечь однозначно, не должны зависеть от вероятностной интерпретации.

---

### 05:54:01–05:54:20 — halal/kosher и доказуемость безопасности (`точно по скриншотам`)

#### Сценарии

- Halal lunch на 2 человек.
- Halal lunch на 30 человек.
- Kosher lunch на 30 человек.
- Дополнительные allergy/lactose ограничения.

#### Наблюдение

Каталог не содержал SKU, подтверждающих соответствующую certification. Ассистент отказался называть корзину halal/kosher только по составу или названию рецепта.

#### Реализация

- Business route извлекает `requiredDietaryTags`.
- Retrieval и validation требуют полного совпадения verified product-level claims.
- Для celiac disease автоматически требуется `gluten-free` evidence.
- Response явно говорит, что в данных SKU нет подтверждения.

#### Вывод

Консервативный отказ лучше ложного safety claim. Для pitch deck это пример того, как система отделяет «похоже подходит» от «данные это подтверждают».

---

### 05:58:27–06:05:46 — частичные аудитории и разные варианты блюда (`точно`)

#### Симптом

Запрос: обед для 30 мужчин, 10 из них вегетарианцы. Первая логика сделала полностью вегетарианское блюдо на всех 30.

#### Почему это неверно

Ограничение подгруппы не означает предпочтение остальных. Десять vegetarian guests должны получить совместимый вариант, но оставшиеся двадцать не должны автоматически лишаться мяса.

#### Решение

- Добавлен `ServingGroup` и deterministic parser partial vegetarian/vegan preference.
- Для примера создаются группы `standard: 20` и `vegetarian: 10`.
- Shared sides используют `servingGroupIds: ["all"]`.
- Protein variants получают group-specific IDs и dietary tags.
- Retrieval применяет dietary constraints к конкретному ingredient group, а не ко всему order.
- Repair учитывает stock для рассчитанного группового объёма.

#### Живая проверка

Сценарий на 30 человек собрал мясной protein примерно для 20 и vegetarian protein для 10, сохранив общие гарниры.

#### Ограничение

Deterministic parser пока поддерживает только одну vegetarian/vegan подгруппу; сложные комбинации остаются техническим долгом.

---

### 05:xx — автономное edge-case тестирование (`интервал`)

По запросу пользователя тестирование было расширено в направлениях:

- catalog safety и функциональные замены;
- conversation/new chat/continuation;
- arbitrary currencies и unrealistic budgets.

Найденные классы проблем были оформлены не как отдельные prompt exceptions, а как reusable layers: capabilities, budget resolver, serving parser, audience groups, stock-aware repair и regression tests.

Ключевой метод тестирования, который закрепился в проекте:

1. Пользователь формулирует непредсказуемую задачу.
2. Проверяется, какую цель вывел assistant.
3. Проверяется, какие claims подтверждаются SKU.
4. Проверяется арифметика после выбора упаковок.
5. Если ошибка общая, fix переносится в deterministic contract, а не в карточку одного товара.

---

### 06:10:28–06:10:37 — корзина на 50 человек оказалась математически фиктивной (`точно по скриншотам`)

#### Запрос

Обед для 50 мужчин до 45 000 рублей; allergy на арахис, lactose intolerance и пять человек не едят мучное.

#### Что было выполнено

- Арахис, молочные продукты и мучное отсутствовали.
- Recipe был реалистично масштабируемым по типу блюда.

#### Критическая ошибка

UI показал:

- куриная грудка — 80 г;
- рис — 80 г;
- фасоль — 80 г;
- овощи — 100 г;
- total $40.48;
- текст, что одна 80-граммовая упаковка курицы «немного больше нужного объёма».

Для 50 взрослых это физически невозможно. Интерфейс не показывал количество упаковок и создавал впечатление, что в корзине по одной единице каждого SKU.

#### Корневая причина

Поле ingredient `quantity` было семантически неоднозначным. Модель вернула per-person норму 80 г, а сервер интерпретировал её как total requirement. Затем selection/validation честно проверили неправильное требование.

Это важный урок: детерминированная валидация не спасает, если сам контракт нормализации сформулирован неверно.

---

### 06:15:37–06:18:08 — новый quantity contract и проверяемая корзина (`точно`)

#### Системное решение

1. В structured schema поле `quantity` заменено на `quantityPerServing`.
2. Prompt явно определяет это как edible amount для одного человека, не package size и не total.
3. Server `scalePerServingQuantity()` умножает норму на `servingsCovered`.
4. Для group-specific ingredients используется размер соответствующей audience group.
5. Product selection quantity limit повышен с 20 до 500; route sanitization обновлён тем же образом.
6. Server validation по-прежнему требует `capacity × packs >= requirement` и `packs <= stock`.
7. Ответ больше не пишет абстрактное «немного больше». Он показывает required, purchased, pack count и точный excess.
8. Result card показывает:
   - общее число упаковок;
   - `N упаковок × размер упаковки = общий вес/объём`;
   - unit price × quantity = line total;
   - видимый редактируемый quantity control.

#### Параллельно найден UI bug

Широкий CSS selector `.selected-row div` применял `flex-direction: column` ко всем вложенным `div`, включая quantity control. Поэтому число между minus/trash и plus визуально терялось.

Добавлен специфичный row override и отдельный `.selected-copy`.

#### Regression tests

- 160 г × 50 = 8 кг.
- 180 г × standard group 20 = 3,6 кг.
- 150 г × vegetarian group 10 = 1,5 кг.
- Product selection допускает 63 упаковки.
- UI quantity evidence: `63 уп. × 80 г = 5,04 кг`.

#### Результат suite

77 тестов в 6 файлах прошли; typecheck и lint прошли.

---

### 06:18:38–06:19:00 — live API verification на исходном запросе (`точно по runtime trace`)

Повторён тот же запрос на 50 человек через настоящий `/api/chat`.

Trace:

- business routing: около 5,1 с;
- interpretation: около 10,0 с;
- servings: 50;
- budget: 45 000 RUB → примерно $582.19;
- 10 ingredient requirements;
- поиск по 10 000 SKU;
- 300 SKU после retrieval;
- shortlist 120;
- initial model selection: 6 products;
- validation отклонила insufficient red pepper и onion quantities;
- deterministic repair пересобрал позиции;
- final validation: passed;
- final total: $144.85.

Ключевое доказательство:

- требуется курица: 8 кг;
- куплено: 11 упаковок × 750 г = 8,25 кг;
- excess: 250 г.

Исправление прошло тот же серверный путь, на котором ранее возникала ошибка.

---

### 06:19 — production build (`точно`)

`next build` завершился успешно:

- compilation passed;
- TypeScript passed;
- static/dynamic routes generated;
- `/api/chat`, catalog и checkout routes собраны.

---

### 06:21:13–06:21:34 — полная browser verification (`точно по runtime trace`)

Тот же сценарий отправлен через реальный UI, не только curl.

Финальная карточка показала:

- 50 порций;
- 42 упаковки;
- chicken: 11 × 750 г = 8,25 кг;
- rice: 4 × 1 кг = 4 кг;
- carrots: 8 × 500 г = 4 кг;
- onion: 3 × 1 кг = 3 кг;
- red pepper: 6 × 500 г = 3 кг;
- peas: 3 × 1 кг = 3 кг;
- canned tomatoes: 4 × 1 кг = 4 кг;
- garlic, oil и salt с отдельными line totals;
- общий итог: $166.56.

Разница с curl-run ($144.85) объясняется вариативностью model recipe/optional ingredients. Во всех случаях количественные и серверные ограничения соблюдены.

Browser checks:

- meaningful content присутствует;
- Next.js error overlay отсутствует;
- console errors отсутствуют;
- найдено 10 quantity controls;
- все 10 имеют горизонтальную компоновку;
- Inspector завершил 13/13 узлов.

---

## Накопленные продуктовые принципы

### 1. Проверяемость важнее уверенного текста

Пользователь должен видеть не только «подбор готов», но и доказательство:

- какой объём нужен;
- сколько упаковок выбрано;
- какой общий объём куплен;
- откуда взялась цена;
- какой остаток образуется.

### 2. Исправлять класс ошибки, а не пример

Проект последовательно отказался от локальных патчей вида:

- «дописать бумажным полотенцам слово салфетки»;
- «добавить курицу в ответ на high-protein»;
- «научить только рублям»;
- «особо обработать только 10 vegetarian guests».

Вместо этого появились reusable contracts: capabilities, catalog-grounded planning, universal currency boundary, audience groups и per-serving scaling.

### 3. AI не отменяет детерминированную бизнес-логику

Модель полезна для языка, намерения, рецепта и выбора из shortlist. Сервер отвечает за:

- business fit;
- budget normalization;
- product existence;
- safety evidence;
- stock;
- package arithmetic;
- totals;
- retry limits.

### 4. Честный отказ — часть успешного продукта

Если каталог не может безопасно решить задачу, правильный результат — объяснить ограничение и сохранить корзину неизменной. Это особенно важно для certification, household chemistry, hygiene и out-of-business запросов.

---

## Текущее техническое состояние на момент документа

- Catalog DB: 10 000 SKU.
- Tests: 89 passed / 9 files.
- Typecheck: passed.
- ESLint: passed.
- Production build: passed.
- Live SSE: passed.
- Browser UI: passed без overlay/console errors.
- Git history: репозиторий опубликован в `Weeki513/grocery-copilot`.
- Актуальные ограничения и публичный запуск описаны в `README.md`.

## Известный незакрытый долг

1. Follow-up context sanitization ограничивает `recipe.servings` максимумом 20; это конфликтует с поддержкой 500 servings.
2. Ручное уменьшение AI-result quantities не запускает повторную server validation.
3. Partial audience parser ограничен одной vegetarian/vegan группой.
4. Nutrition/calorie sufficiency не валидируется отдельным кодом.
5. Market price realism не проверяется внешними данными: каталог синтетический.
6. Нет durable server-side chat/checkpoint storage.

Эти пункты намеренно оставлены видимыми: они показывают границу между убедительным прототипом и production-системой и могут стать отдельными слайдами roadmap.
