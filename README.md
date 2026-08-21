# Grocery Copilot

> An AI-native grocery shopping experience that turns natural-language meal requests into a validated, editable cart — with a live inspector showing how the agent makes each decision.

**Live demo:** [Vercel demo — deployment URL to be added](#deployment-notes) · **Source:** [Weeki513/grocery-copilot](https://github.com/Weeki513/grocery-copilot) · **Docs:** [product spec](docs/product-spec.md) · [build log](docs/build-log.md)

Grocery Copilot is a portfolio-grade product experience combining product design, interaction design, AI orchestration, and deterministic backend systems. It is a complete grocery flow — catalog, assistant, editable selection, cart, and fictional checkout — rather than an LLM chat wrapper.

## Demo media

<!--
Add the presentation assets when they are ready:
- docs/assets/grocery-copilot-hero.webp — desktop hero showing the grocery app and AI Inspector
- docs/assets/grocery-copilot-demo.mp4 or docs/assets/grocery-copilot-demo.gif — short end-to-end interaction
- docs/assets/ai-inspector.webp — close-up of a real workflow run
Do not commit secrets, customer data, or API responses containing private information.
-->

<p><em>Media placeholder — add the named assets above when the final demo capture is ready.</em></p>

## What the product does

A user can ask for a meal or grocery task in English or Russian, including servings, budget, preparation time, allergies, exclusions, and dietary requirements. The assistant:

- interprets the goal and chooses the appropriate grocery capability;
- plans a recipe when a recipe is needed;
- searches a deterministic catalog of exactly 10,000 synthetic SKU through bilingual SQLite FTS5 retrieval;
- selects real product IDs from a compact shortlist;
- validates stock, allergens, dietary evidence, package capacity, quantity, and budget on the server;
- repairs or explains an unavailable selection instead of inventing a product; and
- presents an editable result that only enters the main cart after the user confirms it.

The desktop layout pairs an iPhone-like grocery application with an AI Inspector. The Inspector shows safe, real workflow events: route selection, retrieval, model choice, validation, repairs, fallback use, latency, and candidate counts.

## Why this project is interesting

The difficult part is not producing a plausible recipe. It is turning an ambiguous natural-language goal into a trustworthy shopping action while keeping the experience fast, understandable, and editable.

This project demonstrates:

- product thinking about capability boundaries and honest refusal;
- UX that makes AI output reviewable rather than silently mutating a cart;
- a real LangGraph workflow with structured OpenAI Responses API outputs;
- a server-authoritative boundary where the model suggests and deterministic code decides; and
- a pitchable interface that exposes useful operational evidence without exposing prompts, hidden reasoning, or secrets.

## Key product and engineering decisions

| Decision | Why it matters |
| --- | --- |
| Capability before keyword matching | A household task is resolved by verified product purpose, not by an unrelated word match. |
| Compact retrieval | The model sees at most 12 candidates per ingredient group, never the full 10,000-SKU catalog. |
| Structured outputs | Zod-backed schemas restrict model output to product IDs, quantities, mappings, confidence, and short reasons. |
| Server-authoritative cart math | Product names, prices, stock, capacity, safety evidence, and totals are reread from SQLite. |
| Editable confirmation | An AI result is a proposal; the user explicitly chooses “Add all to cart.” |
| Fictional checkout | The public demo validates the flow without pretending to take payment, schedule delivery, or persist orders. |
| Bilingual by design | EN/RU copy, search terms, recipes, and product metadata are supported throughout the experience. |

## Architecture

The request path is deliberately split between language understanding and deterministic business logic:

```text
POST /api/chat
  → body and usage gates
  → business router
  → deterministic currency and budget gate
  → catalog / clarify / unsupported direct response
  → meal LangGraph workflow when planning is required
```

The meal graph is:

```text
START
  → interpret_request
  → clarification required?
      yes → ask_clarification → END
      no  → plan_recipe
              → normalize_ingredients
              → retrieve_products
              → select_products or fallback_model
              → validate_selection
                  valid      → build_cart
                  repairable → repair_selection → validate_selection
                  repeated   → fallback_model → validate_selection
              → compose_user_response → END
```

Clarification currently ends the graph invocation. The next client request sends recent conversation context again; there is no claim of durable LangGraph checkpoint/resume storage.

## Reliability and deterministic safeguards

- Product IDs must exist in SQLite and must have been present in the server-generated shortlist.
- Stock, duplicate selections, allergens, exclusions, verified dietary tags, package capacity, and required ingredients are checked server-side.
- Prices and totals come from the database, not from model output.
- Quantities are scaled from per-serving requirements and checked against package capacity and stock.
- Budget and currency gates run before an expensive recipe graph when a request is already impossible.
- The chat endpoint bounds request size, message length, per-IP/session frequency, concurrency, daily requests, model calls, and output tokens.
- Local development can use process-local limits; Vercel fails closed with HTTP 503 unless shared Upstash Redis protection is configured.
- Checkout rereads current products and validates quantities but returns only a fictional browser-local confirmation.

## AI workflow and Inspector

The Inspector is backed by the same in-process events used by the live SSE response. It reports safe operational summaries such as:

- the selected business route and capability;
- the current graph node and completed stages;
- shortlist and candidate counts;
- model, latency, and approximate token information;
- validation errors, repair decisions, and fallback transitions; and
- the prepared cart selection.

It intentionally omits system prompts, API keys, hidden reasoning, sensitive headers, and full internal payloads.

## Tech stack

- Next.js 16 App Router, React 19, TypeScript
- LangGraph.js and OpenAI Responses API structured outputs
- Zod, Zustand, and Lucide React
- SQLite with `better-sqlite3` and bilingual FTS5 retrieval
- Vitest, deterministic catalog/evaluation fixtures, and ESLint
- Vercel-compatible build-time catalog artifact with read-only runtime access

## Tests and evals

The repository includes deterministic coverage for catalog scale and quality, bilingual retrieval, business capabilities, currencies, serving groups, package arithmetic, schema boundaries, selection validation and repair, usage protection, and Vercel catalog modes.

`evals/cases.ts` contains 20 stable scenario cases across normal requests, constraints, stock changes, budgets, and complex fallback paths. The eval command validates this manifest without making paid model calls in CI.

Run the full local checks with:

```bash
npm run typecheck
npm run lint
npm test
npm run evals
npm run catalog:validate
npm run build
```

## Run locally

Requirements: Node.js 20.9+ and npm 10+.

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run catalog:generate
npm run catalog:validate
npm run dev
```

Open [http://localhost:3000/en](http://localhost:3000/en) or [http://localhost:3000/ru](http://localhost:3000/ru).

Browsing the catalog and using the product UI does not require an OpenAI key. Add `OPENAI_API_KEY` to `.env.local` to enable live assistant requests; the key is read only by server code and is never sent to the browser.

### Environment variables

- `OPENAI_API_KEY` is required for live AI requests and optional for catalog-only development.
- `OPENAI_PRIMARY_MODEL`, `OPENAI_FALLBACK_MODEL`, and the `CHAT_*` / `OPENAI_MAX_*` variables are optional tuning controls with conservative local defaults.
- `DATABASE_URL` is optional for the default local SQLite path. `CATALOG_READ_ONLY=1` is useful for an explicit local read-only smoke test.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are optional locally, but both are required for public Vercel chat protection.
- `GEL_PER_USD` and `RUB_PER_USD` are optional fallback FX settings for those currencies.

`.env.local` is ignored by Git. Keep `.env.example` tracked and empty of credentials.

## Deployment notes

This repository is prepared for a non-commercial Vercel engineering demo. A production URL is not claimed until a real Vercel deployment reaches `READY` and passes a live smoke test.

- `npm run build` first generates the deterministic 10,000-SKU SQLite/FTS5 artifact through the `prebuild` script.
- Vercel runtime opens that artifact read-only and fails loudly if its count or catalog version is invalid; it does not regenerate or mutate SQLite in serverless execution.
- Checkout performs server-side product/stock/total validation and returns a fictional confirmation. No order is written to the server filesystem.
- `/api/chat` is a Node.js SSE route with a 60-second maximum duration. In Vercel, missing or unavailable shared Redis protection returns HTTP 503 instead of weakening the limits to a per-instance fallback.
- Configure `OPENAI_API_KEY`, model names, all chat/model caps, and both Upstash variables in Vercel Production environment variables. Add provider-level OpenAI spend and rate limits as a second safety layer.
- Vercel Hobby should be treated as hosting for a personal, non-commercial showcase. Authentication, payment, delivery, and durable server-side user/order storage are intentionally out of scope.

## Current limitations

- Chat/session persistence is browser-local; clarification is continued with client conversation rather than a durable server checkpoint.
- Partial-audience parsing currently supports one vegetarian or vegan subgroup; more complex audience splits depend on the model.
- Manually lowering a quantity in the AI result updates the client preview but does not rerun server validation until a later server action.
- The catalog and prices are deterministic synthetic fixtures, not a live retailer feed.
- Product visuals use emoji, and checkout is fictional.
- Paid live model scoring is intentionally excluded from CI.

## License

The source is available under the [PolyForm Strict License 1.0.0](https://polyformproject.org/licenses/strict/1.0.0). It permits noncommercial inspection, evaluation, research, and testing, but does not grant permission to distribute the source or make derivative works as another product. Commercial use or other permissions require authorization from the licensor.

The [LICENSE](LICENSE) file is authoritative; this paragraph is only a plain-language summary.
