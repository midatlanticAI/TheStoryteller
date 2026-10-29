import type { AttributeBlock, AttributeId, SkillId } from "../world/schema";
import { ATTRIBUTES, SKILLS } from "../world/schema";
import type { World } from "../world";

export type Controller = { kind: "player"; playerId: string } | { kind: "ai" };

export interface ItemInstance {
  instanceId: string;
  itemId: string;
  qty: number;
}

export interface Character {
  id: string;
  name: string;
  speciesId: string;
  archetypeId: string;
  controller: Controller;
  attributes: AttributeBlock;
  skills: Record<SkillId, number>;
  vitality: { current: number; max: number };
  /** Magic strain. At max the character collapses. */
  strain: { current: number; max: number };
  conditions: string[];
  inventory: ItemInstance[];
  equipped: { weapon?: string; armor?: string; shield?: string; talisman?: string };
  magicSourceIds: string[];
  xp: number;
  level: number;
  unspentSkillPoints: number;
  /** Free text the player or narrator keeps: background, bonds, scars. */
  background: string;
  alive: boolean;
}

export const DEFAULT_ATTRIBUTES: AttributeBlock = {
  might: 5,
  agility: 5,
  vigor: 5,
  wits: 5,
  will: 5,
  presence: 5,
};

export function emptySkills(): Record<SkillId, number> {
  const out = {} as Record<SkillId, number>;
  for (const s of SKILLS) out[s] = 0;
  return out;
}

export function maxVitality(attributes: AttributeBlock, level: number): number {
  return 10 + attributes.vigor * 2 + (level - 1) * 3;
}

export function maxStrain(attributes: AttributeBlock, level: number): number {
  return 4 + attributes.will + Math.floor((level - 1) / 2);
}

export function attributeMod(value: number): number {
  return value - 5;
}

export interface NewCharacterInput {
  id: string;
  name: string;
  speciesId: string;
  archetypeId: string;
  controller: Controller;
  /** Base attributes before species mods. Defaults to all 5s. */
  attributes?: Partial<AttributeBlock>;
  background?: string;
}

function clampAttr(n: number): number {
  return Math.max(1, Math.min(12, n));
}

/** Builds a level-1 character from a species and an archetype of the world. */
export function createCharacter(world: World, input: NewCharacterInput): Character {
  const species = world.species.get(input.speciesId);
  if (!species) throw new Error(`Unknown species "${input.speciesId}"`);
  const archetype = world.archetypes.get(input.archetypeId);
  if (!archetype) throw new Error(`Unknown archetype "${input.archetypeId}"`);
  if (archetype.speciesAllowed && !archetype.speciesAllowed.includes(species.id)) {
    throw new Error(`${archetype.name} is not open to ${species.plural}`);
  }
  const attributes = { ...DEFAULT_ATTRIBUTES, ...input.attributes } as AttributeBlock;
  for (const a of ATTRIBUTES as readonly AttributeId[]) {
    attributes[a] = clampAttr(attributes[a] + (species.attributeMods[a] ?? 0));
  }
  const skills = emptySkills();
  for (const [skill, rank] of Object.entries(archetype.skills) as [SkillId, number][]) skills[skill] = rank;

  const inventory: ItemInstance[] = archetype.startingItemIds.map((itemId, i) => ({
    instanceId: `${input.id}-item-${i + 1}`,
    itemId,
    qty: 1,
  }));
  const equipped: Character["equipped"] = {};
  for (const inst of inventory) {
    const item = world.items.get(inst.itemId);
    if (!item) continue;
    if (item.kind === "weapon" && !equipped.weapon) equipped.weapon = inst.instanceId;
    if (item.kind === "armor" && !equipped.armor) equipped.armor = inst.instanceId;
    if (item.kind === "shield" && !equipped.shield) equipped.shield = inst.instanceId;
    if (item.kind === "talisman" && !equipped.talisman) equipped.talisman = inst.instanceId;
  }
  const magicSourceIds = archetype.magicSourceIds.filter((id) => species.magicAffinity.includes(id));
  const level = 1;
  return {
    id: input.id,
    name: input.name,
    speciesId: species.id,
    archetypeId: archetype.id,
    controller: input.controller,
    attributes,
    skills,
    vitality: { current: maxVitality(attributes, level), max: maxVitality(attributes, level) },
    strain: { current: 0, max: maxStrain(attributes, level) },
    conditions: [],
    inventory,
    equipped,
    magicSourceIds,
    xp: 0,
    level,
    unspentSkillPoints: 0,
    background: input.background ?? "",
    alive: true,
  };
}

export function findItemInstance(c: Character, instanceId: string): ItemInstance | undefined {
  return c.inventory.find((i) => i.instanceId === instanceId);
}

export function equippedItemId(c: Character, slot: keyof Character["equipped"]): string | undefined {
  const inst = c.equipped[slot];
  if (!inst) return undefined;
  return findItemInstance(c, inst)?.itemId;
}
