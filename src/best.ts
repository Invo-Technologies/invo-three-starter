/** The player's best round on this device. */
const KEY = "shardarena.best";

export function readBest(): number {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Saves `score` if it beats the record. Returns true for a new best. */
export function recordBest(score: number): boolean {
  if (score <= readBest()) return false;
  try {
    localStorage.setItem(KEY, String(score));
  } catch {
    /* private mode */
  }
  return true;
}
