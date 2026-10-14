import { describe, expect, it } from "vitest";
import { ARENA_RADIUS, MAX_MAGNET, PILLARS, PLAYER_RADIUS, RoundClock, pickupRadius, resolveCollision, spawnPoint, wordWatcher } from "../src/logic.js";
import { economy, ITEMS } from "../shared/economy.js";

describe("collision", () => {
  it("pushes the player out of a pillar", () => {
    const p = PILLARS[0]!;
    const out = resolveCollision(p.x + 0.2, p.z);
    expect(Math.hypot(out.x - p.x, out.z - p.z)).toBeCloseTo(p.r + PLAYER_RADIUS, 5);
  });

  it("keeps the player inside the arena", () => {
    const out = resolveCollision(100, 0);
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(ARENA_RADIUS - PLAYER_RADIUS, 5);
  });

  it("leaves a free position alone", () => {
    expect(resolveCollision(1, 2)).toEqual({ x: 1, z: 2 });
  });
});

describe("shards and the magnet", () => {
  it("spawns shards inside the arena, clear of pillars and away from the player", () => {
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 200; i++) {
      const s = spawnPoint(random, { x: 0, z: 3 });
      expect(Math.hypot(s.x, s.z)).toBeLessThan(ARENA_RADIUS);
      for (const p of PILLARS) expect(Math.hypot(s.x - p.x, s.z - p.z)).toBeGreaterThan(p.r);
    }
  });

  it("reaches further with each Shard Magnet, up to the shop limit", () => {
    expect(pickupRadius(1)).toBeGreaterThan(pickupRadius(0));
    expect(pickupRadius(99)).toBe(pickupRadius(MAX_MAGNET));
    expect(economy.items.find((i) => i.id === ITEMS.magnet)?.maxOwned).toBe(MAX_MAGNET);
    expect(economy.items.find((i) => i.id === ITEMS.crown)?.currency).toBe("premium");
  });
});

describe("RoundClock", () => {
  it("counts down and stops at zero", () => {
    const clock = new RoundClock(2);
    clock.tick(1.5);
    expect(clock.left).toBeCloseTo(0.5);
    expect(clock.over).toBe(false);
    clock.tick(5);
    expect(clock.over).toBe(true);
    expect(clock.progress).toBe(1);
  });
});

describe("wordWatcher", () => {
  it("fires on the key that completes the word", () => {
    const typed = wordWatcher("invo");
    expect(["x", "I", "n", "v"].map(typed)).toEqual([false, false, false, false]);
    expect(typed("o")).toBe(true);
  });
});
