import { nextInt, type RngState } from "./rng";

/** A dice expression such as "1d8", "2d6+2", "d20", "3". */
export interface DiceSpec {
  count: number;
  sides: number;
  modifier: number;
}

export interface DiceRoll {
  expression: string;
  rolls: number[];
  modifier: number;
  total: number;
}

const DICE_RE = /^\s*(\d*)d(\d+)\s*([+-]\s*\d+)?\s*$/i;

export function parseDice(expression: string): DiceSpec {
  const trimmed = expression.trim();
  if (/^-?\d+$/.test(trimmed)) return { count: 0, sides: 0, modifier: parseInt(trimmed, 10) };
  const m = DICE_RE.exec(trimmed);
  if (!m) throw new Error(`Bad dice expression: "${expression}"`);
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = parseInt(m[2]!, 10);
  const modifier = m[3] ? parseInt(m[3].replace(/\s+/g, ""), 10) : 0;
  if (count < 0 || count > 100 || sides < 1 || sides > 1000) {
    throw new Error(`Dice out of range: "${expression}"`);
  }
  return { count, sides, modifier };
}

export function formatDice(spec: DiceSpec): string {
  if (spec.count === 0) return String(spec.modifier);
  const mod = spec.modifier === 0 ? "" : spec.modifier > 0 ? `+${spec.modifier}` : `${spec.modifier}`;
  return `${spec.count}d${spec.sides}${mod}`;
}

export function rollDice(rng: RngState, expression: string | DiceSpec): { roll: DiceRoll; rng: RngState } {
  const spec = typeof expression === "string" ? parseDice(expression) : expression;
  const rolls: number[] = [];
  let cursor = rng;
  for (let i = 0; i < spec.count; i++) {
    const r = nextInt(cursor, 1, spec.sides);
    rolls.push(r.value);
    cursor = r.rng;
  }
  const total = rolls.reduce((a, b) => a + b, 0) + spec.modifier;
  return { roll: { expression: formatDice(spec), rolls, modifier: spec.modifier, total }, rng: cursor };
}

export function rollD20(rng: RngState): { value: number; rng: RngState } {
  const r = nextInt(rng, 1, 20);
  return { value: r.value, rng: r.rng };
}
