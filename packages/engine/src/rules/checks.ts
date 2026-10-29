import { rollD20 } from "../dice";
import type { RngState } from "../rng";
import type { Character } from "../model/character";
import { attributeMod } from "../model/character";
import { SKILL_ATTRIBUTE, type SkillId } from "../world/schema";
import type { RollEvent } from "../actions/types";

/** Named difficulty bands the narrator and UI share. */
export const DIFFICULTY = {
  trivial: 8,
  easy: 12,
  moderate: 16,
  hard: 20,
  heroic: 25,
  legendary: 30,
} as const;
export type DifficultyName = keyof typeof DIFFICULTY;

export function difficultyName(target: number): DifficultyName {
  if (target <= 8) return "trivial";
  if (target <= 12) return "easy";
  if (target <= 16) return "moderate";
  if (target <= 20) return "hard";
  if (target <= 25) return "heroic";
  return "legendary";
}

/** d20 + attribute mod + 2 x skill rank, with 1 and 20 as criticals. */
export function skillBonus(c: Character, skill: SkillId): number {
  const attr = SKILL_ATTRIBUTE[skill];
  let bonus = attributeMod(c.attributes[attr]) + c.skills[skill] * 2;
  if (c.conditions.includes("wounded")) bonus -= 2;
  if (c.conditions.includes("exhausted")) bonus -= 2;
  if (c.conditions.includes("collapsed")) bonus -= 5;
  return bonus;
}

export function makeCheck(
  rng: RngState,
  c: Character,
  skill: SkillId,
  target: number,
  label: string,
  extraBonus = 0,
): { event: RollEvent; rng: RngState } {
  const d = rollD20(rng);
  const bonus = skillBonus(c, skill) + extraBonus;
  const total = d.value + bonus;
  const natural = d.value;
  const critical = natural === 20 ? "hit" : natural === 1 ? "miss" : undefined;
  const success = critical === "hit" ? true : critical === "miss" ? false : total >= target;
  return {
    rng: d.rng,
    event: {
      type: "roll",
      characterId: c.id,
      label,
      roll: { expression: "1d20", rolls: [natural], modifier: 0, total: natural },
      bonus,
      total,
      target,
      success,
      margin: total - target,
      ...(critical ? { critical } : {}),
    },
  };
}
