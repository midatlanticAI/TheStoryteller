import type { Campaign } from "../model/campaign";
import type { World, Location } from "../world";
import { nextFloat, pickWeighted, type RngState } from "../rng";
import { rollDice } from "../dice";

export const WATCHES_PER_DAY = 4;

export function advanceWatches(c: Campaign, watches: number): { day: number; watch: number } {
  const total = c.watch + watches;
  return { day: c.day + Math.floor(total / WATCHES_PER_DAY), watch: total % WATCHES_PER_DAY };
}

export function watchName(watch: number): string {
  return ["dawn", "day", "dusk", "night"][watch] ?? "day";
}

/** Chance of an encounter per day of travel at a location. */
export function encounterChance(loc: Location, attention: number): number {
  return Math.min(0.9, loc.dangerTier * 0.12 + Math.min(0.3, attention / 100));
}

export function rollEncounter(
  rng: RngState,
  world: World,
  loc: Location,
  attention: number,
): { creatureIds: string[]; rng: RngState } {
  const eligible = loc.encounters.filter((e) => attention >= e.minAttention);
  if (eligible.length === 0) return { creatureIds: [], rng };
  const chance = nextFloat(rng);
  if (chance.value > encounterChance(loc, attention)) return { creatureIds: [], rng: chance.rng };
  const picked = pickWeighted(
    chance.rng,
    eligible.map((e) => ({ weight: e.weight, item: e })),
  );
  if (!picked.value) return { creatureIds: [], rng: picked.rng };
  const count = rollDice(picked.rng, picked.value.count);
  const n = Math.max(1, Math.min(6, count.roll.total));
  return { creatureIds: Array.from({ length: n }, () => picked.value!.creatureId), rng: count.rng };
}
