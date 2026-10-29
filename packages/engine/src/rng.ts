/**
 * Deterministic, serialisable random source.
 *
 * Every roll in a campaign comes from here so a campaign can be replayed from
 * its seed and action log. The state is a single 32-bit integer, which is kept
 * inside the campaign save and advanced on every draw.
 */
export interface RngState {
  seed: number;
  state: number;
  draws: number;
}

export function createRng(seed: number | string): RngState {
  const s = typeof seed === "string" ? hashString(seed) : seed >>> 0;
  return { seed: s, state: s || 0x9e3779b9, draws: 0 };
}

export function hashString(input: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: returns the next float in [0,1) and the advanced state. */
export function nextFloat(rng: RngState): { value: number; rng: RngState } {
  let t = (rng.state + 0x6d2b79f5) >>> 0;
  const state = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, rng: { ...rng, state, draws: rng.draws + 1 } };
}

/** Integer in [min, max], inclusive. */
export function nextInt(rng: RngState, min: number, max: number): { value: number; rng: RngState } {
  const { value, rng: next } = nextFloat(rng);
  return { value: min + Math.floor(value * (max - min + 1)), rng: next };
}

/** Picks one entry by weight. Returns undefined for an empty table. */
export function pickWeighted<T>(
  rng: RngState,
  entries: ReadonlyArray<{ weight: number; item: T }>,
): { value: T | undefined; rng: RngState } {
  const total = entries.reduce((sum, e) => sum + Math.max(0, e.weight), 0);
  if (total <= 0) return { value: undefined, rng };
  const { value, rng: next } = nextFloat(rng);
  let cursor = value * total;
  for (const entry of entries) {
    cursor -= Math.max(0, entry.weight);
    if (cursor < 0) return { value: entry.item, rng: next };
  }
  return { value: entries[entries.length - 1]?.item, rng: next };
}
