# CartParty technical specification

CartParty is a collaborative product-decision board. A Party lets a group save products, discuss them, vote, and follow source-backed price observations together.

## System scope

### Primary capabilities

- Account registration, JWT access/refresh-token authentication, and automatic refresh/retry in the web client.
- Shared Parties with `owner` and `member` roles. Owners may invite existing CartParty users.
- Party-scoped products with a title, product URL, image, retailer name, currency, notes, and current price.
- One current `love`, `pass`, or `favorite` vote per user/product pair, plus flat comments.
- Party-scoped product, vote, comment, price, activity, and presence updates.
- Price-history storage and a chart in the web app.
- Chrome Manifest V3 capture extension that saves the current tab as a product.

### Deliberately out of scope

- Budgeting, purchase assignment, email invites, threaded comments, and comparison tables.
- Guaranteed support for every retailer. Price extraction relies on pricing data the retailer exposes in the product page HTML.

## Frontend stack

`apps/web` is a React 19 + TypeScript single-page application built with Vite. Tailwind/PostCSS provide the styling pipeline; the interface also uses local CSS design tokens. Axios handles REST requests, Socket.io Client keeps Party views current, Recharts draws price history, and Lucide supplies icons.

The browser holds access and refresh tokens in local storage. Axios adds the access token to authenticated calls and, after a `401`, refreshes the session once and retries the failed request. The app joins a Socket.io room per selected Party and updates the board as changes arrive.

`apps/extension` is a separate React/Vite Chrome extension. Its content script reads the active page title, URL, hostname, and candidate image; the popup authenticates and saves the result to a selected Party. It does not determine prices itself—the backend tracking job does that from the saved product URL.

## Backend stack

`apps/api` is a NestJS 10 + TypeScript service.

| Concern | Implementation |
| --- | --- |
| HTTP API | NestJS controllers with global DTO validation (`class-validator`) |
| Authentication | Passport JWT, bcryptjs password hashing, access and refresh tokens |
| Database access | Prisma 6 |
| Primary data store | PostgreSQL |
| Realtime | NestJS Socket.io gateway with authenticated workspace rooms |
| Background jobs | BullMQ backed by Redis-compatible Key Value |
| Validation/shared domain | Zod and shared domain types in `packages/shared` |

The root is a pnpm workspace monorepo:

```text
apps/web        React decision-board application
apps/api        NestJS API, Prisma data access, Socket.io, BullMQ tracking
apps/extension  Chrome MV3 capture extension
packages/shared Shared schemas and domain primitives
```

## Data model and authorization

```text
User ──< WorkspaceMember >── Workspace ──< Product
                                      └──< ActivityEvent
Product ──< Vote
        ├──< Comment
        └──< PriceHistory
```

- `WorkspaceMember(workspaceId, userId)` is unique and gates all workspace reads.
- Workspace owners manage workspace settings and members.
- A product’s creator or the workspace owner may edit or delete it.
- `Vote(productId, userId)` is unique, so a user has one current vote per product.
- Product and price-history values use PostgreSQL `Decimal(10,2)`, avoiding floating-point persistence errors.

The migration at [20260717020000_flatten_workspaces](/Users/himnish03/Documents/Projects/CartParty/apps/api/prisma/migrations/20260717020000_flatten_workspaces/migration.sql) flattened the historical collection layer: products now belong directly to a workspace.

## Price tracking specification

### Status

**Implemented as real, source-backed tracking in this repository.** The earlier simulated mechanism has been removed. It no longer manufactures price movement from a product ID and time.

On each scan, the worker considers every product with a saved `productUrl` and:

1. Fetches the product page over HTTP(S), with a 15-second timeout.
2. Extracts a price from schema.org JSON-LD `Product`/`Offer` data (`price` or `lowPrice`) or standard price metadata (`product:price:amount`, `price`, or `product:price`).
3. Updates `Product.currentPrice`, retains an extracted ISO currency when provided, and appends a `PriceHistory` observation.
4. Emits `price:updated` only when the observed amount changes. A decrease also creates a `price_dropped` activity event.

If a page has no extractable price, returns a non-success response, is too large, times out, or blocks the request, that product is skipped. The worker logs the reason; it does not invent a value or overwrite the last known price. Prices rendered only after client-side JavaScript, personalized prices, bot protection, and retailer markup changes can prevent generic extraction. Dedicated approved retailer integrations are the next step where reliability guarantees are needed.

