/** XP needed to reach each level (index = level). Level 1 needs 0. */
export const LEVEL_XP = [0, 0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];
export const MAX_LEVEL = LEVEL_XP.length - 1;

export function levelForXp(xp: number): number {
  let level = 1;
  for (let l = 2; l <= MAX_LEVEL; l++) if (xp >= LEVEL_XP[l]!) level = l;
  return level;
}

export function xpToNext(xp: number): number | undefined {
  const level = levelForXp(xp);
  if (level >= MAX_LEVEL) return undefined;
  return LEVEL_XP[level + 1]! - xp;
}
