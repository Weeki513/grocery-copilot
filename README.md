# Grocery Copilot

Grocery Copilot is a local, pitch-ready grocery delivery prototype. A customer describes a meal in natural language; a single LangGraph workflow interprets the request, plans a recipe, retrieves a compact shortlist from 10,000 stored SKU, asks OpenAI to select product IDs, validates the selection on the server, repairs it when necessary, and builds a normal editable cart.

The desktop experience intentionally has two halves:

- a consumer grocery app presented in an iPhone-like frame;
- a live AI Inspector showing safe operational events from the real workflow.

English and Russian are supported throughout the store, assistant, checkout, and Inspector. All prices use USD.

## Requirements

- Node.js 20.9 or newer (Node.js 24 is tested)
- npm 10 or newer
- an OpenAI API key with access to `gpt-5.6-luna` and `gpt-5.6-terra`

PostgreSQL and Docker are not required for the local demo. The permitted SQLite mode is used with FTS5 and an isolated repository layer so the storage adapter can later be replaced without changing the graph, validation, or UI.

## Quick start

```bash
npm install
npm run db:migrate
npm run catalog:generate
npm run catalog:validate
npm run dev
```

Open [http://localhost:3000/en](http://localhost:3000/en) or [http://localhost:3000/ru](http://localhost:3000/ru).

The checked-in `.env.example` documents the configuration. A local ignored `.env` is already created for development:

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

Insert the API key after `OPENAI_API_KEY=` and restart the dev server. The key is read only by server code, is never returned to the browser, and is excluded by `.gitignore`.

If the key is absent or a configured model is unavailable, the store and catalog remain usable and the assistant shows a clear configuration error. It does not substitute a prerecorded AI answer.

### Public deployment API protection

The chat endpoint has server-side protection enabled by default: per-IP and per-session rate limiting, a daily request cap, a concurrent-request cap, request/message size limits, a daily OpenAI-call cap, and a maximum output-token limit. The API key is never exposed to the browser. Tune the limits through the variables above before publishing; the defaults are intentionally conservative for a public demo.

Without `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, counters are process-local for local development. For a multi-instance deployment, set those two server-only variables to make IP/session and daily AI caps shared across instances, and configure hosting/provider-level spend limits as a second safety layer. If the shared store is temporarily unavailable, the app falls back to process-local protection so the service remains usable.

## Useful commands

```bash
npm run dev                 # Next.js development server
npm run build               # production build
npm run lint                # ESLint
npm run typecheck           # strict TypeScript check
npm test                    # deterministic unit/integration tests
npm run evals               # 20-case reproducible eval manifest checks
npm run catalog:generate    # create catalog unless exactly 10,000 SKU exist
npm run catalog:generate -- --force
npm run catalog:validate    # distribution and data integrity checks
npm run catalog:report      # catalog counts and quality report
```

## Architecture

### Application

- Next.js App Router and React 19 render the server entry route and interactive client shell.
- Zustand persists language, chat history, session ID, cart, and the last local order in the browser.
- Route Handlers provide catalog search, product lookup, SSE chat streaming, and checkout.
- SQLite stores products and local orders. FTS5 indexes English/Russian names, descriptions, brands, ingredients, and synonyms.

### Catalog

`scripts/generate-catalog.ts` creates exactly 10,000 products with seed `513`. The category counts match `spec.md` exactly. Product families, brands, packaging, sizes, pricing, descriptions, ingredients, allergens, storage rules, origin, availability, and popularity are procedural rather than LLM-generated.

The generator adds reproducible content-management defects: missing descriptions, weights present only in names, empty brands, near-duplicates, incomplete ingredients, stale previous prices, stock-flag mismatches, and similar imperfections. Critical data damage is kept below the specification threshold.

The SQLite database lives at `data/grocery-copilot.db` and is ignored by Git. It is not regenerated on every app start. If the file is missing or has the wrong count, the local repository bootstraps it once.

### Retrieval

For each normalized ingredient, the server:

1. expands bilingual model-supplied search terms;
2. uses FTS5 across the stored catalog;
3. filters availability, maximum per-item price, allergens, and exclusions;
4. ranks by FTS relevance and popularity;
5. keeps at most 12 products per ingredient.

The ordinary shortlist is therefore well below 150 products. The model never receives the 10,000-product catalog.

### LangGraph workflow

The compiled `StateGraph` is the real orchestrator:

```text
START → interpret_request → needs_clarification?
  yes → ask_clarification → interrupt / resume → plan_recipe
  no  → plan_recipe
       → normalize_ingredients
       → retrieve_products
       → select_products (or fallback_model for complex requests)
       → validate_selection
            valid      → build_cart
            repairable → repair_selection → validate_selection
            repeated   → fallback_model → validate_selection
       → compose_user_response → END
```

`MemorySaver` checkpoints graph state by `sessionId`, allowing a clarification interrupt to resume with the next user message. This is appropriate for a single-process local demo; a production deployment should replace it with a durable database checkpointer.

Every node emits an Inspector event with a safe input/output summary, duration, model, candidate count, and token estimate when available. Events never contain the system prompt, API key, hidden reasoning, or full product payloads.

### OpenAI

The server uses the OpenAI Responses API and `responses.parse` with Zod-backed structured outputs. Luna performs request interpretation/recipe planning and ordinary product selection. Terra is used only for complex requests or repeated validation failure. Sol is never configured.

The strict product selection schema accepts only:

- `productId`;
- package quantity;
- ingredient key;
- confidence;
- short reason;
- unresolved ingredient IDs and the fallback flag.

Names, current prices, stock, totals, and discounts are reloaded from SQLite by `productId`.

### Server validation

Deterministic code checks that every product exists, was in the shortlist, is in stock, does not exceed inventory, covers the required amount, contains no forbidden allergen or excluded ingredient, is not duplicated, covers every required ingredient, and stays within budget. Totals are calculated only from database prices.

The repair node rebuilds failed selections from verified candidates and chooses sufficient package quantities. Retry count and graph recursion limit prevent infinite loops. Terra receives the compact shortlist rather than a restarted full workflow.

## Tests and evals

The default test suite verifies:

- exactly 10,000 stored SKU and all 17 category counts;
- real bilingual FTS retrieval;
- controlled data-quality flags;
- rejection of invented product IDs;
- deterministic allergen rejection;
- database-authoritative pricing;
- strict structured selection output.

`evals/cases.ts` contains the required 20 stable scenarios: 8 ordinary, 4 constrained, 3 stock-change, 3 budget, and 2 complex fallback cases. The manifest is designed for repeatable live evaluation once an API key is configured; CI-safe tests validate its distribution and expectations without making paid model calls.

## Demo notes

- Change language from the top-right control on the home screen. The cart and chat remain intact.
- Suggested prompts are localized and send real AI requests.
- Click any Inspector graph node or event to inspect safe input/output metadata.
- AI-selected products are not silently inserted into the cart; the customer confirms with “Add all to cart”.
- Checkout uses the fictional card ending in `4242` and creates a local order with a generated number.

## Troubleshooting

### Assistant says the API key is missing

Add a key to `.env`, keep the variable name exactly `OPENAI_API_KEY`, and restart `npm run dev`.

### Model unavailable or permission error

Confirm the project has access to the model IDs in `.env`. The requested defaults are `gpt-5.6-luna` and `gpt-5.6-terra`.

### Catalog count is not 10,000

```bash
npm run catalog:generate -- --force
npm run catalog:validate
```

### SQLite native module fails to install

Use a supported current Node.js release and reinstall dependencies:

```bash
rm -rf node_modules
npm install
```

### Reset local demo state

Delete `data/grocery-copilot.db`, rerun the migration and catalog commands, then clear the `ladle-grocery-state` entry from browser local storage if you also want to reset cart and chat history.

## Demo limitations

- Checkpoints are process-local rather than durable across server restarts.
- Semantic embeddings are intentionally optional; FTS5 is the primary retrieval path.
- Checkout creates a local fictional order and performs no payment.
- Product visuals use emoji as required by the catalog schema.
- The offline eval command validates the scenario contract; paid live model scoring is intentionally not run in CI.
