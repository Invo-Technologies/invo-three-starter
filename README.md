# Shard Arena: a Three.js starter with INVO built in

[![Open in Replit](https://replit.com/badge?caption=Open%20in%20Replit)](https://replit.com/github.com/Invo-Technologies/invo-three-starter)

A minimal, forkable 3D arena game in **Three.js + TypeScript** with INVO's game economy already wired in:

- a wallet in two currencies
- **Gems** sold through INVO's hosted checkout
- an item shop whose purchases **appear on your drone**
- **Shards** earned by playing
- loyalty events

Press **Run** and it works. No keys, no setup.

The gameplay is deliberately small: fly your drone around the arena and collect shards before the clock runs out. It's a starting point; replace it with your game.

## What's in the box

| | |
|---|---|
| **3D scene** | Arena, pillars, lighting with shadows, and bloom on the glowing edges. All built in code: no model files. |
| **Player controller** | WASD, the arrow keys, or an on-screen stick on touch screens. Collision with pillars and the arena wall. |
| **Asset loader** | `src/assets.ts`: drop `.glb` files in `public/models/` and list them, with a progress bar on the loading screen. |
| **Wallet HUD** | Gems and Shards, live from the server, at the top right. |
| **Shop** | The Crown of Light (Gems) floats above your drone. The Shard Magnet (Shards, stacks to 3) widens your pickup reach, shown as rings on the floor. Both appear and disappear in the world through `InvoItemAttachments`. |
| **Buying Gems** | INVO's hosted checkout. The wallet is credited only by INVO's signed webhook, exactly once. |
| **Screens** | Loading, Menu, the in-game HUD, Results and a Loadout close-up. |

## Run it

**On Replit:** press **Run**. The first start registers your copy with INVO's demo sandbox and prints its project ID.

**Locally:**

```bash
npm install
npm run dev   # http://localhost:3000
```

Locally everything works except crediting Gems from checkout: the demo sandbox delivers webhooks only to Replit addresses (`*.replit.app`, `*.replit.dev`, `*.repl.co`), so test checkout on Replit.

## The demo sandbox

Out of the box the game uses INVO's **public demo key**, which is in `server/invo.ts`:

- It's safe to keep in the code: it only reaches a sandbox-locked demo app and is refused in production.
- Players are fictional, and phone numbers are never sent to INVO.
- Payments use test cards only, for example `4242 4242 4242 4242` with any future expiry and any CVC. No real money moves.

## Going live

1. Create your game in the [INVO console](https://console.invo.network) and copy its **game secret** and **webhook signing secret**.
2. In Replit, open **Tools → Secrets** and add `INVO_GAME_SECRET` and `INVO_WEBHOOK_SECRET`.
3. In the INVO console, set the webhook URL to `https://<your-app>.replit.app/api/invo/webhook`.
4. Add a PostgreSQL database (`DATABASE_URL`) so the ledger survives redeploys, then **Deploy**.

No code changes: the SDK picks production from your key, and your copy's project ID links it to your INVO account.

## Make it yours

| To change | Edit |
|---|---|
| Currencies, Gem packs, shop items and prices | `shared/economy.ts` |
| How items look in the world | `src/items.ts` |
| The arena, lights and bloom | `src/world.ts` |
| The drone and movement | `src/player.ts`, `src/input.ts` |
| Rules: round length, collision, magnet reach | `src/logic.ts` |
| Screens and styling | `src/screens.ts`, `src/styles.css` |

Every INVO touchpoint is marked with an `INVO:` comment. The agent-readable map is [replit.md](./replit.md).

Built on [`@invonetwork/three`](https://www.npmjs.com/package/@invonetwork/three) and [`@invonetwork/web-sdk`](https://www.npmjs.com/package/@invonetwork/web-sdk). Docs: https://docs.invo.network

MIT licensed. Make it your own.
