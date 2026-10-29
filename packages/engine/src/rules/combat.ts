import { rollDice, rollD20 } from "../dice";
import type { RngState } from "../rng";
import type { Character } from "../model/character";
import { attributeMod, equippedItemId } from "../model/character";
import type { World } from "../world";
import type { Combatant, Encounter } from "../model/campaign";

export function characterDefense(world: World, c: Character): number {
  let def = 10 + attributeMod(c.attributes.agility);
  const armorId = equippedItemId(c, "armor");
  const shieldId = equippedItemId(c, "shield");
  if (armorId) def += world.items.get(armorId)?.defense ?? 0;
  if (shieldId) def += world.items.get(shieldId)?.defense ?? 0;
  if (c.conditions.includes("defending")) def += 3;
  if (c.conditions.includes("collapsed")) def -= 4;
  return def;
}

export interface WeaponProfile {
  name: string;
  damage: string;
  skill: "melee" | "archery";
}

export function characterWeapon(world: World, c: Character): WeaponProfile {
  const weaponId = equippedItemId(c, "weapon");
  const item = weaponId ? world.items.get(weaponId) : undefined;
  if (item && item.damage) return { name: item.name, damage: item.damage, skill: item.skill ?? "melee" };
  return { name: "bare hands", damage: "1d3", skill: "melee" };
}

export function damageBonus(c: Character, skill: "melee" | "archery"): number {
  return skill === "melee" ? Math.max(0, Math.floor(attributeMod(c.attributes.might) / 2)) : 0;
}

export function makeCombatant(world: World, creatureId: string, index: number): Combatant {
  const creature = world.creatures.get(creatureId);
  if (!creature) throw new Error(`Unknown creature "${creatureId}"`);
  return {
    id: `enemy-${index}`,
    creatureId,
    name: index > 1 ? `${creature.name} ${index}` : creature.name,
    vitality: { current: creature.vitality, max: creature.vitality },
    defense: creature.defense,
    alive: true,
  };
}

export function rollInitiative(
  rng: RngState,
  world: World,
  party: Character[],
  enemies: Combatant[],
  surprise: Encounter["surprise"],
): { order: { id: string; name: string; value: number }[]; rng: RngState } {
  let cursor = rng;
  const rolls: { id: string; name: string; value: number }[] = [];
  for (const c of party) {
    const d = rollD20(cursor);
    cursor = d.rng;
    rolls.push({ id: c.id, name: c.name, value: d.value + attributeMod(c.attributes.agility) + (surprise === "party" ? 10 : 0) });
  }
  for (const e of enemies) {
    const creature = world.creatures.get(e.creatureId)!;
    const d = rollD20(cursor);
    cursor = d.rng;
    rolls.push({ id: e.id, name: e.name, value: d.value + attributeMod(creature.agility) + (surprise === "enemies" ? 10 : 0) });
  }
  rolls.sort((a, b) => b.value - a.value);
  return { order: rolls, rng: cursor };
}

export function rollDamage(rng: RngState, expression: string, bonus: number): { amount: number; rng: RngState } {
  const r = rollDice(rng, expression);
  return { amount: Math.max(1, r.roll.total + bonus), rng: r.rng };
}

/** Enemies pick the living party member with the lowest current vitality share, mildly randomised. */
export function pickTarget(rng: RngState, party: Character[]): { target: Character | undefined; rng: RngState } {
  const alive = party.filter((c) => c.alive && !c.conditions.includes("collapsed"));
  const pool = alive.length ? alive : party.filter((c) => c.alive);
  if (pool.length === 0) return { target: undefined, rng };
  const d = rollD20(rng);
  const sorted = [...pool].sort((a, b) => a.vitality.current / a.vitality.max - b.vitality.current / b.vitality.max);
  const target = d.value <= 12 ? sorted[0] : pool[d.value % pool.length];
  return { target, rng: d.rng };
}