The current generic tracker supports HTTP(S) product URLs and intentionally consumes only public page data. Follow each retailer’s terms, robots policy, rate limits, and applicable law before enabling broad production use.

### Job execution

BullMQ queue: `price-check`; job name: `scan`.

- Local/default mode: `RUN_PRICE_SCHEDULER` is enabled unless explicitly set to `false`. The API registers an hourly cron job at minute `0`.
- Render free-tier mode: `RUN_PRICE_SCHEDULER=false`. The scheduled GitHub workflow [price-scan.yml](/Users/himnish03/Documents/Projects/CartParty/.github/workflows/price-scan.yml) calls `POST /internal/price-scan` at minute `17` each hour. This endpoint requires the `x-cartparty-price-secret` header to match `PRICE_SCAN_SECRET` and only enqueues work; the BullMQ processor performs the lookup.
- A running worker requires the API process, Redis, and PostgreSQL. The separate `start:worker` command also initializes the Nest application, but the deployed blueprint currently processes jobs in the API service.

To make production tracking active, deploy the API containing this change and configure both GitHub secrets:

```text
CARTPARTY_API_URL=https://YOUR-API.onrender.com
CARTPARTY_PRICE_SCAN_SECRET=<same value as the API PRICE_SCAN_SECRET>
```

Then manually run **Trigger price scan** once and inspect the API logs plus a product’s price history. A `200` from the enqueue endpoint confirms only that the scan was queued; a successful observation requires that the individual retailer page exposes a supported price.

## API contract

All endpoints other than auth, health, and the protected internal trigger require a bearer access token.

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
GET  /auth/profile
POST /auth/onboarding/complete

POST   /workspaces
GET    /workspaces
GET    /workspaces/:id
PATCH  /workspaces/:id
DELETE /workspaces/:id
POST   /workspaces/:id/members

POST   /workspaces/:id/products
GET    /workspaces/:id/products
PATCH  /products/:id
DELETE /products/:id

POST   /products/:id/votes
DELETE /products/:id/votes
POST   /products/:id/comments
GET    /products/:id/comments
GET    /products/:id/price-history
GET    /workspaces/:id/activity

GET  /extension/workspaces
POST /extension/save
POST /internal/price-scan
GET  /health
```

Socket.io clients authenticate with `{ auth: { token } }`, join with `join_workspace`, and receive `product:added`, `vote:updated`, `comment:added`, `price:updated`, `activity:new`, and `presence:updated` events.

## Local development

Prerequisites: Node.js 22+, pnpm 9+, Docker (for Postgres and Redis).

```bash
npm install -g pnpm
pnpm install
cp .env.example .env
docker compose up -d
pnpm --filter @cartparty/api prisma:generate
pnpm --filter @cartparty/api prisma:deploy
pnpm --filter @cartparty/api prisma:seed
pnpm dev
```

Local URLs:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- Health: `http://localhost:4000/health`

Demo credentials: `maya@cartparty.dev` / `cartparty123`. Seeding resets local database data and must not be used in production.

The required environment variables are defined in [.env.example](/Users/himnish03/Documents/Projects/CartParty/.env.example). In addition to database, Redis, JWT, port, and frontend settings, set `RUN_PRICE_SCHEDULER=true` locally for hourly scans. Use a unique `PRICE_SCAN_SECRET` outside local development.

## Deployment topology

```text
Vercel (React web app)
        │ REST + Socket.io
        ▼
Render API (NestJS + price processor) ── PostgreSQL
        │
        └──────────────────────────────── Redis / Render Key Value
GitHub Actions hourly trigger ───────────► protected scan endpoint
```

[render.yaml](/Users/himnish03/Documents/Projects/CartParty/render.yaml) provisions the Render API, PostgreSQL, Redis-compatible Key Value, and generated JWT secrets. [vercel.json](/Users/himnish03/Documents/Projects/CartParty/vercel.json) builds and serves `apps/web`.

Set these Vercel build-time variables and redeploy after changing them:

```text
VITE_API_URL=https://YOUR-API.onrender.com
VITE_WS_URL=https://YOUR-API.onrender.com
```

Set `FRONTEND_URL` on Render to the exact Vercel origin. Free Render services can sleep and its free database/Key Value offerings are not suitable for durable production data; use paid infrastructure, backups, monitoring, and a dedicated worker before a real launch.

## Verification

```bash
pnpm typecheck
pnpm build
```

Before release, verify registration, Party membership boundaries, product management, shared updates, extension save, and a scan against an allowed retailer URL that exposes JSON-LD product pricing.
