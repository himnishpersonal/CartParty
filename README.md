# CartParty

CartParty is a collaborative purchase-decision app. A group creates a workspace for a real decision, saves products directly into it, votes, comments, watches price movement, and sees the shared activity record update live.

It is deliberately not a personal wishlist. The unit of work is a shared decision board.

## What Is Built

- Account registration, login, JWT access tokens, refresh tokens, and automatic client refresh/retry.
- Workspaces with owner and member roles.
- Owner-only invitations for people who already have CartParty accounts.
- Direct workspace product boards. Products belong to a workspace; there is no collection layer.
- Product creation, editing, deletion, manual price updates, product links, images, and notes.
- One active `love`, `pass`, or `favorite` vote per person per product.
- Flat product comments.
- Workspace-scoped Socket.io rooms, authenticated presence, and live product/vote/comment/price/activity events.
- Mocked BullMQ hourly price tracking with persisted history and price-drop activity.
- Price-history chart, physical price-tag UI, and receipt-style activity feed.
- Chrome Manifest V3 extension that captures the current page and saves it directly to a workspace.
- Three realistic PostgreSQL demo workspaces with twelve products, votes, comments, activity, and multi-week prices.

## Stack

| Area | Technology |
| --- | --- |
| Web app | React 19, TypeScript, Vite, Tailwind tooling, Axios, Socket.io client, Recharts |
| API | NestJS 10, TypeScript, Prisma |
| Data | PostgreSQL |
| Jobs | Redis, BullMQ repeatable jobs |
| Realtime | Socket.io through a NestJS gateway |
| Extension | Chrome Manifest V3, React popup, content script, Chrome storage |
| Monorepo | pnpm workspaces |

## Architecture

```text
apps/web        React decision-board UI
apps/api        NestJS REST API, Socket.io gateway, Prisma, price worker
apps/extension  Chrome extension for one-click product capture
packages/shared Shared Zod schemas and domain enums
```

The core relationship is intentionally flat:

```text
User -> Workspace membership -> Workspace -> Products
                                         -> Activity events
Product -> Votes, comments, price history
```

The migration at [20260717020000_flatten_workspaces](/Users/himnish03/Documents/Projects/CartParty/apps/api/prisma/migrations/20260717020000_flatten_workspaces/migration.sql) moved existing products to their parent workspace and removed the old collections table without deleting product data.

## Local Development

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

Seeded demo login:

```text
maya@cartparty.dev / cartparty123
```

The seed is demo-only and resets local database content. It is not a production deployment step.

## Browser Extension

Build the extension:

```bash
pnpm --filter @cartparty/extension build
```

In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select [apps/extension/dist](/Users/himnish03/Documents/Projects/CartParty/apps/extension/dist).

The popup logs in, captures the active page's title, URL, hostname, and largest image, then saves the product to the selected workspace. It does not scrape prices.

## Interface System

The web interface is driven by [tokens.css](/Users/himnish03/Documents/Projects/CartParty/apps/web/src/tokens.css). It centralizes color, typography, spacing, radius, elevation, and motion.

- Space Grotesk is the display face; Hanken Grotesk serves UI text and tabular prices.
- Price tags are a notched, punched-card signature component. Orange is reserved for price drops.
- Activity is a receipt with dotted leaders and live-print behavior.
- The login screen uses a native CartParty bag animation rather than stock imagery.
- Loading, empty, recoverable error, reconnecting, and presence states are first-class UI states.

Domain records are not hardcoded into React. Workspace, product, vote, comment, price, activity, and user data comes from the authenticated API. [seed.ts](/Users/himnish03/Documents/Projects/CartParty/apps/api/prisma/seed.ts) is the local source of demo records.

## API Surface

```text
POST /auth/register
POST /auth/login
POST /auth/refresh

POST /workspaces
GET  /workspaces
GET  /workspaces/:id
POST /workspaces/:id/members

POST /workspaces/:id/products
GET  /workspaces/:id/products
PATCH /products/:id
DELETE /products/:id

POST   /products/:id/votes
DELETE /products/:id/votes
POST   /products/:id/comments
GET    /products/:id/comments
GET    /products/:id/price-history
GET    /workspaces/:id/activity

GET  /extension/workspaces
POST /extension/save
GET  /health
```

## Deployment

The recommended MVP topology is:

```text
Vercel (apps/web)
       |
       v
Render API (apps/api) <-> Render PostgreSQL
       |
       +-----------------> Render Key Value
GitHub Actions ---------> protected hourly price-scan trigger
```

