# Shard Arena: guide for coding agents

A Three.js + TypeScript game with INVO's economy wired in. Read this before changing anything that touches money.

## Run, build, test

- `npm run dev`: one server on `PORT` (default 3000), Vite with hot reload, INVO routes at `/api/invo`.
- `npm run build`, then `npm start`: production.
- `npm test` and `npm run typecheck` must pass after every change.

## Rules that must not be broken

1. **Secrets stay on the server.** `INVO_GAME_SECRET` and `INVO_WEBHOOK_SECRET` live in Replit Secrets and are read only in `server/`.
   - Never import `server/` from `src/`.
   - Never commit `.invo/`.
2. **The server decides balances and ownership.** In the browser, read `economy.wallet`, `economy.owns(id)` and `economy.quantity(id)`.
3. **Gems are credited only by INVO's signed webhook** (`POST /api/invo/webhook`). Never credit from a checkout return URL.
4. **Prices and items come from `shared/economy.ts`.**
5. **Keep the demo key working.** `INVO_DEMO_KEY` in `server/invo.ts` is public by design. Going live means setting the two Secrets, and nothing else.

## Where INVO is wired in (search for `INVO:` comments)

| File | What it does |
|---|---|
| `server/invo.ts` | Demo key, `registerProject` on every start, `invoGameServerFromEnv` |
| `server/app.ts` | Mounts the INVO routes and serves the game |
| `server/store.ts` | The ledger: Postgres if `DATABASE_URL` is set, else `.data/` |
| `shared/economy.ts` | Currencies, Gem packs, items |
| `src/main.ts` | `installInvo(...)`, the pause while dialogs are open, `economy.earn(...)`, the loyalty event |
| `src/items.ts` | `InvoItemAttachments`: purchases appearing on the drone and the floor |
| `src/first-sale.ts` | The one-time "first sale" card shown to the builder in the sandbox |

## Common tasks

- **New item that appears in the world:** add it to `shared/economy.ts`, then call `.define(itemId, (ctx) => object3D)` in `src/items.ts`.
  - Attach worn things to `player.body`.
  - Attach floor effects to `player.anchor`.
  - The object is created when the server confirms ownership, rebuilt when the quantity changes, and disposed on sign-out.
- **Earn currency:** `economy.earn(amount, "reason")`. It is batched and rate-limited by the server.
- **Open the shop or Gem packs:** `invo.ui?.openShop(category)` or `invo.ui?.openBuyCurrency()`.
- **Pause during INVO dialogs:** check `invo.paused` in the loop. It is already done for movement and the clock.
- **Load a model:** add `{ key, url }` to `MODELS` in `src/assets.ts` and use `model(key)`.

Package docs: `node_modules/@invonetwork/three/INTEGRATION.md`.
