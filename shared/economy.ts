/**
 * INVO: your game's economy, in one place. The server enforces it (prices, limits, who owns
 * what) and the browser shows it, so edit it here and both sides agree.
 *
 * - PREMIUM currency ("Gems") is your game's INVO currency. Players buy it with real money
 *   through INVO's hosted checkout; INVO holds it. Its name should match the currency you
 *   created in the INVO console.
 * - SOFT currency ("Shards") is earned by playing and kept in your server's own ledger.
 * - Items cost one or the other. When a player spends Gems, INVO splits the sale 90% to
 *   you and 10% to INVO automatically; nothing here needs to do that maths.
 */
import type { GameEconomyConfig } from "@invonetwork/web-sdk/game";

/** Item ids the game code checks. Keep them in sync with `items` below. */
export const ITEMS = {
  /** Premium cosmetic: a halo of light that floats above the player. */
  crown: "crown_of_light",
  /** Soft upgrade: pulls shards in from further away, stacks up to 3. */
  magnet: "shard_magnet",
} as const;

export const economy: GameEconomyConfig = {
  premium: {
    name: "Gems",
    packs: [
      { id: "gems_small", name: "Handful of Gems", usdAmount: "0.99", amount: 100 },
      { id: "gems_large", name: "Chest of Gems", usdAmount: "4.99", amount: 550, badge: "Best value" },
    ],
  },
  soft: {
    name: "Shards",
    startingBalance: 20,
  },
  items: [
    {
      id: ITEMS.crown,
      name: "Crown of Light",
      description: "A golden halo that floats above you. Purely cosmetic.",
      category: "cosmetic",
      currency: "premium",
      price: 80,
      color: "#F4C04A",
      icon: "♛",
    },
    {
      id: ITEMS.magnet,
      name: "Shard Magnet",
      description: "Pulls shards in from further away. Stacks up to 3.",
      category: "upgrade",
      currency: "soft",
      price: 25,
      maxOwned: 3,
      color: "#3FD0C9",
      icon: "◎",
    },
  ],
};