### 1. Render infrastructure

The repository includes [render.yaml](/Users/himnish03/Documents/Projects/CartParty/render.yaml), a Render Blueprint that creates:

1. Managed PostgreSQL database.
2. Private Redis-compatible Key Value instance.
3. Free API web service with a `/health` check and Prisma migration pre-deploy step.
4. Shared generated JWT secrets for the API.

Push this repository to GitHub, then in Render select **New +** -> **Blueprint**, connect the repository, and approve the services in `render.yaml`. During creation, enter the final Vercel production URL when Render requests `FRONTEND_URL`. Render supplies `PORT`; do not set it manually.

The Blueprint is intentionally configured with `plan: free` for every Render resource. The API process handles BullMQ jobs directly; there is no paid Render background worker.

The Blueprint installs dependencies, builds the API, then applies pending migrations when the free API starts:

```bash
pnpm install --frozen-lockfile
pnpm --filter @cartparty/api prisma:generate
pnpm --filter @cartparty/api build
pnpm --filter @cartparty/api prisma:deploy && pnpm --filter @cartparty/api start:prod
```

Do not run `prisma:seed` against production.

### 2. Vercel web app

Import the repository into Vercel. [vercel.json](/Users/himnish03/Documents/Projects/CartParty/vercel.json) builds `apps/web` from the monorepo root and publishes `apps/web/dist`.

Set these Vercel build-time variables:

```text
VITE_API_URL=https://YOUR-API.onrender.com
VITE_WS_URL=https://YOUR-API.onrender.com
```

Redeploy the web app after changing either value because Vite embeds them at build time.

### 3. Production environment variables

The Blueprint automatically wires `DATABASE_URL`, `REDIS_URL`, `NODE_ENV`, and generated JWT secrets. `RUN_PRICE_SCHEDULER=false` is configured on the free API because Free instances sleep when idle. Instead, [price-scan.yml](/Users/himnish03/Documents/Projects/CartParty/.github/workflows/price-scan.yml) triggers the protected scan endpoint hourly.

Set this Vercel origin on the Render API service during Blueprint setup or afterward:

```text
FRONTEND_URL=https://YOUR-APP.vercel.app
PRICE_SCAN_SECRET=<long random secret, also stored as a GitHub Actions secret>
```

Add these GitHub Actions repository secrets after the Render API is live:

```text
CARTPARTY_API_URL=https://YOUR-API.onrender.com
CARTPARTY_PRICE_SCAN_SECRET=<same value as Render PRICE_SCAN_SECRET>
```

`FRONTEND_URL` must exactly match the deployed Vercel origin so REST and Socket.io requests pass origin checks. Use a separate staging environment with separate database, Redis, and secrets before production.

### 4. Release checklist

1. Run `pnpm typecheck` and `pnpm build`.
2. Deploy the Render Blueprint, allow migrations and API startup to finish, and verify `GET /health` returns `200`.
3. Add the two GitHub Actions secrets and manually run **Trigger price scan** once to verify the queue connects to Redis.
4. Deploy the Vercel web app with the final Render API URL.
5. Set `FRONTEND_URL` on Render to the final Vercel URL and restart the API if it was not known during Blueprint creation.
6. Verify registration, login, creating a workspace, saving a product, voting, commenting, WebSocket presence, and the extension against the production API.
7. Configure a custom domain, database backups, error monitoring, and uptime monitoring before inviting real users.

### Free-tier limitations

This topology is for a portfolio/demo MVP, not a production launch. Render Free web services spin down after 15 minutes without inbound HTTP or WebSocket traffic and can take about a minute to restart. Free Render Postgres expires after 30 days and Free Key Value is in-memory only. Upgrade before collecting real user data.

## Intentionally Out of Scope

- Budget tracking and forecasting
- Purchase assignment or ownership
- Threaded comments
- Product comparison tables
- Notifications beyond the in-app activity feed
- Email invitations and tokenized invite links for people without accounts

## Engineering Decisions

- Prisma provides generated types and fast migration iteration for the MVP.
- Vote upserts and the `(product_id, user_id)` unique constraint model one current decision per person rather than vote history.
- Price movement is intentionally mocked. Real retail scraping needs a separate reliability, legal, and terms-of-service design.
- WebSocket rooms are scoped by workspace. Connections authenticate first; joins then verify membership.
