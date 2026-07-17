# CartParty Design Document

## Product Positioning

CartParty helps groups decide what to buy together. The product should feel like a collaborative decision workspace, not a wishlist, shopping feed, or personal bookmark manager.

## Core User Flow

1. A user creates or joins a workspace.
2. The workspace is the purchase context, such as "Kitchen Reset" or "Cabin Trip".
3. Members add products manually or through the browser extension.
4. The group votes, comments, and watches activity update in realtime.
5. Mocked price checks update product history and surface price drops.

## Information Architecture

- Workspace sidebar: workspace switching.
- Main surface: workspace header, add-product action, product decision cards.
- Right rail: activity feed and selected product detail.
- Product detail: notes, comments, and price history.
- Extension popup: login, captured product preview, workspace picker, save.

## Visual System

CartParty uses a decisive retail workspace rather than a wishlist aesthetic. The complete system lives in `apps/web/src/tokens.css`; components do not own independent color, radius, spacing, type, or motion values.

Core palette roles:

- Near-white canvas and white panels keep the workspace neutral.
- Electric blue marks actions, selection, and active navigation.
- Saturated green is reserved for positive votes.
- Red is reserved for pass votes and recoverable errors.
- Orange is reserved exclusively for price-drop data.

Space Grotesk carries workspace and product headings. Hanken Grotesk carries UI copy, controls, and tabular price data. The type system is intentionally limited to five sizes. Product cards use a 10px radius, a one-pixel border, and no shadow. Only the open product detail receives elevation.

## Signature Components

Every price is rendered as a physical tag rather than a generic badge. The tag has a notched edge, punch-hole detail, tabular numbers, and a compact price-drop delta when the latest history point is lower.

Workspace activity is rendered as a running receipt. Rows use timestamps, dotted leaders, actor alignment, and a perforated top edge. New WebSocket events print into the top of the receipt.

These two devices carry the visual personality; the surrounding board, sidebar, and controls stay restrained.

## Responsive Layout

Desktop uses a narrow workspace sidebar, a two-column product board, and a right rail containing product detail and activity. At intermediate widths the right rail becomes a two-column band below the board. Mobile turns workspaces into a horizontal scroller, uses one product column, and stacks detail above activity. Fixed card media ratios and tabular vote counts prevent data changes from shifting the layout.

## Trust States

- Loading uses card-shaped skeletons matching the final grid.
- Empty workspaces invite the first concrete product addition.
- API failures explain what failed and expose a retry action.
- Socket disconnects surface a reconnecting banner.
- Presence comes from authenticated active WebSocket connections, not a hardcoded member list.

## Realtime Model

Clients authenticate the Socket.io handshake and emit `join_workspace` with the active workspace ID. The gateway verifies workspace membership before joining `workspace:{id}` and emits live presence from active socket connections. Product collaboration events use the same room:

- `product:added`
- `vote:updated`
- `comment:added`
- `price:updated`
- `activity:new`
- `presence:updated`

The web app refreshes affected workspace data after vote, comment, and price events. This keeps the MVP simple while preserving realtime feedback.

## Data Source Boundary

The frontend contains interface copy and image presentation rules, but no demo workspace, product, price, vote, comment, activity, or user records. All domain content arrives through API responses. Local development data is centralized in `apps/api/prisma/seed.ts`, where three workspaces, twelve products, comments, uneven votes, and multi-week price histories are generated into PostgreSQL. Replacing the seed with user-created records requires no UI change.

## Data Model

The schema follows the MVP spec:

- Users own workspaces and can be workspace members.
- Workspaces contain products.
- Products have votes, flat comments, and price history.
- Activity events store derived collaboration history with JSON metadata.

## Price Tracking

The `price-check` queue runs an hourly scan. For MVP, the worker applies deterministic fake price movement to products with a URL and current price. When the price changes, it records history, updates the product, emits `price:updated`, and creates a `price_dropped` activity event if the new price is lower.

## Extension Design

The extension is intentionally minimal:

- Content script captures title, URL, hostname, and the largest page image.
- Popup handles login and stores the JWT in Chrome local storage.
- Popup loads lightweight workspace data and posts to `/extension/save`.
- No price scraping happens during save.

## Deployment Design

Use Vercel for the web app and Render for backend infrastructure. The Render Blueprint provisions separate API and BullMQ worker services alongside managed PostgreSQL and Redis-compatible Key Value, with private connection strings injected into both services.
