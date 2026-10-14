/**
 * The game's rules, kept free of Three.js so they are easy to test and change: a round
 * timer, the arena's collision, where shards may appear, and how far the magnet reaches.
 */
export const ROUND_SECONDS = 45;
export const ARENA_RADIUS = 13;
export const PLAYER_RADIUS = 0.55;
export const MAX_MAGNET = 3;

export interface Circle {
  x: number;
  z: number;
  r: number;
}

/** The arena's pillars. */
export const PILLARS: Circle[] = [
  { x: 6, z: 0, r: 1.1 },
  { x: -6, z: 0, r: 1.1 },
  { x: 0, z: 6, r: 1.1 },
  { x: 0, z: -6, r: 1.1 },
];

/** How close a shard must be to be collected. Each Shard Magnet adds reach. */
export function pickupRadius(magnets: number): number {
  const level = Math.max(0, Math.min(MAX_MAGNET, Math.floor(magnets)));
  return 0.9 + level * 0.75;
}

/** Push a circle out of the pillars and keep it inside the arena. Returns the new position. */
export function resolveCollision(x: number, z: number, r: number = PLAYER_RADIUS, pillars: Circle[] = PILLARS): { x: number; z: number } {
  for (const p of pillars) {
    const dx = x - p.x;
    const dz = z - p.z;
    const d = Math.hypot(dx, dz);
    const min = p.r + r;
    if (d < min) {
      const nx = d > 1e-6 ? dx / d : 1;
      const nz = d > 1e-6 ? dz / d : 0;
      x = p.x + nx * min;
      z = p.z + nz * min;
    }
  }
  const limit = ARENA_RADIUS - r;
  const fromCentre = Math.hypot(x, z);
  if (fromCentre > limit) {
    x = (x / fromCentre) * limit;
    z = (z / fromCentre) * limit;
  }
  return { x, z };
}

/** A random point a shard may appear at: inside the arena, clear of pillars and the player. */
export function spawnPoint(random: () => number, avoid: { x: number; z: number }, minGap = 3): { x: number; z: number } {
  for (let attempt = 0; attempt < 50; attempt++) {
    const a = random() * Math.PI * 2;
    const d = Math.sqrt(random()) * (ARENA_RADIUS - 1.5);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const clearOfPillars = PILLARS.every((p) => Math.hypot(x - p.x, z - p.z) > p.r + 1);
    if (clearOfPillars && Math.hypot(x - avoid.x, z - avoid.z) > minGap) return { x, z };
  }
  return { x: 0, z: ARENA_RADIUS / 2 };
}

/** A countdown that only runs while the game is not paused. */
export class RoundClock {
  private elapsed = 0;
  constructor(readonly seconds = ROUND_SECONDS) {}
  tick(dt: number): void {
    this.elapsed = Math.min(this.seconds, this.elapsed + Math.max(0, dt));
  }
  get left(): number {
    return this.seconds - this.elapsed;
  }
  get progress(): number {
    return this.elapsed / this.seconds;
  }
  get over(): boolean {
    return this.elapsed >= this.seconds;
  }
}

/** Watches typed keys for a word (case-insensitive). Returns true on the key that completes it. */
export function wordWatcher(word: string): (key: string) => boolean {
  const target = word.toLowerCase();
  let typed = "";
  return (key) => {
    typed = (typed + key.toLowerCase()).slice(-target.length);
    return typed === target;
  };
}
